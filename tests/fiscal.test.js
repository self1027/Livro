import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import router from '../src/controllers/usersController.js'
import users from '../src/services/usersService.js'
import denunciations from '../src/services/denunciationsService.js'

test('área do fiscal renderiza seleção, filtro, PDF e paginação e rejeita parâmetros inválidos', async () => {
    const original={active:users.getActiveUsers,find:users.findByPk,list:denunciations.findAllByFiscal}
    users.getActiveUsers=async()=>[{id:1,name:'Fiscal <teste>'}]
    users.findByPk=async id=>id==='1'?{id:1,name:'Fiscal <teste>'}:null
    let args, empty=false
    denunciations.findAllByFiscal=async(...input)=>{
        args=input
        return {ok:true,data:{total:empty?0:51,hasMore:!empty&&input[3]===0,nextPage:input[3]===0?2:null,denuncias:empty?[]:[{id:input[3]+1,number:123,year:2026,title:'Denúncia <teste>',endereco:'Rua',numero:1,bairro:'Centro',status:'REGISTRADA'}]}}
    }
    const app=express()
    app.set('views',fileURLToPath(new URL('../views/',import.meta.url)))
    app.set('view engine','ejs')
    app.use(router)
    const server=app.listen(0)
    await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    try{
        let response=await fetch(base+'/area-fiscal'),html=await response.text()
        assert.equal(response.status,200)
        assert.ok(html.includes('Fiscal &lt;teste&gt;'))
        assert.ok(html.includes('/area-fiscal/1?status=ALL'))
        response=await fetch(base+'/area-fiscal/1');html=await response.text()
        assert.equal(response.status,200)
        assert.deepEqual(args,['1','ALL',50,0])
        assert.ok(html.includes('1 de 51 denúncias exibidas'))
        assert.ok(html.includes('data-next-page="2"'))
        assert.ok(html.includes('/denuncias/pdf?fiscalId=1&amp;status=ALL'))
        assert.ok(html.includes('Denúncia &lt;teste&gt;'))
        response=await fetch(base+'/area-fiscal/1?status=REGISTRADA&page=2');html=await response.text()
        assert.equal(response.status,200)
        assert.deepEqual(args,['1','REGISTRADA',50,50])
        assert.ok(!html.includes('data-fiscal-more'))
        for(const route of ['/area-fiscal/1?status=UNKNOWN','/area-fiscal/1?page=-1','/area-fiscal/1?page=abc','/area-fiscal/abc'])assert.equal((await fetch(base+route)).status,400)
        assert.equal((await fetch(base+'/area-fiscal/2')).status,404)
        empty=true;response=await fetch(base+'/area-fiscal/1?status=REGISTRADA');html=await response.text()
        assert.ok(html.includes('Nenhuma denúncia encontrada para este status'))
        assert.ok(html.includes('Ver todos os status'))
    }finally{
        users.getActiveUsers=original.active;users.findByPk=original.find;denunciations.findAllByFiscal=original.list
        await new Promise(resolve=>server.close(resolve))
    }
})
