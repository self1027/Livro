const express = require('express');
const router = express.Router();
const denunciationsModel = require('../denunciations/denunciationsModel');
const usersModel = require('../users/usersModel');
const DENUNCIATION_SENDER = require('../constants/denunciationSenders')


router.get('/api/denuncias', async (req, res) => {
    const { limit = 50, offset = 0 } = req.query;

    console.log(`Limit: ${limit}, Offset: ${offset}`);

    try {
        // Buscando as denúncias no banco de dados
        const denuncias = await denunciationsModel.findAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [{
                model: usersModel,
                as: 'user',
                attributes: ['name']
            }],
            order: [
                ['year', 'DESC'],
                ['number', 'DESC']
            ]
        });

        console.log(`Denúncias encontradas: ${denuncias.length}`);
        res.json(denuncias);
    } catch (error) {
        console.error('Erro ao buscar denúncias:', error);
        res.status(500).send('Erro ao carregar denúncias.');
    }
});



module.exports = router;
