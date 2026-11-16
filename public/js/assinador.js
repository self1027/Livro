(() => {
    'use strict'
    const app=document.getElementById('assinador-app')
    if(!app)return
    const canManage=app.dataset.canManage==='true'
    const pollMs=Math.min(200,Math.max(50,Number(app.dataset.pollMs)||200))
    const stallMs=Math.max(15_000,Number(app.dataset.stallMs)||45_000)
    const $=id=>document.getElementById(id)
    const apiRoot='/api/assinador'
    const state={job:null,signers:[],pollTimer:null,polling:false,stallTimer:null,openedPdfFor:null}
    const time=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'America/Sao_Paulo'})
    const dateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})
    const statusLabel={queued:'Na fila',running:'Em andamento',completed:'Concluída',failed:'Falhou',cancelled:'Cancelada',paused:'Pausada'}
    const statusTone={
        queued:{color:'#46564d',background:'#edf0ed'},
        running:{color:'#245d45',background:'#e1eee7'},
        completed:{color:'#245d45',background:'#e1eee7'},
        failed:{color:'#963b38',background:'#fbe6e3'},
        cancelled:{color:'#6b6b6b',background:'#f0f0f0'},
        paused:{color:'#795116',background:'#fff0d6'},
        unstable:{color:'#795116',background:'#fff0d6'}
    }

    const portalInstability=/ERR_TIMED_OUT|ERR_CONNECTION|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|Timeout \d+ms exceeded|net::ERR_|portal SIVISA está lento|Portal SIVISA instável|ECONNRESET|ETIMEDOUT|ENOTFOUND/i

    function status(message,error=false,warning=false){
        const node=$('assinador-status')
        node.hidden=!message
        node.textContent=message||''
        node.dataset.error=String(!!error&&!warning)
        node.dataset.warning=String(!!warning)
    }

    function renderPortalAlert(job){
        const alert=$('assinador-portal-alert')
        if(!alert)return
        const show=!!(job&&!['queued','running','completed'].includes(job.status)&&(job.portalUnstable||portalInstability.test(job.error||'')||portalInstability.test(job.stage||'')))
        alert.hidden=!show
        if(show){
            const text=$('assinador-portal-alert-text')
            if(text)text.textContent=job.error||'A conexão com o portal oficial falhou ou está lenta.'
        }
    }

    function renderStallAlert(job){
        const alert=$('assinador-stall-alert')
        if(!alert)return
        const running=job&&['queued','running'].includes(job.status)
        const stamp=job?.lastProgressAt?new Date(job.lastProgressAt).getTime():0
        const idle=running&&stamp&&(Date.now()-stamp)>=stallMs
        alert.hidden=!idle
        if(idle){
            const seconds=Math.round((Date.now()-stamp)/1000)
            const text=$('assinador-stall-alert-text')
            if(text)text.textContent=`Nenhum avanço há ${seconds}s (etapa: ${job.stage||'em andamento'}).`
        }
    }

    function needsCadastro(job){
        return job?.recovery?.kind==='EditSigner'||job?.recovery?.kind==='CreateSigner'
    }

    function preferResume(job){
        const actions=document.querySelector('.assinador-actions')
        if(!actions)return
        const prefer=!!(job&&['paused','failed','cancelled'].includes(job.status)&&!needsCadastro(job))
        actions.dataset.preferResume=String(prefer)
        $('assinador-resume').className=prefer?'btn btn-primary':'btn btn-outline-primary'
        $('assinador-start').className=prefer?'btn btn-outline-primary':'btn btn-primary'
    }

    async function api(path,{method='GET',body}={}){
        const response=await fetch(`${apiRoot}${path}`,{
            method,
            cache:'no-store',
            credentials:'same-origin',
            ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        })
        const type=response.headers.get('content-type')||''
        const data=type.includes('application/json')?await response.json():null
        if(!response.ok)throw Object.assign(new Error(data?.error||'Não foi possível concluir a operação.'),{status:response.status})
        return data
    }

    function renderBanner(text){
        const node=$('assinador-banner')
        node.hidden=!text
        node.textContent=text||''
    }

    function renderJob(job){
        state.job=job
        const running=job&&['queued','running'].includes(job.status)
        $('assinador-cancel').disabled=!running
        $('assinador-start').disabled=!!running
        $('assinador-resume').disabled=!!running
        $('assinador-stage').textContent=job?.stage||'Aguardando protocolo.'
        const count=$('assinador-count')
        if(job&&job.total){
            count.hidden=false
            count.textContent=`Assinaturas confirmadas: ${job.confirmed}/${job.total}`
        }else count.hidden=true
        const queue=$('assinador-queue')
        queue.replaceChildren()
        for(const [index,signer] of (job?.signers||[]).entries()){
            const item=document.createElement('li')
            item.textContent=`${signer.name} (${signer.login})`
            item.dataset.done=String(index<Number(job.confirmed||0))
            queue.append(item)
        }
        const log=$('assinador-log')
        log.replaceChildren()
        for(const entry of job?.log||[]){
            const line=document.createElement('p')
            const stamp=document.createElement('time')
            stamp.textContent=entry.at?time.format(new Date(entry.at)):''
            line.append(stamp,document.createTextNode(entry.message||''))
            log.append(line)
        }
        log.scrollTop=log.scrollHeight
        const pdf=$('assinador-pdf')
        if(job?.pdfReady){
            const href=`/api/assinador/jobs/${job.id}/pdf`
            pdf.hidden=false
            pdf.dataset.src=href
            pdf.href=href
            maybeOpenPdf(job,href)
        }else{
            pdf.hidden=true
            pdf.removeAttribute('href')
            delete pdf.dataset.src
        }
        renderBanner(job?.banner||'')
        renderPortalAlert(job)
        renderStallAlert(job)
        preferResume(job)
        const unstable=!!(job&&(job.portalUnstable||portalInstability.test(job.error||'')||portalInstability.test(job.stage||'')))
        if(job?.error&&!running){
            if(unstable)status('Portal SIVISA instável — prefira Retomar quando a conexão melhorar.',false,true)
            else status(job.error+(!canManage&&needsCadastro(job)?' Peça a quem administra o Assinador para atualizar o cadastro.':''),true)
        }
        else if(running)status(job.stage||'Em execução…')
        else if(job?.status==='completed')status(state.openedPdfFor===job.id?'PDF enviado para download. Ele abre em seguida, como na impressão do SIVISA.':'PDF gerado. Use Baixar PDF se o arquivo não abriu.')
        else if(job?.status==='paused'||job?.status==='failed')status('Execução interrompida. Prefira Retomar em vez de Assinar de novo.',false,true)
        else renderPortalAlert(null)
        clearInterval(state.stallTimer)
        if(running)state.stallTimer=setInterval(()=>renderStallAlert(state.job),5_000)
    }

    function renderSigners(){
        const filter=($('assinador-signer-filter').value||'').trim().toLocaleLowerCase('pt-BR')
        const list=$('assinador-signers')
        list.replaceChildren()
        const rows=state.signers.filter(item=>!filter||`${item.name} ${item.login}`.toLocaleLowerCase('pt-BR').includes(filter))
        if(!rows.length){
            list.append(Object.assign(document.createElement('p'),{className:'assinador-muted',textContent:filter?'Nenhum fiscal encontrado.':'Nenhum fiscal cadastrado.'}))
            return
        }
        for(const signer of rows){
            const row=document.createElement('div')
            row.className='assinador-signer'
            const info=document.createElement('div')
            info.append(Object.assign(document.createElement('strong'),{textContent:signer.name}))
            info.append(Object.assign(document.createElement('small'),{textContent:`${signer.login}${signer.hasPassword?' · senha ok':' · sem senha'}`}))
            row.append(info)
            if(canManage){
                const actions=document.createElement('div')
                actions.className='assinador-signer-actions'
                const edit=Object.assign(document.createElement('button'),{type:'button',className:'assinador-link-button',textContent:'Editar'})
                edit.addEventListener('click',()=>openSigner(signer))
                const remove=Object.assign(document.createElement('button'),{type:'button',className:'assinador-link-button',textContent:'Excluir'})
                remove.dataset.danger='true'
                remove.addEventListener('click',async()=>{
                    if(!confirm(`Excluir ${signer.name}?`))return
                    try{await api(`/signers/${signer.id}`,{method:'DELETE'});await loadSigners();status('Fiscal removido.')}
                    catch(error){status(error.message,true)}
                })
                actions.append(edit,remove)
                row.append(actions)
            }
            list.append(row)
        }
    }

    async function loadSigners(){
        const data=await api('/signers')
        state.signers=data.signers||[]
        renderSigners()
    }

    function renderHistory(jobs=[]){
        const body=$('assinador-history-body')
        if(!body)return
        body.replaceChildren()
        if(!jobs.length){
            body.append(Object.assign(document.createElement('tr'),{innerHTML:'<td colspan="4">Nenhuma execução registrada ainda.</td>'}))
            return
        }
        for(const job of jobs){
            const row=document.createElement('tr')
            const protocol=document.createElement('td')
            protocol.append(Object.assign(document.createElement('span'),{className:'assinador-history-protocol',textContent:job.protocol}))
            const statusCell=document.createElement('td')
            const statusWrap=document.createElement('div')
            statusWrap.className='assinador-history-status'
            const unstable=!!(job.portalUnstable||portalInstability.test(job.error||'')||portalInstability.test(job.stage||''))
            const tone=statusTone[unstable?'unstable':job.status]||statusTone.queued
            const badge=Object.assign(document.createElement('span'),{className:'ui-status',textContent:unstable?'Portal instável':(statusLabel[job.status]||job.status)})
            badge.style.setProperty('--status-color',tone.color)
            badge.style.setProperty('--status-background',tone.background)
            if(unstable)badge.title=job.error||'Portal SIVISA instável'
            statusWrap.append(badge)
            if(job.total)statusWrap.append(Object.assign(document.createElement('span'),{className:'assinador-history-signers',textContent:`${job.confirmed}/${job.total}`}))
            statusCell.append(statusWrap)
            const duration=document.createElement('td')
            duration.textContent=formatDuration(job.startedAt,job.finishedAt)
            if(job.startedAt)duration.title=`Início: ${dateTime.format(new Date(job.startedAt))}${job.finishedAt?` · Fim: ${dateTime.format(new Date(job.finishedAt))}`:''}`
            const actions=document.createElement('td')
            const group=document.createElement('div')
            group.className='assinador-history-actions'
            if(job.pdfReady){
                const pdf=Object.assign(document.createElement('a'),{className:'assinador-link-button',href:`/api/assinador/jobs/${job.id}/pdf`,textContent:'PDF',target:'assinador-pdf-frame'})
                pdf.dataset.src=pdf.href
                pdf.addEventListener('click',()=>{pdf.href=`${pdf.dataset.src}?dl=${Date.now()}`})
                group.append(pdf)
            }
            if(['paused','failed'].includes(job.status)&&!needsCadastro(job)){
                const resume=Object.assign(document.createElement('button'),{type:'button',className:'assinador-link-button',textContent:'Retomar'})
                resume.addEventListener('click',()=>{
                    $('assinador-protocol').value=job.protocol
                    start('retomar')
                })
                group.append(resume)
            }
            if(['queued','running'].includes(job.status)){
                const open=Object.assign(document.createElement('button'),{type:'button',className:'assinador-link-button',textContent:'Acompanhar'})
                open.addEventListener('click',()=>{
                    $('assinador-protocol').value=job.protocol
                    renderJob(job)
                    schedulePoll()
                })
                group.append(open)
            }
            if(group.childNodes.length)actions.append(group)
            row.append(protocol,statusCell,duration,actions)
            body.append(row)
        }
    }

    function formatDuration(startedAt,finishedAt){
        if(!startedAt)return '—'
        const start=new Date(startedAt).getTime()
        const end=finishedAt?new Date(finishedAt).getTime():Date.now()
        if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return '—'
        const total=Math.round((end-start)/1000)
        if(total<60)return `${total}s`
        const minutes=Math.floor(total/60)
        const seconds=total%60
        if(minutes<60)return seconds?`${minutes}m ${seconds}s`:`${minutes}m`
        const hours=Math.floor(minutes/60)
        const rest=minutes%60
        return rest?`${hours}h ${rest}m`:`${hours}h`
    }

    async function loadHistory(){
        try{
            const data=await api('/jobs?limit=20')
            renderHistory(data.jobs||[])
        }catch(error){
            const body=$('assinador-history-body')
            if(body)body.replaceChildren(Object.assign(document.createElement('tr'),{innerHTML:`<td colspan="4">${error.message}</td>`}))
        }
    }

    function setPasswordVisible(visible){
        const input=$('assinador-signer-password')
        const toggle=$('assinador-password-toggle')
        if(!input||!toggle)return
        input.type=visible?'text':'password'
        toggle.setAttribute('aria-pressed',String(!!visible))
        toggle.textContent=visible?'Ocultar senha':'Mostrar senha'
    }

    function passwordMask(length){
        const size=Math.max(0,Math.min(200,Number(length)||0))
        return size? '•'.repeat(size) : ''
    }

    function openSigner(signer=null){
        const dialog=$('assinador-signer-dialog')
        if(!dialog)return
        const input=$('assinador-signer-password')
        const hint=$('assinador-password-hint')
        const length=Number(signer?.passwordLength)||0
        $('assinador-signer-title').textContent=signer?'Editar fiscal':'Cadastrar fiscal'
        $('assinador-signer-id').value=signer?.id||''
        $('assinador-signer-name').value=signer?.name||''
        $('assinador-signer-login').value=signer?.login||''
        input.required=!signer
        input.dataset.revealed='false'
        input.dataset.mask=signer&&length?'true':'false'
        input.dataset.passwordLength=String(length||'')
        input.value=signer&&length?passwordMask(length):''
        input.placeholder=signer&&length?`${length} caracteres cadastrados`:'Senha eletrônica'
        if(hint)hint.textContent=signer
            ?(length?`Senha cadastrada com ${length} caracteres. Deixe a máscara para manter, edite para trocar, ou use Mostrar senha.`:'Na edição, deixe em branco para manter a senha atual. Use Mostrar senha para revelar a cadastrada.')
            :'Informe a senha eletrônica do portal SIVISA.'
        setPasswordVisible(false)
        $('assinador-signer-error').hidden=true
        dialog.showModal()
    }

    async function toggleSignerPassword(){
        const input=$('assinador-signer-password')
        const errorNode=$('assinador-signer-error')
        if(!input)return
        if(input.type==='text'){
            setPasswordVisible(false)
            return
        }
        const id=$('assinador-signer-id').value
        if(id&&input.dataset.revealed!=='true'&&(input.dataset.mask==='true'||!input.value)){
            try{
                const data=await api(`/signers/${id}/secret`)
                input.value=data.password||''
                input.dataset.revealed='true'
                input.dataset.mask='false'
                input.dataset.passwordLength=String(data.passwordLength||input.value.length||'')
                if(errorNode)errorNode.hidden=true
            }catch(error){
                if(errorNode){errorNode.hidden=false;errorNode.textContent=error.message}
                return
            }
        }
        setPasswordVisible(true)
    }

    async function refreshLatest(){
        const protocol=$('assinador-protocol').value.trim()
        if(!protocol)return
        try{
            const data=await api(`/latest?protocol=${encodeURIComponent(protocol)}`)
            if(data.job)renderJob(data.job)
            else renderBanner(data.banner||'')
        }catch(error){status(error.message,true)}
    }

    async function poll(){
        if(state.polling||!state.job||!['queued','running'].includes(state.job.status))return
        state.polling=true
        try{
            const data=await api(`/jobs/${state.job.id}`)
            renderJob(data.job)
            if(['queued','running'].includes(data.job.status))schedulePoll()
        }catch(error){
            status(error.message,true)
            schedulePoll()
        }finally{state.polling=false}
    }

    function schedulePoll(){
        clearTimeout(state.pollTimer)
        state.pollTimer=setTimeout(poll,pollMs)
    }

    function deliverPdf(href){
        const frame=document.getElementById('assinador-pdf-frame')
        if(!frame)return
        // shortcut: o navegador abre o anexo como a impressão do SIVISA; não dá para mandar o leitor do Windows daqui.
        frame.src=`${href}${href.includes('?')?'&':'?'}dl=${Date.now()}`
    }

    function maybeOpenPdf(job,href){
        if(!job||job.status!=='completed'||!job.pdfReady||state.openedPdfFor===job.id)return
        state.openedPdfFor=job.id
        deliverPdf(href)
    }

    async function start(mode){
        status('')
        try{
            const data=await api('/jobs',{method:'POST',body:{protocol:$('assinador-protocol').value,mode}})
            state.openedPdfFor=null
            renderJob(data.job)
            schedulePoll()
            loadHistory().catch(()=>{})
        }catch(error){
            status(error.message,true)
        }
    }

    $('assinador-pdf').addEventListener('click',()=>{
        const src=$('assinador-pdf').dataset.src
        if(src)$('assinador-pdf').href=`${src}?dl=${Date.now()}`
    })
    $('assinador-start').addEventListener('click',()=>start('assinar'))
    $('assinador-resume').addEventListener('click',()=>start('retomar'))
    $('assinador-cancel').addEventListener('click',async()=>{
        if(!state.job)return
        try{
            const data=await api(`/jobs/${state.job.id}/cancel`,{method:'POST',body:{}})
            renderJob(data.job)
        }catch(error){status(error.message,true)}
    })
    $('assinador-protocol').addEventListener('change',refreshLatest)
    $('assinador-protocol').addEventListener('blur',refreshLatest)
    $('assinador-signer-filter')?.addEventListener('input',renderSigners)
    $('assinador-signer-open')?.addEventListener('click',event=>{
        event.preventDefault()
        event.stopPropagation()
        const fold=$('assinador-signers-fold')
        if(fold&&!fold.open)fold.open=true
        openSigner()
    })
    $('assinador-password-toggle')?.addEventListener('click',()=>{toggleSignerPassword().catch(()=>{})})
    document.querySelectorAll('[data-close-dialog]').forEach(node=>node.addEventListener('click',()=>$('assinador-signer-dialog')?.close()))
    $('assinador-signer-password')?.addEventListener('focus',()=>{
        const input=$('assinador-signer-password')
        if(input?.dataset.mask==='true'){
            input.value=''
            input.dataset.mask='false'
        }
    })
    $('assinador-signer-form')?.addEventListener('submit',async event=>{
        event.preventDefault()
        const id=$('assinador-signer-id').value
        const input=$('assinador-signer-password')
        const masked=input?.dataset.mask==='true'
        const body={
            name:$('assinador-signer-name').value,
            login:$('assinador-signer-login').value,
            password:masked?'':(input?.value||'')
        }
        const errorNode=$('assinador-signer-error')
        try{
            await api(id?`/signers/${id}`:'/signers',{method:id?'PUT':'POST',body})
            $('assinador-signer-dialog').close()
            await loadSigners()
            status('Fiscal salvo.')
        }catch(error){
            errorNode.hidden=false
            errorNode.textContent=error.message
        }
    })

    loadSigners().catch(error=>status(error.message,true))
    loadHistory()
})()
