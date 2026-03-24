import express from 'express'
import denunciationsService from '../services/denunciationsService.js'
import pdfService from '../utils/pdfService.js'

const router = express.Router()

router.get('/denuncias/pdf', async (req, res) => {
    try {
        const { fiscalId, status } = req.query
        if (!fiscalId) return res.status(400).send('fiscalId é obrigatório')

        const result = await denunciationsService.getPdfData({ fiscalId, status })

        if (!result.ok) return res.status(result.status).send(result.message)

        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'inline; filename=denuncias.pdf')

        pdfService.generateDenunciasPdf(res, result.data)

    } catch (error) {
        console.error(error)
        res.status(500).send('Erro ao gerar PDF')
    }
})

export default router