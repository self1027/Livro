import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import ejs from 'ejs'
import path from 'node:path'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { Op } from 'sequelize'
import { normalizeFilters, currentYearStart, summarize, selectQueue, mergeMonthlyReports, summarizeMonthlyClosures } from '../src/utils/adminMetrics.js'
import repo, { whereFor } from '../src/repositories/adminRepository.js'
import Report from '../src/models/reportsModel.js'
import {applyCatalog, catalogDefaults} from '../src/utils/catalogRegistry.js'
import attendance from '../src/services/attendanceService.js'
import router, { adminUrl } from '../src/controllers/adminController.js'
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
test('abertura usa o ano atual de São Paulo e respeita períodos escolhidos, inclusive todo o histórico', () => {
    assert.equal(normalizeFilters({}, now).start, '2026-01-01')
    assert.equal(normalizeFilters({ scope:'open' }, now).start, '2026-01-01')
    assert.equal(currentYearStart(new Date('2027-01-01T02:59:59Z')), '2026-01-01')
    assert.equal(currentYearStart(new Date('2027-01-01T03:00:00Z')), '2027-01-01')
    assert.equal(normalizeFilters({ start:'2024-03-01' }, now).start, '2024-03-01')
    assert.equal(normalizeFilters({ year:'2024' }, now).start, '')
    assert.equal(normalizeFilters({ end:'2025-12-31' }, now).start, '')
    const allHistory = normalizeFilters({ start:'', end:'' }, now)
    for (const target of ['/admin','/admin/export/csv','/admin/export/pdf']) {
        const url = new URL(adminUrl(allHistory, { page:2, view:'analytics' }, target), 'http://livro.test')
        assert.equal(url.searchParams.get('start'), '')
        assert.equal(url.searchParams.get('end'), '')
        assert.equal(normalizeFilters(Object.fromEntries(url.searchParams), now).start, '')
    }
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
test('comparativo mensal inclui meses só com relatório ou finalização e preenche lacunas nas três séries',()=>{
    assert.deepEqual(mergeMonthlyReports([{month:'2026-02',total:3}],[{month:'2025-12',total:'2'},{month:'2026-03',total:'4'}]),[
        {month:'2025-12',total:0,withReport:2,closed:0},
        {month:'2026-01',total:0,withReport:0,closed:0},
        {month:'2026-02',total:3,withReport:0,closed:0},
        {month:'2026-03',total:0,withReport:4,closed:0}
    ])
    assert.deepEqual(mergeMonthlyReports([],[{month:'2026-10',total:'1'}]),[{month:'2026-10',total:0,withReport:1,closed:0}])
    assert.deepEqual(mergeMonthlyReports([],[],[{month:'2026-02',total:'2'},{month:'2026-04',total:'1'}]),[
        {month:'2026-02',total:0,withReport:0,closed:2},
        {month:'2026-03',total:0,withReport:0,closed:0},
        {month:'2026-04',total:0,withReport:0,closed:1}
    ])
    assert.deepEqual(mergeMonthlyReports([],[]),[])
})

test('finalizações mensais usam o destino da mudança, deduplicam denúncias e respeitam a virada do mês em São Paulo',()=>{
    const event=(id,description,created_at='2026-02-12T12:00:00Z',type=0)=>({denunciation_id:id,type,description,created_at})
    assert.deepEqual(summarizeMonthlyClosures([
        event(1,'Status alterado de "Em Andamento" para "Finalizada"'),
        event(1,'Status alterado de "Finalizada" para "Registrada"'),
        event(1,'Status alterado de "Registrada" para "Finalizada"','2026-02-20T12:00:00Z'),
        event(2,'Status alterado para "Finalizada"','2026-02-12T12:00:00Z',1),
        event(3,'Status alterado para "Finalizada"','2026-03-01T02:59:59Z'),
        event(1,'Status alterado para "Finalizada"','2026-03-01T03:00:00Z'),
        event(4,'Status alterado de "Finalizada" para "Em Andamento"'),
        event(5,'Fiscal atribuído. Finalizada'),
        event(6,'Foi solicitada a alteração para "Finalizada"')
    ]),[{month:'2026-02',total:2},{month:'2026-03',total:1}])
    assert.deepEqual(summarizeMonthlyClosures([]),[])
})

test('finalizações reconhecem o nome atual do catálogo e o nome original do histórico',()=>{
    try{
        applyCatalog(catalogDefaults.map(status=>status.slug==='FINALIZADA'?{...status,label:'Encerrada'}:status))
        const events=['Finalizada','Encerrada','FINALIZADA','Em Andamento'].map((label,index)=>({denunciation_id:index,type:0,description:`Status alterado para "${label}"`,created_at:'2026-02-12T12:00:00Z'}))
        assert.deepEqual(summarizeMonthlyClosures(events),[{month:'2026-02',total:3}])
    }finally{applyCatalog(catalogDefaults)}
})

test('consulta de finalizações filtra a data da mudança e mantém o fiscal responsável e os demais filtros na denúncia',async()=>{
    const original=Report.findAll
    let options
    Report.findAll=async input=>{options=input;return [{denunciation_id:1,type:0,description:'Status alterado para "Finalizada"',created_at:'2026-03-01T03:00:00Z'}]}
    try{
        const result=await repo.findMonthlyClosedDenunciations(normalizeFilters({start:'2026-03-01',end:'2026-03-31',year:'2024',userId:'2',bairro:'Centro',registration_type:'OFICIO'}))
        assert.deepEqual(result,[{month:'2026-03',total:1}])
        assert.equal(options.where.type,0)
        assert.equal(options.where.created_at[Op.gte].toISOString(),'2026-03-01T03:00:00.000Z')
        assert.equal(options.where.created_at[Op.lt].toISOString(),'2026-04-01T03:00:00.000Z')
        assert.equal(options.where.user_id,undefined)
        const complaint=options.include[0].where
        assert.equal(complaint.created_at,undefined)
        assert.equal(complaint.status,undefined) // Reopened complaints still have historical closures.
        assert.equal(complaint.year,2024)
        assert.equal(complaint.user_id,2)
        assert.equal(complaint.bairro,'Centro')
        assert.equal(complaint.registration_type,'OFICIO')
    }finally{Report.findAll=original}
})

test('painel, paginação, exports e atendimento funcionam sem banco', async t => {
    let data = []
    let reports = []
    let actionReports = []
    let scopedPermissions=null
    const calls=[]
    const original = { ...repo }
    const originalGet = attendance.get, originalUpdate = attendance.update
    repo.findDenunciations = async filters => {calls.push(['denunciations',filters]);return data}
    repo.findUsers = async () => users
    repo.findDistricts = async () => [{ name: 'Centro' }]
    repo.findYears = async () => [2026, 2025]
    repo.findRecentReports = async filters => {calls.push(['reports',filters]);return reports}
    repo.findSivisaReports = async filters => {calls.push(['sivisa',filters]);return actionReports.filter(report=>!filters.userId||String(report.user_id)===filters.userId)}
    repo.findActionReports = async ids => {calls.push(['actionDetails',ids]);return ids.map(id=>actionReports.find(report=>report.id===id))}
    repo.findMonthlyReportedDenunciations = async filters => {calls.push(['monthlyReports',filters]);return [{month:'2026-10',total:'2'}]}
    repo.findMonthlyClosedDenunciations = async filters => {calls.push(['monthlyClosed',filters]);return [{month:'2026-10',total:'1'}]}
    attendance.get = async () => {calls.push(['attendance']);return { weekdays: [], paused: false, updated_at: null }}
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
        calls.length=0
        let res = await fetch(`${base}/admin`)
        assert.equal(res.status, 200)
        const html=await res.text()
        assert.match(html, /Nenhuma denúncia encontrada/)
        assert.doesNotMatch(html, /id="monthChart"|id="admin-chart-data"|<th>Protocolos<\/th>|Últimos relatórios/)
        assert.deepEqual(calls.map(([name])=>name), ['denunciations'])
        assert.equal(calls[0][1].start,currentYearStart())
        calls.length=0
        res = await fetch(`${base}/admin?tab=attendance`)
        assert.equal(res.status, 200)
        assert.match(await res.text(), /Nenhum dia definido/)
        assert.deepEqual(calls.map(([name])=>name), ['attendance'])
    })
    await t.test('cada análise carrega somente seus dados e mantém período explícito',async()=>{
        for(const [view,queryName,marker] of [['sivisa','sivisa','Aguardando SIVISA'],['reports','reports','Últimos relatórios'],['analytics','denunciations','id="monthChart"']]){
            calls.length=0
            const res=await fetch(`${base}/admin?view=${view}&start=&end=`)
            assert.equal(res.status,200)
            const html=await res.text()
            assert.ok(html.includes(marker))
            assert.deepEqual(calls.map(([name])=>name),view==='analytics'?[queryName,'monthlyReports','monthlyClosed']:[queryName])
            assert.equal(calls[0][1].start,'')
            assert.match(html,/Desde o início do livro/)
            if(view==='analytics'){
                const payload=JSON.parse(html.match(/<script id="admin-chart-data" type="application\/json">([\s\S]*?)<\/script>/)[1])
                assert.deepEqual(payload.monthly,[{month:'2026-10',total:0,withReport:2,closed:1}])
                assert.match(html,/Com relatório registrado/)
                assert.match(html,/<th>Denúncias finalizadas<\/th>/)
                assert.match(html,/<td>2<\/td><td>1<\/td>/)
                assert.equal(calls[1][1].start,'')
                assert.equal(calls[2][1].start,'')
            }
        }
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
        const analytics=await (await fetch(`${base}/admin?view=analytics&bairro=${encodeURIComponent('</script><script>alert(1)</script>')}`)).text()
        assert.doesNotMatch(analytics, /<script>alert\(1\)<\/script>/)
        const payload = analytics.match(/<script id="admin-chart-data" type="application\/json">([\s\S]*?)<\/script>/)[1]
        assert.equal(JSON.parse(payload).filters.bairro, '</script><script>alert(1)</script>')
    })
    await t.test('exports incluem todas as páginas e bloqueiam fórmulas CSV', async () => {
        data[0].title = '=HYPERLINK("test")'
        calls.length=0
        let res = await fetch(`${base}/admin/export/csv?queue=unassigned&page=2&view=sivisa&start=&end=`)
        assert.equal(res.status, 200)
        const csv = await res.text()
        assert.equal(csv.split('\r\n').length, 31)
        assert.match(csv, /'=HYPERLINK/)
        assert.deepEqual(calls.map(([name])=>name),['denunciations'])
        assert.equal(calls[0][1].start,'')
        res = await fetch(`${base}/admin/export/pdf?queue=unassigned`)
        assert.equal(res.status, 200)
        assert.match(res.headers.get('content-type'), /application\/pdf/)
        assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString(), '%PDF')
    })
    await t.test('quantidade por autor abre as ações corretas e preserva o período e os demais filtros',async()=>{
        actionReports=[
            {id:101,type:1,user_id:1,created_at:now,description:'Visita sanitária <script>alert(1)</script>',user:users[0],denunciation:data[0],sivisa:{applies:true},sivisaProtocols:[]},
            {id:102,type:1,user_id:1,created_at:now,description:'Retorno da inspeção',user:users[0],denunciation:data[0],sivisa:{applies:true},sivisaProtocols:[{id:1,protocol:'01.000001/26'},{id:2,protocol:'01.000002/26'}]},
            {id:103,type:1,user_id:2,created_at:now,description:'Ação de outro autor',user:users[1],denunciation:data[0]}
        ]
        const summary=await (await fetch(`${base}/admin?view=sivisa&start=2026-01-01&end=2026-10-31&bairro=Centro`)).text()
        const href=summary.match(/href="([^"]+)" aria-label="Ver 2 ações de Fiscal A"/)[1].replaceAll('&amp;','&')
        const params=new URL(href,base).searchParams
        assert.equal(params.get('userId'),'1')
        assert.equal(params.get('actionMetric'),'actions')
        assert.equal(params.get('start'),'2026-01-01')
        assert.equal(params.get('end'),'2026-10-31')
        assert.equal(params.get('bairro'),'Centro')
        calls.length=0
        const res=await fetch(new URL(href,base))
        assert.equal(res.status,200)
        const html=await res.text()
        assert.match(html,/Ações · Fiscal A/)
        assert.match(html,/Visita sanitária &lt;script&gt;/)
        assert.match(html,/Retorno da inspeção/)
        assert.doesNotMatch(html,/Ação de outro autor|<script>alert\(1\)/)
        assert.deepEqual(calls.find(([name])=>name==='actionDetails')[1],[102,101])
        const pending=await (await fetch(`${base}/admin?view=sivisa&userId=1&actionMetric=pending`)).text()
        assert.match(pending,/Visita sanitária/)
        assert.doesNotMatch(pending,/Retorno da inspeção/)
        const protocols=await (await fetch(`${base}/admin?view=sivisa&userId=1&actionMetric=protocols`)).text()
        assert.match(protocols,/2 protocolos em 1 ação/)
        assert.match(protocols,/01\.000001\/26/)
        assert.match(protocols,/01\.000002\/26/)
        const empty=await (await fetch(`${base}/admin?view=sivisa&userId=1&actionMetric=notApplicable`)).text()
        assert.match(empty,/Nenhuma ação encontrada para esta seleção/)
        try{
            scopedPermissions=['dashboard.read']
            const restricted=await (await fetch(new URL(href,base))).text()
            assert.match(restricted,/Visita sanitária/)
            assert.doesNotMatch(restricted,/href="\/denuncias\/|href="\/relatorio\//)
            scopedPermissions=['dashboard.read','reports.edit']
            const other=await (await fetch(`${base}/admin?view=sivisa&userId=2&actionMetric=actions`)).text()
            assert.match(other,/Ação de outro autor/)
            assert.doesNotMatch(other,/href="\/relatorio\//)
        }finally{scopedPermissions=null;actionReports=[]}
    })
    await t.test('detalhamento pagina 25 ações e só busca os textos da página solicitada',async()=>{
        actionReports=Array.from({length:30},(_,i)=>({id:i+1,type:1,user_id:1,created_at:now,description:`Ação ${i+1}`,user:users[0],denunciation:data[0]}))
        try{
            calls.length=0
            const html=await (await fetch(`${base}/admin?view=sivisa&userId=1&actionMetric=actions&page=2&start=&end=`)).text()
            assert.match(html,/Página 2 de 2/)
            assert.deepEqual(calls.find(([name])=>name==='actionDetails')[1],[5,4,3,2,1])
            assert.match(html,/actionMetric=actions/)
            assert.match(html,/start=&amp;end=/)
        }finally{actionReports=[]}
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
    const filters = normalizeFilters({ view:'analytics', year: '2026', start: '2026-02-10', end: '2026-02-20', queue: 'inactive', userId: '2' })
    const window = { location: { href: '' } }
    const context = { window, URLSearchParams, Chart: function (_canvas, config) { configs.push(config) },
        document: { getElementById: id => id === 'admin-chart-data' ? { textContent: JSON.stringify({ filters, monthly: [{ month: '2026-02', total: 1, withReport: 2, closed: 3 }], bairros: [{ bairro: 'Centro', total: 1 }], statusStats: [{ slug: 'REGISTRADA', label: 'Registrada', count: 1 }] }) } : {} } }
    vm.runInNewContext(await fs.readFile('public/js/admin.js', 'utf8'), context)
    configs[0].options.onClick(null, [{ index: 0 }])
    let params = new URL(window.location.href, 'http://localhost').searchParams
    assert.equal(params.get('start'), '2026-02-10')
    assert.equal(params.get('end'), '2026-02-20')
    assert.equal(params.get('userId'), '2')
    assert.equal(params.get('queue'), '')
    assert.equal(params.get('view'), 'overview')
    assert.equal(configs[0].data.datasets.length,3)
    assert.equal(configs[0].data.datasets[0].data[0],1)
    assert.equal(configs[0].data.datasets[1].data[0],2)
    assert.equal(configs[0].data.datasets[2].data[0],3)
    assert.equal(configs[0].data.datasets[2].label,'Denúncias finalizadas')
    window.location.href=''
    configs[0].options.onClick(null,[{index:0,datasetIndex:1}])
    assert.equal(window.location.href,'') // A report month must not open a list filtered by complaint creation date.
    configs[0].options.onClick(null,[{index:0,datasetIndex:2}])
    assert.equal(window.location.href,'') // Closure dates also differ from complaint creation dates.
    configs[1].options.onClick(null, [{ index: 0 }])
    params = new URL(window.location.href, 'http://localhost').searchParams
    assert.equal(params.get('bairro'), 'Centro')
    configs[2].options.onClick(null, [{ index: 0 }])
    params = new URL(window.location.href, 'http://localhost').searchParams
    assert.equal(params.get('status'), 'REGISTRADA')
})
