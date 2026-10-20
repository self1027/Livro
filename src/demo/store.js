import {createSeed,calendarDay,defaultRoles} from './data.js'
import {statuses,senders,applyCatalog,isClosedStatus} from '../utils/catalogRegistry.js'
import {normalizeFilters,summarize,selectQueue,mergeMonthlyReports,summarizeMonthlyClosures} from '../utils/adminMetrics.js'
import {normalizeSivisa,summarizeSivisa,selectSivisaReports,SIVISA_METRICS} from '../utils/sivisa.js'

export const storageKey='livro-demo-v2'
export function resetState(state){for(const key of Object.keys(state))delete state[key];Object.assign(state,createSeed());applyCatalog(state.catalogs)}
export const receivesComplaints=(state,user)=>!!user?.ativo&&(state.roles||defaultRoles).some(role=>role.id===(user.role_id||(user.id===1?1:2))&&role.permissions.includes('denunciations.receive'))
const nextId=rows=>Math.max(0,...rows.map(r=>r.id))+1
const required=(value,label,max=255)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`Informe ${label} válido (até ${max} caracteres).`);return value.trim()}
export function loadState(storage){
  try{
    const value=JSON.parse(storage.getItem(storageKey))
    if(value?.version!==2||!['users','districts','complaints','reports','catalogs','messages'].every(k=>Array.isArray(value[k]))||!value.tour||!value.schedule||!value.attendance)throw Error('invalid')
    if(!value.complaints.every(r=>Number.isSafeInteger(r.id)&&typeof r.title==='string'&&Number.isFinite(Date.parse(r.created_at)))||!value.users.every(r=>Number.isSafeInteger(r.id)&&typeof r.name==='string')||!value.reports.every(r=>Number.isSafeInteger(r.id)&&Number.isFinite(Date.parse(r.created_at))))throw Error('invalid')
    applyCatalog(value.catalogs);return value
  }catch{return createSeed()}
}
export function saveState(storage,state){try{storage.setItem(storageKey,JSON.stringify(state))}catch{throw Error('Não foi possível salvar neste navegador. A sessão continua em memória; suas alterações serão perdidas ao recarregar.')}}
export function complaint(state,id){const row=state.complaints.find(r=>r.id===Number(id));if(!row)throw Error('Denúncia não encontrada.');return row}
export function hydrate(state,row){
  const reports=state.reports.filter(r=>r.denunciation_id===row.id).map(r=>({...r,user:state.users.find(u=>u.id===r.user_id)})).sort((a,b)=>b.id-a.id)
  return {...row,user:state.users.find(u=>u.id===row.user_id),creator:state.users.find(u=>u.id===row.creator_id),reports,last_activity:reports[0]?.created_at||row.created_at,first_text_report_at:reports.filter(r=>r.type===1).map(r=>r.created_at).sort()[0]||null}
}
export function createComplaint(state,input){
  applyCatalog(state.catalogs)
  const row={}
  for(const [key,label,max] of [['title','título',255],['endereco','logradouro',255],['numero','número',255],['description','descrição',10000]])row[key]=required(input[key],label,max)
  row.bairro=required(input.bairro,'bairro');if(!state.districts.some(d=>d.name===row.bairro))throw Error('Selecione um bairro cadastrado.')
  if(!Object.hasOwn(senders,input.registration_type))throw Error('Selecione uma origem cadastrada.')
  const now=new Date().toISOString(),year=Number(calendarDay(now).slice(0,4))
  Object.assign(row,{id:nextId(state.complaints),year,number:Math.max(0,...state.complaints.filter(r=>r.year===year).map(r=>r.number))+1,registration_type:input.registration_type,complemento:typeof input.complemento==='string'?input.complemento.trim().slice(0,255):'',status:'REGISTRADA',user_id:null,creator_id:1,created_at:now,updated_at:now})
  state.complaints.push(row);return row
}
export function assignComplaint(state,id,userId){
  const row=complaint(state,id),user=state.users.find(u=>u.id===Number(userId)&&receivesComplaints(state,u))
  if(!user)throw Error('Selecione um fiscal ativo.')
  if(row.user_id===user.id)return row
  row.user_id=user.id;row.updated_at=new Date().toISOString()
  state.reports.push({id:nextId(state.reports),denunciation_id:row.id,user_id:1,type:0,description:`Fiscal responsável atribuído: ${user.name}`,created_at:row.updated_at})
  return row
}
export function addReport(state,id,input){
  applyCatalog(state.catalogs)
  const row=complaint(state,id)
  if(!row.user_id)throw Error('Atribua um fiscal responsável antes de registrar o acompanhamento.')
  const text=typeof input.description==='string'?input.description.trim():'',status=input.status||row.status
  if(text.length>10000)throw Error('Use até 10000 caracteres no relatório.')
  if(!Object.hasOwn(statuses,status))throw Error('Selecione um status cadastrado.')
  if(!text&&status===row.status)throw Error('Escreva um relatório ou altere o status.')
  const normalized=text?normalizeSivisa(input):null,created_at=new Date().toISOString(),operation_id=globalThis.crypto.randomUUID()
  let report
  if(text){report={id:nextId(state.reports),denunciation_id:row.id,user_id:row.user_id,type:1,description:text,created_at,operation_id,sivisa:{applies:normalized.applies,notes:normalized.notes},sivisaProtocols:normalized.protocols};state.reports.push(report)}
  if(status!==row.status)state.reports.push({id:nextId(state.reports),denunciation_id:row.id,user_id:row.user_id,type:0,description:`Status alterado de "${statuses[row.status]?.label||row.status}" para "${statuses[status].label}"`,created_at,operation_id})
  row.status=status;row.updated_at=created_at;return report
}
export function saveSivisa(state,id,input){
  const report=state.reports.find(r=>r.id===Number(id)&&r.type===1);if(!report)throw Error('Relatório não encontrado.')
  const normalized=normalizeSivisa(input,{editing:true});report.sivisa={applies:normalized.applies,notes:normalized.notes};report.sivisaProtocols=normalized.protocols;return report
}
export function filterComplaints(state,filters,{author=false,period=true}={}){
  const contains=(a,b)=>String(a||'').toLocaleLowerCase('pt-BR').includes(String(b).toLocaleLowerCase('pt-BR'))
  return state.complaints.map(r=>hydrate(state,r)).filter(r=>{
    for(const key of ['year','number','status','registration_type'])if(filters[key]&&String(r[key])!==String(filters[key]))return false
    for(const key of ['endereco','numero','bairro'])if(filters[key]&&!contains(r[key],filters[key]))return false
    if(!author&&filters.userId&&(filters.userId==='unassigned'?!!r.user_id:String(r.user_id)!==String(filters.userId)))return false
    if(filters.scope==='open'&&isClosedStatus(r.status))return false
    const day=calendarDay(r.created_at)
    return !period||(!filters.start||day>=filters.start)&&(!filters.end||day<=filters.end)
  }).sort((a,b)=>b.year-a.year||b.number-a.number||b.id-a.id)
}
export function dashboard(state,query){
  applyCatalog(state.catalogs)
  const filters=normalizeFilters(query),users=state.users,rows=filterComplaints(state,filters),metrics=summarize(rows,users,filters)
  const selected=selectQueue(metrics.rows,filters.queue),pages=Math.max(1,Math.ceil(selected.length/25));filters.page=Math.min(filters.page,pages)
  const actionIds=new Set(filterComplaints(state,filters,{author:filters.view==='sivisa',period:false}).map(r=>r.id))
  const reports=state.reports.filter(r=>actionIds.has(r.denunciation_id)&&(!filters.start||calendarDay(r.created_at)>=filters.start)&&(!filters.end||calendarDay(r.created_at)<=filters.end)&&(!(filters.view==='sivisa'&&filters.userId)||String(r.user_id)===filters.userId)).map(r=>({...r,user:users.find(u=>u.id===r.user_id),denunciation:hydrate(state,complaint(state,r.denunciation_id))})).sort((a,b)=>b.id-a.id)
  const monthlyReported=new Map()
  for(const r of reports.filter(r=>r.type===1)){const month=calendarDay(r.created_at).slice(0,7);if(!monthlyReported.has(month))monthlyReported.set(month,new Set());monthlyReported.get(month).add(r.denunciation_id)}
  const matching=filters.actionMetric?selectSivisaReports(reports,filters.actionMetric):[]
  const actionPages=Math.max(1,Math.ceil(matching.length/25)),actionPage=Math.min(Number(query.page)||1,actionPages)
  const actionDetails=filters.actionMetric?{metric:filters.actionMetric,label:SIVISA_METRICS[filters.actionMetric],author:users.find(u=>String(u.id)===filters.userId)?.name||'',count:filters.actionMetric==='protocols'?matching.reduce((sum,r)=>sum+r.sivisaProtocols.length,0):matching.length,actionCount:matching.length,page:actionPage,pages:actionPages,reports:matching.slice((actionPage-1)*25,actionPage*25)}:null
  return {...metrics,filters,users,districts:state.districts,years:[...new Set(state.complaints.map(r=>r.year))].sort().reverse(),reports:reports.filter(r=>r.type===1||!r.operation_id||!reports.some(t=>t.type===1&&t.operation_id===r.operation_id)).slice(0,10),selectedRows:selected.slice((filters.page-1)*25,filters.page*25),selectedCount:selected.length,pages,exportRows:selected,actionDetails,sivisaMetrics:summarizeSivisa(reports,users),monthly:mergeMonthlyReports(metrics.monthly,[...monthlyReported].map(([month,ids])=>({month,total:ids.size})),summarizeMonthlyClosures(reports))}
}
