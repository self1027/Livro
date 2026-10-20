(() => {
    const search = document.getElementById('searchDistrict')
    const rows = [...document.querySelectorAll('[data-district-row]')]
    const feedback = document.getElementById('districtSearchFeedback')
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    search?.addEventListener('input', () => {
        const filter = normalize(search.value.trim())
        let visible = 0
        rows.forEach(row => {
            const matches = normalize(row.textContent).includes(filter)
            row.hidden = !matches
            // Override responsive table display rules for filtered records.
            row.style.display = matches ? '' : 'none'
            if (matches) visible++
        })
        feedback.textContent = filter ? visible ? `${visible} bairro(s) encontrado(s).` : 'Nenhum bairro encontrado para esta busca.' : ''
    })
    document.querySelectorAll('[data-edit-district]').forEach(button => button.addEventListener('click', () => {
        document.getElementById('editName').value = button.dataset.name
        document.getElementById('editForm').action = `/bairros/${encodeURIComponent(button.dataset.editDistrict)}`
    }))
    document.querySelectorAll('[data-delete-district]').forEach(form => form.addEventListener('submit', event => {
        if (!confirm('Deseja realmente excluir este bairro?')) event.preventDefault()
    }))
    if (typeof window.jQuery === 'function') {
        window.jQuery('#editModal').on('shown.bs.modal', () => document.getElementById('editName').focus())
    }
})()
