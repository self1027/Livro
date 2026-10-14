(() => {
    document.querySelectorAll('[data-delete-report]').forEach(form => form.addEventListener('submit',event => {
        if (!confirm('Deseja realmente excluir este relatório?')) event.preventDefault()
    }))
    const form=document.getElementById('detail-report-form')
    if (!form) return
    const submit=form.querySelector('[data-detail-submit]')
    const progress=form.querySelector('[data-detail-progress]')
    const feedback=document.getElementById('detail-report-feedback')
    form.addEventListener('submit',event => {
        const description=form.elements.description.value.trim(), status=form.elements.status.value
        if (!description && (!status || status === form.dataset.currentStatus)) {
            event.preventDefault()
            feedback.textContent='Escreva um relatório ou selecione um status diferente do atual.'
            feedback.hidden=false
            form.elements.description.setAttribute('aria-invalid','true')
            form.elements.description.focus()
            return
        }
        feedback.hidden=true
        form.elements.description.removeAttribute('aria-invalid')
        submit.disabled=true;submit.textContent='Salvando…';progress.textContent='Registrando o acompanhamento.'
    })
    window.addEventListener('pageshow',() => {submit.disabled=false;submit.textContent='Salvar acompanhamento';progress.textContent=''})
    if (typeof window.jQuery === 'function') window.jQuery('#fiscalModal').on('shown.bs.modal',()=>document.getElementById('detail-fiscal')?.focus())
})()
