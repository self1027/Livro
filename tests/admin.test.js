import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import ejs from 'ejs'
import path from 'node:path'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { Op } from 'sequelize'
import { normalizeFilters, summarize, selectQueue } from '../src/utils/adminMetrics.js'
import repo, { whereFor } from '../src/repositories/adminRepository.js'
import attendance from '../src/services/attendanceService.js'
import router from '../src/controllers/adminController.js'
import {can,canManageReport} from '../src/auth/permissions.js'
import {routePermission} from '../src/auth/middleware.js'

const now = new Date('2026-10-14T15:00:00Z')
const users = [{ id: 1, name: 'Fiscal A', ativo: true }, { id: 2, name: 'Fiscal B', ativo: false }]
const row = (id, status, days, userId = null, activity = null) => ({ id, number: id, year: 2026, title: 'Denúncia', bairro: 'Centro', status, user_id: userId,
    created_at: new Date(now.getTime() - days * 86400000), last_activity: activity, user: users.find(u => u.id === userId) })

test('métricas distinguem abertas, andamento, finalizadas e filas por idade', () => {
    const data = [row(1, 'FINALIZADA', 80), row(2, 'REGISTRADA', 7), row(3, 'PENDENTE', 30, 1), row(4, 'EM_ANDAMENTO', 60, 1), row(5, 'NOTIFICADA', 61, 2, now)]
    const metrics = summarize(data, users, normalizeFilters({}), now)
    assert.deepEqual(metrics.stats, { total: 5, open: 4, progress: 2, closed: 1, unassigned: 1, inactive: 2, old: 1 })
    assert.deepEqual(metrics.ages.map(a => a.count), [1, 1, 1, 1])
    assert.equal(metrics.workload.find(u => u.id === 1).open, 2)
    assert.equal(metrics.workload.find(u => u.id === 2).inactive, 0)
    assert.deepEqual(selectQueue(metrics.rows, 'unassigned').map(r => r.id), [2])
})
test('datas usam calendário de São Paulo e denúncias de anos anteriores continuam visíveis', () => {
    const data = [{ ...row(1, 'REGISTRADA', 1), year: 2025, created_at: new Date('2026-10-14T02:30:00Z') }]
    const metrics = summarize(data, users, normalizeFilters({}), new Date('2026-10-14T03:30:00Z'))
    assert.equal(metrics.rows[0].age, 1)
    assert.equal(metrics.stats.open, 1)
    assert.equal(normalizeFilters({}).year, '')
})
test('filtros validam intervalo, valores inesperados e datas inexistentes', () => {
    assert.throws(() => normalizeFilters({ start: '2026-10-14', end: '2026-10-01' }))
    const filters = normalizeFilters({ start: '2026-02-30', status: 'FAKE', userId: ['1'], page: '-1', inactivityDays: '15' })
    assert.equal(filters.start, '')
    assert.equal(filters.status, '')
    assert.equal(filters.userId, '')
    assert.equal(filters.page, 1)
    assert.equal(filters.inactivityDays, 15)
})
test('consulta mantém filtros combinados e inclui todo o último dia', () => {
    const where = whereFor(normalizeFilters({ year: '2025', scope: 'open', userId: 'unassigned', start: '2026-10-01', end: '2026-10-14', bairro: 'Centro', status: 'PENDENTE' }))
    assert.equal(where.year, 2025)
    assert.equal(where.user_id, null)
    assert.equal(where.status, 'PENDENTE')
    assert.equal(where.bairro, 'Centro')
    assert.equal(where.created_at[Op.gte].toISOString(), '2026-10-01T03:00:00.000Z')
    assert.equal(where.created_at[Op.lt].toISOString(), '2026-10-15T03:00:00.000Z')
    assert.equal(where[Op.or].length, 2)
})
test('preenche meses intermediários e contabiliza status desconhecido', () => {
    const data = [{ ...row(1, null, 1), created_at: new Date('2026-01-01T12:00:00Z') }, { ...row(2, 'FINALIZADA', 1), created_at: new Date('2026-03-01T12:00:00Z') }]
    const metrics = summarize(data, users, normalizeFilters({}), now)
    assert.deepEqual(metrics.monthly.map(m => m.total), [1, 0, 1])
    assert.equal(metrics.statusStats.reduce((sum, s) => sum + s.count, 0), 2)
})

