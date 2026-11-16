import express from 'express'
import assinadorService,{AssinadorError} from '../services/assinadorService.js'
import {can} from '../auth/permissions.js'

export const assinadorRouter=express.Router()

assinadorRouter.use((req,res,next)=>{
    if(req.path!=='/assinador'&&!req.path.startsWith('/api/assinador'))return next()
    res.set('Cache-Control','no-store')
    if(!req.auth)return req.path==='/assinador'?res.status(404).send('Página não encontrada.'):res.status(401).json({error:'Autenticação necessária.'})
    if(!can(req.auth,'assinador.use'))return req.path==='/assinador'?res.status(403).send('Você não possui permissão para usar o Assinador SIVISA.'):res.status(403).json({error:'Você não possui permissão para usar o Assinador SIVISA.'})
    next()
})

const endpoint=operation=>async(req,res)=>{
    try{res.json(await operation(req))}
    catch(error){
        if(error instanceof AssinadorError)return res.status(error.status).json({error:error.message})
        console.error('Erro no Assinador SIVISA:',error.name,error.message)
        res.status(500).json({error:'Não foi possível concluir a operação do Assinador SIVISA. Tente novamente.'})
    }
}

assinadorRouter.get('/assinador',async(req,res)=>{
    try{
        const context=await assinadorService.pageContext(req.auth)
        res.render('assinador/index',{assinador:context})
    }catch(error){
        if(error instanceof AssinadorError)return res.status(error.status).send(error.message)
        throw error
    }
})

assinadorRouter.get('/api/assinador/signers',endpoint(req=>assinadorService.listSigners(req.auth)))
assinadorRouter.post('/api/assinador/signers',endpoint(req=>assinadorService.saveSigner(req.auth,req.body)))
assinadorRouter.get('/api/assinador/signers/:id/secret',endpoint(req=>assinadorService.revealSignerSecret(req.auth,req.params.id)))
assinadorRouter.put('/api/assinador/signers/:id',endpoint(req=>assinadorService.saveSigner(req.auth,req.body,req.params.id)))
assinadorRouter.delete('/api/assinador/signers/:id',endpoint(req=>assinadorService.deleteSigner(req.auth,req.params.id)))
assinadorRouter.get('/api/assinador/latest',endpoint(req=>assinadorService.latestForProtocol(req.auth,req.query.protocol||'')))
assinadorRouter.post('/api/assinador/jobs',endpoint(req=>assinadorService.startJob(req.auth,req.body)))
assinadorRouter.get('/api/assinador/jobs',endpoint(req=>assinadorService.listJobs(req.auth,req.query)))
assinadorRouter.get('/api/assinador/jobs/:id',endpoint(req=>assinadorService.jobStatus(req.auth,req.params.id)))
assinadorRouter.post('/api/assinador/jobs/:id/cancel',endpoint(req=>assinadorService.cancelJob(req.auth,req.params.id)))
assinadorRouter.get('/api/assinador/jobs/:id/pdf',async(req,res)=>{
    try{
        const file=await assinadorService.openPdf(req.auth,req.params.id)
        res.set('Content-Type','application/pdf')
        res.set('Content-Disposition',`attachment; filename="${file.filename}"`)
        res.set('Cache-Control','no-store')
        file.stream.pipe(res)
    }catch(error){
        if(error instanceof AssinadorError)return res.status(error.status).json({error:error.message})
        console.error('Erro ao baixar PDF do Assinador:',error.name)
        res.status(500).json({error:'Não foi possível baixar o PDF.'})
    }
})

export default assinadorRouter
