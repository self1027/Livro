import {catalogDefaults} from '../utils/catalogRegistry.js'

export const complaintDraft={registration_type:'PESSOA_TELEFONE',title:'Descarte irregular e água parada em terreno',endereco:'das Flores',numero:'245',bairro:'Centro',complemento:'Terreno ao lado da praça — cenário fictício',description:'Moradores relatam acúmulo de resíduos e recipientes com água parada em um terreno há aproximadamente duas semanas. Há presença de insetos e mau cheiro, principalmente no fim da tarde. Solicita-se vistoria da Vigilância Sanitária para orientar a limpeza e eliminar possíveis focos de vetores. Denúncia fictícia criada exclusivamente para esta demonstração.'}
export const inspectionDraft='Vistoria realizada no endereço informado. Foram encontrados resíduos e recipientes com água parada. O responsável foi orientado sobre a remoção dos materiais, a higienização do terreno e a prevenção de vetores. Emitida notificação para regularização, com retorno programado. Registro fictício para demonstração.'
export const closureDraft='Retorno de fiscalização: constatada a retirada dos resíduos, a limpeza do terreno e a eliminação dos recipientes com água parada. Orientações atendidas e situação regularizada. Denúncia finalizada. Registro fictício para demonstração.'
export const calendarDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
export const defaultRoles=[{id:1,name:'Coordenação',maximum:true,permissions:['denunciations.read','denunciations.create','reports.create','reports.edit','dashboard.read','schedule.read','chat.use']},{id:2,name:'Fiscal sanitário',maximum:false,permissions:['denunciations.receive','denunciations.read','reports.create','reports.edit','schedule.read','chat.use']}]

export function createSeed(now=new Date()){
  const ago=days=>new Date(now.getTime()-days*86400000).toISOString()
  const users=[{id:1,name:'Marina Costa',ativo:true,role:'Coordenação',username:'marina.demo'},{id:2,name:'Ana Ribeiro',ativo:true,role:'Fiscal sanitário',username:'ana.demo'},{id:3,name:'Lucas Almeida',ativo:true,role:'Fiscal sanitário',username:'lucas.demo'},{id:4,name:'Beatriz Santos',ativo:true,role:'Fiscal sanitário',username:'beatriz.demo'}]
  const districts=['Centro','Jardim Alvorada','Vila Mineira','Pereira Jordão','Jardim Europa','Vila Botega'].map((name,i)=>({id:i+1,name,ativo:true}))
  const titles=['Água parada em terreno','Condições de higiene em estabelecimento','Descarte de resíduos em via pública','Armazenamento inadequado de alimentos','Presença de vetores em imóvel','Solicitação de inspeção sanitária']
  const statuses=['REGISTRADA','EM_ANDAMENTO','NOTIFICADA','FINALIZADA','PENDENTE','FINALIZADA','FEITO_AIF']
  const senders=['PESSOA_TELEFONE','PESSOA_PRESENCIAL','OFICIO','OUTRO_ORGÃO']
  const complaints=Array.from({length:48},(_,i)=>({id:i+1,number:48-i,year:Number(calendarDay(ago(i*4+3)).slice(0,4)),title:titles[i%titles.length],registration_type:senders[i%4],endereco:['das Acácias','dos Ipês','José Bonifácio','da Paz'][i%4],numero:String(100+i*7),bairro:districts[i%6].name,complemento:'Endereço fictício',description:'Cenário fictício: '+titles[i%titles.length]+'. Solicita-se avaliação da equipe de fiscalização e acompanhamento das providências.',status:statuses[i%7],user_id:i%5===0?null:2+i%3,creator_id:1,created_at:ago(i*4+3),updated_at:ago(i*4+3)}))
  const reports=[]
  for(const row of complaints){
    if(!row.user_id)continue
    const created_at=new Date(new Date(row.created_at).getTime()+86400000).toISOString()
    const id=reports.length+1
    reports.push({id,denunciation_id:row.id,user_id:row.user_id,type:1,description:'Vistoria sanitária realizada. Responsável orientado quanto às adequações necessárias. Acompanhamento registrado pela equipe. Dados fictícios.',created_at,operation_id:'seed-'+row.id,sivisa:{applies:row.id%4!==0,notes:[]},sivisaProtocols:row.id%3===0?[{protocol:`01.${String(900+row.id).padStart(6,'0')}/${String(row.year).slice(-2)}`,note:'Inspeção demonstrativa'}]:[]})
    if(row.status==='FINALIZADA')reports.push({id:reports.length+1,denunciation_id:row.id,user_id:row.user_id,type:0,description:'Status alterado para "Finalizada"',created_at,operation_id:'seed-close-'+row.id})
  }
  return {version:2,users,districts,complaints,reports,catalogs:structuredClone(catalogDefaults),roles:structuredClone(defaultRoles),recoveryEmail:'coordenacao@example.com',audits:[],attendance:{enabled:true,paused:false,weekdays:['SEG','QUA','SEX']},schedule:{weeks:{},days:{}},messages:[{id:1,from:2,to:1,text:'Vistoria do setor concluída. Os relatórios de exemplo já estão disponíveis para acompanhamento.',created_at:ago(1)}],tour:{step:0,active:false,playing:false,complaintId:null,reportId:null}}
}
