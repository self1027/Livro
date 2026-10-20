import {complaintDraft,calendarDay,defaultRoles} from './data.js'
import {complaint,hydrate,filterComplaints,dashboard,receivesComplaints} from './store.js'
import {statuses,senders,senderDetails,reportDetails,applyCatalog} from '../utils/catalogRegistry.js'
import {currentYearStart,isOpen} from '../utils/adminMetrics.js'
import {normalizeSearchFilters,describeSearchFilters,searchUrl} from '../utils/searchFilters.js'
import {sivisaState} from '../utils/sivisa.js'

export function adminUrl(filters,changes={},path='/admin'){
  const params=new URLSearchParams()
  for(const [key,value] of Object.entries({...filters,page:1,...changes}))if(value!=null&&(value!==''||key==='start'||key==='end'))params.set(key,String(value))
  return `${path}?${params}`
}
export function pageContext(state,url){
  applyCatalog(state.catalogs)
  const q=Object.fromEntries(url.searchParams),path=url.pathname
  const data={auth:null,authEnabled:false,csrfToken:null,can:()=>true,canPath:()=>true,canWorkOnDenunciation:()=>true,canManageReport:()=>true,DENUNCIATION_STATUS:statuses,DENUNCIATION_SENDER:senders,REPORT_DETAILS:reportDetails,SENDER_DETAILS:senderDetails,STATUS:statuses,SENDERS:senders,fiscais:state.users.filter(u=>receivesComplaints(state,u)),users:state.users,districts:state.districts,attendance:state.attendance,year:Number(calendarDay(new Date()).slice(0,4)),fieldErrors:{},form:{...complaintDraft},existingId:null,error:'',notice:'',success:q.saved==='1',successMessages:q.notice?['Alteração salva nesta demonstração.']:[],sivisaPendingCount:state.reports.filter(r=>sivisaState(r)==='pending').length}
  const page=(view,extra={})=>({view,data:{...data,...extra}})
  if(path==='/')return page('index',{denuncias:filterComplaints(state,{}).slice(0,20),offset:20,limit:20})
  if(path==='/denuncias/new')return page('denunciation/new',{lastNumber:Math.max(0,...state.complaints.filter(r=>r.year===data.year).map(r=>r.number))+1})
  let match=path.match(/^\/denuncias\/(\d+)(\/edit)?$/)
  if(match){const row=hydrate(state,complaint(state,match[1]));return page(match[2]?'denunciation/edit':'denunciation/show',{denuncia:row,reports:row.reports,lastNumber:row.number,year:row.year})}
  if(path==='/buscar'){
    const result=normalizeSearchFilters(q)
    return page('denunciation/search',{...result.filters,searchErrors:result.errors,searchPerformed:result.hasFilters&&!result.errors.length,denuncias:result.errors.length?[]:filterComplaints(state,result.filters),activeFilters:describeSearchFilters(result.filters,state.users),searchUrl})
  }
  if(path==='/admin/assignments'){
    const rows=filterComplaints(state,{}).filter(r=>!r.user_id&&isOpen(r)),pages=Math.max(1,Math.ceil(rows.length/25)),current=Math.max(1,Math.min(Number(q.page)||1,pages))
    return page('denunciation/associate',{denunciaSelecionada:q.denunciaId?hydrate(state,complaint(state,q.denunciaId)):null,denuncias:rows.slice((current-1)*25,current*25),total:rows.length,page:current,pages})
  }
  if(path==='/area-fiscal')return page('users/select')
  match=path.match(/^\/area-fiscal\/(\d+)$/)
  if(match){
    const fiscal=state.users.find(u=>u.id===Number(match[1]));if(!fiscal)throw Error('Fiscal não encontrado.')
    const selectedStatus=q.status||'ALL',rows=filterComplaints(state,{userId:String(fiscal.id),status:selectedStatus==='ALL'?'':selectedStatus})
    const current=Math.max(1,Number(q.page)||1)
    return page('users/home',{fiscal,selectedStatus,denuncias:rows.slice((current-1)*50,current*50),total:rows.length,hasMore:rows.length>current*50,nextPage:current+1})
  }
  if(path==='/admin')return page('admin/index',{...dashboard(state,q),adminUrl,formatDate:value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem relatório',currentYearStart:currentYearStart(),isOpen,tab:q.tab==='attendance'?'attendance':'overview',notice:q.notice?'Configuração salva nesta demonstração.':'',noticeError:false,attendance:state.attendance})
  if(path==='/escala'||path==='/admin/schedule'){
    const today=calendarDay(new Date()),ano=Number(q.ano)||Number(today.slice(0,4)),mes=q.mes==null?Number(today.slice(5,7))-1:Math.max(0,Math.min(11,Number(q.mes)||0))
    const first=new Date(ano,mes,1),week=Math.ceil((Math.floor((first-new Date(ano,0,1))/86400000)+new Date(ano,0,1).getDay()+1)/7)
    const defaults=Array.from({length:6},(_,i)=>({week_key:`${week+i}-${ano}`,nome:state.users[1+i%3].name,anotacao:'Escala fictícia de fiscalização · período da tarde'}))
    return page('schedule/index',{ano,mes,mesLabel:new Date(ano,mes,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),editable:path.startsWith('/admin'),basePath:path,semanas:[...new Map([...defaults,...Object.values(state.schedule.weeks)].map(r=>[r.week_key,r])).values()],dias:Object.values(state.schedule.days)})
  }
  if(path==='/admin/catalogs')return page('admin/catalogs',{kind:['status','sender','district'].includes(q.kind)?q.kind:'status',catalogKinds:{status:'Status',sender:'Origens'},entries:state.catalogs.map((r,i)=>({...r,id:r.id||i+1})),editId:null,form:{},notice:q.saved?'Cadastro salvo.':''})
  if(path==='/admin/access'){
    const permissions={'denunciations.receive':'Receber denúncias para fiscalização','denunciations.read':'Consultar denúncias','denunciations.create':'Cadastrar denúncias','reports.create':'Registrar relatórios','reports.edit':'Editar relatórios e SIVISA','dashboard.read':'Consultar métricas','schedule.read':'Consultar escala','chat.use':'Usar recados'}
    const roles=state.roles||defaultRoles
    return page('admin/access',{roles,permissions,permissionDescriptions:Object.fromEntries(Object.keys(permissions).map(k=>[k,'Permissão demonstrativa. As alterações ficam somente neste navegador.'])),setting:{recovery_email:state.recoveryEmail||'coordenacao@example.com'},accounts:state.users.map(u=>({id:u.id,user_id:u.id,username:u.username,enabled:u.ativo,role_id:u.role_id|| (u.id===1?1:2)})),selectedUser:null,audits:state.audits||[]})
  }
  if(path==='/recados')return page('chat/index',{chatUser:state.users[0],chatCanAnnounce:true})
  if(path==='/sivisa/pendencias'){
    const reports=state.reports.filter(r=>sivisaState(r)==='pending').map(r=>({...r,denunciation:complaint(state,r.denunciation_id)})).sort((a,b)=>b.id-a.id)
    const pages=Math.max(1,Math.ceil(reports.length/25)),current=Math.max(1,Math.min(Number(q.page)||1,pages))
    return page('reports/pendingSivisa',{reports:reports.slice((current-1)*25,current*25),total:reports.length,page:current,pages})
  }
  match=path.match(/^\/relatorio\/(\d+)(\/sivisa)?$/)
  if(match){const report=state.reports.find(r=>r.id===Number(match[1]));if(!report)throw Error('Relatório não encontrado.');return page(match[2]?'reports/sivisa':'reports/show',{report,denuncia:hydrate(state,complaint(state,report.denunciation_id)),updatesCurrentStatus:true,sivisaForm:{sivisa_state:sivisaState(report)==='not_applicable'?'not_applicable':'pending',sivisa_protocol:[...(report.sivisaProtocols||[]).map(r=>r.protocol),...(report.sivisa?.notes||[]).map(()=>'')],sivisa_note:[...(report.sivisaProtocols||[]).map(r=>r.note),...(report.sivisa?.notes||[])]}})}
  return page('operationResult',{title:'Página não encontrada',message:'Este endereço não existe na demonstração. Volte à listagem para continuar.',actionHref:'/',actionLabel:'Voltar à listagem'})
}
