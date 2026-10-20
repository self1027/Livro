import {filterComplaints,complaint} from './store.js'

export function localApi(state,url,method='GET',input={}){
  const path=url.pathname,number=value=>Number(value),nextId=rows=>Math.max(0,...rows.map(r=>r.id))+1
  if(path==='/api/denuncias')return filterComplaints(state,{}).slice(number(url.searchParams.get('offset')),number(url.searchParams.get('offset'))+(number(url.searchParams.get('limit'))||20))
  if(path==='/admin/schedule/week'){if(!/^\d{1,2}-\d{4}$/.test(input.week_key)||!input.nome?.trim())throw Error('Responsável e semana são obrigatórios.');state.schedule.weeks[input.week_key]=input;return {ok:true}}
  if(path==='/admin/schedule/day'){if(!/^\d{4}-\d{2}-\d{2}$/.test(input.data))throw Error('Data inválida.');if(input.tipo==='remover')delete state.schedule.days[input.data];else state.schedule.days[input.data]=input;return {ok:true}}
  if(!path.startsWith('/api/recados/'))throw Error('Recurso indisponível na demonstração.')
  const ref=id=>{if(!id)return null;const row=complaint(state,id);return {id:row.id,protocol:`${row.number}/${row.year}`,title:row.title}}
  const messages=peer=>state.messages.filter(m=>m.from===peer||m.to===peer).map(m=>({id:m.id,senderId:m.from,body:m.text,createdAt:m.created_at,readAt:m.readAt||null,announcementId:m.announcementId||null,denunciation:ref(m.denunciationId)}))
  const conversation=id=>({id,peer:{id,name:state.users.find(u=>u.id===id)?.name,active:state.users.find(u=>u.id===id)?.ativo},lastMessage:messages(id).at(-1),unreadCount:0})
  if(path.endsWith('/people'))return {people:state.users.map(u=>({...u,roleName:u.role||'Fiscal sanitário',roleId:u.role_id||2})),audiences:[{id:2,name:'Fiscal sanitário'}]}
  if(path.endsWith('/conversations'))return method==='POST'?{conversation:conversation(Number(input.userId))}:{conversations:state.users.filter(u=>u.id!==1).map(u=>conversation(u.id))}
  if(path.endsWith('/notifications'))return {unreadCount:0,conversations:[]}
  if(path.endsWith('/denunciations')){const query=(url.searchParams.get('q')||'').toLowerCase(),id=url.searchParams.get('id');return {denunciations:state.complaints.filter(r=>id?r.id===Number(id):`${r.number} ${r.title}`.toLowerCase().includes(query)).slice(0,15).map(r=>ref(r.id))}}
  let match=path.match(/\/conversations\/(\d+)\/(messages|reads|read)$/)
  if(match){
    const peer=Number(match[1]);if(!state.users.some(u=>u.id===peer&&u.id!==1))throw Error('Pessoa não encontrada.')
    if(match[2]==='messages'&&method==='POST'){
      if(typeof input.body!=='string'||!input.body.trim()||input.body.length>8000)throw Error('Escreva um recado de até 8000 caracteres.')
      const message={id:nextId(state.messages),from:1,to:peer,text:input.body.trim(),created_at:new Date().toISOString(),denunciationId:input.denunciationId||null,clientId:input.clientId}
      if(!state.messages.some(m=>input.clientId&&m.clientId===input.clientId))state.messages.push(message)
      return {message:messages(peer).at(-1)}
    }
    if(match[2]==='reads')return {reads:[]}
    if(match[2]==='read'){for(const m of state.messages)if(m.from===peer&&input.messageIds?.includes(m.id))m.readAt=new Date().toISOString();return {ok:true}}
    return {messages:messages(peer).filter(m=>(!url.searchParams.has('after')||m.id>Number(url.searchParams.get('after')))&&(!url.searchParams.has('before')||m.id<Number(url.searchParams.get('before')))),hasMore:false,peerActive:true}
  }
  if(path.endsWith('/announcements')&&method==='POST'){
    if(typeof input.body!=='string'||!input.body.trim()||input.body.length>8000)throw Error('Informe o texto do anúncio.')
    const recipients=state.users.filter(u=>u.id!==1&&(input.audience?.type==='all'||input.audience?.type==='users'&&input.audience.userIds.includes(u.id)||input.audience?.type==='roles'&&input.audience.roleIds.includes(u.role_id||2)))
    const id=Date.now();for(const user of recipients)state.messages.push({id:nextId(state.messages),from:1,to:user.id,text:input.body.trim(),created_at:new Date().toISOString(),announcementId:id,denunciationId:input.denunciationId||null})
    return {announcement:{id,recipientCount:recipients.length}}
  }
  if((match=path.match(/\/announcements\/(\d+)$/))){const recipients=state.messages.filter(m=>m.announcementId===Number(match[1])).map(m=>({id:m.to,name:state.users.find(u=>u.id===m.to)?.name,readAt:null}));return {announcement:{recipientCount:recipients.length,readCount:0,recipients}}}
  throw Error('Recurso indisponível na demonstração.')
}
