import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createSeed} from '../src/demo/data.js'
import {saveSivisa,resetState,assignComplaint} from '../src/demo/store.js'
import {pageContext} from '../src/demo/pages.js'
import {mutate} from '../src/demo/actions.js'
import {localApi} from '../src/demo/api.js'
import {csv} from '../src/demo/export.js'

test('reabrir e salvar SIVISA preserva observações sem protocolo',()=>{
  const state=createSeed()
  saveSivisa(state,1,{sivisa_protocol:['ABC',''],sivisa_note:['Inspeção','Acompanhada por dois fiscais']})
  const form=pageContext(state,new URL('http://localhost/relatorio/1/sivisa')).data.sivisaForm
  saveSivisa(state,1,form)
  assert.deepEqual(state.reports[0].sivisa.notes,['Acompanhada por dois fiscais'])
  assert.deepEqual(state.reports[0].sivisaProtocols,[{protocol:'ABC',note:'Inspeção'}])
})
test('restaurar remove configurações administrativas opcionais',()=>{
  const state=createSeed();state.recoveryEmail='changed@example.com';state.roles=[{id:55,name:'Outro'}];state.audits=[{action:'Exemplo'}];state.optional='old'
  resetState(state)
  assert.equal(state.recoveryEmail,'coordenacao@example.com')
  assert.equal(state.roles.some(r=>r.id===55),false)
  assert.deepEqual(state.audits,[]);assert.equal(state.optional,undefined)
})
test('fiscal sem permissão de recebimento sai das opções e não recebe atribuição',()=>{
  const state=createSeed()
  mutate(state,'/admin/access/roles/2',{name:'Auditor',permissions:'denunciations.read'})
  assert.equal(pageContext(state,new URL('http://localhost/admin/assignments')).data.fiscais.length,0)
  assert.throws(()=>assignComplaint(state,1,2),/fiscal/i)
})
test('bairros, escala, atendimento e recados gravam nos dados locais',()=>{
  const state=createSeed()
  mutate(state,'/bairros/1',{name:'Centro Novo'});assert.equal(state.complaints[0].bairro,'Centro Novo')
  mutate(state,'/admin/attendance',{weekdays:['TER','QUI']});assert.deepEqual(state.attendance.weekdays,['TER','QUI'])
  localApi(state,new URL('http://localhost/admin/schedule/week'),'POST',{week_key:'10-2026',nome:'Ana',anotacao:'Teste'});assert.equal(state.schedule.weeks['10-2026'].nome,'Ana')
  localApi(state,new URL('http://localhost/api/recados/conversations/2/messages'),'POST',{body:'Recado de teste',denunciationId:1})
  const result=localApi(state,new URL('http://localhost/api/recados/conversations/2/messages'))
  assert.equal(result.messages.at(-1).body,'Recado de teste');assert.equal(result.messages.at(-1).denunciation.id,1)
})
test('credenciais fictícias são descartadas e CSV neutraliza fórmulas',()=>{
  const state=createSeed()
  mutate(state,'/admin/access/accounts',{name:'Pessoa Teste',username:'pessoa.demo',password:'SomenteTeste123',role_id:'2',ativo:'on',enabled:'on'})
  assert.equal(JSON.stringify(state).includes('SomenteTeste123'),false)
  assert.match(csv([{number:1,year:2026,title:'=HYPERLINK("url")'}]),/"'=HYPERLINK/)
})
