import {Readable} from 'node:stream'
import {PauseException,SignatureEvidence} from './core.js'
import {withNetworkRetry} from './resilience.js'

const ORIGIN='https://sivisa.saude.sp.gov.br'

export class PlaywrightPortal{
    constructor({passwordFor,log=()=>{}}={}){
        this.passwordFor=passwordFor
        this.log=log
        this.browser=null
        this.context=null
        this.page=null
        this.currentLogin=null
        this.currentName=null
        this.identities={}
        this.procedures=new Map()
        this.chromium=null
    }

    async ensureBrowser(){
        if(this.browser)return
        try{
            const playwright=await import('playwright')
            this.chromium=playwright.chromium
        }catch{
            throw new PauseException('Playwright não está instalado neste servidor. Execute npm install e playwright install chromium.')
        }
        try{
            this.browser=await this.chromium.launch({headless:process.env.ASSINADOR_HEADED!=='true'})
        }catch(error){
            throw new PauseException(`Não foi possível abrir o navegador do Assinador. Confira o Chromium do Playwright neste servidor. ${String(error?.message||error).slice(0,240)}`)
        }
    }

    async dispose(){
        await this.context?.close().catch(()=>{})
        await this.browser?.close().catch(()=>{})
        this.context=null
        this.page=null
        this.browser=null
        this.currentLogin=null
        this.currentName=null
    }

    async prepare(signers,signal){
        this.identities={}
        for(const signer of signers){
            const password=await this.passwordFor(signer)
            if(!password)throw new PauseException(`O login ${signer.login} (${signer.name}) está sem senha cadastrada. Edite o fiscal e informe a senha.`,{kind:'EditSigner',login:signer.login,name:signer.name})
        }
        for(const signer of signers){
            this.log?.(`Validando cadastro e credencial de ${signer.name}…`)
            await this.login(signer,signal)
        }
        const names=Object.values(this.identities)
        if(new Set(names.map(name=>name.toLowerCase())).size!==signers.length){
            throw new PauseException('Os logins selecionados correspondem a nomes ambíguos no SIVISA.')
        }
    }

    async resetSession(){
        await this.ensureBrowser()
        await this.context?.close().catch(()=>{})
        this.context=await this.browser.newContext({ignoreHTTPSErrors:false,acceptDownloads:true})
        this.page=await this.context.newPage()
        this.page.setDefaultTimeout(60_000)
        this.lastDialog=''
        this.page.on('dialog',dialog=>{
            this.lastDialog=String(dialog.message()||'').slice(0,500)
            // shortcut: aceita todo confirm do portal; separar por dialog.type() se algum alerta passar a exigir cancelar.
            dialog.accept().catch(()=>{})
        })
        this.currentLogin=null
        this.currentName=null
        // identities é preservado entre logins da mesma execução (prepare + fila).
        this.procedures.clear()
        await this.gotoTrusted(`${ORIGIN}/sivisa/`,{timeout:90_000})
    }

    async gotoTrusted(url,{timeout=60_000,signal}={}){
        await withNetworkRetry(
            ()=>this.page.goto(url,{waitUntil:'domcontentloaded',timeout}),
            {
                signal,
                onRetry:(attempt,total)=>{
                    this.log?.(`Portal SIVISA lento ou instável — tentativa ${attempt}/${total}…`)
                }
            }
        )
    }

    async settle(){
        await this.page.waitForLoadState('domcontentloaded',{timeout:30_000}).catch(()=>{})
        await this.page.waitForLoadState('networkidle',{timeout:5_000}).catch(()=>{})
    }

