import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import mysql from 'mysql2/promise'
import express from 'express'

test('MySQL isolado: conversas privadas, anúncios, leitura e polling',{skip:process.env.CHAT_DB_TESTS!=='true',timeout:90000},async t=>{
    const database='livro_chat_test_'+randomBytes(8).toString('hex')
    const management=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD??'masterkey'})
    await management.query('CREATE DATABASE `'+database+'` CHARACTER SET utf8mb4')
    process.env.DB_NAME=database
    const {default:db}=await import('../src/database/database.js')
    const {default:User}=await import('../src/models/usersModel.js')
    const {default:Denunciation}=await import('../src/models/denunciationsModel.js')
    const {Role,Account}=await import('../src/auth/models.js')
    const {ChatConversation,ChatMessage,ChatMessageRead,ChatAnnouncement}=await import('../src/models/chatModels.js')
    const {migrateChat}=await import('../src/database/migrateChat.js')
    const {default:chat}=await import('../src/services/chatService.js')
    const {default:router}=await import('../src/controllers/chatController.js')
    let server
    try{
        await User.sync();await Denunciation.sync();await Role.sync();await Account.sync();await migrateChat();await migrateChat()
        const chiefRole=await Role.create({name:'Chefia',maximum:true,permissions:[]})
        const fiscalRole=await Role.create({name:'Fiscal',permissions:['chat.use','denunciations.read']})
        const adminRole=await Role.create({name:'Administrativo',permissions:['chat.use']})
        const disabledRole=await Role.create({name:'Sem recados',permissions:[]})
        const person=async(name,role,enabled=true)=>{
            const user=await User.create({name,ativo:true})
            const account=await Account.create({user_id:user.id,username:'person-'+user.id,password_hash:'not-used-by-service-tests',role_id:role.id,enabled,must_change_password:false})
            return {user:user.toJSON(),account:account.toJSON(),role:role.toJSON()}
        }
        const chief=await person('Chefia',chiefRole),edna=await person('Edna',fiscalRole),admin=await person('Administrativa',adminRole),otherChief=await person('Outra Chefia',chiefRole)
        const disabled=await person('Inativa',fiscalRole,false),noPermission=await person('Sem acesso',disabledRole)
        const complaint=await Denunciation.create({number:223,year:2026,title:'Local com água acumulada',description:'Descrição',endereco:'Rua teste',numero:'1',bairro:'Centro',user_id:edna.user.id})
        let pair
        const send=(actor,id,body,extra={})=>chat.sendMessage(actor,id,{body,clientId:randomUUID(),...extra})
        await t.test('públicos seguem cargos e apenas pessoas ativas com recados aparecem',async()=>{
            const result=await chat.people(chief)
            assert.ok(result.people.some(row=>row.id===edna.user.id))
            for(const excluded of [chief,disabled,noPermission])assert.ok(!result.people.some(row=>row.id===excluded.user.id))
            assert.ok(result.audiences.some(row=>row.id===fiscalRole.id&&row.name==='Fiscal'))
            await assert.rejects(chat.people(noPermission),error=>error.status===403)
            await assert.rejects(chat.people(null),error=>error.status===401)
        })
        await t.test('dupla é única inclusive com criações simultâneas e ordem invertida',async()=>{
            const results=await Promise.all([chat.createConversation(chief,edna.user.id),chat.createConversation(edna,chief.user.id),chat.createConversation(chief,edna.user.id)])
            pair=results[0].conversation
            assert.ok(results.every(result=>result.conversation.id===pair.id))
            assert.equal(await ChatConversation.count(),1)
            await assert.rejects(chat.createConversation(chief,chief.user.id),error=>error.status===400)
            await assert.rejects(chat.createConversation(chief,disabled.user.id),error=>error.status===400)
        })
        await t.test('privacidade não tem exceção para outra chefia e consultas não marcam leitura',async()=>{
            const sent=await send(chief,pair.id,'Pode buscar informações?',{denunciationId:complaint.id})
            assert.equal(sent.message.denunciation.protocol,'223/2026')
            for(const method of [()=>chat.messages(otherChief,pair.id),()=>send(otherChief,pair.id,'Forjado'),()=>chat.markRead(otherChief,pair.id,{messageIds:[sent.message.id]}),()=>chat.reads(otherChief,pair.id)])await assert.rejects(method,error=>error.status===404)
            const received=await chat.messages(edna,pair.id)
            assert.equal(received.messages[0].readAt,null)
            assert.equal((await chat.notifications(edna)).unreadCount,1)
            assert.equal((await chat.conversations(edna)).unreadCount,1)
            assert.equal(await ChatMessageRead.count(),0)
            await assert.rejects(chat.markRead(chief,pair.id,{messageIds:[sent.message.id]}),error=>error.status===400)
            await chat.markRead(edna,pair.id,{messageIds:[sent.message.id]})
            const firstRead=(await ChatMessageRead.findOne()).read_at.getTime()
            await chat.markRead(edna,pair.id,{messageIds:[sent.message.id]})
            assert.equal((await ChatMessageRead.findOne()).read_at.getTime(),firstRead)
            assert.equal((await chat.notifications(edna)).unreadCount,0)
            assert.equal((await chat.reads(chief,pair.id)).reads[0].messageId,sent.message.id)
            assert.ok((await chat.messages(chief,pair.id)).messages[0].readAt)
        })
        await t.test('envios repetidos e concorrentes usam o mesmo registro sem duplicar',async()=>{
            const input={body:'Mesmo envio',clientId:randomUUID()}
            const results=await Promise.all([chat.sendMessage(chief,pair.id,input),chat.sendMessage(chief,pair.id,input)])
            assert.equal(results[0].message.id,results[1].message.id)
            assert.equal(await ChatMessage.count({where:{body:input.body}}),1)
            await assert.rejects(chat.sendMessage(chief,pair.id,{...input,body:'Conteúdo diferente'}),error=>error.status===409)
            const another=await chat.createConversation(chief,admin.user.id)
            await assert.rejects(chat.sendMessage(chief,another.conversation.id,input),error=>error.status===409)
        })
        await t.test('cursor não perde mensagem quando duas transações enviam na mesma conversa',async()=>{
            const original=ChatMessage.create
            let release,firstCreated,secondFinished=false,calls=0
            const waiting=new Promise(resolve=>{release=resolve}),created=new Promise(resolve=>{firstCreated=resolve})
            ChatMessage.create=async function(...args){
                const result=await original.apply(this,args)
                if(++calls===1){firstCreated();await waiting}
                return result
            }
            let first,second
            try{
                first=send(chief,pair.id,'Primeira transação ainda sem confirmação')
                await created
                second=send(edna,pair.id,'Segunda transação concorrente').then(result=>{secondFinished=true;return result})
                await new Promise(resolve=>setTimeout(resolve,50))
                assert.equal(secondFinished,false)
                release()
                const [one,two]=await Promise.all([first,second])
                assert.ok(one.message.id<two.message.id)
                assert.equal((await chat.messages(edna,pair.id,{after:one.message.id})).messages[0].id,two.message.id)
            }finally{release();await Promise.allSettled([first,second].filter(Boolean));ChatMessage.create=original}
        })
        await t.test('referências validam permissão, busca e existência sem conceder acesso',async()=>{
            assert.equal((await chat.denunciations(edna,{q:'223/26'})).denunciations[0].id,complaint.id)
            assert.equal((await chat.denunciations(edna,{q:'água'})).denunciations[0].id,complaint.id)
            assert.deepEqual((await chat.denunciations(edna,{q:'%'})).denunciations,[])
            assert.deepEqual((await chat.denunciations(edna,{})).denunciations,[])
            await assert.rejects(chat.denunciations(admin,{id:complaint.id}),error=>error.status===403)
            const other=await chat.createConversation(admin,chief.user.id)
            await assert.rejects(send(admin,other.conversation.id,'Referência inválida',{denunciationId:complaint.id}),error=>error.status===403)
            await assert.rejects(send(chief,pair.id,'Não existe',{denunciationId:2147483647}),error=>error.status===400)
            await send(chief,other.conversation.id,'Referência recebida',{denunciationId:complaint.id})
            assert.equal((await chat.messages(admin,other.conversation.id)).messages.at(-1).denunciation,null)
        })
        await t.test('anúncio usa chat existente, réplica privada e público congelado com recibos individuais',async()=>{
            const input={body:'Comunicado para a equipe',clientId:randomUUID(),audience:{type:'roles',roleIds:[fiscalRole.id,adminRole.id]}}
            await assert.rejects(chat.announce(edna,input),error=>error.status===403)
            const result=await chat.announce(chief,input),announcementId=result.announcement.id
            assert.equal(result.announcement.recipientCount,2)
            assert.equal((await chat.announce(chief,input)).announcement.id,announcementId)
            assert.equal(await ChatMessage.count({where:{announcement_id:announcementId}}),2)
            const received=(await chat.messages(edna,pair.id)).messages.find(row=>row.announcementId===announcementId)
            assert.ok(received)
            await chat.markRead(edna,pair.id,{messageIds:[received.id]})
            await send(edna,pair.id,'Recebido, chefia')
            const other=await chat.createConversation(admin,chief.user.id)
            assert.ok(!(await chat.messages(admin,other.conversation.id)).messages.some(row=>row.body==='Recebido, chefia'))
            await Account.update({role_id:adminRole.id},{where:{user_id:edna.user.id}})
            const overview=(await chat.announcement(chief,announcementId)).announcement
            assert.equal(overview.recipientCount,2);assert.equal(overview.readCount,1)
            assert.ok(overview.recipients.find(row=>row.id===edna.user.id).readAt)
            await assert.rejects(chat.announcement(edna,announcementId),error=>error.status===404)
            await assert.rejects(chat.announcement(otherChief,announcementId),error=>error.status===404)
            await Account.update({role_id:fiscalRole.id},{where:{user_id:edna.user.id}})
        })
        await t.test('anúncio concorrente é idempotente e falha reverte todas as cópias',async()=>{
            const input={body:'Concorrente',clientId:randomUUID(),audience:{type:'all'}}
            const results=await Promise.all([chat.announce(chief,input),chat.announce(chief,input)])
            assert.equal(results[0].announcement.id,results[1].announcement.id)
            const count=await ChatMessage.count(),announcements=await ChatAnnouncement.count()
            const original=ChatMessage.create
            let calls=0
            ChatMessage.create=async function(...args){if(++calls===2)throw new Error('Falha simulada no segundo destinatário');return original.apply(this,args)}
            try{await assert.rejects(chat.announce(chief,{...input,body:'Falha atômica',clientId:randomUUID()}),/Falha simulada/)}finally{ChatMessage.create=original}
            assert.equal(await ChatMessage.count(),count)
            assert.equal(await ChatAnnouncement.count(),announcements)
        })
        await t.test('histórico e novidades são paginados por cursor e polling entrega apenas ao destinatário',async()=>{
            const start=await ChatMessage.max('id')
            await ChatMessage.bulkCreate(Array.from({length:112},(_,index)=>({conversation_id:pair.id,sender_id:chief.user.id,body:'Histórico '+index,client_id:randomUUID()})))
            const first=await chat.messages(edna,pair.id),older=await chat.messages(edna,pair.id,{before:first.messages[0].id})
            assert.equal(first.messages.length,40);assert.equal(first.hasMore,true)
            assert.ok(older.messages.at(-1).id<first.messages[0].id)
            const after=await chat.messages(edna,pair.id,{after:start})
            assert.equal(after.messages.length,100);assert.equal(after.hasMore,true)
            const remaining=await chat.messages(edna,pair.id,{after:after.messages.at(-1).id})
            assert.equal(remaining.messages.length,12);assert.equal(remaining.hasMore,false)
            const notification=await chat.notifications(edna)
            assert.equal(notification.unreadMessages.length,20)
            assert.equal(notification.latestMessageId,remaining.messages.at(-1).id)
            assert.ok(notification.unreadMessages.every(row=>row.conversationId===pair.id))
            await assert.rejects(chat.messages(edna,pair.id,{before:1,after:2}),error=>error.status===400)
            await assert.rejects(chat.markRead(edna,pair.id,{messageIds:Array(101).fill(first.messages[0].id)}),error=>error.status===400)
        })
        await t.test('inativação preserva histórico e impede novos envios',async()=>{
            await Account.update({enabled:false},{where:{user_id:edna.user.id}})
            assert.equal((await chat.messages(chief,pair.id)).peerActive,false)
            assert.equal((await chat.conversations(chief)).conversations.find(row=>row.id===pair.id).peer.active,false)
            await assert.rejects(send(chief,pair.id,'Sem acesso'),error=>error.status===400)
            await Account.update({enabled:true},{where:{user_id:edna.user.id}})
        })
        await t.test('recibos de mensagens antigas continuam consultáveis por IDs com escopo privado',async()=>{
            const old=(await send(chief,pair.id,'Mensagem antiga consultada no histórico')).message
            await ChatMessage.bulkCreate(Array.from({length:210},(_,index)=>({conversation_id:pair.id,sender_id:chief.user.id,body:'Lida posteriormente '+index,client_id:randomUUID()})))
            const newer=await ChatMessage.findAll({where:{conversation_id:pair.id,sender_id:chief.user.id},attributes:['id'],order:[['id','DESC']],limit:210})
            await ChatMessageRead.bulkCreate(newer.map(message=>({message_id:message.id,user_id:edna.user.id,read_at:new Date()})))
            await chat.markRead(edna,pair.id,{messageIds:[old.id]})
            assert.ok(!(await chat.reads(chief,pair.id)).reads.some(read=>read.messageId===old.id))
            const other=await chat.createConversation(chief,admin.user.id),foreign=(await send(chief,other.conversation.id,'Mensagem de outra conversa')).message
            await chat.markRead(admin,other.conversation.id,{messageIds:[foreign.id]})
            const incoming=(await send(edna,pair.id,'Resposta recebida nesta conversa')).message
            await chat.markRead(chief,pair.id,{messageIds:[incoming.id]})
            const selected=await chat.reads(chief,pair.id,{messageIds:`${old.id},${foreign.id},${incoming.id}`})
            assert.equal(selected.reads.length,1)
            assert.equal(selected.reads[0].messageId,old.id)
            assert.ok(selected.reads[0].readAt)
            for(const messageIds of ['', '0','1,,2','1 OR 1',[old.id],Array(201).fill(old.id).join(',')])await assert.rejects(chat.reads(chief,pair.id,{messageIds}),error=>error.status===400)
            await assert.rejects(chat.reads(chief,pair.id,{messageIds:String(old.id),after:old.id}),error=>error.status===400)
        })
        await t.test('rotas exigem autenticação e não expõem mensagens em erros',async()=>{
            const app=express();app.use(express.json());app.use((req,res,next)=>{req.auth=req.get('X-Test-Person')==='edna'?edna:undefined;next()});app.use(router)
            server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve))
            const base='http://127.0.0.1:'+server.address().port
            assert.equal((await fetch(base+'/api/recados/conversations')).status,401)
            assert.equal((await fetch(base+'/recados')).status,404)
            const response=await fetch(base+'/api/recados/conversations/1e2/messages',{headers:{'X-Test-Person':'edna'}})
            assert.equal(response.status,400);assert.match((await response.json()).error,/Conversa inválido/)
        })
    }finally{
        if(server)await new Promise(resolve=>server.close(resolve))
        await db.close()
        if(!/^livro_chat_test_[a-f0-9]{16}$/.test(database))throw new Error('Nome de banco temporário inválido.')
        await management.query('DROP DATABASE `'+database+'`');await management.end()
    }
})
