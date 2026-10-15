import express from 'express'
import denunciations from '../services/denunciationsService.js'
import {senderDetails,statuses} from '../utils/catalogRegistry.js'

const router=express.Router()
const validId=value=>typeof value==='string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
router.get(['/fiscais','/fiscais/:id/edit'],(req,res)=>res.redirect('/admin/access'))
router.post(['/fiscais','/fiscais/:id'],(req,res)=>res.redirect(303,'/admin/access'))
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
