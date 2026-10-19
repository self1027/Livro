import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSivisa,sivisaRows,sivisaState,summarizeSivisa,selectSivisaReports} from '../src/utils/sivisa.js'
import ejs from 'ejs'
import {fileURLToPath} from 'node:url'

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
test('SIVISA é aplicável por padrão e protocolo informado regulariza a ação',()=>{
    for(const input of [{},{sivisa_state:''},{sivisa_protocol:[''],sivisa_note:['']}]){
        const values=normalizeSivisa(input)
        assert.deepEqual(values,{applies:true,protocols:[],notes:[]})
        assert.equal(sivisaState({type:1,sivisa:values,sivisaProtocols:values.protocols}),'pending')
    }
    const values=normalizeSivisa({sivisa_protocol:' 01.000917 /26 '})
    assert.deepEqual(values,{applies:true,protocols:[{protocol:'01.000917/26',note:''}],notes:[]})
    assert.equal(sivisaState({type:1,sivisa:values,sivisaProtocols:values.protocols}),'registered')
    assert.deepEqual(normalizeSivisa({sivisa_state:'not_applicable'}),{applies:false,protocols:[],notes:[]})
    assert.deepEqual(normalizeSivisa({},{editing:true}),{applies:true,protocols:[],notes:[]})
})

test('validação preserva estados explícitos, protocolos e observações; edição sem último protocolo fica aplicável',()=>{
    for(const state of ['invalid',[],{},false])assert.throws(()=>normalizeSivisa({sivisa_state:state}),/Informe se/)
    assert.throws(()=>normalizeSivisa({sivisa_state:'registered'}),/pelo menos/)
    const result=normalizeSivisa({sivisa_state:'registered'},{editing:true})
    assert.equal(result.applies,true);assert.deepEqual(result.protocols,[])
    assert.throws(()=>normalizeSivisa({sivisa_state:'pending',sivisa_protocol:['01.000917/26',' 01.000917/26 ']}),/mais de uma vez/)
    assert.throws(()=>normalizeSivisa({sivisa_state:'not_applicable',sivisa_protocol:'01.000917/26'}),/Remova/)
    assert.throws(()=>normalizeSivisa({sivisa_state:'pending',sivisa_protocol:{value:'forjado'}}),/inválidos/)
    assert.deepEqual(normalizeSivisa({sivisa_state:'pending',sivisa_protocol:[' 01.000917 /26 '],sivisa_note:[' Notificação completa ']}).protocols,[{protocol:'01.000917/26',note:'Notificação completa'}])
})

test('observações sem protocolo são preservadas sem regularizar SIVISA nem gerar protocolos',()=>{
    for(const state of [undefined,'pending','not_applicable']){
        const values=normalizeSivisa({sivisa_state:state,sivisa_note:'  Aguardando vistoria  '})
        assert.deepEqual(values,{applies:state!=='not_applicable',protocols:[],notes:['Aguardando vistoria']})
        const report={type:1,sivisa:values,sivisaProtocols:values.protocols}
        assert.equal(sivisaState(report),state==='not_applicable'?'not_applicable':'pending')
        assert.equal(summarizeSivisa([report]).protocols,0)
    }
    assert.deepEqual(normalizeSivisa({sivisa_protocol:['','01.000917/26'],sivisa_note:['Sem protocolo','Com protocolo','Outra observação']}),{
        applies:true,protocols:[{protocol:'01.000917/26',note:'Com protocolo'}],notes:['Sem protocolo','Outra observação']
    })
    assert.throws(()=>normalizeSivisa({sivisa_note:'a'.repeat(501)}),/até 500/)
    assert.throws(()=>normalizeSivisa({sivisa_note:{value:'forjado'}}),/inválidos/)
    assert.throws(()=>normalizeSivisa({sivisa_note:Array(101).fill('Observação')}),/máximo 100/)
    assert.deepEqual(sivisaRows({sivisa_note:'Somente observação'}),[{protocol:'',note:'Somente observação'}])
})

test('observações sem protocolo aparecem no formulário e no histórico com texto seguro',async()=>{
    const note='Aguardando <vistoria>'
    const fields=await ejs.renderFile(fileURLToPath(new URL('../views/partials/sivisaFields.ejs',import.meta.url)),{sivisaForm:{sivisa_note:[note,'Outro motivo']}})
    assert.match(fields,/Aguardando &lt;vistoria&gt;/)
    assert.match(fields,/Outro motivo/)
    assert.equal((fields.match(/name="sivisa_protocol"/g)||[]).length,2)
    for(const applies of [true,false]){
        const html=await ejs.renderFile(fileURLToPath(new URL('../views/partials/sivisaSummary.ejs',import.meta.url)),{report:{type:1,sivisa:{applies,notes:[note]},sivisaProtocols:[]},sivisaHref:'/relatorio/1/sivisa'})
        assert.match(html,/Aguardando &lt;vistoria&gt;/)
        assert.match(html,applies?/SIVISA pendente/:/Não cabe SIVISA/)
        assert.ok(!html.includes('SIVISA ·'))
        assert.match(html,/href="\/relatorio\/1\/sivisa"/)
    }
})

test('formulário usa dispensa opcional e preserva protocolos e opção marcada ao renderizar novamente',async()=>{
    const file=fileURLToPath(new URL('../views/partials/sivisaFields.ejs',import.meta.url))
    for(const state of [undefined,'pending','registered','not_applicable','unclassified']){
        const html=await ejs.renderFile(file,{sivisaForm:{sivisa_state:state,sivisa_protocol:'01.000917/26',sivisa_note:'Texto <seguro>'}})
        const checkbox=html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0]
        assert.ok(checkbox)
        assert.match(checkbox,/name="sivisa_state" value="not_applicable"/)
        assert.equal(checkbox.includes('checked'),state==='not_applicable')
        assert.ok(!checkbox.includes('required'))
        assert.ok(!html.includes('<select'))
        assert.match(html,/SIVISA pendente/)
        assert.match(html,/value="01.000917\/26"/)
        assert.match(html,/Texto &lt;seguro&gt;/)
    }
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
