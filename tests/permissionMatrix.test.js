import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import ejs from 'ejs'
import {fileURLToPath} from 'node:url'
import {protectRoutes,routePermission} from '../src/auth/middleware.js'
import {PERMISSIONS,can,canManageReport,canWorkOnDenunciation,canEditDenunciation} from '../src/auth/permissions.js'
import Report from '../src/models/reportsModel.js'
import Denunciation from '../src/models/denunciationsModel.js'
import {statuses,senders,senderDetails,reportDetails} from '../src/utils/catalogRegistry.js'

const identity=permissions=>({user:{id:1,name:'Fiscal'},account:{must_change_password:false},role:{name:'Teste',maximum:false,permissions}})
const routes=[
    ['GET','/recados','chat.use'],['GET','/api/recados/notifications','chat.use'],['GET','/api/recados/conversations/1/messages','chat.use'],['POST','/api/recados/conversations/1/read','chat.use'],['POST','/api/recados/announcements','chat.announce'],
    ['GET','/','denunciations.read'],['GET','/buscar','denunciations.read'],['GET','/api/denuncias','denunciations.read'],['GET','/denuncias/1','denunciations.read'],
    ['GET','/denuncias/new','denunciations.create'],['POST','/denuncias','denunciations.create'],
    ['GET','/denuncias/1/edit','denunciations.edit.own'],['POST','/denuncias/1/edit','denunciations.edit.own'],
    ['GET','/admin/assignments','denunciations.assign'],['POST','/admin/assignments/1','denunciations.assign'],['POST','/atribuir/1','denunciations.assign'],
    ['POST','/denuncias/1/adicionar-relatorio','reports.create'],['GET','/relatorio/1','reports.edit'],['POST','/relatorio/1/editar','reports.edit'],['POST','/relatorio/1/deletar','reports.delete'],
    ['GET','/relatorio/1/sivisa','reports.edit'],['POST','/relatorio/1/sivisa','reports.edit'],['GET','/sivisa/pendencias','reports.edit'],
    ['GET','/area-fiscal','fiscal.area.own'],['GET','/area-fiscal/1','fiscal.area.own'],['GET','/denuncias/pdf?fiscalId=1','fiscal.area.own'],
    ['GET','/area-fiscal/2','fiscal.area.all'],['GET','/denuncias/pdf?fiscalId=2','fiscal.area.all'],
    ['GET','/escala','schedule.read'],['GET','/admin/schedule','schedule.manage'],['POST','/admin/schedule/week','schedule.manage'],['POST','/admin/schedule/day','schedule.manage'],
    ['GET','/admin/catalogs','catalogs.manage'],['POST','/admin/catalogs/status','catalogs.manage'],['POST','/admin/catalogs/status/1','catalogs.manage'],['POST','/bairros','catalogs.manage'],['POST','/bairros/1','catalogs.manage'],['POST','/bairros/1/delete','catalogs.manage'],
    ['GET','/admin?tab=attendance','attendance.manage'],['POST','/admin/attendance','attendance.manage'],
    ['GET','/admin','dashboard.read'],['GET','/admin/export/csv','dashboard.read'],['GET','/admin/export/pdf','dashboard.read'],
    ['GET','/admin/access',null],['POST','/admin/access/accounts',null],['POST','/admin/access/roles',null],['POST','/admin/access/email',null]
]

test('cada permissão isolada autoriza somente suas rotas; modificadores não concedem operações',async()=>{
    const previous=process.env.AUTH_ENABLED,original={report:Report.findByPk,denunciation:Denunciation.findByPk}
    Report.findByPk=async id=>({user_id:id==='1'?'1':2,denunciation_id:2})
    Denunciation.findByPk=async id=>({user_id:id==='1'?'1':id==='3'?null:2,created_by_user_id:id==='1'?'1':id==='3'?null:2})
    const app=express()
    app.use((req,res,next)=>{req.auth=identity(req.get('X-Test-Permission')?[req.get('X-Test-Permission')]:[]);req.usingBearer=true;next()})
    app.use(protectRoutes);app.use((req,res)=>res.sendStatus(204))
    const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    try{
        process.env.AUTH_ENABLED='true'
        for(const permission of ['',...Object.keys(PERMISSIONS)]){
            for(const [method,path,expected] of routes){
                const allowed=expected&&(permission===expected||(expected==='fiscal.area.own'&&permission==='fiscal.area.all')||(expected==='denunciations.edit.own'&&permission==='denunciations.edit.all'))
                const response=await fetch(base+path,{method,headers:{'X-Test-Permission':permission},redirect:'manual'})
                assert.equal(response.status,allowed?204:403,`${permission||'sem permissões'}: ${method} ${path}`)
            }
        }
        for(const permission of ['reports.edit','reports.delete','reports.create','denunciations.edit.own']){
            const [method,path]=permission==='reports.edit'?['POST','/relatorio/2/editar']:permission==='reports.delete'?['POST','/relatorio/2/deletar']:permission==='reports.create'?['POST','/denuncias/2/adicionar-relatorio']:['POST','/denuncias/2/edit']
            assert.equal((await fetch(base+path,{method,headers:{'X-Test-Permission':permission}})).status,403)
        }
        assert.equal((await fetch(base+'/denuncias/3/adicionar-relatorio',{method:'POST',headers:{'X-Test-Permission':'reports.create'}})).status,403)
    }finally{
        Report.findByPk=original.report;Denunciation.findByPk=original.denunciation
        if(previous===undefined)delete process.env.AUTH_ENABLED;else process.env.AUTH_ENABLED=previous
        await new Promise(resolve=>server.close(resolve))
    }
})

