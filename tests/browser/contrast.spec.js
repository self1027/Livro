import {test, expect} from '@playwright/test'

test('rótulos do catálogo, tabela e escala mantêm contraste no tema escuro', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  await page.goto('/')
  await page.getByRole('button', {name: 'Entrar e explorar', exact: true}).click()

  async function checkContrast(selector) {
    const results = await page.locator(selector).evaluateAll(elements => {
      function channels(color) {
        const values = color.match(/[\d.]+/g).map(Number)
        return color.startsWith('color(srgb') ? values.map((v, i) => i < 3 ? v * 255 : v) : values
      }
      function luminance(rgb) {
        return rgb.slice(0, 3).map(value => {
          value /= 255
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
        }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
      }
      return elements.filter(element => element.getClientRects().length).map(element => {
        let parent = element, background
        while (parent) {
          background = channels(getComputedStyle(parent).backgroundColor)
          if (background[3] !== 0) break
          parent = parent.parentElement
        }
        const foreground = luminance(channels(getComputedStyle(element).color))
        const ground = luminance(background)
        return {text: element.textContent.trim(), ratio: (Math.max(foreground, ground) + .05) / (Math.min(foreground, ground) + .05)}
      })
    })
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) expect(result.ratio, result.text).toBeGreaterThanOrEqual(4.5)
  }

  await checkContrast('.home-table .ui-status, .home-muted, .badge-warning')
  await page.goto('/area-fiscal/2')
  await page.locator('.fiscal-table tbody tr').first().hover()
  await checkContrast('.fiscal-table .ui-status, .fiscal-table td')
  await page.goto('/admin/schedule')
  await page.locator('.nome-badge').first().waitFor()
  await checkContrast('.nome-badge')
})
