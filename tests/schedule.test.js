import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import publicRouter from '../src/controllers/scheduleController.js'
import adminRouter from '../src/controllers/adminScheduleController.js'
import service from '../src/services/scheduleService.js'

test('consulta da escala não permite edição e painel administra a escala do mês atual', async () => {
    const original={get:service.getCalendar,week:service.upsertWeek,day:service.upsertDay}
    const reads=[],writes=[]
    service.getCalendar=async(ano,mes)=>{reads.push([ano,mes]);return {ano:2026,mes:9,mesLabel:'Outubro 2026',semanas:[],dias:[]}}
    service.upsertWeek=async data=>writes.push(['week',data])
    service.upsertDay=async data=>writes.push(['day',data])
    const app=express()
    app.set('views',fileURLToPath(new URL('../views/',import.meta.url)))
    app.set('view engine','ejs')
    app.use(express.json());app.use(publicRouter);app.use('/admin/schedule',adminRouter)
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    try {
        let response=await fetch(base+'/escala'),html=await response.text()
        assert.equal(response.status,200)
        assert.ok(html.includes('Somente visualização'))
        assert.ok(!html.includes('schedule-editor.js'))
        assert.ok(!html.includes('id="modalSemana"'))
        assert.ok(html.includes('href="/escala?ano=2026'))
        response=await fetch(base+'/admin/schedule');html=await response.text()
        assert.equal(response.status,200)
        assert.ok(html.includes('id="modalSemana"'))
        assert.ok(html.includes('schedule-editor.js'))
        assert.ok(html.includes('aria-current="page">Escala'))
        assert.ok(Number.isNaN(reads[1][0]) && Number.isNaN(reads[1][1]))
        await fetch(base+'/admin/schedule?ano=2025&mes=11')
        assert.deepEqual(reads.at(-1),[2025,11])
        const post=(route,body)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
        for(const route of ['/escala/semana','/escala/dia'])assert.equal((await post(route,{nome:'Não gravar'})).status,405)
        assert.equal(writes.length,0)
        assert.equal((await post('/admin/schedule/week',{week_key:'42-2026',nome:' Fiscal A ',anotacao:'Notas'})).status,200)
        assert.equal((await post('/admin/schedule/day',{data:'2026-10-14',tipo:'feriado',anotacao:'Feriado'})).status,200)
        assert.equal(writes.length,2)
        assert.deepEqual(writes[0],['week',{weekKey:'42-2026',nome:'Fiscal A',anotacao:'Notas'}])
        assert.equal((await post('/admin/schedule/day',{data:'2026-02-30',tipo:'feriado'})).status,400)
        assert.equal((await post('/admin/schedule/week',{week_key:'42-2026',nome:''})).status,400)
        assert.equal((await fetch(base+'/escala?mes=12')).status,400)
        assert.equal(writes.length,2)
    } finally {
        service.getCalendar=original.get;service.upsertWeek=original.week;service.upsertDay=original.day
        await new Promise(resolve=>server.close(resolve))
    }
})
