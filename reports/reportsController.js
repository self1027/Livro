const express = require('express')
const router = express.Router()
const denunciationsModel = require('../denunciations/denunciationsModel')
const reportsModel = require('./reportsModel')
const userModel = require('../users/usersModel')
const DENUNCIATION_SENDER = require('../constants/denunciationSenders')
const DENUNCIATION_STATUS = require('../constants/denunciationStatus')

router.post('/denuncia/:id/adicionar-relatorio', async (req, res) => {
    const denunciaId = req.params.id;
    const descriptionInput = req.body.description?.trim() || null;
    const userId = req.body.user_id;
    const novoStatus = req.body.status;

    try {
        const denuncia = await denunciationsModel.findByPk(denunciaId);
        if (!denuncia) return res.status(404).send('Denúncia não encontrada');

        const dataAtual = new Date().toLocaleDateString('pt-BR');
        const statusAnterior = denuncia.status;
        const houveMudancaStatus = statusAnterior !== novoStatus;

        let descriptionFinal = '';

        if (descriptionInput && houveMudancaStatus) {
            // Texto + status alterado
            descriptionFinal = `${descriptionInput} - ${dataAtual}\nStatus alterado de ${statusAnterior} para ${novoStatus}`;
        } else if (descriptionInput) {
            // Só texto
            descriptionFinal = `${descriptionInput} - ${dataAtual}`;
        } else if (houveMudancaStatus) {
            // Só status alterado
            descriptionFinal = `Status alterado de ${statusAnterior} para ${novoStatus} - ${dataAtual}`;
        } else {
            return res.status(400).send('Nada para atualizar');
        }

        // Cria o relatório
        await reportsModel.create({
            description: descriptionFinal,
            denunciation_id: denunciaId,
            user_id: userId
        });

        // Atualiza o status da denúncia, se necessário
        if (houveMudancaStatus) {
            denuncia.status = novoStatus;
            await denuncia.save();
        }

        res.redirect(`/denuncia/${denunciaId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao adicionar o relatório');
    }
});

// Rota para renderizar a página de edição de relatório
router.get('/relatorio/:id', async (req, res) => {
    const reportId = req.params.id;

    try {
        // Busca o relatório pelo ID
        const report = await reportsModel.findByPk(reportId);
        
        if (!report) {
            return res.status(404).send('Relatório não encontrado');
        }

        // Busca a denúncia relacionada ao relatório
        const denuncia = await denunciationsModel.findByPk(report.denunciation_id);

        if (!denuncia) {
            return res.status(404).send('Denúncia não encontrada');
        }

        // Passa os dados para a view de edição
        res.render('reports/show', {
            report: report,
            denuncia: denuncia,
            DENUNCIATION_STATUS: DENUNCIATION_STATUS // Passa os status disponíveis
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar a página de edição');
    }
});

// Rota para editar um relatório
router.post('/relatorio/:id/editar', async (req, res) => {
    const reportId = req.params.id;
    const { description: newDescriptionRaw, status: newStatus, oldStatus, oldDescription } = req.body;

    try {
        console.log(oldStatus, newStatus)
        const report = await reportsModel.findByPk(reportId);
        if (!report) {
            return res.status(404).send('Relatório não encontrado');
        }

        let finalDescription = newDescriptionRaw;

        // Só aplica lógica de status se tiver `oldStatus`
        if (oldStatus && oldStatus !== newStatus) {
            const labelOld = DENUNCIATION_STATUS[oldStatus]?.label || oldStatus;
            const labelNew = DENUNCIATION_STATUS[newStatus]?.label || newStatus;

            const statusLine = `Status alterado de ${labelOld} para ${labelNew}`;

            // Remove linha anterior de status se houver
            const statusLineRegex = /Status alterado de .+ para .+/;
            const parts = oldDescription?.split('\n') || [];
            const baseDescription = parts.filter(line => !statusLineRegex.test(line)).join('\n');

            finalDescription = `${baseDescription}\n${statusLine}`;
        }

        await report.update({
            description: finalDescription,
            status: newStatus
        });

        console.log('Relatório atualizado com sucesso.');
        res.redirect(`/denuncia/${report.denunciation_id}`);
    } catch (error) {
        console.error(error);
        res.redirect(`/relatorio/${reportId}`);
    }
});


module.exports = router;
