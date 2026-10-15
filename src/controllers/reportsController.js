import express from 'express'
import reportsService from '../services/reportsService.js'
import {canWorkOnDenunciation} from '../auth/permissions.js'
import {completeOperation} from '../utils/completeOperation.js'
import sivisaService from '../services/sivisaService.js'
import {sivisaState} from '../utils/sivisa.js'
import denunciationsService from '../services/denunciationsService.js'
import usersService from '../services/usersService.js'
import {reportDetails,senderDetails,statuses,senders} from '../utils/catalogRegistry.js'

const router = express.Router()

router.post('/denuncias/:id/adicionar-relatorio', async (req, res) => {
    const { id: denunciaId } = req.params
    const { description, status, sivisa_state, sivisa_protocol, sivisa_note } = req.body
    const userId = req.auth ? req.auth.user.id : req.body.user_id

    try {
        const result = await reportsService.addReport({
            denunciationId: denunciaId,
            userId,
            description,
            status,sivisa_state,sivisa_protocol,sivisa_note,actor:req.auth
        })

        if (!result.ok) {
            const detail=await denunciationsService.getById(denunciaId)
            if(!detail.ok)return res.status(result.status).send(result.message)
            return res.status(result.status).render('denunciation/show',{denuncia:detail.data,reports:detail.data.reports||[],fiscais:await usersService.getActiveUsers(),REPORT_DETAILS:reportDetails,SENDER_DETAILS:senderDetails,DENUNCIATION_STATUS:statuses,DENUNCIATION_SENDER:senders,error:result.message,reportForm:req.body})
        }

        return completeOperation(req,res,{redirect:`/denuncias/${denunciaId}?notice=report-saved#reports-section`,title:'Acompanhamento salvo',message:'O acompanhamento foi registrado com sucesso.'})

    } catch (error) {
        console.error('Erro ao adicionar relatório:', error)
        res.status(500).send('Erro ao adicionar o relatório')
    }
})

router.get('/sivisa/pendencias',async(req,res)=>{
    if(!req.auth)return res.redirect('/area-fiscal')
    const page=req.query.page??'1'
    if(typeof page!=='string'||! /^[1-9]\d*$/.test(page)||!Number.isSafeInteger(Number(page)))return res.status(400).send('Página inválida.')
    res.render('reports/pendingSivisa',await sivisaService.pendingPage(req.auth.user.id,Number(page)))
})
async function sivisaPage(req,res,{status=200,error='',input}={}){
    const result=await reportsService.getReport(req.params.id)
    if(!result.ok)return res.status(result.status).send(result.message)
    if(Number(result.data.report.type)!==1)return res.status(400).send('Registros de status não recebem protocolos SIVISA.')
    const report=result.data.report
    const sivisaForm=input||{sivisa_state:sivisaState(report),sivisa_protocol:report.sivisaProtocols.map(item=>item.protocol),sivisa_note:report.sivisaProtocols.map(item=>item.note)}
    res.status(status).render('reports/sivisa',{...result.data,sivisaForm,error,success:req.query.saved==='1'})
}
router.get('/relatorio/:id/sivisa',(req,res)=>sivisaPage(req,res))
router.post('/relatorio/:id/sivisa',async(req,res)=>{
    const result=await reportsService.saveSivisa(req.params.id,req.body,req.auth)
    if(!result.ok)return sivisaPage(req,res,{status:result.status,error:result.message,input:req.body})
    res.redirect(`/relatorio/${req.params.id}/sivisa?saved=1`)
})

router.get('/relatorio/:id', async (req, res) => {
    const result = await reportsService.getReport(req.params.id)

    if (!result.ok) return res.status(result.status).send(result.message)

    res.render('reports/show', {...result.data,updatesCurrentStatus:!req.auth||canWorkOnDenunciation(req.auth,'reports.edit',result.data.denuncia)})
})

router.post('/relatorio/:id/editar', async (req, res) => {
    const result = await reportsService.editReport(req.params.id, {
        description: typeof req.body.description==='string'?req.body.description.trim():req.body.description,
        status: req.body.status,
        actor: req.auth
    })

    if (!result.ok) return res.status(result.status).send(result.message)

    completeOperation(req,res,{redirect:`/denuncias/${result.data.denunciation_id}?notice=report-updated#reports-section`,title:'Relatório atualizado',message:'O relatório foi atualizado com sucesso.',actionHref:`/relatorio/${req.params.id}`,actionLabel:'Voltar ao relatório'})
})

router.post('/relatorio/:id/deletar', async (req, res) => {
    const result = await reportsService.deleteReport(req.params.id)

    if (!result.ok) return res.status(result.status).send(result.message)

    completeOperation(req,res,{redirect:`/denuncias/${result.denunciationId}?notice=report-deleted#reports-section`,title:'Relatório excluído',message:'O relatório foi excluído com sucesso.'})
})

export default router
