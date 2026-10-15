(() => {
    document.querySelectorAll('[data-sivisa-form]').forEach(form=>{
        const fields=form.querySelector('[data-sivisa-fields]'),rows=fields.querySelector('[data-sivisa-rows]'),state=fields.querySelector('[data-sivisa-state]'),description=form.querySelector('[name="description"]')
        const template=rows.firstElementChild.cloneNode(true)
        const update=()=>{state.required=!description||!!description.value.trim();state.setCustomValidity('')}
        description?.addEventListener('input',update);state.addEventListener('change',update)
        fields.querySelector('[data-sivisa-add]').addEventListener('click',()=>{
            const row=template.cloneNode(true);row.querySelectorAll('input').forEach(input=>input.value='');rows.append(row);row.querySelector('input').focus()
        })
        rows.addEventListener('click',event=>{
            if(!event.target.closest('[data-sivisa-remove]'))return
            const row=event.target.closest('[data-sivisa-row]')
            if(rows.children.length>1)row.remove();else row.querySelectorAll('input').forEach(input=>input.value='')
            if(state.value==='registered'&&![...rows.querySelectorAll('[data-sivisa-protocol]')].some(input=>input.value.trim()))state.value='pending'
            update()
        })
        form.addEventListener('submit',event=>{
            update()
            const hasProtocol=[...rows.querySelectorAll('[data-sivisa-protocol]')].some(input=>input.value.trim())
            if(state.required&&state.value==='registered'&&!hasProtocol)state.setCustomValidity('Informe pelo menos um protocolo ou marque que ainda está pendente.')
            if(state.value==='not_applicable'&&hasProtocol)state.setCustomValidity('Remova os protocolos para marcar que não cabe SIVISA.')
            if(!form.checkValidity()){event.preventDefault();form.reportValidity()}
        })
        fields.addEventListener('input',event=>{
            state.setCustomValidity('')
            if(event.target.matches('[data-sivisa-protocol]')&&state.value==='registered'&&![...rows.querySelectorAll('[data-sivisa-protocol]')].some(input=>input.value.trim()))state.value='pending'
        })
        update()
    })
})()
