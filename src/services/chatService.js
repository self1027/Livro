import {randomUUID} from 'node:crypto'
import {Op,QueryTypes,Transaction,UniqueConstraintError} from 'sequelize'
import db from '../database/database.js'
import User from '../models/usersModel.js'
import Denunciation from '../models/denunciationsModel.js'
import {Role} from '../auth/models.js'
import {can} from '../auth/permissions.js'
import {ChatConversation,ChatMessage,ChatMessageRead,ChatAnnouncement} from '../models/chatModels.js'

export class ChatError extends Error{
    constructor(status,message){super(message);this.status=status}
}
const fail=(status,message)=>{throw new ChatError(status,message)}
export function positiveId(value,label='Identificador'){
    if(!((typeof value==='number'&&Number.isInteger(value))||(typeof value==='string'&&/^[1-9]\d*$/.test(value))))fail(400,`${label} inválido.`)
    const parsed=Number(value)
    if(!Number.isSafeInteger(parsed)||parsed<1||parsed>2147483647)fail(400,`${label} inválido.`)
    return parsed
}
export function messageInput(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Mensagem inválida.')
    if(typeof input.body!=='string'||!input.body.trim()||input.body.length>8000)fail(400,'Escreva uma mensagem com até 8.000 caracteres.')
    if(typeof input.clientId!=='string'||! /^[A-Za-z0-9_-]{8,80}$/.test(input.clientId))fail(400,'Identificador de envio inválido. Recarregue a página.')
    const denunciationId=input.denunciationId==null||input.denunciationId===''?null:positiveId(input.denunciationId,'Denúncia')
    return {body:input.body.trim(),clientId:input.clientId,denunciationId}
}
function requireUse(identity){
    if(!identity?.user?.id)fail(401,'Autenticação necessária.')
    if(!can(identity,'chat.use'))fail(403,'Você não possui permissão para usar os recados.')
    return positiveId(identity.user.id)
}
const sql=(query,replacements={},transaction)=>db.query(query,{type:QueryTypes.SELECT,replacements,transaction})
const ownConversation='(c.user_low_id = :userId OR c.user_high_id = :userId)'
const date=value=>value==null?null:new Date(value).toISOString()
const permissions=value=>Array.isArray(value)?value:(typeof value==='string'?JSON.parse(value):[])

