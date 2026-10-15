import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { UniqueConstraintError } from 'sequelize'
import catalogService, { createCatalogService, generateSlug, validateEntry } from '../src/services/catalogService.js'
import router from '../src/controllers/catalogController.js'
import { applyCatalog, catalogDefaults, statuses, senders, reportDetails, closedStatusSlugs } from '../src/utils/catalogRegistry.js'
import { summarize, normalizeFilters } from '../src/utils/adminMetrics.js'
import { whereFor } from '../src/repositories/adminRepository.js'
import REPORT_TYPE from '../src/constants/reportType.js'
import reportsService from '../src/services/reportsService.js'
import reportsRepo from '../src/repositories/reportsRepository.js'
import denunciationsRepo from '../src/repositories/denunciationsRepository.js'
import { Op } from 'sequelize'
import { hsvToRgb, rgbToHsv, rgbToHex, hexToRgb, contrastRatio } from '../public/js/colorMath.js'
import db from '../src/database/database.js'
import sivisaService from '../src/services/sivisaService.js'

function memoryCatalog() {
    let rows = catalogDefaults.map((row, i) => ({ ...row, id:i + 1 }))
    let conflict = false
    const wrap = row => row && { ...row, update: async data => Object.assign(row,data) }
    const model = {
        sync: async () => {},
        findAll: async () => rows.map(row => ({...row})),
        findByPk: async id => wrap(rows.find(row => row.id === id)),
        findOne: async ({where}) => wrap(rows.find(row => Object.entries(where).every(([key,value]) => row[key] === value))),
        max: async () => Math.max(-1, ...rows.filter(row => row.code != null).map(row => row.code)),
        create: async data => {
            if (conflict) { conflict = false; throw new UniqueConstraintError({message:'concurrent create'}) }
            const row = {...data,id:rows.length + 1}; rows.push(row); return wrap(row)
        },
        findOrCreate: async ({where,defaults}) => {
            const row = await model.findOne({where})
            return row ? [row,false] : [await model.create(defaults),true]
        }
    }
    const db = { transaction: async callback => {
        const snapshot = structuredClone(rows)
        try { return await callback({LOCK:{UPDATE:'UPDATE'}}) }
        catch (error) { rows = snapshot; throw error }
    } }
    let published
    const service = createCatalogService({model,db,publish:rows => {published = rows}})
    return {service, get rows(){return rows}, get published(){return published}, forceConflict:()=>{conflict = true}}
}
const input = {label:'Vistoria sanitária',color:'#123456',backgroundColor:'#FFFFFF',behavior:'progress'}

test('cadastros geram slugs únicos, preservam referências e inicialização não sobrescreve edição', async () => {
    const catalog = memoryCatalog()
    const first = await catalog.service.save('status',input)
    assert.equal(first.slug,'VISTORIA_SANITARIA')
    const renamed = await catalog.service.save('status',{...input,label:'Vistoria concluída',behavior:'closed',slug:'forged'},first.id)
    assert.equal(renamed.slug,first.slug)
    assert.equal(renamed.color,'#123456')
    assert.equal(renamed.backgroundColor,'#ffffff')
    const duplicate = await catalog.service.save('status',input)
    assert.equal(duplicate.slug,'VISTORIA_SANITARIA_2')
    await catalog.service.initialize()
    assert.equal(catalog.rows.find(row => row.id === first.id).label,'Vistoria concluída')
    assert.equal(catalog.published.length,catalog.rows.length)
    await assert.rejects(catalog.service.save('report',{...input,behavior:'text'}),/Categoria inválida/)
    catalog.forceConflict()
    assert.ok(await catalog.service.save('sender',input))
})

test('validação bloqueia cores e classificações inválidas e preserva comportamento automático', async () => {
    assert.equal(generateSlug('Órgão / Saúde'),'ORGAO_SAUDE')
    assert.throws(() => validateEntry('status',{...input,color:'red;display:none'}),/RGB/)
    assert.throws(() => validateEntry('status',{...input,label:'!!!'}),/nome/)
    assert.throws(() => validateEntry('report',{...input,behavior:'status'}),/Categoria inválida/)
    const initial = catalogDefaults.find(row => row.slug === 'REGISTRADA')
    assert.equal(validateEntry('status',{...input,behavior:'closed'},initial).behavior,'registered')
    const catalog = memoryCatalog()
    const size = catalog.rows.length
    await assert.rejects(catalog.service.save('status',{...input,color:'invalid'}))
    await assert.rejects(catalog.service.save('sender',input,1),/não encontrado/)
    assert.equal(catalog.rows.length,size)
})

