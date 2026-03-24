import express from 'express'
import denunciationsModel from '../models/denunciationsModel.js'
import usersModel from '../models/usersModel.js'

const router = express.Router()

router.get('/api/denuncias', async (req, res) => {
    const { limit = 50, offset = 0 } = req.query

    try {
        const denuncias = await denunciationsModel.findAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [{ model: usersModel, as: 'user', attributes: ['name'] }],
            order: [['year', 'DESC'], ['number', 'DESC']]
        })
        res.json(denuncias)
    } catch (error) {
        console.error('Erro ao buscar denúncias:', error)
        res.status(500).send('Erro ao carregar denúncias.')
    }
})

export default router