async function activePeople(transaction){
    const rows=await sql(`SELECT u.id,u.name,a.role_id AS roleId,r.name AS roleName,r.maximum,r.permissions
        FROM users u JOIN auth_accounts a ON a.user_id=u.id JOIN auth_roles r ON r.id=a.role_id
        WHERE u.ativo=1 AND a.enabled=1 ORDER BY u.name,u.id`,{},transaction)
    return rows.filter(row=>!!row.maximum||permissions(row.permissions).includes('chat.use')).map(({id,name,roleId,roleName})=>({id:Number(id),name,roleId:Number(roleId),roleName}))
}
export async function people(identity){
    const userId=requireUse(identity),available=(await activePeople()).filter(person=>person.id!==userId)
    const audiences=[...new Map(available.map(person=>[person.roleId,{id:person.roleId,name:person.roleName}])).values()]
    return {people:available,audiences}
}
async function conversation(identity,id,transaction){
    const userId=requireUse(identity),row=await ChatConversation.findByPk(positiveId(id,'Conversa'),{transaction})
    if(!row||![row.user_low_id,row.user_high_id].includes(userId))fail(404,'Conversa não encontrada.')
    return row
}
const peerIdOf=(row,userId)=>row.user_low_id===userId?row.user_high_id:row.user_low_id
async function peerOf(row,userId,transaction){
    const peerId=peerIdOf(row,userId),[user,available]=await Promise.all([User.findByPk(peerId,{attributes:['id','name'],transaction}),activePeople(transaction)])
    return {id:peerId,name:user?.name||'Pessoa indisponível',active:available.some(person=>person.id===peerId)}
}
async function ensurePair(userId,peerId,transaction){
    const pair={user_low_id:Math.min(userId,peerId),user_high_id:Math.max(userId,peerId)}
    const [row]=await ChatConversation.findOrCreate({where:pair,defaults:pair,transaction})
    // Serialize inserts in this conversation. Otherwise a later ID could commit first,
    // and a client polling after that ID would miss the delayed earlier message.
    return ChatConversation.findByPk(row.id,{transaction,lock:transaction.LOCK.UPDATE})
}
async function inTransaction(work){
    for(let attempt=0;;attempt++){
        try{return await db.transaction({isolationLevel:Transaction.ISOLATION_LEVELS.READ_COMMITTED},work)}
        catch(error){if(attempt>=2||!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code))throw error}
    }
}
export async function createConversation(identity,peerId){
    const userId=requireUse(identity);peerId=positiveId(peerId,'Destinatário')
    if(userId===peerId)fail(400,'Escolha outra pessoa para conversar.')
    const peer=(await activePeople()).find(person=>person.id===peerId)
    if(!peer)fail(400,'O destinatário não possui acesso ativo aos recados.')
    const row=await inTransaction(transaction=>ensurePair(userId,peerId,transaction))
    return {conversation:{id:row.id,peer:{id:peer.id,name:peer.name,active:true}}}
}
async function unreadCountFor(userId){
    const [row]=await sql(`SELECT COUNT(*) AS total FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id
        LEFT JOIN chat_message_reads r ON r.message_id=m.id AND r.user_id=:userId
        WHERE ${ownConversation} AND m.sender_id<>:userId AND r.id IS NULL`,{userId})
    return Number(row.total)
}
export async function conversations(identity){
    const userId=requireUse(identity)
    const [rows,available]=await Promise.all([sql(`SELECT c.id,c.user_low_id,c.user_high_id,
        CASE WHEN c.user_low_id=:userId THEN high_user.name ELSE low_user.name END AS peerName,
        m.id AS messageId,m.body,m.createdAt,m.sender_id,m.announcement_id,
        (SELECT COUNT(*) FROM chat_messages unread LEFT JOIN chat_message_reads seen ON seen.message_id=unread.id AND seen.user_id=:userId
         WHERE unread.conversation_id=c.id AND unread.sender_id<>:userId AND seen.id IS NULL) AS unreadCount
        FROM chat_conversations c JOIN users low_user ON low_user.id=c.user_low_id JOIN users high_user ON high_user.id=c.user_high_id
        LEFT JOIN chat_messages m ON m.id=(SELECT MAX(latest.id) FROM chat_messages latest WHERE latest.conversation_id=c.id)
        WHERE ${ownConversation} ORDER BY COALESCE(m.createdAt,c.createdAt) DESC,c.id DESC`,{userId}),activePeople()])
    const active=new Set(available.map(person=>person.id))
    const result=rows.map(row=>({id:Number(row.id),peer:{id:peerIdOf(row,userId),name:row.peerName,active:active.has(peerIdOf(row,userId))},
        lastMessage:row.messageId?{id:Number(row.messageId),body:row.body.slice(0,200),createdAt:date(row.createdAt),senderId:Number(row.sender_id),announcementId:row.announcement_id==null?null:Number(row.announcement_id)}:null,unreadCount:Number(row.unreadCount)}))
    return {conversations:result,unreadCount:result.reduce((sum,row)=>sum+row.unreadCount,0)}
}
async function validateDenunciation(identity,id,transaction){
    if(id==null)return
    if(!can(identity,'denunciations.read'))fail(403,'Você não possui permissão para vincular denúncias.')
    if(!await Denunciation.findByPk(id,{attributes:['id'],transaction}))fail(400,'Denúncia não encontrada.')
}
function serializeMessage(row,identity){
    return {id:Number(row.id),conversationId:Number(row.conversation_id),senderId:Number(row.sender_id),body:row.body,createdAt:date(row.createdAt),readAt:date(row.read_at),announcementId:row.announcement_id==null?null:Number(row.announcement_id),
        denunciation:row.denunciation_id&&row.denunciation_number!=null&&can(identity,'denunciations.read')?{id:Number(row.denunciation_id),protocol:`${row.denunciation_number}/${row.denunciation_year}`} :null}
}
const messageSelect=`SELECT m.*,r.read_at,d.number AS denunciation_number,d.year AS denunciation_year FROM chat_messages m
    LEFT JOIN chat_message_reads r ON r.message_id=m.id AND r.user_id<>m.sender_id
    LEFT JOIN denunciations d ON d.id=m.denunciation_id`
