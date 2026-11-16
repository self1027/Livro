import {createHash,randomUUID} from 'node:crypto'
import {createWriteStream,existsSync} from 'node:fs'
import {mkdir,rename,rm,stat} from 'node:fs/promises'
import path from 'node:path'
import {pipeline} from 'node:stream/promises'
import {Readable} from 'node:stream'

export class PauseException extends Error{
    constructor(message,recovery=null){
        super(message)
        this.name='PauseException'
        this.recovery=recovery
    }
}

export const PauseRecoveryKind=Object.freeze({None:'None',EditSigner:'EditSigner',CreateSigner:'CreateSigner',Resume:'Resume'})

const PORTAL_INSTABILITY=/ERR_TIMED_OUT|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|ERR_INTERNET|ERR_SSL|ERR_CERT|Timeout \d+ms exceeded|net::ERR_|NS_ERROR_|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up|Navigation timeout|page\.goto: Timeout|waitForNavigation: Timeout|Target page, context or browser has been closed/i

export function isPortalInstability(message){
    return PORTAL_INSTABILITY.test(String(message||''))
}

export function formatPortalError(error){
    const raw=String(error?.message||error||'').trim()||'Falha inesperada no Assinador SIVISA.'
    if(!isPortalInstability(raw))return raw
    return 'O portal SIVISA está lento ou instável neste momento (falha de rede/timeout). Aguarde alguns minutos e use Retomar — a execução foi preservada quando possível.'
}

export function createSigner({id=randomUUID(),name,login,hasPassword=false}){
    return {id,name:String(name||'').trim(),login:String(login||'').trim(),hasPassword:!!hasPassword}
}

export const Rules={
    protocol(text){
        const value=String(text||'').trim()
        if(value.length<1||value.length>100||/[\u0000-\u001f\u007f]/.test(value))throw new PauseException('Informe um protocolo válido, com até 100 caracteres.')
        return value
    },
    validateSigners(signers){
        if(!signers.length)throw new PauseException('Selecione pelo menos um fiscal.')
        if(signers.some(s=>!String(s.name||'').trim()||!String(s.login||'').trim()))throw new PauseException('Todos os fiscais precisam de nome e login.')
        const logins=signers.map(s=>s.login.trim().toLowerCase())
        if(new Set(logins).size!==logins.length)throw new PauseException('A fila contém logins duplicados.')
    },
    exactResult(protocol,results){
        const matches=(results||[]).filter(item=>String(item.protocol||'').trim()===protocol)
        if(matches.length!==1)throw new PauseException(matches.length===0?'Nenhum resultado exato para o protocolo informado.':'Mais de um resultado exato. Pesquisa ambígua; execução interrompida.')
        if(!String(matches[0].id||'').trim())throw new PauseException('O resultado não informa o identificador do procedimento.')
        return matches[0]
    },
    prefix(state,expected){
        if(!state?.verified){
            const reason=state?.reason||'Não foi possível verificar as assinaturas no portal.'
            throw new PauseException(reason+RunPolicy.nextStepForEvidence(reason),{kind:PauseRecoveryKind.Resume})
        }
        const logins=state.logins||[]
        if(logins.length>expected.length||logins.some((login,index)=>index>=expected.length||login.toLowerCase()!==expected[index].login.toLowerCase())){
            throw new PauseException('As assinaturas no SIVISA conflitam com a ordem solicitada. Registradas: '+logins.join(', ')+RunPolicy.nextStepForEvidence('ordem'),{kind:PauseRecoveryKind.Resume})
        }
        return logins.length
    },
    delayMilliseconds(){return 500},
    key(protocol){return createHash('sha256').update(Rules.protocol(protocol),'utf8').digest('hex')}
}

