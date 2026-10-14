(() => {
    const search=document.getElementById('fiscal-search')
    if (search) {
        const entries=[...document.querySelectorAll('[data-fiscal-entry]')]
        const feedback=document.getElementById('fiscal-search-feedback')
        const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
        search.addEventListener('input',()=>{
            const value=normalize(search.value)
            let visible=0
            entries.forEach(entry=>{entry.hidden=!normalize(entry.textContent).includes(value);if(!entry.hidden)visible++})
            feedback.textContent=value?visible?`${visible} ${visible===1?'fiscal encontrado':'fiscais encontrados'}.`:'Nenhum fiscal encontrado para esta busca.':''
        })
    }
    const root=document.querySelector('.fiscal-area')
    if (!root) return
    const form=root.querySelector('[data-fiscal-filter-form]')
    const select=document.getElementById('statusFilter')
    const apply=form.querySelector('[data-fiscal-filter-submit]')
    const feedback=root.querySelector('[data-fiscal-filter-feedback]')
    const exportLink=root.querySelector('[data-fiscal-export]')
    let revision=0, controller, failedStatus=null
    apply.hidden=true
    const url=(status,page)=>`/area-fiscal/${encodeURIComponent(root.dataset.fiscalId)}?${new URLSearchParams({status,page})}`
    async function update(status,page=1,append=false,historyMode='push') {
        controller?.abort()
        controller=new AbortController()
        const current=++revision
        const results=root.querySelector('[data-fiscal-results]')
        const button=results.querySelector('[data-fiscal-more]')
        results.setAttribute('aria-busy','true')
        if (button) {button.disabled=true;if(append)button.textContent='Carregando…'}
        if (!append) {
            failedStatus=null;select.value=status;apply.hidden=true
            results.inert=true
            feedback.hidden=false;feedback.textContent='Atualizando denúncias…'
            exportLink.setAttribute('aria-disabled','true')
        }
        try {
            const response=await fetch(url(status,page),{signal:controller.signal})
            if (!response.ok) throw Error('Falha na consulta')
            const doc=new DOMParser().parseFromString(await response.text(),'text/html')
            if (current!==revision) return
            const nextRoot=doc.querySelector('.fiscal-area')
            const nextResults=nextRoot?.querySelector('[data-fiscal-results]')
            if (!nextResults || nextRoot.dataset.fiscalId!==root.dataset.fiscalId || nextRoot.dataset.selectedStatus!==status) throw Error('Resposta inválida')
            if (append) {
                const body=results.querySelector('#fiscal-denunciations tbody')
                const rows=[...nextResults.querySelectorAll('#fiscal-denunciations tbody tr')]
                body.append(...rows)
                const next=nextResults.querySelector('[data-fiscal-more]')
                const finished=!next || !rows.length
                if (next) button.dataset.nextPage=next.dataset.nextPage
                button.disabled=finished;button.textContent=finished?'Todas carregadas':'Carregar mais'
                button.dataset.finished=String(finished)
                root.dataset.total=nextRoot.dataset.total
                results.querySelector('[data-fiscal-count]').textContent=`${body.rows.length} de ${nextRoot.dataset.total} denúncias exibidas`
                results.querySelector('[data-fiscal-feedback]').textContent=rows.length?`${rows.length} ${rows.length===1?'denúncia adicionada':'denúncias adicionadas'}.`:'Todas as denúncias disponíveis foram carregadas.'
            } else {
                results.replaceWith(nextResults)
                root.dataset.selectedStatus=status;root.dataset.total=nextRoot.dataset.total
                exportLink.href=nextRoot.querySelector('[data-fiscal-export]').getAttribute('href')
                feedback.textContent=nextResults.querySelector('[data-fiscal-count]').textContent.trim()
                if (historyMode==='push') history.pushState(null,'',url(status,page))
                failedStatus=null;apply.hidden=true
            }
        } catch (error) {
            if (current!==revision || error.name==='AbortError') return
            if (append) results.querySelector('[data-fiscal-feedback]').textContent='Não foi possível carregar as denúncias. Tente novamente.'
            else {
                select.value=root.dataset.selectedStatus;failedStatus=status
                feedback.textContent='Não foi possível atualizar as denúncias. Tente novamente.'
                apply.textContent='Tentar novamente';apply.hidden=false
                if (historyMode==='none') history.replaceState(null,'',url(root.dataset.selectedStatus,1))
            }
        } finally {
            if (current===revision) {
                const currentResults=root.querySelector('[data-fiscal-results]')
                currentResults.inert=false;currentResults.setAttribute('aria-busy','false')
                const more=currentResults.querySelector('[data-fiscal-more]')
                if (more && more.dataset.finished!=='true') {more.disabled=false;more.textContent='Carregar mais'}
                exportLink.removeAttribute('aria-disabled')
            }
        }
    }
    select.addEventListener('change',()=>update(select.value,1))
    form.addEventListener('submit',event=>{event.preventDefault();update(failedStatus || select.value,1)})
    root.addEventListener('click',event=>{
        const more=event.target.closest('[data-fiscal-more]')
        if (more && !more.disabled) update(root.dataset.selectedStatus,Number(more.dataset.nextPage),true)
        const reset=event.target.closest('.fiscal-empty a')
        if (reset) {event.preventDefault();update('ALL',1)}
    })
    exportLink.addEventListener('click',event=>{if(exportLink.getAttribute('aria-disabled')==='true')event.preventDefault()})
    window.addEventListener('popstate',()=>{
        const params=new URLSearchParams(location.search)
        update(params.get('status') || 'ALL',Number(params.get('page') || 1),false,'none')
    })
})()
