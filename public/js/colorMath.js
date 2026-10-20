export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export function hsvToRgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
    const sectors = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]]
    return sectors[Math.floor(((h % 360) + 360) % 360 / 60)].map(n => Math.round((n + m) * 255))
}
export function rgbToHsv([r, g, b]) {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
    let h = 0
    if (delta) h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
    return [((h * 60) + 360) % 360, max ? delta / max : 0, max]
}
export const rgbToHex = rgb => '#' + rgb.map(n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('')
export const hexToRgb = hex => /^#[0-9a-f]{6}$/i.test(hex) ? [1,3,5].map(index => parseInt(hex.slice(index,index+2),16)) : null
export function contrastRatio(foreground, background) {
    const luminance = rgb => rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126,.7152,.0722][i], 0)
    const a = luminance(foreground), b = luminance(background)
    return (Math.max(a,b) + .05) / (Math.min(a,b) + .05)
}