test('painel, paginação, exports e atendimento funcionam sem banco', async t => {
    let data = []
    let reports = []
    let scopedPermissions=null
    const original = { ...repo }
    const originalGet = attendance.get, originalUpdate = attendance.update
    repo.findDenunciations = async () => data
    repo.findUsers = async () => users
    repo.findDistricts = async () => [{ name: 'Centro' }]
    repo.findYears = async () => [2026, 2025]
    repo.findRecentReports = async () => reports
    attendance.get = async () => ({ weekdays: [], paused: false, updated_at: null })
    attendance.update = async () => {}
    const app = express()
    app.set('views', path.resolve('views'))
    app.engine('ejs', ejs.__express)
    app.set('view engine', 'ejs')
    app.use(express.urlencoded({ extended: true }))
    app.use((req,res,next)=>{
        if(scopedPermissions){
            const auth={user:{id:1},role:{maximum:false,permissions:scopedPermissions}}
            res.locals.can=permission=>can(auth,permission)
            res.locals.canPath=target=>can(auth,routePermission(new URL(target,'http://livro.test').pathname,'GET'))
            res.locals.canManageReport=(permission,report)=>canManageReport(auth,permission,report)
        }
        next()
    })
    app.use(router)
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(async () => {
        Object.assign(repo, original)
        attendance.get = originalGet
        attendance.update = originalUpdate
        server.closeAllConnections()
        await new Promise(resolve => server.close(resolve))
    })
    const base = `http://127.0.0.1:${server.address().port}`
    await t.test('estado vazio e aba de atendimento', async () => {
        let res = await fetch(`${base}/admin`)
        assert.equal(res.status, 200)
        assert.match(await res.text(), /Nenhuma denúncia encontrada/)
        res = await fetch(`${base}/admin?tab=attendance`)
        assert.equal(res.status, 200)
        assert.match(await res.text(), /Nenhum dia definido/)
    })
    await t.test('paginação, filas e escape de conteúdo', async () => {
        data = Array.from({ length: 30 }, (_, i) => ({ ...row(i + 1, 'REGISTRADA', 90), title: '</script><script>alert(1)</script>' }))
        reports = [{ id: 1, created_at: now, type: 1, description: '<img src=x onerror=alert(1)>', user: users[0], denunciation: data[0] }]
        const res = await fetch(`${base}/admin?page=2&queue=unassigned&bairro=${encodeURIComponent('</script><script>alert(1)</script>')}`)
        const html = await res.text()
        assert.equal(res.status, 200)
        assert.match(html, /Página 2 de 2/)
        assert.match(html, /&lt;\/script&gt;/)
        assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
        assert.doesNotMatch(html, /<img src=x onerror/)
        const payload = html.match(/<script id="admin-chart-data" type="application\/json">([\s\S]*?)<\/script>/)[1]
        assert.equal(JSON.parse(payload).filters.bairro, '</script><script>alert(1)</script>')
    })
    await t.test('exports incluem todas as páginas e bloqueiam fórmulas CSV', async () => {
        data[0].title = '=HYPERLINK("test")'
        let res = await fetch(`${base}/admin/export/csv?queue=unassigned&page=2`)
        assert.equal(res.status, 200)
        const csv = await res.text()
        assert.equal(csv.split('\r\n').length, 31)
        assert.match(csv, /'=HYPERLINK/)
        res = await fetch(`${base}/admin/export/pdf?queue=unassigned`)
        assert.equal(res.status, 200)
        assert.match(res.headers.get('content-type'), /application\/pdf/)
        assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString(), '%PDF')
    })
    await t.test('painel não oferece atribuição ou edição de relatório sem as permissões da ação e autoria',async()=>{
        reports=[{id:91,user_id:1,type:1,description:'Próprio',denunciation:data[0]},{id:92,user_id:2,type:1,description:'Outro autor',denunciation:data[0]}]
        try{
            scopedPermissions=['dashboard.read']
            let html=await (await fetch(`${base}/admin?view=reports`)).text()
            assert.ok(!html.includes('href="/denuncias/'))
            assert.ok(!html.includes('href="/admin/assignments'))
            assert.ok(!html.includes('href="/relatorio/'))
            scopedPermissions=['dashboard.read','reports.edit']
            html=await (await fetch(`${base}/admin?view=reports`)).text()
            assert.ok(html.includes('href="/relatorio/91"'))
            assert.ok(!html.includes('href="/relatorio/92"'))
        }finally{scopedPermissions=null}
    })
    await t.test('datas invertidas retornam 400 e salvar atendimento informa resultado', async () => {
        assert.equal((await fetch(`${base}/admin?start=2026-10-14&end=2026-10-01`)).status, 400)
        let res = await fetch(`${base}/admin/attendance`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'weekdays=SEG' })
        assert.equal(res.headers.get('location'), '/admin?tab=attendance&notice=saved')
        attendance.update = async () => { throw new Error('Falha simulada') }
        res = await fetch(`${base}/admin/attendance`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'weekdays=SEG' })
        assert.equal(res.headers.get('location'), '/admin?tab=attendance&notice=error')
    })
})

test('gráficos preservam os filtros e usam os limites do mês escolhido', async () => {
    const configs = []
    const filters = normalizeFilters({ year: '2026', start: '2026-02-10', end: '2026-02-20', queue: 'inactive', userId: '2' })
    const window = { location: { href: '' } }
    const context = { window, URLSearchParams, Chart: function (_canvas, config) { configs.push(config) },
        document: { getElementById: id => id === 'admin-chart-data' ? { textContent: JSON.stringify({ filters, monthly: [{ month: '2026-02', total: 1 }], bairros: [{ bairro: 'Centro', total: 1 }], statusStats: [{ slug: 'REGISTRADA', label: 'Registrada', count: 1 }] }) } : {} } }
    vm.runInNewContext(await fs.readFile('public/js/admin.js', 'utf8'), context)
    configs[0].options.onClick(null, [{ index: 0 }])
    let params = new URL(window.location.href, 'http://localhost').searchParams
    assert.equal(params.get('start'), '2026-02-10')
    assert.equal(params.get('end'), '2026-02-20')
    assert.equal(params.get('userId'), '2')
    assert.equal(params.get('queue'), '')
    configs[1].options.onClick(null, [{ index: 0 }])
    params = new URL(window.location.href, 'http://localhost').searchParams
    assert.equal(params.get('bairro'), 'Centro')
    configs[2].options.onClick(null, [{ index: 0 }])
    params = new URL(window.location.href, 'http://localhost').searchParams
    assert.equal(params.get('status'), 'REGISTRADA')
})
