const express = require('express')
const router = express.Router()
const denunciationsModel = require('../denunciations/denunciationsModel')
const reportsModel = require('./reportsModel')
const userModel = require('../users/usersModel')
const DENUNCIATION_SENDER = require('../constants/denunciationSenders')
const DENUNCIATION_STATUS = require('../constants/denunciationStatus')

// Rota para adicionar um relatório a uma denúncia
router.post('/denuncia/:id/adicionar-relatorio', async (req, res) => {
    const denunciaId = req.params.id;  // ID da denúncia
    const description = req.body.description; // Descrição do relatório
    const userId = req.body.user_id; // Assumindo que o ID do usuário logado está em req.user.id

    try {
        // Verifica se a denúncia existe
        const denunciaExists = await denunciationsModel.findByPk(denunciaId);
        if (!denunciaExists) {
            return res.status(404).send('Denúncia não encontrada');
        }

        // Cria o novo relatório
        const newReport = await reportsModel.create({
            description: description,
            denunciation_id: denunciaId,
            user_id: userId // Atribuindo o ID do usuário logado
        });

        // Redireciona de volta para a página da denúncia ou exibe uma mensagem de sucesso
        res.redirect(`/denuncia/${denunciaId}`); // Redireciona para a página da denúncia
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao adicionar o relatório');
    }
});

module.exports = router;
