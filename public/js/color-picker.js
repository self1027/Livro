import { clamp, hsvToRgb, rgbToHsv, rgbToHex, hexToRgb, contrastRatio } from './colorMath.js'

document.querySelectorAll('[data-color-picker]').forEach(picker => {
    const square = picker.querySelector('.ui-color-square')
    const cursor = picker.querySelector('.ui-color-cursor')
    const hue = picker.querySelector('[data-hue]')
    const channels = [...picker.querySelectorAll('[data-rgb]')]
    const hex = picker.querySelector('[data-hex]')
    let [h, s, v] = rgbToHsv(hexToRgb(hex.value) || [40,82,109])
    function render(updateHex = true) {
        const rgb = hsvToRgb(h,s,v)
        square.style.setProperty('--picker-hue', `hsl(${h} 100% 50%)`)
        cursor.style.left = `${s * 100}%`
        cursor.style.top = `${(1 - v) * 100}%`
        square.setAttribute('aria-valuenow', Math.round(s * 100))
        square.setAttribute('aria-valuetext', `Saturação ${Math.round(s * 100)}%, brilho ${Math.round(v * 100)}%`)
        hue.value = Math.round(h)
        channels.forEach((channel, i) => { channel.value = rgb[i] })
        if (updateHex) hex.value = rgbToHex(rgb)
        picker.querySelector('.ui-color-swatch').style.background = rgbToHex(rgb)
        picker.dispatchEvent(new CustomEvent('colorchange', { bubbles: true }))
    }
    function position(event) {
        const rect = square.getBoundingClientRect()
        s = clamp((event.clientX - rect.left) / rect.width,0,1)
        v = 1 - clamp((event.clientY - rect.top) / rect.height,0,1)
        render()
    }
    square.addEventListener('pointerdown', event => {
        if (event.button !== 0) return
        square.focus()
        square.setPointerCapture(event.pointerId)
        position(event)
    })
    square.addEventListener('pointermove', event => { if (square.hasPointerCapture(event.pointerId)) position(event) })
    square.addEventListener('pointerup', event => { if (square.hasPointerCapture(event.pointerId)) square.releasePointerCapture(event.pointerId) })
    square.addEventListener('keydown', event => {
        const step = event.shiftKey ? .1 : .01
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
        event.preventDefault()
        if (event.key === 'ArrowLeft') s -= step
        if (event.key === 'ArrowRight') s += step
        if (event.key === 'ArrowUp') v += step
        if (event.key === 'ArrowDown') v -= step
        s = clamp(s,0,1); v = clamp(v,0,1); render()
    })
    hue.addEventListener('input', () => { h = Number(hue.value); render() })
    channels.forEach(channel => channel.addEventListener('input', () => {
        if (channels.some(input => input.value === '' || !input.checkValidity())) return
        ;[h,s,v] = rgbToHsv(channels.map(input => Number(input.value)))
        render()
    }))
    hex.addEventListener('input', () => {
        const rgb = hexToRgb(hex.value)
        if (!rgb) return
        ;[h,s,v] = rgbToHsv(rgb)
        render(false)
    })
    render(false)
})
document.querySelectorAll('.catalog-form').forEach(form => {
    const preview = form.querySelector('[data-catalog-preview]')
    const update = () => {
        const name = form.elements.label.value.trim()
        const color = form.elements.color.value, background = form.elements.backgroundColor.value
        preview.textContent = name || 'Prévia'
        if (hexToRgb(color)) preview.style.setProperty('--status-color', color)
        if (hexToRgb(background)) preview.style.setProperty('--status-background', background)
        if (hexToRgb(color) && hexToRgb(background)) {
            const ratio = contrastRatio(hexToRgb(color),hexToRgb(background))
            form.querySelector('[data-color-contrast]').textContent = `Contraste ${ratio.toFixed(1)}:1${ratio < 4.5 ? ' — ajuste as cores para facilitar a leitura' : ''}`
        }
    }
    form.addEventListener('colorchange', update)
    form.elements.label.addEventListener('input', update)
    update()
})
