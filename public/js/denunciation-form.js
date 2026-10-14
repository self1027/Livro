(() => {
    const form = document.getElementById('denunciaForm')
    if (!form) return
    const feedback = document.getElementById('registration-feedback')
    const submit = form.querySelector('[data-registration-submit]')
    const progress = form.querySelector('[data-registration-progress]')
    const messages = {registration_type:'Selecione a origem da denúncia.',title:'Informe um título.',endereco:'Informe o logradouro.',numero:'Informe o número ou s/n.',bairro:'Selecione um bairro cadastrado.',description:'Descreva a situação denunciada.'}
    const fields = [...form.querySelectorAll('input:not([type="hidden"]), select, textarea')]
    function mark(field, message) {
        const invalid = !!message
        field.classList.toggle('is-invalid',invalid)
        field.setAttribute('aria-invalid',String(invalid))
        const error = form.querySelector(`[data-field-error="${field.name}"]`)
        if (error) {error.textContent=message;error.classList.toggle('d-block',invalid)}
    }
    fields.forEach(field => {
        if (field.classList.contains('is-invalid')) field.setAttribute('aria-invalid','true')
        field.addEventListener('input',() => {
            if (!field.hasAttribute('data-district-input')) field.setCustomValidity('')
            mark(field,'')
        })
    })
    form.addEventListener('submit',event => {
        const invalid = []
        fields.forEach(field => {
            if (field.required && !field.value.trim()) field.setCustomValidity(messages[field.name] || 'Preencha este campo.')
            const message = field.checkValidity() ? '' : field.validationMessage
            mark(field,message)
            if (message) invalid.push(field)
        })
        if (invalid.length) {
            event.preventDefault()
            feedback.replaceChildren()
            const title = document.createElement('strong')
            title.textContent = 'Revise os campos indicados para continuar.'
            const list = document.createElement('ul')
            list.className = 'mb-0 mt-2'
            invalid.forEach(field => {
                const item=document.createElement('li'),link=document.createElement('a')
                link.href='#'+field.id;link.textContent=field.validationMessage
                link.addEventListener('click',event=>{event.preventDefault();field.focus()})
                item.append(link);list.append(item)
            })
            feedback.append(title,list);feedback.hidden=false;feedback.focus()
            return
        }
        if (event.defaultPrevented) return
        feedback.hidden=true;submit.disabled=true;submit.textContent='Cadastrando…';progress.textContent='Salvando a denúncia.'
    })
    window.addEventListener('pageshow',() => {submit.disabled=false;submit.textContent='Cadastrar denúncia';progress.textContent='Revise as informações antes de cadastrar.'})
})()