async function oneMessage(identity,id,transaction){
    const [row]=await sql(`${messageSelect} WHERE m.id=:id`,{id},transaction)
    return serializeMessage(row,identity)
}
export async function messages(identity,id,query={}){
    const userId=requireUse(identity),row=await conversation(identity,id)
    if(query.before!=null&&query.after!=null)fail(400,'Escolha apenas uma direção para carregar mensagens.')
    const cursor=query.before!=null?positiveId(query.before,'Página'):query.after!=null?positiveId(query.after,'Página'):null
    const forward=query.after!=null,limit=forward?100:40
    const rows=await sql(`${messageSelect} WHERE m.conversation_id=:conversationId ${cursor==null?'':`AND m.id ${forward?'>':'<'} :cursor`} ORDER BY m.id ${forward?'ASC':'DESC'} LIMIT :limit`,{conversationId:row.id,cursor,limit:limit+1})
    const hasMore=rows.length>limit,page=rows.slice(0,limit)
    if(!forward)page.reverse()
    const peer=await peerOf(row,userId)
    return {messages:page.map(message=>serializeMessage(message,identity)),hasMore,peerActive:peer.active}
}
function assertSameMessage(existing,input,conversationId){
    if(existing.body!==input.body||(existing.denunciation_id??null)!==input.denunciationId||existing.conversation_id!==conversationId)fail(409,'Este identificador já foi usado em outro envio.')
}
export async function sendMessage(identity,id,input){
    const userId=requireUse(identity),data=messageInput(input),row=await conversation(identity,id)
    const existing=await ChatMessage.findOne({where:{sender_id:userId,client_id:data.clientId}})
    if(existing){assertSameMessage(existing,data,row.id);return {message:await oneMessage(identity,existing.id)}}
    let created
    try{
        created=await inTransaction(async transaction=>{
            await ChatConversation.findByPk(row.id,{transaction,lock:transaction.LOCK.UPDATE})
            const peer=await peerOf(row,userId,transaction)
            if(!peer.active)fail(400,'O destinatário não possui acesso ativo aos recados.')
            await validateDenunciation(identity,data.denunciationId,transaction)
            return ChatMessage.create({conversation_id:row.id,sender_id:userId,body:data.body,denunciation_id:data.denunciationId,client_id:data.clientId},{transaction})
        })
    }catch(error){
        if(!(error instanceof UniqueConstraintError))throw error
        created=await ChatMessage.findOne({where:{sender_id:userId,client_id:data.clientId}})
        if(!created)throw error
        assertSameMessage(created,data,row.id)
    }
    return {message:await oneMessage(identity,created.id)}
}
export async function markRead(identity,id,input={}){
    const userId=requireUse(identity),row=await conversation(identity,id)
    if(!input||!Array.isArray(input.messageIds)||input.messageIds.length>100)fail(400,'Informe até 100 mensagens para confirmar leitura.')
    const ids=[...new Set(input.messageIds.map(value=>positiveId(value,'Mensagem')))]
    if(ids.length){
        const received=await ChatMessage.findAll({where:{id:{[Op.in]:ids},conversation_id:row.id,sender_id:{[Op.ne]:userId}},attributes:['id']})
        if(received.length!==ids.length)fail(400,'A leitura só pode ser confirmada para mensagens recebidas nesta conversa.')
        const now=new Date()
        await ChatMessageRead.bulkCreate(received.map(message=>({message_id:message.id,user_id:userId,read_at:now})),{ignoreDuplicates:true})
    }
    return {unreadCount:await unreadCountFor(userId)}
}
export async function reads(identity,id,query={}){
    const userId=requireUse(identity),row=await conversation(identity,id)
    let messageIds=null
    if(query.messageIds!=null){
        if(typeof query.messageIds!=='string'||!query.messageIds||query.messageIds.length>2200)fail(400,'Informe até 200 identificadores de mensagens separados por vírgula.')
        const values=query.messageIds.split(',')
        if(values.length>200)fail(400,'Informe até 200 identificadores de mensagens separados por vírgula.')
        messageIds=[...new Set(values.map(value=>positiveId(value,'Mensagem')))]
        if(query.after!=null)fail(400,'Escolha os identificadores das mensagens ou o cursor de leitura.')
    }
    const after=query.after==null?null:positiveId(query.after,'Mensagem')
    const result=await sql(`SELECT r.message_id,r.read_at FROM chat_message_reads r JOIN chat_messages m ON m.id=r.message_id
        WHERE m.conversation_id=:conversationId AND m.sender_id=:userId ${after==null?'':'AND m.id>:after'} ${messageIds==null?'':'AND m.id IN (:messageIds)'} ORDER BY m.id DESC LIMIT 200`,{conversationId:row.id,userId,after,messageIds})
    return {reads:result.map(item=>({messageId:Number(item.message_id),readAt:date(item.read_at)}))}
}
function normalizeAudience(audience){
    if(!audience||typeof audience!=='object'||Array.isArray(audience))fail(400,'Selecione o público do anúncio.')
    if(audience.type==='all')return {type:'all'}
    const property=audience.type==='roles'?'roleIds':audience.type==='users'?'userIds':null
    if(!property||!Array.isArray(audience[property])||!audience[property].length||audience[property].length>1000)fail(400,'Selecione os destinatários do anúncio.')
    return {type:audience.type,[property]:[...new Set(audience[property].map(id=>positiveId(id,'Destinatário')))].sort((a,b)=>a-b)}
}
function assertSameAnnouncement(existing,data,audience){
    if(existing.body!==data.body||(existing.denunciation_id??null)!==data.denunciationId||JSON.stringify(existing.audience.selection)!==JSON.stringify(audience))fail(409,'Este identificador já foi usado em outro anúncio.')
}
export async function announce(identity,input={}){
    const userId=requireUse(identity)
    if(!can(identity,'chat.announce'))fail(403,'Você não possui permissão para enviar anúncios.')
    const data=messageInput(input),audience=normalizeAudience(input.audience)
    const existing=await ChatAnnouncement.findOne({where:{sender_id:userId,client_id:data.clientId}})
    if(existing){assertSameAnnouncement(existing,data,audience);return {announcement:{id:existing.id,recipientCount:existing.audience.recipients.length}}}
    let created
    try{
        created=await inTransaction(async transaction=>{
            await validateDenunciation(identity,data.denunciationId,transaction)
            const available=(await activePeople(transaction)).filter(person=>person.id!==userId)
            if(audience.type==='roles'){
                const roles=await Role.count({where:{id:{[Op.in]:audience.roleIds}},transaction})
                if(roles!==audience.roleIds.length)fail(400,'Um dos cargos selecionados não existe.')
            }
            const recipients=available.filter(person=>audience.type==='all'||(audience.type==='roles'?audience.roleIds.includes(person.roleId):audience.userIds.includes(person.id))).sort((a,b)=>a.id-b.id)
            if(audience.type==='users'&&recipients.length!==audience.userIds.length)fail(400,'Um dos destinatários não possui acesso ativo aos recados.')
            if(!recipients.length)fail(400,'O público selecionado não tem destinatários ativos.')
            const announcement=await ChatAnnouncement.create({sender_id:userId,body:data.body,denunciation_id:data.denunciationId,client_id:data.clientId,audience:{selection:audience,recipients}},{transaction})
            for(const recipient of recipients){
                const row=await ensurePair(userId,recipient.id,transaction)
                await ChatMessage.create({conversation_id:row.id,sender_id:userId,body:data.body,denunciation_id:data.denunciationId,announcement_id:announcement.id,client_id:randomUUID()},{transaction})
            }
            return announcement
        })
    }catch(error){
        if(!(error instanceof UniqueConstraintError))throw error
        created=await ChatAnnouncement.findOne({where:{sender_id:userId,client_id:data.clientId}})
        if(!created)throw error
        assertSameAnnouncement(created,data,audience)
    }
    return {announcement:{id:created.id,recipientCount:created.audience.recipients.length}}
}
export async function announcement(identity,id){
    const userId=requireUse(identity),row=await ChatAnnouncement.findByPk(positiveId(id,'Anúncio'))
    if(!row||row.sender_id!==userId)fail(404,'Anúncio não encontrado.')
    const rows=await sql(`SELECT r.user_id,r.read_at FROM chat_messages m JOIN chat_message_reads r ON r.message_id=m.id AND r.user_id<>m.sender_id WHERE m.announcement_id=:id`,{id:row.id})
    const seen=new Map(rows.map(item=>[Number(item.user_id),date(item.read_at)]))
    const recipients=row.audience.recipients.map(person=>({id:person.id,name:person.name,readAt:seen.get(person.id)||null}))
    return {announcement:{id:row.id,recipientCount:recipients.length,readCount:recipients.filter(person=>person.readAt).length,recipients}}
}
export async function notifications(identity){
    const userId=requireUse(identity)
    const [unreadCount,latest,unread]=await Promise.all([
        unreadCountFor(userId),
        sql(`SELECT MAX(m.id) AS id FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id WHERE ${ownConversation} AND m.sender_id<>:userId`,{userId}),
        sql(`SELECT m.id,m.conversation_id,m.body,m.announcement_id,u.name AS senderName FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id JOIN users u ON u.id=m.sender_id
            LEFT JOIN chat_message_reads r ON r.message_id=m.id AND r.user_id=:userId
            WHERE ${ownConversation} AND m.sender_id<>:userId AND r.id IS NULL ORDER BY m.id DESC LIMIT 20`,{userId})
    ])
    const latestMessageId=Number(latest[0].id||0)
    return {unreadCount,latestMessageId,revision:`${latestMessageId}:${unreadCount}`,unreadMessages:unread.reverse().map(row=>({id:Number(row.id),conversationId:Number(row.conversation_id),senderName:row.senderName,body:row.body.slice(0,200),announcementId:row.announcement_id==null?null:Number(row.announcement_id)}))}
}
export async function denunciations(identity,query={}){
    requireUse(identity)
    if(!can(identity,'denunciations.read'))fail(403,'Você não possui permissão para consultar denúncias.')
    if(query.id!=null){
        const row=await Denunciation.findByPk(positiveId(query.id,'Denúncia'),{attributes:['id','number','year','title']})
        return {denunciations:row?[{id:row.id,protocol:`${row.number}/${row.year}`,title:row.title}]:[]}
    }
    if(query.q==null||query.q==='')return {denunciations:[]}
    if(typeof query.q!=='string'||query.q.length>120)fail(400,'Busca inválida. Use até 120 caracteres.')
    const term=query.q.trim()
    if(!term)return {denunciations:[]}
    const match=/^([1-9]\d*)(?:\s*\/\s*(\d{2}|\d{4}))?$/.exec(term)
    let rows
    if(match){
        const number=positiveId(match[1],'Protocolo'),year=match[2]?(match[2].length===2?2000+Number(match[2]):Number(match[2])):null
        rows=await sql(`SELECT id,number,year,title FROM denunciations WHERE number=:number ${year==null?'':'AND year=:year'} ORDER BY year DESC,id DESC LIMIT 20`,{number,year})
    }else{
        const search=`%${term.replace(/[!%_]/g,value=>'!'+value)}%`
        rows=await sql("SELECT id,number,year,title FROM denunciations WHERE title LIKE :search ESCAPE '!' OR endereco LIKE :search ESCAPE '!' ORDER BY id DESC LIMIT 20",{search})
    }
    return {denunciations:rows.map(row=>({id:Number(row.id),protocol:`${row.number}/${row.year}`,title:row.title}))}
}
export default {people,conversations,createConversation,messages,sendMessage,markRead,reads,announce,announcement,notifications,denunciations}
