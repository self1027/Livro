(() => {
    const form = document.querySelector('[data-search-form]')
    if (!form) return
    const feedback = document.getElementById('search-feedback')
    const submit = form.querySelector('[data-search-submit]')
    const progress = form.querySelector('[data-search-progress]')
    form.addEventListener('submit', event => {
        const fields = [...form.querySelectorAll('input[name], select[name]')]
        if (!fields.some(field => field.value.trim())) {
            event.preventDefault()
            feedback.textContent = 'Preencha pelo menos um filtro para buscar denúncias.'
            feedback.hidden = false
            feedback.focus()
            return
        }
        feedback.hidden = true
        submit.disabled = true
        submit.textContent = 'Buscando…'
        progress.textContent = 'Consultando denúncias.'
    })
    window.addEventListener('pageshow', () => {
        submit.disabled = false
        submit.textContent = 'Buscar denúncias'
        progress.textContent = ''
    })
})()
