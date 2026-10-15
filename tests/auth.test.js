import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import {hashPassword,verifyPassword,normalizeUsername,tokenHash,randomToken} from '../src/auth/passwords.js'
import {validateRole,can,PERMISSIONS,PERMISSION_DESCRIPTIONS} from '../src/auth/permissions.js'
import {routePermission,checkCsrf,authContext,protectRoutes} from '../src/auth/middleware.js'
import {authRouter} from '../src/auth/controller.js'

test('senhas usam salt independente; username normalizado e valores inválidos rejeitados',async()=>{
    const password='uma frase longa para teste'
    const first=await hashPassword(password),second=await hashPassword(password)
    assert.notEqual(first,second)
    assert.equal(await verifyPassword(password,first),true)
    assert.equal(await verifyPassword('senha incorreta',first),false)
    assert.equal(await verifyPassword(password,'invalid'),false)
    await assert.rejects(hashPassword('curta'))
    assert.equal(normalizeUsername('Fiscal.01'),'fiscal.01')
    assert.throws(()=>normalizeUsername(' fiscal '))
    const token=randomToken();assert.equal(token.length,43);assert.notEqual(tokenHash(token),token)
})
test('responsabilidades usam permissões conhecidas e autoridade máxima independente do nome',()=>{
    const role=validateRole({name:' Coordenação ',maximum:true,permissions:['catalogs.manage','catalogs.manage']})
    assert.deepEqual(role.permissions,['catalogs.manage']);assert.equal(role.name,'Coordenação')
    assert.equal(can({role},'denunciations.create'),true)
    assert.equal(can({role:{name:'Chefia',maximum:false,permissions:[]}},'catalogs.manage'),false)
    assert.throws(()=>validateRole({name:'Teste',permissions:['invented']}))
    assert.ok(Object.keys(PERMISSIONS).length>10)
    for(const permission of Object.keys(PERMISSIONS))assert.ok(PERMISSION_DESCRIPTIONS[permission]?.length>30)
    assert.equal(can({role},'denunciations.receive'),false)
    assert.equal(can({role:{...role,permissions:['denunciations.receive']}},'denunciations.receive'),true)
})
test('rotas antigas e atuais exigem a mesma permissão; rotas desconhecidas não são liberadas',()=>{
    for(const path of ['/cadastro/usuario','/usuario/registrar','/editar-usuario/1','/usuario/atualizar/1','/admin/fiscais/1'])assert.equal(routePermission(path,'POST'),'maximum')
    for(const path of ['/atribuir','/atribuir/1','/admin/assignments/1'])assert.equal(routePermission(path,'POST'),'denunciations.assign')
    for(const path of ['/bairros','/bairros/1/delete','/admin/catalogs/status'])assert.equal(routePermission(path,'POST'),'catalogs.manage')
    assert.equal(routePermission('/admin/access/roles/1','POST'),'maximum')
    assert.equal(routePermission('/future-module','GET'),null)
    assert.equal(checkCsrf({get:()=>null,body:{_csrf:'valid'}},'valid'),true)
    assert.equal(checkCsrf({get:()=>null,body:{_csrf:'other'}},'valid'),false)
    assert.equal(checkCsrf({get:()=>null,body:{_csrf:'é'}},'a'),false)
})
test('ativação é explícita; login renderiza CSRF no servidor e chamadas sem autenticação são bloqueadas',async()=>{
    const previous=process.env.AUTH_ENABLED
    const app=express();app.set('views',fileURLToPath(new URL('../views/',import.meta.url)));app.set('view engine','ejs');app.use(express.urlencoded({extended:false}));app.use(authContext);app.use(authRouter);app.use(protectRoutes);app.get('/',(req,res)=>res.send('legacy'))
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`
    try{
        process.env.AUTH_ENABLED='false'
        assert.equal(await (await fetch(base+'/')).text(),'legacy')
        assert.equal((await fetch(base+'/auth/login')).status,404)
        process.env.AUTH_ENABLED='true'
        assert.equal((await fetch(base+'/',{redirect:'manual'})).status,302)
        assert.equal((await fetch(base+'/api/denuncias')).status,401)
        const page=await fetch(base+'/auth/login'),html=await page.text()
        assert.equal(page.status,200);assert.match(html,/name="_csrf" value="[A-Za-z0-9_-]{43}"/)
        assert.match(html,/auth-shell/);assert.ok(!html.includes('id="app-navigation"'))
        assert.match(page.headers.get('set-cookie'),/HttpOnly/);assert.match(page.headers.get('set-cookie'),/SameSite=Strict/)
        assert.equal((await fetch(base+'/auth/login',{method:'POST',body:new URLSearchParams({username:'test',password:'invalid'})})).status,403)
    }finally{await new Promise(resolve=>server.close(resolve));if(previous===undefined)delete process.env.AUTH_ENABLED;else process.env.AUTH_ENABLED=previous}
})
