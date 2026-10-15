import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSivisa,sivisaState,summarizeSivisa,selectSivisaReports} from '../src/utils/sivisa.js'

test('primeiro protocolo regulariza; último removido deixa pendência; status não cabe',()=>{
    const report={type:1,sivisa:{applies:true},sivisaProtocols:[]}
    assert.equal(sivisaState(report),'pending')
    report.sivisaProtocols=[{protocol:'01.000917/26'},{protocol:'01.001096/26'}]
    assert.equal(sivisaState(report),'registered')
    report.sivisaProtocols.pop();assert.equal(sivisaState(report),'registered')
    report.sivisaProtocols.pop();assert.equal(sivisaState(report),'pending')
    report.sivisa.applies=false;assert.equal(sivisaState(report),'not_applicable')
    assert.equal(sivisaState({type:0}),'not_applicable')
    assert.equal(sivisaState({type:1}),'unclassified')
})
test('validação exige escolha e protocolo no cadastro; edição sem último protocolo fica aplicável',()=>{
    assert.throws(()=>normalizeSivisa({}),/Informe se/)
    assert.throws(()=>normalizeSivisa({sivisa_state:'registered'}),/pelo menos/)
    const result=normalizeSivisa({sivisa_state:'registered'},{editing:true})
    assert.equal(result.applies,true);assert.deepEqual(result.protocols,[])
    assert.throws(()=>normalizeSivisa({sivisa_state:'pending',sivisa_protocol:['01.000917/26',' 01.000917/26 ']}),/mais de uma vez/)
    assert.throws(()=>normalizeSivisa({sivisa_state:'not_applicable',sivisa_protocol:'01.000917/26'}),/Remova/)
    assert.throws(()=>normalizeSivisa({sivisa_state:'pending',sivisa_protocol:{value:'forjado'}}),/inválidos/)
    assert.deepEqual(normalizeSivisa({sivisa_state:'pending',sivisa_protocol:[' 01.000917 /26 '],sivisa_note:[' Notificação completa ']}).protocols,[{protocol:'01.000917/26',note:'Notificação completa'}])
})
test('produtividade conta ações e protocolos separadamente, pelo autor, sem contar mudanças de status',()=>{
    const reports=[{type:1,user_id:1,sivisa:{applies:true},sivisaProtocols:[{},{}]},{type:1,user_id:1,sivisa:{applies:true}},{type:1,user_id:2,sivisa:{applies:false}},{type:1,user_id:2},{type:0,user_id:1}]
    const result=summarizeSivisa(reports,[{id:1,name:'A'},{id:2,name:'B'}])
    assert.deepEqual([result.actions,result.protocols,result.registered,result.pending,result.notApplicable,result.unclassified],[4,2,1,1,1,1])
    assert.equal(result.byAuthor[0].actions,2);assert.equal(result.byAuthor[0].pending,1)
    assert.equal(result.byAuthor[1].unclassified,1)
    for(const key of ['actions','registered','pending','notApplicable','unclassified'])assert.equal(selectSivisaReports(reports,key).length,result[key])
    assert.equal(selectSivisaReports(reports,'protocols').reduce((sum,report)=>sum+report.sivisaProtocols.length,0),result.protocols)
    assert.deepEqual(selectSivisaReports(reports,'unknown'),[])
})