    async withNavigation(action){
        await Promise.all([
            this.page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30_000}).catch(()=>{}),
            Promise.resolve().then(action)
        ])
        await this.settle()
    }

    async safeEvaluate(fn,arg){
        try{
            return arg===undefined?await this.page.evaluate(fn):await this.page.evaluate(fn,arg)
        }catch(error){
            if(/Execution context was destroyed|Target closed|navigat/i.test(String(error?.message||error))){
                await this.settle()
                await new Promise(resolve=>setTimeout(resolve,150))
                return arg===undefined?await this.page.evaluate(fn):await this.page.evaluate(fn,arg)
            }
            throw error
        }
    }

    async readSessionIdentity(){
        return this.safeEvaluate(()=>{
            const form=document.querySelector('form#form_login[action*="efetuaLogout"]')
            if(!form)return {logged:false,login:'',name:''}
            const header=(form.innerText||'').split('\n')[0].trim()
            const fromHeader=/^Olá,\s*(.+?)\s*-\s*/u.exec(header)?.[1]?.trim()||''
            return {
                logged:true,
                login:document.querySelector('#usuariologin')?.value||'',
                name:fromHeader
            }
        })
    }

    async login(signer,signal){
        this.throwIfAborted(signal)
        const password=await this.passwordFor(signer)
        if(!password)throw new PauseException(`O login ${signer.login} (${signer.name}) está sem senha cadastrada. Edite o fiscal e informe a senha.`,{kind:'EditSigner',login:signer.login,name:signer.name})
        this.log?.(`Entrando no SIVISA como ${signer.name} (${signer.login})…`)
        await this.resetSession()
        const loginField=this.page.locator('#usuariologin')
        const passwordField=this.page.locator('#usuariosenha')
        if(!await loginField.count()||!await passwordField.count())throw new PauseException('O formulário oficial de login mudou ou não está disponível.')
        await loginField.fill(signer.login)
        await passwordField.fill(password)
        await this.withNavigation(()=>this.page.locator('#form_login').evaluate(form=>form.requestSubmit()))
        await this.settle()
        let identity=await this.readSessionIdentity()
        if(!identity.logged)throw new PauseException(`Login ou senha incorretos para ${signer.name} (${signer.login}). Edite o cadastro e tente novamente.`,{kind:'EditSigner',login:signer.login,name:signer.name})
        // Evita ficar preso em usuario.edita.logic quando o portal está lento: o nome já vem do cabeçalho.
        if(!identity.name||(identity.login&&identity.login.trim().toLowerCase()!==signer.login.trim().toLowerCase())){
            this.log?.('Confirmando identidade no perfil do usuário…')
            await this.gotoTrusted(`${ORIGIN}/sivisa/fmk/usuario.edita.logic`,{timeout:45_000,signal})
            await this.settle()
            const profile=await this.safeEvaluate(()=>({
                login:document.querySelector('#usuariologin')?.value||'',
                name:document.querySelector('#usuarionome')?.value||''
            }))
            identity={logged:true,login:profile.login,name:profile.name.trim()||identity.name}
        }
        if(identity.login&&identity.login.trim().toLowerCase()!==signer.login.trim().toLowerCase()){
            throw new PauseException(`A sessão autenticada não corresponde ao login ${signer.login}. Confira o cadastro local.`,{kind:'EditSigner',login:signer.login,name:signer.name})
        }
        if(!identity.name)throw new PauseException(`Não foi possível ler o nome oficial de ${signer.login} no SIVISA.`)
        this.currentLogin=signer.login
        this.currentName=identity.name
        this.identities[signer.login]=this.currentName
        this.log?.(`Sessão confirmada: ${this.currentName} (${signer.login}).`)
    }

    isProcedureLink(address,action,id){
        try{
            const url=new URL(address,ORIGIN)
            if(url.origin!==ORIGIN)return false
            const path=url.pathname.split(';')[0]
            return path===`/sivisa/${action}`&&url.searchParams.get('procedimento.id')===id
        }catch{return false}
    }

    previewUrl(id,fromSearch=''){
        if(fromSearch&&this.isProcedureLink(fromSearch,'procedimento.assina.logic',id))return fromSearch
        const nested=`/sivisa/procedimento.viewPdf.logic?procedimento.id=${encodeURIComponent(id)}`
        return `${ORIGIN}/sivisa/procedimento.assina.logic?url=${encodeURIComponent(nested)}&procedimento.id=${encodeURIComponent(id)}`
    }

    async search(protocol,signal){
        this.requireLogin()
        this.throwIfAborted(signal)
        await this.gotoTrusted(`${ORIGIN}/sivisa/procedimento.pesquisa.logic`,{signal})
        await this.requireHeader()
        const ready=await this.safeEvaluate(value=>{
            const field=document.querySelector('#procedimentonroFicha')
            if(!field||!document.querySelector('#botao_procedimento'))return false
            field.value=value
            field.dispatchEvent(new Event('input',{bubbles:true}))
            return true
        },protocol)
        if(!ready)throw new PauseException('O formulário de pesquisa mudou ou a sessão expirou.')
        await this.withNavigation(()=>this.page.locator('#botao_procedimento').click())
        const rows=await this.safeEvaluate(()=>Array.from(document.querySelectorAll('#procedimento tbody tr')).filter(row=>row.cells.length===9).map(row=>{
            const view=row.querySelector('a[title="ver registro"]')
            const print=row.querySelector('a[title="imprimir registro"]')
            const preview=row.querySelector('a[title="ler e assinar procedimento"]')
            const id=view?new URL(view.href,location.href).searchParams.get('procedimento.id')||'':''
            return {
                id,
                protocol:row.cells[4].textContent.trim(),
                view:view?.href||'',
                print:print?.href||'',
                preview:preview?.href||''
            }
        }))
        for(const row of rows.filter(item=>item.id)){
            if(!this.isProcedureLink(row.view,'procedimento.visualizar.logic',row.id)||!this.isProcedureLink(row.print,'procedimento.imprime.logic',row.id)){
                throw new PauseException('Os vínculos oficiais não correspondem ao procedimento esperado.')
            }
            const preview=this.previewUrl(row.id,row.preview)
            if(!this.isProcedureLink(preview,'procedimento.assina.logic',row.id))throw new PauseException('Prévia de procedimento inválida.')
            this.procedures.set(row.id,{...row,preview})
        }
        return rows.filter(item=>item.id).map(item=>({id:item.id,protocol:item.protocol}))
    }

    async readLinkedProfessionalNames(procedure,signal){
        this.requireLogin()
        this.throwIfAborted(signal)
        await this.gotoTrusted(this.links(procedure).view,{signal})
        await this.requireHeader()
        return this.safeEvaluate(()=>{
            const table=document.querySelector('table#tabelaProfissionais')
            if(!table)return []
            return Array.from(table.querySelectorAll('tbody tr')).filter(row=>row.cells.length===5).map(row=>row.cells[1].textContent.trim())
        })
    }

    async readTeamDirectory(signal){
        this.requireLogin()
        this.throwIfAborted(signal)
        await this.gotoTrusted(`${ORIGIN}/sivisa/profissional.listaProfissionaisEquipe.logic`,{signal})
        await this.requireHeader()
        const rows=await this.safeEvaluate(()=>{
            const table=document.querySelector('table#profissionalEquipe')
            if(!table)return {valid:false,rows:[]}
            const headers=Array.from(table.querySelectorAll('th')).map(item=>item.textContent.trim())
            const body=Array.from(table.querySelectorAll('tbody tr')).filter(row=>row.cells.length>=4)
            const mapped=body.map(row=>({
                name:row.cells[0].textContent.trim(),
                login:row.cells[3].textContent.trim()
            })).filter(row=>row.name&&row.login)
            const valid=headers.join('|')==='Nome|Telefone|E-mail|Usuário'&&mapped.length>0
            return {valid,rows:mapped}
        })
        if(!rows.valid)throw new PauseException('A lista de profissionais da equipe mudou ou está vazia.')
        return rows.rows
    }

    async readSignatures(procedure,signal){
        this.requireLogin()
        this.throwIfAborted(signal)
        return withNetworkRetry(async()=>{
            await this.gotoTrusted(this.links(procedure).view,{signal})
            await this.requireHeader()
            const formOk=await this.safeEvaluate(({id,protocol})=>document.querySelector('#procedimentoid')?.value===id&&document.querySelector('#procedimentonroFicha')?.value===protocol,{id:procedure.id,protocol:procedure.protocol})
            if(!formOk)return {verified:false,logins:[],reason:'O formulário aberto não corresponde ao procedimento exato.'}
            const table=await this.safeEvaluate(()=>{
                const node=document.querySelector('table#tabelaProfissionais')
                if(!node)return {valid:false,rows:[]}
                const headers=Array.from(node.querySelectorAll('th')).map(item=>item.textContent.trim())
                const rows=Array.from(node.querySelectorAll('tbody tr')).filter(row=>row.cells.length===5)
                const valid=headers.join('|')==='CPF|Nome|Equipe|Ação|Assinatura'&&rows.length>0&&rows.every(row=>{
                    const cell=row.cells[4]
                    return cell.querySelector('a#assinou.iconeValido')?cell.children.length===1:cell.children.length===0&&cell.textContent.trim()===''
                })
                return {valid,rows:rows.map(row=>({name:row.cells[1].textContent.trim(),signed:!!row.cells[4].querySelector('a#assinou.iconeValido')}))}
            })
            if(!table.valid)return {verified:false,logins:[],reason:'A coluna oficial de assinaturas não está no formato validado.'}
            if(!table.rows.some(row=>row.signed))return SignatureEvidence.resolve(procedure.protocol,table.rows,this.identities,[])
            await this.openPreview(procedure,signal)
            await this.page.waitForFunction(()=>typeof pdfDoc!=='undefined'&&pdfDoc&&pdfDoc.numPages>0,null,{timeout:30_000})
            const pages=await this.safeEvaluate(async()=>{
                if(typeof pdfDoc==='undefined'||!pdfDoc?.numPages)return []
                const result=[]
                for(let n=1;n<=pdfDoc.numPages;n++){
                    const page=await pdfDoc.getPage(n)
                    const text=await page.getTextContent()
                    result.push(text.items.map(item=>item.str).join(' '))
                }
                return result
            })
            return SignatureEvidence.resolve(procedure.protocol,table.rows,this.identities,pages)
        },{
            signal,
            onRetry:(attempt,total)=>this.log?.(`Falha ao ler assinaturas no portal — tentativa ${attempt}/${total}…`)
        })
    }

    async awaitSignature(procedure,signer,signal){
        this.requireLogin()
        this.throwIfAborted(signal)
        if(this.currentLogin.toLowerCase()!==signer.login.toLowerCase())throw new PauseException('O fiscal ativo não corresponde ao esperado.')
        this.lastDialog=''
        await this.openPreview(procedure,signal)
        const available=await this.safeEvaluate(({id,login})=>{
            const anchor=document.querySelector('#btn_assinar a')
            if(!anchor)return false
            const url=new URL(anchor.href,location.href)
            return url.origin===location.origin&&url.pathname==='/sivisa/procedimento.assinarProcedimento.logic'&&url.searchParams.get('procedimento.id')===id&&url.searchParams.get('loginAssinatura')===login
        },{id:procedure.id,login:signer.login})
        if(!available)throw new PauseException('O portal não disponibilizou a assinatura para o fiscal e procedimento esperados. Nada foi reenviado.')
        await this.pace(signal)
        await this.page.locator('#assinar').click()
        const frame=this.page.frameLocator('#TB_iframeContent')
        await frame.locator('#usuariosenha').waitFor({state:'visible',timeout:30_000})
        const password=await this.passwordFor(signer)
        if(!password)throw new PauseException('A credencial de assinatura não está disponível.')
        const loginValue=await frame.locator('#usuariologin').inputValue()
        if(loginValue.trim().toLowerCase()!==signer.login.trim().toLowerCase())throw new PauseException('A identidade do formulário de assinatura não corresponde ao esperado.')
        await frame.locator('#usuariosenha').fill(password)
        await Promise.all([
            this.page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30_000}).catch(()=>{}),
            frame.locator('a[href^="javascript:assinarProcedimento("]').click()
        ])
        await this.page.waitForLoadState('domcontentloaded').catch(()=>{})
        this.throwIfAborted(signal)
        const dialogText=this.lastDialog||''
        if(/incorret|inválid|invalida|erro|bloquead|expirad|não foi|nao foi/i.test(dialogText))throw new PauseException(dialogText)
    }

    async fetchOfficialPdf(link,signal,{timeoutMs=45_000}={}){
        this.throwIfAborted(signal)
        const controller=new AbortController()
        const onAbort=()=>controller.abort(signal?.reason||new PauseException('Execução cancelada.'))
        signal?.addEventListener('abort',onAbort,{once:true})
        const timer=setTimeout(()=>controller.abort(new PauseException('Tempo esgotado ao obter a impressão oficial do SIVISA.')),timeoutMs)
        let rejectWait
        const cancel=new Promise((_,reject)=>{rejectWait=reject})
        cancel.catch(()=>{})
        const fail=reason=>{rejectWait(reason instanceof Error?reason:new PauseException('Execução cancelada.'));controller.abort(reason)}
        const onCancel=()=>fail(controller.signal.reason||new PauseException('Execução cancelada.'))
        controller.signal.addEventListener('abort',onCancel,{once:true})
        try{
            const response=await Promise.race([this.page.request.get(link,{timeout:timeoutMs}),cancel])
            if(controller.signal.aborted)throw controller.signal.reason||new PauseException('Execução cancelada.')
            if(response.status()!==200)throw new PauseException(`A impressão oficial não retornou o PDF (HTTP ${response.status()}).`)
            const body=Buffer.from(await response.body())
            if(!body.length||!body.subarray(0,5).equals(Buffer.from('%PDF-'))){
                throw new PauseException('O portal retornou conteúdo que não é o PDF oficial de impressão.')
            }
            if(body.length>100*1024*1024)throw new PauseException('O PDF excedeu o limite de 100 MB.')
            return body
        }finally{
            clearTimeout(timer)
            signal?.removeEventListener('abort',onAbort)
        }
    }

    async print(procedure,signal){
        this.requireLogin()
        this.throwIfAborted(signal)
        // Re-search keeps the session on the result grid and refreshes official print links.
        await this.search(procedure.protocol,signal)
        const link=this.links(procedure).print
        if(!link||!this.isProcedureLink(link,'procedimento.imprime.logic',procedure.id)){
            throw new PauseException('O link de impressão oficial não está disponível.')
        }
        await this.pace(signal)
        // Avoid click→inline PDF navigation: response.body() from that path can hang forever.
        // Authenticated request API uses the same cookies and has a hard timeout.
        this.log?.('Baixando impressão oficial via sessão autenticada…')
        const body=await this.fetchOfficialPdf(link,signal)
        await this.pace(signal)
        return Readable.from([body])
    }

    async openPreview(procedure,signal){
        const preview=this.links(procedure).preview||this.previewUrl(procedure.id)
        if(!preview)throw new PauseException('A prévia oficial não está disponível para este procedimento.')
        await withNetworkRetry(async()=>{
            await this.gotoTrusted(preview,{signal})
            const valid=await this.safeEvaluate(id=>{
                const pageUrl=new URL(location.href)
                const nested=pageUrl.searchParams.get('url')
                if(!nested)return false
                const view=new URL(nested,location.href)
                return pageUrl.searchParams.get('procedimento.id')===id&&view.origin===location.origin&&view.pathname==='/sivisa/procedimento.viewPdf.logic'&&view.searchParams.get('procedimento.id')===id
            },procedure.id)
            if(!valid)throw new PauseException('A prévia aberta não corresponde ao procedimento esperado.')
            await this.page.waitForFunction(()=>(typeof pdfDoc!=='undefined'&&pdfDoc&&pdfDoc.numPages>0)||!!document.querySelector('#btn_assinar'),null,{timeout:30_000})
        },{
            signal,
            onRetry:(attempt,total)=>this.log?.(`Prévia do PDF instável — tentativa ${attempt}/${total}…`)
        })
    }

    links(procedure){
        const row=this.procedures.get(procedure.id)
        if(!row)throw new PauseException('O procedimento precisa ser pesquisado novamente.')
        return row
    }

    async requireHeader(){
        const ok=await this.safeEvaluate(name=>{
            const form=document.querySelector('form#form_login[action*="efetuaLogout"]')
            if(!form)return false
            return form.innerText.split('\n')[0].startsWith('Olá, '+name+' - ')
        },this.currentName)
        if(!ok)throw new PauseException('A sessão do portal não corresponde ao fiscal autenticado.')
    }

    requireLogin(){
        if(!this.currentLogin||!this.currentName)throw new PauseException('A sessão ainda não foi validada.')
    }

    throwIfAborted(signal){
        if(signal?.aborted)throw signal.reason||new PauseException('Execução cancelada.')
    }

    async pace(signal){
        await new Promise((resolve,reject)=>{
            const timer=setTimeout(resolve,500)
            signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason||new PauseException('Execução cancelada.'))},{once:true})
        })
    }
}

export default PlaywrightPortal
