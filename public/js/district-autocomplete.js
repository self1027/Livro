(() => {
    document.querySelectorAll('[data-district-autocomplete]').forEach(wrapper => {
        if (wrapper.dataset.initialized) return
        wrapper.dataset.initialized = 'true'
        const input = wrapper.querySelector('[data-district-input]')
        const list = wrapper.querySelector('[role="listbox"]')
        const error = wrapper.querySelector('[data-district-error]')
        const options = JSON.parse(wrapper.querySelector('[data-district-options]').textContent)
        const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
        let filtered = [], active = -1
        function close() {
            list.replaceChildren()
            list.hidden = true
            input.setAttribute('aria-expanded','false')
            input.removeAttribute('aria-activedescendant')
            filtered = []; active = -1
        }
        function validate(showError = false) {
            const value = input.value.trim()
            const match = options.find(option => normalize(option) === normalize(value))
            input.setCustomValidity(value && !match ? 'Selecione um bairro cadastrado.' : '')
            error.hidden = !showError || !value || !!match
            error.classList.toggle('d-block',!error.hidden)
            return !!match
        }
        function select(value) {
            input.value = value
            input.dispatchEvent(new Event('input',{bubbles:true}))
            validate()
            close()
        }
        function render() {
            list.replaceChildren()
            list.hidden = false
            input.setAttribute('aria-expanded','true')
            if (!filtered.length) {
                const empty = document.createElement('div')
                empty.className = 'autocomplete-no-results'
                empty.textContent = 'Nenhum bairro encontrado. '
                const link = document.createElement('a')
                link.href = '/admin/catalogs?kind=district'
                link.target = '_blank'; link.rel = 'noopener'
                link.textContent = 'Gerenciar bairros'
                empty.append(link); list.append(empty)
                input.removeAttribute('aria-activedescendant')
                return
            }
            filtered.forEach((value,index) => {
                const option = document.createElement('div')
                option.className = 'autocomplete-item'
                option.id = `${list.id}-${index}`
                option.setAttribute('role','option')
                option.setAttribute('aria-selected',String(index === active))
                option.textContent = value
                option.addEventListener('pointerdown',event => event.preventDefault())
                option.addEventListener('click',() => {select(value);input.focus()})
                list.append(option)
            })
            if (active >= 0) {
                input.setAttribute('aria-activedescendant',`${list.id}-${active}`)
                list.children[active].scrollIntoView({block:'nearest'})
            } else input.removeAttribute('aria-activedescendant')
        }
        input.addEventListener('input',() => {
            validate()
            const value = normalize(input.value)
            if (!value) {close();return}
            filtered = options.filter(option => normalize(option).includes(value)).slice(0,8)
            active = -1; render()
        })
        input.addEventListener('blur',() => validate(true))
        input.addEventListener('keydown',event => {
            if (event.key === 'Escape') {close();return}
            if (list.hidden || !filtered.length) return
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                active = event.key === 'ArrowDown' ? (active + 1) % filtered.length : (active - 1 + filtered.length) % filtered.length
                render()
            } else if (event.key === 'Enter' && active >= 0) {event.preventDefault();select(filtered[active])}
        })
        document.addEventListener('click',event => {if (!wrapper.contains(event.target))close()})
        input.closest('form')?.addEventListener('submit',event => {
            if (!validate(true)) {event.preventDefault();if (!input.closest('form').noValidate) input.reportValidity()}
            else {
                const canonical = options.find(option => normalize(option) === normalize(input.value))
                input.value = canonical
            }
        })
        validate()
    })
})()
