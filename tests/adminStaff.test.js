import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import admin from '../src/controllers/adminStaffController.js'
import userRoutes from '../src/controllers/usersController.js'
import denunciationRoutes from '../src/controllers/denunciationsController.js'
import users from '../src/services/usersService.js'
import denunciations from '../src/services/denunciationsService.js'
import repo from '../src/repositories/denunciationsRepository.js'
import userRepo from '../src/repositories/usersRepository.js'
import User from '../src/models/usersModel.js'

test('gestão antiga redireciona para acessos sem gravar; atribuição mantém fila paginada', async () => {
    const original={all:users.getAllOrdered,active:users.getActiveUsers,find:users.findByPk,create:users.create,update:users.update,count:repo.count,list:repo.findAll,selected:repo.findByIdWithUser,assign:denunciations.assignDenunciation}
    const updates=[],assignments=[];let listOptions
    const fiscal={id:1,name:'Fiscal <teste>',ativo:true}
    const row={id:2,number:12,year:2026,title:'Denúncia <teste>',description:'Descrição',endereco:'Rua',numero:1,bairro:'Centro',created_at:'2026-10-14',status:'REGISTRADA',registration_type:'PESSOA_TELEFONE',user_id:null}
    users.getAllOrdered=async()=>[fiscal];users.getActiveUsers=async()=>[fiscal];users.findByPk=async id=>id==='1'?fiscal:null
    users.create=async data=>updates.push(['create',data]);users.update=async(id,data)=>updates.push(['update',id,data])
    repo.count=async()=>51;repo.findAll=async options=>{listOptions=options;return [row]};repo.findByIdWithUser=async id=>id==='2'?row:null
    denunciations.assignDenunciation=async(id,userId)=>{assignments.push([id,userId]);return {ok:true}}
    const app=express();app.set('views',fileURLToPath(new URL('../views/',import.meta.url)));app.set('view engine','ejs');app.use(express.urlencoded({extended:true}));app.use('/admin',admin);app.use(userRoutes);app.use(denunciationRoutes)
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`
    const post=(route,body)=>fetch(base+route,{method:'POST',body:new URLSearchParams(body),redirect:'manual'})
    try {
        let response,html
        for(const route of ['/admin/fiscais','/admin/fiscais/1/edit']){
            response=await fetch(base+route,{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/admin/access')
        }
        for(const route of ['/admin/fiscais','/admin/fiscais/1','/usuario/registrar','/usuario/atualizar/1']){
            response=await post(route,{name:'Novo fiscal'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/admin/access')
        }
        assert.deepEqual(updates,[])
        response=await fetch(base+'/admin/assignments?page=2');html=await response.text();assert.equal(response.status,200);assert.equal(listOptions.limit,25);assert.equal(listOptions.offset,25);assert.equal(listOptions.where.user_id,null);assert.ok(html.includes('Página 2 de 3'));assert.ok(html.includes('Denúncia &lt;teste&gt;'))
        response=await fetch(base+'/admin/assignments?denunciaId=2');html=await response.text();assert.ok(html.includes('action="/admin/assignments/2"'));assert.ok(html.includes('id="assignment-user"'))
        assert.equal((await fetch(base+'/admin/assignments?denunciaId=999')).status,404)
        response=await post('/admin/assignments/2',{userId:'1',redirectToShow:'true'});assert.equal(response.headers.get('location'),'/denuncias/2?notice=fiscal-saved');assert.deepEqual(assignments,[['2','1']])
        response=await post('/admin/assignments/2',{userId:''});assert.ok(response.headers.get('location').startsWith('/admin/assignments?denunciaId=2&error='));assert.equal(assignments.length,1)
        for(const [route,destination] of [['/cadastro/usuario','/admin/access'],['/editar-usuario/1','/admin/access'],['/atribuir?denunciaId=2','/admin/assignments?denunciaId=2']]){const legacy=await fetch(base+route,{redirect:'manual'});assert.equal(legacy.status,302);assert.equal(legacy.headers.get('location'),destination)}
        const legacyWrite=await post('/atribuir/2',{userId:'1'});assert.equal(legacyWrite.status,307);assert.equal(legacyWrite.headers.get('location'),'/admin/assignments/2')
    }finally{
        users.getAllOrdered=original.all;users.getActiveUsers=original.active;users.findByPk=original.find;users.create=original.create;users.update=original.update;repo.count=original.count;repo.findAll=original.list;repo.findByIdWithUser=original.selected;denunciations.assignDenunciation=original.assign
        await new Promise(resolve=>server.close(resolve))
    }
})

test('estado ativo explícito permanece estável em salvamentos repetidos', async () => {
    const original=User.findByPk
    const previousAuth=process.env.AUTH_ENABLED
    process.env.AUTH_ENABLED='false' // Exercise the mocked legacy repository without connecting to the configured database.
    const user={name:'Fiscal',ativo:true,save:async()=>user}
    User.findByPk=async()=>user
    try {await userRepo.update(1,{ativo:false});assert.equal(user.ativo,false);await userRepo.update(1,{ativo:false});assert.equal(user.ativo,false);await userRepo.update(1,{ativo:true});assert.equal(user.ativo,true)}
    finally {User.findByPk=original;if(previousAuth===undefined)delete process.env.AUTH_ENABLED;else process.env.AUTH_ENABLED=previousAuth}
})