export const RunPolicy={
    isComplete(run){return !!run&&String(run.stage||'')==='PDF salvo'},
    canResume(run){return !!run&&!RunPolicy.isComplete(run)},
    banner(run){
        if(!run)return ''
        if(RunPolicy.isComplete(run))return `Protocolo ${run.protocol}: PDF já gerado (${run.confirmed}/${run.signers.length}). Use Assinar só se quiser uma nova execução.`
        return `Protocolo ${run.protocol}: execução interrompida em ${run.confirmed}/${run.signers.length} · ${run.stage}. Prefira Retomar.`
    },
    pdfDestination(folder,protocol,previous){
        if(RunPolicy.canResume(previous)&&previous.destination)return previous.destination
        return PdfFile.destination(folder,protocol)
    },
    shouldReplaceExisting(previous,destination){
        return RunPolicy.canResume(previous)&&String(previous.destination||'')===String(destination||'')
    },
    nextStepForEvidence(reason){
        if(!reason)return ' Use Retomar depois de conferir o procedimento no SIVISA.'
        const text=String(reason)
        if(/fora da fila|não está vinculado|ambígu/i.test(text))return ' Confira o cadastro local e os vínculos da ficha; depois use Assinar ou Retomar.'
        if(/ordem|conflitam|horário/i.test(text))return ' Próximo passo: use Retomar para reconciliar com o portal sem repetir assinaturas.'
        return ' Próximo passo: use Retomar após conferir o estado no SIVISA.'
    }
}

const foldName=value=>String(value||'').normalize('NFC').replace(/\s+/g,' ').trim().toLowerCase()

export const TeamQueue={
    resolve(linkedNames,team,catalog){
        if(!linkedNames.length)throw new PauseException('O procedimento não lista profissionais vinculados.')
        const linked=linkedNames.map(name=>String(name).trim())
        if(new Set(linked.map(foldName)).size!==linked.length)throw new PauseException('A tabela de profissionais do procedimento contém nomes ambíguos.')
        if(!team.length)throw new PauseException('A lista de profissionais da equipe não retornou registros.')
        if(new Set(team.map(m=>foldName(m.name))).size!==team.length)throw new PauseException('A lista da equipe contém nomes ambíguos; não foi possível vincular o usuário.')
        if(new Set(team.map(m=>foldName(m.login))).size!==team.length)throw new PauseException('A lista da equipe contém usuários duplicados.')
        const resolved=[],missingDirectory=[],missingCatalog=[],missingCredential=[],disabled=[]
        for(const name of linked){
            const member=team.find(item=>foldName(item.name)===foldName(name))
            if(!member||!String(member.login||'').trim()){missingDirectory.push(name);continue}
            const login=member.login.trim()
            const signer=catalog.find(item=>foldName(item.login)===foldName(login))
            if(!signer){missingCatalog.push({name,login});continue}
            if(signer.enabled===false){disabled.push(signer);continue}
            if(!signer.hasPassword){missingCredential.push(signer);continue}
            resolved.push(signer)
        }
        if(missingDirectory.length)throw new PauseException('Não foi possível obter o usuário SIVISA de: '+missingDirectory.join(', ')+'.')
        if(disabled.length){
            const first=disabled[0]
            throw new PauseException('O fiscal está desativado: '+disabled.map(s=>`${s.name} (${s.login})`).join(', ')+'. Reative o cadastro em vez de criar outro login.',{kind:PauseRecoveryKind.EditSigner,login:first.login,name:first.name})
        }
        if(missingCatalog.length){
            const first=missingCatalog[0]
            throw new PauseException('É necessário cadastrar o login ainda não encontrado: '+missingCatalog.map(m=>`${m.name} (${m.login})`).join(', ')+'.',{kind:PauseRecoveryKind.CreateSigner,login:first.login,name:first.name})
        }
        if(missingCredential.length){
            const first=missingCredential[0]
            throw new PauseException('É necessário cadastrar a senha de: '+missingCredential.map(s=>`${s.name} (${s.login})`).join(', ')+'.',{kind:PauseRecoveryKind.EditSigner,login:first.login,name:first.name})
        }
        Rules.validateSigners(resolved)
        return resolved
    }
}

