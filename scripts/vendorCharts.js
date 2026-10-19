import { copyFile, mkdir } from 'node:fs/promises'

const target = new URL('../public/vendor/chartjs/', import.meta.url)
await mkdir(target, { recursive: true })
await copyFile(new URL('../node_modules/chart.js/dist/chart.umd.min.js', import.meta.url), new URL('chart.umd.js', target))
await copyFile(new URL('../node_modules/chart.js/LICENSE.md', import.meta.url), new URL('LICENSE.md', target))
