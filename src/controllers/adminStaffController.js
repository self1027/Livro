import express from 'express'
import users from '../services/usersService.js'
import denunciations from '../services/denunciationsService.js'
import {senderDetails,statuses} from '../utils/catalogRegistry.js'

const router=express.Router()
const validId=value=>typeof value==='string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
const nameInput=body=>typeof body?.name==='string'?body.name.trim():typeof body?.username==='string'?body.username.trim():''
const validName=name=>name.length>0 && name.length<=255
async function staffPage(req,res,{status=200,error='',formName=''}={}) {
    const username=await users.getAllOrdered()
    res.status(status).render('users/new',{username,error,formName,success:req.query.notice==='created'?'Fiscal cadastrado com sucesso.':req.query.notice==='updated'?'Fiscal atualizado com sucesso.':''})
}
router.get('/fiscais',async(req,res)=>{
    try{await staffPage(req,res)}catch(error){console.error(error);res.status(500).send('Não foi possível carregar os fiscais.')}
})
router.post('/fiscais',async(req,res)=>{
    const name=nameInput(req.body)
    try{
        if(!validName(name))return await staffPage(req,res,{status:400,error:'Informe um nome de até 255 caracteres.',formName:name})
        await users.create({name})
        res.redirect('/admin/fiscais?notice=created')
    }catch(error){console.error(error);res.status(500).send('Não foi possível cadastrar o fiscal.')}
})
router.get('/fiscais/:id/edit',async(req,res)=>{
    if(!validId(req.params.id))return res.status(400).send('Fiscal inválido.')
    try{
        const user=await users.findByPk(req.params.id)
        if(!user)return res.status(404).send('Fiscal não encontrado.')
        res.render('users/edit',{user,error:''})
    }catch(error){console.error(error);res.status(500).send('Não foi possível carregar o fiscal.')}
})
router.post('/fiscais/:id',async(req,res)=>{
    if(!validId(req.params.id))return res.status(400).send('Fiscal inválido.')
    try{
        const user=await users.findByPk(req.params.id)
        if(!user)return res.status(404).send('Fiscal não encontrado.')
        const name=nameInput(req.body)
        if(req.body.activeState==='explicit' && req.body.ativo!=null && req.body.ativo!=='on')return res.status(400).send('Situação do fiscal inválida.')
        if(!validName(name))return res.status(400).render('users/edit',{user:{id:user.id,name,ativo:req.body.activeState==='explicit'?req.body.ativo==='on':user.ativo},error:'Informe um nome de até 255 caracteres.'})
        const state=req.body.activeState==='explicit'?{ativo:req.body.ativo==='on'}:{toggleActive:req.body.active!==undefined}
        await users.update(req.params.id,{name,...state})
        res.redirect('/admin/fiscais?notice=updated')
    }catch(error){console.error(error);res.status(500).send('Não foi possível salvar o fiscal.')}
})
router.get('/assignments',async(req,res)=>{
    const {denunciaId,page}=req.query
    if((denunciaId!=null&&!validId(denunciaId)) || (page!=null&&!validId(page)))return res.status(400).send('Denúncia ou página inválida.')
    try{
        const context=await denunciations.getAssignContext({denunciaId,page:Number(page||1)})
        if(denunciaId&&!context.denunciaSelecionada)return res.status(404).send('Denúncia não encontrada.')
        res.render('denunciation/associate',{...context,SENDER_DETAILS:senderDetails,DENUNCIATION_STATUS:statuses,success:typeof req.query.success==='string'?req.query.success:'',error:typeof req.query.error==='string'?req.query.error:''})
    }catch(error){console.error(error);res.status(500).send('Não foi possível carregar a fila de atribuição.')}
})
router.post('/assignments/:denunciaId',async(req,res)=>{
    const {denunciaId}=req.params
    if(!validId(denunciaId))return res.status(400).send('Denúncia inválida.')
    const destination=`/admin/assignments?denunciaId=${denunciaId}`
    try{
        const userId=req.body?.userId
        if(!validId(userId))return res.redirect(destination+'&error='+encodeURIComponent('Selecione um fiscal ativo.'))
        const result=await denunciations.assignDenunciation(denunciaId,userId)
        if(!result.ok)return res.redirect(destination+'&error='+encodeURIComponent(result.message))
        if(req.body.redirectToShow==='true')return res.redirect(`/denuncias/${denunciaId}?notice=fiscal-saved`)
        res.redirect('/admin/assignments?success='+encodeURIComponent('Fiscal atribuído com sucesso.'))
    }catch(error){console.error(error);res.redirect(destination+'&error='+encodeURIComponent('Não foi possível atribuir o fiscal. Tente novamente.'))}
})
export default router