const STAMP=/([\p{L}\p{M} .'-]+?)\s+(\d{2}\/\d{2}\/\d{4}\s*\d{2}:\d{2}:\d{2})\s*\//gu
const STAMP_AT=/^(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}:\d{2})$/

export const SignatureEvidence={
    resolve(protocol,professionals,identities,pages){
        const marker='Assinado com senha eletrônica por:'
        const unknown=message=>({verified:false,logins:[],reason:message})
        const names=professionals.map(p=>p.name.trim())
        if(!professionals.length||new Set(names.map(n=>n.toLowerCase())).size!==names.length)return unknown('A tabela oficial de profissionais está ausente ou contém identidades ambíguas.')
        const identityNames=Object.values(identities)
        if(new Set(identityNames.map(n=>n.toLowerCase())).size!==identityNames.length)return unknown('Dois logins selecionados correspondem ao mesmo nome no portal.')
        if(identityNames.some(name=>!professionals.some(p=>p.name.toLowerCase()===name.toLowerCase())))return unknown('Um fiscal selecionado não está vinculado ao procedimento no SIVISA.')
        const signed=professionals.filter(p=>p.signed).map(p=>p.name.trim())
        if(signed.some(name=>!identityNames.some(n=>n.toLowerCase()===name.toLowerCase())))return unknown('Há assinatura de um profissional fora da fila selecionada.')
        if(!signed.length)return {verified:true,logins:[],reason:null}
        if(!pages.length)return unknown('A prévia oficial não disponibilizou o registro das assinaturas.')
        let reference=null
        for(const raw of pages){
            const page=String(raw).replace(/\s+/g,' ').trim()
            if(!page.includes('No. '+protocol+' '))return unknown('A prévia PDF não corresponde ao protocolo pesquisado.')
            const start=page.toLowerCase().lastIndexOf(marker.toLowerCase())
            if(start<0)return unknown('O PDF não apresenta o registro oficial das assinaturas em todas as páginas.')
            const stamps=[]
            STAMP.lastIndex=0
            let match
            while((match=STAMP.exec(page.slice(start+marker.length)))){
                const atMatch=STAMP_AT.exec(match[2].replace(/\s+/,' '))
                if(!atMatch)return unknown('O horário de uma assinatura não pôde ser interpretado.')
                const [day,month,year]=atMatch[1].split('/').map(Number)
                const [hour,minute,second]=atMatch[2].split(':').map(Number)
                const at=Date.UTC(year,month-1,day,hour,minute,second)
                if(!Number.isFinite(at))return unknown('O horário de uma assinatura não pôde ser interpretado.')
                stamps.push({name:match[1].trim(),at})
            }
            if(stamps.length!==signed.length||new Set(stamps.map(s=>s.name.toLowerCase())).size!==stamps.length||!signed.every(name=>stamps.some(s=>s.name.toLowerCase()===name.toLowerCase()))){
                return unknown('O registro de assinaturas no PDF diverge da tabela oficial do portal.')
            }
            if(new Set(stamps.map(s=>s.at)).size!==stamps.length)return unknown('Duas assinaturas têm o mesmo horário; não foi possível comprovar a ordem cronológica.')
            const ordered=[...stamps].sort((a,b)=>a.at-b.at)
            if(reference&&(reference.length!==ordered.length||reference.some((item,index)=>item.name!==ordered[index].name||item.at!==ordered[index].at))){
                return unknown('As páginas do PDF divergem sobre as assinaturas registradas.')
            }
            reference=ordered
        }
        const logins=reference.map(stamp=>{
            const entry=Object.entries(identities).find(([,name])=>name.toLowerCase()===stamp.name.toLowerCase())
            if(!entry)throw new PauseException('Não foi possível mapear a assinatura ao login esperado.')
            return entry[0]
        })
        return {verified:true,logins,reason:null}
    }
}

export const PdfFile={
    destination(folder,protocol){
        const safe=[...Rules.protocol(protocol)].map(char=>/["*/:<>?\\|]|[\u0000-\u001f]/.test(char)?'_':char).join('')
        const base=path.join(folder,`Sivisa-${safe}.pdf`)
        if(!existsSync(base))return base
        for(let suffix=2;;suffix++){
            const candidate=path.join(folder,`Sivisa-${safe} (${suffix}).pdf`)
            if(!existsSync(candidate))return candidate
        }
    },
    async save(content,destination,{replaceExisting=false}={}){
        const folder=path.dirname(path.resolve(destination))
        await mkdir(folder,{recursive:true})
        const temporary=path.join(folder,`.sivisa-${randomUUID().replaceAll('-','')}.tmp`)
        try{
            const stream=content instanceof Readable?content:Readable.from(content)
            await pipeline(stream,createWriteStream(temporary))
            const info=await stat(temporary)
            if(info.size<12)throw new PauseException('O conteúdo recebido não é um PDF válido.')
            const {readFile}=await import('node:fs/promises')
            const bytes=await readFile(temporary)
            if(bytes.subarray(0,5).toString('latin1')!=='%PDF-')throw new PauseException('O portal retornou conteúdo que não é PDF. Nada foi salvo no destino.')
            const tail=bytes.subarray(Math.max(0,bytes.length-2048)).toString('latin1')
            if(!tail.includes('%%EOF'))throw new PauseException('O PDF recebido está incompleto.')
            if(existsSync(destination)&&!replaceExisting)throw new PauseException('Já existe um PDF neste destino.')
            await rename(temporary,destination)
        }finally{
            if(existsSync(temporary))await rm(temporary,{force:true})
        }
    }
}

export class Workflow{
    constructor(portal,{progress=()=>{},save=async()=>{},delay}={}){
        this.portal=portal
        this.progress=progress
        this.save=save
        this.delay=delay||((ms,signal)=>new Promise((resolve,reject)=>{
            const timer=setTimeout(resolve,ms)
            signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason||new Error('Abortado'))},{once:true})
        }))
    }
    async pace(signal){await this.delay(Rules.delayMilliseconds(),signal)}
    async run(run,signal){
        const protocol=Rules.protocol(run.protocol)
        Rules.validateSigners(run.signers)
        this.progress('Validando as credenciais dos fiscais selecionados…')
        await this.portal.prepare?.(run.signers,signal)
        let confirmed=Math.max(0,Number(run.confirmed)||0)
        let procedure=null
        for(let index=0;index<run.signers.length;index++){
            if(signal?.aborted)throw signal.reason||new PauseException('Execução cancelada.')
            const signer=run.signers[index]
            this.progress(`Entrando como ${signer.name}…`)
            await this.save({...run,confirmed,stage:`Autenticando ${signer.name}`})
            await this.portal.login(signer,signal)
            await this.pace(signal)
            this.progress(`Pesquisando protocolo ${protocol}…`)
            procedure=Rules.exactResult(protocol,await this.portal.search(protocol,signal))
            await this.pace(signal)
            this.progress('Consultando as assinaturas já registradas…')
            let current=Rules.prefix(await this.portal.readSignatures(procedure,signal),run.signers)
            if(current<confirmed)throw new PauseException('O portal deixou de apresentar uma assinatura já verificada. Retomada interrompida.')
            confirmed=current
            await this.save({...run,confirmed,stage:'Estado consultado no portal'})
            if(confirmed>index)this.progress(`Assinatura de ${signer.name} já registrada. Nenhuma assinatura repetida. Verificadas: ${confirmed}/${run.signers.length}.`)
            if(confirmed<=index){
                if(confirmed!==index)throw new PauseException('Há uma assinatura anterior pendente; não é possível avançar.')
                await this.pace(signal)
                this.progress(`Assinando como ${signer.name} no SIVISA…`)
                await this.portal.awaitSignature(procedure,signer,signal)
                await this.pace(signal)
                this.progress(`Verificando assinatura de ${signer.name}…`)
                current=Rules.prefix(await this.portal.readSignatures(procedure,signal),run.signers)
                if(current!==confirmed+1){
                    await this.pace(signal)
                    current=Rules.prefix(await this.portal.readSignatures(procedure,signal),run.signers)
                }
                if(current!==confirmed+1)throw new PauseException('A assinatura esperada ainda não foi comprovada. A próxima assinatura e o PDF estão bloqueados.')
                confirmed=current
                await this.save({...run,confirmed,stage:`Assinatura de ${signer.name} verificada`})
                this.progress(`Assinatura de ${signer.name} registrada. Concluídos: ${confirmed}/${run.signers.length}.`)
            }
            if(confirmed===run.signers.length){
                await this.pace(signal)
                if(Rules.prefix(await this.portal.readSignatures(procedure,signal),run.signers)!==run.signers.length)throw new PauseException('Ainda há assinatura pendente. PDF bloqueado.')
                this.progress('Obtendo a impressão oficial e salvando PDF…')
                const content=await this.portal.print(procedure,signal)
                await PdfFile.save(content,run.destination,{replaceExisting:!!run.replaceExisting})
                await this.save({...run,confirmed,stage:'PDF salvo'})
                return run.destination
            }
        }
        throw new PauseException('O fluxo terminou com assinaturas pendentes.')
    }
}
