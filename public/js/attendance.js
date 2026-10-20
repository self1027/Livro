(() => {
    const checkbox = document.getElementById('attendance-disabled')
    const options = document.getElementById('attendance-options')
    if (!checkbox || !options) return
    const update = () => { options.disabled = checkbox.checked }
    checkbox.addEventListener('change', update)
    update()
})()
