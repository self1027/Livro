import express from 'express'
import chatService,{ChatError} from '../services/chatService.js'
import {can} from '../auth/permissions.js'

export const chatRouter=express.Router()
chatRouter.use((req,res,next)=>{
    if(req.path!=='/recados'&&!req.path.startsWith('/api/recados'))return next()
    res.set('Cache-Control','no-store')
    if(!req.auth)return req.path==='/recados'?res.status(404).send('Página não encontrada.'):res.status(401).json({error:'Autenticação necessária.'})
    if(!can(req.auth,'chat.use'))return req.path==='/recados'?res.status(403).send('Você não possui permissão para usar os recados.'):res.status(403).json({error:'Você não possui permissão para usar os recados.'})
    next()
})
const endpoint=operation=>async(req,res)=>{
    try{res.json(await operation(req))}
    catch(error){
        if(error instanceof ChatError)return res.status(error.status).json({error:error.message})
        console.error('Erro na operação de recados:',error.name,error.original?.code||'')
        res.status(500).json({error:'Não foi possível concluir a operação de recados. Tente novamente.'})
    }
}
chatRouter.get('/recados',(req,res)=>res.render('chat/index',{chatUser:{id:req.auth.user.id,name:req.auth.user.name},chatCanAnnounce:can(req.auth,'chat.announce')}))
chatRouter.get('/api/recados/people',endpoint(req=>chatService.people(req.auth)))
chatRouter.get('/api/recados/denunciations',endpoint(req=>chatService.denunciations(req.auth,req.query)))
chatRouter.get('/api/recados/conversations',endpoint(req=>chatService.conversations(req.auth)))
chatRouter.post('/api/recados/conversations',endpoint(req=>chatService.createConversation(req.auth,req.body?.userId)))
chatRouter.get('/api/recados/conversations/:id/messages',endpoint(req=>chatService.messages(req.auth,req.params.id,req.query)))
chatRouter.post('/api/recados/conversations/:id/messages',endpoint(req=>chatService.sendMessage(req.auth,req.params.id,req.body)))
chatRouter.post('/api/recados/conversations/:id/read',endpoint(req=>chatService.markRead(req.auth,req.params.id,req.body)))
chatRouter.get('/api/recados/conversations/:id/reads',endpoint(req=>chatService.reads(req.auth,req.params.id,req.query)))
chatRouter.post('/api/recados/announcements',endpoint(req=>chatService.announce(req.auth,req.body)))
chatRouter.get('/api/recados/announcements/:id',endpoint(req=>chatService.announcement(req.auth,req.params.id)))
export default chatRouter
