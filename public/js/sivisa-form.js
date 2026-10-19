(() => {
    document.querySelectorAll('[data-sivisa-form]').forEach(form=>{
        const fields=form.querySelector('[data-sivisa-fields]'),rows=fields.querySelector('[data-sivisa-rows]'),state=fields.querySelector('[data-sivisa-state]')
        const template=rows.firstElementChild.cloneNode(true)
        const update=()=>{
            const hasProtocol=[...rows.querySelectorAll('[data-sivisa-protocol]')].some(input=>input.value.trim())
            state.setCustomValidity(state.checked&&hasProtocol?'Remova os protocolos para marcar que não cabe SIVISA.':'')
        }
        state.addEventListener('change',update)
        fields.querySelector('[data-sivisa-add]').addEventListener('click',()=>{
            const row=template.cloneNode(true);row.querySelectorAll('input').forEach(input=>input.value='');rows.append(row);row.querySelector('input').focus()
        })
        rows.addEventListener('click',event=>{
            if(!event.target.closest('[data-sivisa-remove]'))return
            const row=event.target.closest('[data-sivisa-row]')
            if(rows.children.length>1)row.remove();else row.querySelectorAll('input').forEach(input=>input.value='')
            update()
        })
        form.addEventListener('submit',event=>{
            update()
            if(!form.checkValidity()){event.preventDefault();form.reportValidity()}
        })
        fields.addEventListener('input',update)
        update()
    })
})()
