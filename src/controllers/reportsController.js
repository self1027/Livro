import express from 'express'
import reportsService from '../services/reportsService.js'
import {canWorkOnDenunciation} from '../auth/permissions.js'
import {completeOperation} from '../utils/completeOperation.js'
import denunciationsService from '../services/denunciationsService.js'
import usersService from '../services/usersService.js'
import {reportDetails,senderDetails,statuses,senders} from '../utils/catalogRegistry.js'

const router = express.Router()

router.post('/denuncias/:id/adicionar-relatorio', async (req, res) => {
    const { id: denunciaId } = req.params
    const { description, status } = req.body
    const userId = req.auth ? req.auth.user.id : req.body.user_id

    try {
        const result = await reportsService.addReport({
            denunciationId: denunciaId,
            userId,
            description,
            status,actor:req.auth
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
