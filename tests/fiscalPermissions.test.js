import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import {protectRoutes} from '../src/auth/middleware.js'
import {can} from '../src/auth/permissions.js'
import router from '../src/controllers/usersController.js'
import users from '../src/services/usersService.js'
import denunciations from '../src/services/denunciationsService.js'
import Denunciation from '../src/models/denunciationsModel.js'

test('acesso à própria área, a todas as áreas e trabalho em outros registros são independentes',async()=>{
    const previous=process.env.AUTH_ENABLED
    const original={all:users.getAllOrdered,find:users.findByPk,list:denunciations.findAllByFiscal,row:Denunciation.findByPk}
    const people=[{id:1,name:'Fiscal atual',ativo:true},{id:2,name:'Fiscal inativo',ativo:false}]
    users.getAllOrdered=async()=>people
    users.findByPk=async id=>people.find(person=>String(person.id)===id)
    denunciations.findAllByFiscal=async()=>({ok:true,data:{denuncias:[{id:8,number:8,year:2026,title:'Resumo permitido',status:'REGISTRADA'}],total:1,hasMore:false,nextPage:null}})
    Denunciation.findByPk=async()=>({user_id:2,created_by_user_id:2})
    const scopes={own:['fiscal.area.own'],all:['fiscal.area.all','denunciations.edit.own'],work:['fiscal.area.own','fiscal.all','denunciations.edit.own'],editAll:['denunciations.edit.all'],none:[]}
    const app=express()
    app.set('views',fileURLToPath(new URL('../views/',import.meta.url)));app.set('view engine','ejs')
    app.use((req,res,next)=>{
        req.auth={user:people[0],account:{must_change_password:false},role:{maximum:false,permissions:scopes[req.get('X-Test-Scope')]}}
        req.usingBearer=true
        res.locals.can=permission=>can(req.auth,permission)
        next()
    })
    app.use(protectRoutes);app.use(router)
    app.get('/denuncias/pdf',(req,res)=>res.send('PDF permitido'))
    app.post('/denuncias/2/edit',(req,res)=>res.send('Edição permitida'))
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    const request=(scope,path,method='GET')=>fetch(base+path,{method,headers:{'X-Test-Scope':scope},redirect:'manual'})
    try{
        process.env.AUTH_ENABLED='true'
        const entry=await request('own','/area-fiscal')
        assert.equal(entry.headers.get('location'),'/area-fiscal/1')
        const own=await request('own','/area-fiscal/1')
        const ownHtml=await own.text()
        assert.equal(own.status,200);assert.ok(!ownHtml.includes('Selecionar outro fiscal'))
        assert.ok(ownHtml.includes('Resumo permitido'));assert.ok(!ownHtml.includes('href="/denuncias/8"'))
        assert.equal((await request('own','/area-fiscal/2')).status,403)
        assert.equal((await request('own','/denuncias/pdf?fiscalId=1')).status,200)
        assert.equal((await request('own','/denuncias/pdf?fiscalId=2')).status,403)
        const directory=await request('all','/area-fiscal')
        assert.equal(directory.status,200);assert.ok((await directory.text()).includes('Fiscal inativo'))
        assert.equal((await request('all','/area-fiscal/1')).status,200)
        assert.equal((await request('all','/area-fiscal/2')).status,200)
        assert.equal((await request('all','/denuncias/pdf?fiscalId=2')).status,200)
        assert.equal((await request('all','/denuncias/2/edit','POST')).status,403)
        assert.equal((await request('work','/area-fiscal/2')).status,403)
        assert.equal((await request('work','/denuncias/2/edit','POST')).status,403)
        assert.equal((await request('editAll','/denuncias/2/edit','POST')).status,200)
        assert.equal((await request('editAll','/area-fiscal/2')).status,403)
        assert.equal((await request('none','/area-fiscal/1')).status,403)
        assert.equal((await request('none','/denuncias/pdf?fiscalId=1')).status,403)
    }finally{
        users.getAllOrdered=original.all;users.findByPk=original.find;denunciations.findAllByFiscal=original.list;Denunciation.findByPk=original.row
        if(previous===undefined)delete process.env.AUTH_ENABLED;else process.env.AUTH_ENABLED=previous
        await new Promise(resolve=>server.close(resolve))
    }
})
