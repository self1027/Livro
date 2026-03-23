const express = require('express')
const router = express.Router()
const reportsService = require('./reportsService')
const DENUNCIATION_SENDER = require('../../constants/denunciationSenders')

router.post('/denuncia/:id/adicionar-relatorio', async (req, res) => {
    const { id: denunciaId } = req.params
    const { description, status, user_id: userId } = req.body

    try {
        const result = await reportsService.addReport({
            denunciationId: denunciaId,
            userId,
            description: description?.trim(),
            status
        })

        if (!result.ok) {
            return res.status(result.status).send(result.message)
        }

        // Feedback visual usando o array successMessages
        const successMessages = []
        if (description) successMessages.push('Relatório adicionado com sucesso')
        if (status && result.data.status === status) successMessages.push('Status da denúncia atualizado com sucesso')

        // Recarrega a página de visualização da denúncia com feedback
        res.render('book/denunciation/show', {
            denuncia: result.data,
            reports: await reportsService.getReportsByDenunciationId(denunciaId), // trazer os relatórios atualizados
            successMessages,
			DENUNCIATION_SENDER
        })
    } catch (error) {
        console.error('Erro ao adicionar relatório:', error)
        res.status(500).send('Erro ao adicionar o relatório')
    }
})

router.get('/relatorio/:id', async (req, res) => {
    const result = await reportsService.getReport(req.params.id)

    if (!result.ok) return res.status(result.status).send(result.message)

    res.render('book/reports/show', result.data)
})

router.post('/relatorio/:id/editar', async (req, res) => {
    const result = await reportsService.editReport(req.params.id, {
        description: req.body.description?.trim(),
        status: req.body.status
    })

    if (!result.ok) return res.redirect(`/relatorio/${req.params.id}`)

    res.redirect(`/denuncias/${result.data.denunciation_id}`)
})

router.post('/relatorio/:id/deletar', async (req, res) => {
    const result = await reportsService.deleteReport(req.params.id)

    if (!result.ok) return res.status(result.status).send(result.message)

    res.redirect(`/denuncias/${result.denunciationId}`)
})

module.exports = router