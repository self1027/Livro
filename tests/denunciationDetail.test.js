import test from 'node:test'
import assert from 'node:assert/strict'
import ejs from 'ejs'
import {fileURLToPath} from 'node:url'
import {statuses,senders,senderDetails,reportDetails} from '../src/utils/catalogRegistry.js'

test('visualização distingue denúncia sem fiscal e preserva ações e histórico com texto seguro', async () => {
    const data={DENUNCIATION_STATUS:statuses,DENUNCIATION_SENDER:senders,SENDER_DETAILS:senderDetails,REPORT_DETAILS:reportDetails,fiscais:[],denuncia:{id:1,number:12,year:2026,title:'Título <teste>',endereco:'Rua',numero:'1',bairro:'Centro',created_at:'2026-10-14',status:'REGISTRADA',description:'Linha 1\n<script>teste</script>',registration_type:'PESSOA_TELEFONE',user_id:null,user:null},reports:[]}
    const render=()=>ejs.renderFile(fileURLToPath(new URL('../views/denunciation/show.ejs',import.meta.url)),data)
    let html=await render()
    assert.ok(html.includes('Título &lt;teste&gt;'))
    assert.ok(html.includes('&lt;script&gt;teste&lt;/script&gt;'))
    assert.ok(html.includes('<fieldset disabled>'))
    assert.ok(html.includes('Nenhum relatório disponível'))
    assert.ok(html.includes('Nenhuma pessoa ativa com acesso habilitado e cargo que permita receber denúncias'))
    data.denuncia.user_id=2;data.denuncia.user={name:'Fiscal A'}
    data.fiscais=[{id:2,name:'Fiscal A'}]
    data.reports=[{id:3,type:1,created_at:'2026-10-14T15:00:00Z',user:{name:'Fiscal A'},description:'Texto <b>seguro</b>'}]
    html=await render()
    assert.ok(!html.includes('<fieldset disabled>'))
    assert.ok(html.includes('Texto &lt;b&gt;seguro&lt;/b&gt;'))
    assert.ok(html.includes('<time datetime='))
    assert.ok(html.includes('href="/relatorio/3"'))
    assert.ok(html.includes('action="/relatorio/3/deletar"'))
    assert.ok(html.includes('value="2" selected'))
    assert.ok(html.includes('href="/denuncias/1/edit"'))
    assert.ok(html.includes('action="/admin/assignments/1"'))
})