test('botões de relatório, denúncia e atribuição respeitam suas permissões separadamente',async()=>{
    const denuncia={id:1,user_id:'1',created_by_user_id:'1',user:{name:'Fiscal'},reports:[],number:12,year:2026,title:'Teste',created_at:'2026-10-15',status:'REGISTRADA'}
    const report={id:10,user_id:'1',description:'Denúncia atribuída ao fiscal: texto escrito pelo autor',type:1}
    const render=async permissions=>{
        const auth=identity(permissions)
        return ejs.renderFile(fileURLToPath(new URL('../views/denunciation/show.ejs',import.meta.url)),{
            denuncia,reports:[report],fiscais:[],REPORT_DETAILS:reportDetails,SENDER_DETAILS:senderDetails,DENUNCIATION_STATUS:statuses,DENUNCIATION_SENDER:senders,
            auth,can:permission=>can(auth,permission),canPath:path=>can(auth,routePermission(path,'GET')),
            canManageReport:(permission,item)=>canManageReport(auth,permission,item),canWorkOnDenunciation:(permission,item)=>canWorkOnDenunciation(auth,permission,item)
        })
    }
    for(const permission of Object.keys(PERMISSIONS)){
        const html=await render([permission])
        assert.equal(html.includes('href="/relatorio/10"'),permission==='reports.edit',permission)
        assert.equal(html.includes('action="/relatorio/10/deletar"'),permission==='reports.delete',permission)
        assert.equal(html.includes('id="detail-report-form"'),permission==='reports.create',permission)
        assert.equal(html.includes('href="/denuncias/1/edit"'),['denunciations.edit.own','denunciations.edit.all'].includes(permission),permission)
        assert.equal(html.includes('id="fiscalModal"'),permission==='denunciations.assign',permission)
    }
    denuncia.user_id=2
    assert.ok((await render(['denunciations.edit.own'])).includes('href="/denuncias/1/edit"'))
    denuncia.created_by_user_id=2;denuncia.user_id=1
    assert.ok(!(await render(['denunciations.edit.own','fiscal.all'])).includes('href="/denuncias/1/edit"'))
    assert.ok((await render(['denunciations.edit.all'])).includes('href="/denuncias/1/edit"'))
    denuncia.created_by_user_id=null
    assert.ok(!(await render(['denunciations.edit.own'])).includes('href="/denuncias/1/edit"'))
    assert.ok((await render(['denunciations.edit.all'])).includes('href="/denuncias/1/edit"'))
    assert.ok((await render(['reports.edit'])).includes('href="/relatorio/10"'))
    report.user_id=2
    assert.ok(!(await render(['reports.edit'])).includes('href="/relatorio/10"'))
    assert.ok((await render(['reports.edit','fiscal.all'])).includes('href="/relatorio/10"'))
    assert.ok(!(await render(['fiscal.all'])).includes('href="/relatorio/10"'))
})
test('autoria de cadastro independe de atribuição, outros relatórios e permissões de alcance fiscal',()=>{
    const own=identity(['denunciations.edit.own','fiscal.all'])
    for(const assignee of [null,1,2]){
        assert.equal(canEditDenunciation(own,{created_by_user_id:1,user_id:assignee}),true)
        assert.equal(canEditDenunciation(own,{created_by_user_id:2,user_id:assignee}),false)
        assert.equal(canEditDenunciation(own,{created_by_user_id:null,user_id:assignee}),false)
    }
    assert.equal(canEditDenunciation(identity(['denunciations.edit.all']),{created_by_user_id:null,user_id:null}),true)
    assert.equal(canEditDenunciation(identity(['fiscal.all']),{created_by_user_id:1,user_id:1}),false)
    assert.equal(canEditDenunciation(identity(['reports.edit']),{created_by_user_id:1,user_id:1}),false)
})
