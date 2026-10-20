import {createComplaint,assignComplaint,addReport,saveSivisa,complaint} from './store.js'
import {statuses,applyCatalog} from '../utils/catalogRegistry.js'

const text=(value,label,max=255)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`Informe ${label} válido.`);return value.trim()}
const array=value=>value==null?[]:Array.isArray(value)?value:[value]
const slug=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_')
export function mutate(state,path,input){
  applyCatalog(state.catalogs)
  let match
  if(path==='/denuncias'){
    const row=createComplaint(state,input)
    if(state.tour.active&&!state.tour.complaintId)state.tour.complaintId=row.id
    return `/denuncias/${row.id}?notice=created`
  }
  if((match=path.match(/^\/admin\/assignments\/(\d+)$/))){assignComplaint(state,match[1],input.userId);return input.redirectToShow?`/denuncias/${match[1]}?notice=assigned`:`/admin/assignments?denunciaId=${match[1]}&saved=1`}
  if((match=path.match(/^\/denuncias\/(\d+)\/adicionar-relatorio$/))){const report=addReport(state,match[1],input);if(report&&state.tour.active&&Number(match[1])===state.tour.complaintId&&!state.tour.reportId)state.tour.reportId=report.id;return `/denuncias/${match[1]}?notice=report-saved#reports-section`}
  if((match=path.match(/^\/denuncias\/(\d+)\/edit$/))){const row=complaint(state,match[1]),copy=structuredClone(state),validated=createComplaint(copy,input);for(const key of ['title','registration_type','endereco','numero','bairro','complemento','description'])row[key]=validated[key];return `/denuncias/${row.id}?notice=updated`}
  if((match=path.match(/^\/relatorio\/(\d+)\/sivisa$/))){saveSivisa(state,match[1],input);return `/relatorio/${match[1]}/sivisa?saved=1`}
  if((match=path.match(/^\/relatorio\/(\d+)\/(editar|deletar)$/))){
    const report=state.reports.find(r=>r.id===Number(match[1]));if(!report)throw Error('Relatório não encontrado.')
    if(match[2]==='deletar')state.reports=state.reports.filter(r=>r.id!==report.id)
    else if(report.type===1)report.description=text(input.description,'uma descrição',10000)
    else{if(!Object.hasOwn(statuses,input.status))throw Error('Status inválido.');report.description=`Status alterado para "${statuses[input.status].label}"`;complaint(state,report.denunciation_id).status=input.status}
    return `/denuncias/${report.denunciation_id}?notice=updated#reports-section`
  }
  if(path==='/admin/attendance'){
    const weekdays=array(input.weekdays);if(weekdays.some(d=>!['SEG','TER','QUA','QUI','SEX'].includes(d)))throw Error('Dia de atendimento inválido.')
    state.attendance={enabled:input.module_disabled!=='on',paused:input.paused==='on',weekdays,updated_at:new Date().toISOString()};return '/admin?tab=attendance&notice=saved'
  }
  if(path==='/bairros'||(match=path.match(/^\/bairros\/(\d+)(?:\/(edit|delete))?$/))){
    if(match?.[2]==='delete'){const district=state.districts.find(d=>d.id===Number(match[1]));if(state.complaints.some(r=>r.bairro===district?.name))throw Error('Este bairro possui denúncias vinculadas.');state.districts=state.districts.filter(d=>d!==district)}
    else{
      const name=text(input.name,'nome do bairro'),existing=state.districts.find(d=>d.name.toLowerCase()===name.toLowerCase()&&d.id!==Number(match?.[1]));if(existing)throw Error('Bairro já cadastrado.')
      if(match){const district=state.districts.find(d=>d.id===Number(match[1]));if(!district)throw Error('Bairro não encontrado.');for(const row of state.complaints)if(row.bairro===district.name)row.bairro=name;Object.assign(district,{name,slug:slug(name)})}
      else state.districts.push({id:Math.max(0,...state.districts.map(d=>d.id))+1,name,slug:slug(name)})
    }
    return '/admin/catalogs?kind=district&saved=1'
  }
  if((match=path.match(/^\/admin\/catalogs\/(status|sender)(?:\/(\d+))?$/))){
    const kind=match[1],label=text(input.label,'nome da opção',120),color=input.color,backgroundColor=input.backgroundColor
    if(!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(backgroundColor))throw Error('Informe cores hexadecimais válidas.')
    const entry=match[2]?state.catalogs.find((r,i)=>(r.id||i+1)===Number(match[2])):null
    const behavior=entry&&['REGISTRADA','FINALIZADA'].includes(entry.slug)?entry.behavior:input.behavior
    if(kind==='status'&&!['registered','pending','progress','closed'].includes(behavior))throw Error('Classificação inválida.')
    if(entry)Object.assign(entry,{label,color,backgroundColor,...(kind==='status'?{behavior}:{})})
    else{const identifier=slug(label);if(state.catalogs.some(r=>r.kind===kind&&r.slug===identifier))throw Error('Opção já cadastrada.');state.catalogs.push({id:Math.max(state.catalogs.length,...state.catalogs.map(r=>r.id||0))+1,kind,slug:identifier,label,color,backgroundColor,...(kind==='status'?{behavior}:{})})}
    applyCatalog(state.catalogs);return `/admin/catalogs?kind=${kind}&saved=1`
  }
  if(path.startsWith('/admin/access/')){
    if(path.endsWith('/email')){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))throw Error('E-mail inválido.');state.recoveryEmail=input.email}
    else if((match=path.match(/\/accounts(?:\/(\d+))?$/))){
      const name=text(input.name,'nome'),username=text(input.username,'username',64)
      if(!/^[a-zA-Z0-9._-]{3,64}$/.test(username)||state.users.some(u=>u.username===username&&u.id!==Number(match[1])))throw Error('Username inválido ou já utilizado.')
      if(!match[1]&&typeof input.password!=='string')throw Error('Informe uma senha temporária fictícia.')
      if(input.password&&input.password.length<8)throw Error('A senha fictícia precisa de pelo menos 8 caracteres.')
      const id=match[1]?Number(match[1]):Math.max(...state.users.map(u=>u.id))+1,existing=state.users.find(u=>u.id===id)
      const values={id,name,username,ativo:input.ativo==='on'&&input.enabled==='on',role_id:Number(input.role_id)}
      if(existing)Object.assign(existing,values);else state.users.push(values)
    }else if((match=path.match(/\/roles(?:\/(\d+))?$/))){
      state.roles??=[{id:1,name:'Coordenação',maximum:true,permissions:['denunciations.receive','denunciations.read','denunciations.create','reports.create','reports.edit','dashboard.read','schedule.read','chat.use']},{id:2,name:'Fiscal sanitário',maximum:false,permissions:['denunciations.receive','denunciations.read','reports.create','reports.edit','schedule.read','chat.use']}]
      const name=text(input.name,'nome do cargo',80),permissions=array(input.permissions),existing=state.roles.find(r=>r.id===Number(match[1]))
      if(existing)Object.assign(existing,{name,permissions,maximum:input.maximum==='on'});else state.roles.push({id:Math.max(...state.roles.map(r=>r.id))+1,name,permissions,maximum:input.maximum==='on'})
    }else if((match=path.match(/\/people\/(\d+)$/))){const user=state.users.find(u=>u.id===Number(match[1]));if(!user)throw Error('Pessoa não encontrada.');user.name=text(input.name,'nome');user.ativo=input.ativo==='on'}
    else if(!/\/accounts\/\d+\/reset$/.test(path))throw Error('Ação indisponível na demonstração.')
    // Credenciais são descartadas: esta demonstração não cria contas reais.
    state.audits??=[];state.audits.unshift({createdAt:new Date().toISOString(),action:'Configuração demonstrativa atualizada',actor:'Visitante',target:input.name||'',notes:'Somente neste navegador; credenciais não armazenadas.'})
    return '/admin/access?saved=1'
  }
  throw Error('Esta operação não está disponível na demonstração.')
}