test('alterações do banco alimentam métricas sem alterar tipos internos de relatório', () => {
    const rows = [...catalogDefaults,{kind:'status',slug:'ENCERRADA',label:'Encerrada',behavior:'closed',color:'#123456',backgroundColor:'#ffffff'}, {kind:'report',slug:'INSPECAO',label:'Inspeção',behavior:'text',code:2}]
    try {
        applyCatalog(rows)
        assert.ok(closedStatusSlugs().includes('ENCERRADA'))
        assert.ok(whereFor(normalizeFilters({scope:'open'}))[Op.or][0].status[Op.notIn].includes('ENCERRADA'))
        const metrics = summarize([{id:1,status:'ENCERRADA',created_at:new Date(),user_id:null}],[],normalizeFilters({}))
        assert.equal(metrics.stats.open,0)
        assert.equal(metrics.stats.closed,1)
        assert.deepEqual(REPORT_TYPE,{STATUS_CHANGE:0,TEXT:1})
        assert.equal(reportDetails[2],undefined)
        assert.ok(Object.isFrozen(reportDetails))
        assert.equal(statuses.ENCERRADA.label,'Encerrada')
        assert.ok(Object.keys(senders).length)
    } finally { applyCatalog(catalogDefaults) }
})

test('RGB, hexadecimal e quadrado HSV preservam as cores e calculam contraste', () => {
    for (const hex of ['#000000','#ffffff','#123456','#ff0000','#00ff00','#0000ff']) {
        const rgb = hexToRgb(hex)
        assert.equal(rgbToHex(hsvToRgb(...rgbToHsv(rgb))),hex)
    }
    assert.equal(contrastRatio([0,0,0],[255,255,255]),21)
    assert.equal(hexToRgb('#xyzxyz'),null)
})

test('tipo de relatório é definido pelo backend mesmo com tipo forjado na entrada', async () => {
    const find = denunciationsRepo.findByPk, create = reportsRepo.create
    const transaction=db.transaction,saveSivisa=sivisaService.saveForReport
    const writes = []
    denunciationsRepo.findByPk = async () => ({status:'REGISTRADA'})
    reportsRepo.create = async data => { writes.push(data); return data }
    db.transaction=async callback=>callback({LOCK:{UPDATE:'UPDATE'}})
    sivisaService.saveForReport=async()=>{}
    try {
        const result = await reportsService.addReport({denunciationId:1,userId:1,description:'Texto',reportType:0,sivisa_state:'not_applicable'})
        assert.equal(result.ok,true)
        assert.equal(writes.length,1)
        assert.equal(writes[0].type,REPORT_TYPE.TEXT)
    } finally { denunciationsRepo.findByPk = find; reportsRepo.create = create;db.transaction=transaction;sivisaService.saveForReport=saveSivisa }
})
test('painel renderiza categorias e mantém valores ao rejeitar alterações', async () => {
    const originalList = catalogService.list, originalSave = catalogService.save
    catalogService.list = async () => catalogDefaults.map((entry,id)=>({...entry,id:id+1}))
    catalogService.save = async () => { throw Object.assign(new Error('Informe cores RGB válidas.'),{status:400}) }
    const app = express()
    app.set('views',fileURLToPath(new URL('../views/',import.meta.url)))
    app.set('view engine','ejs')
    app.use(express.urlencoded({extended:true}))
    app.use(router)
    const server = app.listen(0)
    await new Promise(resolve=>server.once('listening',resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    try {
        for (const kind of ['status','sender']) {
            const response = await fetch(`${base}/admin/catalogs?kind=${kind}`)
            assert.equal(response.status,200)
            const html = await response.text()
            assert.ok(html.includes('data-color-picker'))
            assert.ok(html.includes('type="module"'))
            assert.ok(!html.includes('kind=report'))
            assert.equal((html.match(/id="app-navigation"/g)||[]).length,1)
        }
        for (const route of ['/admin/catalogs/report','/admin/catalogs/report/12']) {
            const denied = await fetch(base + route,{method:'POST',body:new URLSearchParams(input)})
            assert.equal(denied.status,400)
        }
        const response = await fetch(`${base}/admin/catalogs/status/1`, {method:'POST',body:new URLSearchParams({...input,label:'Nome <teste>',color:'invalid'})})
        assert.equal(response.status,400)
        const html = await response.text()
        assert.ok(html.includes('Nome &lt;teste&gt;'))
        assert.ok(html.includes('Informe cores RGB válidas.'))
    } finally {
        catalogService.list = originalList; catalogService.save = originalSave
        await new Promise(resolve=>server.close(resolve))
    }
})
