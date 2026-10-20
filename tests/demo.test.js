import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createSeed, complaintDraft, calendarDay} from '../src/demo/data.js'
import {createComplaint, assignComplaint, addReport, saveSivisa, dashboard, loadState, saveState, filterComplaints} from '../src/demo/store.js'
import {pageContext} from '../src/demo/pages.js'
import {localApi} from '../src/demo/api.js'

test('listagem e paginação mostram os protocolos mais recentes primeiro, inclusive nos dados salvos',()=>{
  const original=createSeed(),state=loadState({getItem:()=>JSON.stringify(original)})
  const home=pageContext(state,new URL('http://localhost/')).data
  assert.deepEqual(home.denuncias.slice(0,3).map(r=>r.number),[48,47,46])
  assert.equal(home.denuncias.at(-1).number,29)
  const next=localApi(state,new URL('http://localhost/api/denuncias?offset=20&limit=20'))
  assert.equal(next[0].number,28);assert.equal(next.at(-1).number,9)
  const last=localApi(state,new URL('http://localhost/api/denuncias?offset=40&limit=20'))
  assert.deepEqual(last.map(r=>r.number),[8,7,6,5,4,3,2,1])
  const fiscal=pageContext(state,new URL('http://localhost/area-fiscal/2')).data
  assert.deepEqual(fiscal.denuncias.slice(0,3).map(r=>r.number),[45,42,39])
  const search=pageContext(state,new URL('http://localhost/buscar?status=REGISTRADA')).data
  assert.deepEqual(search.denuncias.slice(0,3).map(r=>r.number),[48,41,34])
  const added=createComplaint(state,complaintDraft)
  assert.equal(filterComplaints(state,{})[0].id,added.id)
  assert.equal(state.complaints.length,49)
})

test('ordenação considera primeiro o ano, depois o número, sem depender dos IDs',()=>{
  const state=createSeed()
  state.complaints=state.complaints.slice(0,3).map((r,i)=>({...r,...[{id:100,year:2025,number:999},{id:200,year:2026,number:1},{id:1,year:2026,number:2}][i]}))
  assert.deepEqual(filterComplaints(state,{}).map(r=>r.id),[1,200,100])
})

test('cadastro atribuição relatório SIVISA e conclusão atualizam as métricas',()=>{
  const state=createSeed(), before=dashboard(state,{}).stats
  const row=createComplaint(state,complaintDraft)
  assert.equal(row.number,Math.max(...state.complaints.filter(r=>r.id!==row.id&&r.year===row.year).map(r=>r.number))+1)
  assert.equal(dashboard(state,{}).stats.total,before.total+1)
  assert.throws(()=>addReport(state,row.id,{description:'Vistoria'}),/fiscal/i)
  assignComplaint(state,row.id,2)
  const report=addReport(state,row.id,{description:'Vistoria realizada',status:'EM_ANDAMENTO'})
  assert.equal(report.user_id,2)
  assert.equal(dashboard(state,{view:'sivisa'}).sivisaMetrics.pending>=1,true)
  saveSivisa(state,report.id,{sivisa_protocol:'01.000917/26'})
  assert.equal(report.sivisaProtocols[0].protocol,'01.000917/26')
  assignComplaint(state,row.id,3)
  assert.equal(report.user_id,2)
  addReport(state,row.id,{status:'FINALIZADA'})
  assert.equal(dashboard(state,{}).stats.closed,before.closed+1)
  assert.equal(dashboard(state,{view:'analytics'}).monthly.at(-1).closed>=1,true)
})

test('validação impede dados incompletos, bairro inválido e protocolo duplicado',()=>{
  const state=createSeed(), count=state.complaints.length
  assert.throws(()=>createComplaint(state,{...complaintDraft,title:' '}),/título/i)
  assert.throws(()=>createComplaint(state,{...complaintDraft,bairro:'Inexistente'}),/bairro/i)
  assert.equal(state.complaints.length,count)
  assert.throws(()=>assignComplaint(state,1,999),/fiscal/i)
  const row=createComplaint(state,complaintDraft)
  assignComplaint(state,row.id,2)
  assert.throws(()=>addReport(state,row.id,{description:'Texto',sivisa_protocol:['ABC','ABC']}),/mais de uma/i)
  assert.equal(state.reports.filter(r=>r.denunciation_id===row.id).length,1)
})

test('métricas de ações usam data e autor do relatório',()=>{
  const state=createSeed(), now=calendarDay(new Date())
  state.complaints[0].created_at='2020-01-01T12:00:00Z'
  assignComplaint(state,1,2)
  addReport(state,1,{description:'Inspeção recente'})
  const result=dashboard(state,{view:'sivisa',start:now,end:now,userId:'2'})
  assert.equal(result.sivisaMetrics.actions,1)
  assert.equal(dashboard(state,{view:'analytics',start:now,end:now}).monthly.at(-1).withReport,1)
})

test('persistência recupera estado inválido e informa armazenamento indisponível',()=>{
  const memory=new Map(), storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}
  const state=createSeed(); createComplaint(state,complaintDraft)
  saveState(storage,state)
  assert.equal(loadState(storage).complaints.length,state.complaints.length)
  storage.setItem('livro-demo-v2','{"version":2,"complaints":[{}]}')
  assert.equal(loadState(storage).complaints.length,48)
  assert.equal(loadState({getItem(){throw Error('blocked')}}).complaints.length,48)
  assert.throws(()=>saveState({setItem(){throw Error('quota')}},state),/salvar/i)
})
