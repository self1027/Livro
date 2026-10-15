import test from 'node:test'
import assert from 'node:assert/strict'
import {presentAudit} from '../src/auth/auditPresentation.js'

const context={accounts:[{id:1,user_id:10,username:'chefia'}],users:[{id:10,name:'Ana'},{id:20,name:'José'}],roles:[{id:3,name:'Fiscal'}]}
test('auditoria SIVISA distingue relatório de conta e traduz a pendência',()=>{
    const event=presentAudit({action:'sivisa.saved',actor_id:1,details:{report_id:88,applies:true,protocols:[]}},context)
    assert.equal(event.action,'Registro SIVISA atualizado')
    assert.equal(event.target,'Relatório #88')
    assert.equal(event.notes,'SIVISA pendente')
})
test('auditoria resolve pessoas e distingue cadastro de fiscal de conta',()=>{
    const event=presentAudit({action:'staff.updated',actor_id:1,target_id:null,details:{user_id:20,ativo:false}},context)
    assert.equal(event.action,'Cadastro de fiscal atualizado')
    assert.equal(event.actor,'Ana (@chefia)')
    assert.equal(event.target,'José')
    assert.equal(event.notes,'Fiscal inativo')
})
test('auditoria resolve responsabilidades sem interpretar seu ID como conta',()=>{
    assert.equal(presentAudit({action:'role.saved',target_id:3},context).target,'Fiscal')
    assert.equal(presentAudit({action:'bootstrap',target_id:1},context).actor,'Sistema (configuração inicial)')
    assert.match(presentAudit({action:'login',actor_id:99,target_id:99},context).target,/Conta #99/)
})
