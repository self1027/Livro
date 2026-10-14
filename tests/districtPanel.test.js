import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import catalogRouter from '../src/controllers/catalogController.js'
import districtRouter from '../src/controllers/districtsController.js'
import service from '../src/services/districtsService.js'

test('bairros são gerenciados no painel e todas as operações retornam à seção correta', async () => {
    const original = {getAll:service.getAll,create:service.create,update:service.update,remove:service.remove}
    const calls = []
    service.getAll = async () => [{id:1,name:"Jardim D'Água <teste>",slug:'jardim-dagua'}]
    service.create = async body => { calls.push(['create',body.name]); return {ok:true} }
    service.update = async (id,body) => { calls.push(['update',id,body.name]); return {ok:true} }
    service.remove = async id => { calls.push(['remove',id]); return {ok:false,message:'Bairro não encontrado'} }
    const app = express()
    app.set('views',fileURLToPath(new URL('../views/',import.meta.url)))
    app.set('view engine','ejs')
    app.use(express.urlencoded({extended:true}))
    app.use(catalogRouter)
    app.use(districtRouter)
    const server = app.listen(0)
    await new Promise(resolve=>server.once('listening',resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    try {
        const response = await fetch(`${base}/admin/catalogs?kind=district`)
        assert.equal(response.status,200)
        const html = await response.text()
        assert.ok(html.includes('id="districtTable"'))
        assert.ok(html.includes('data-edit-district="1"'))
        assert.ok(html.includes('&lt;teste&gt;'))
        assert.ok(!html.includes('openEditModal('))
        assert.ok(!html.includes('data-color-picker'))
        const legacy = await fetch(`${base}/bairros?success=Mensagem`,{redirect:'manual'})
        assert.equal(legacy.status,302)
        assert.equal(legacy.headers.get('location'),'/admin/catalogs?kind=district&success=Mensagem')
        for (const route of ['/bairros','/bairros/1','/bairros/1/delete']) {
            const saved = await fetch(base+route,{method:'POST',body:new URLSearchParams({name:'Centro'}),redirect:'manual'})
            assert.equal(saved.status,302)
            const location = new URL(saved.headers.get('location'),base)
            assert.equal(location.pathname,'/admin/catalogs')
            assert.equal(location.searchParams.get('kind'),'district')
            assert.ok(location.searchParams.has('success')||location.searchParams.has('error'))
        }
        assert.deepEqual(calls,[['create','Centro'],['update','1','Centro'],['remove','1']])
    } finally {
        Object.assign(service,original)
        await new Promise(resolve=>server.close(resolve))
    }
})
