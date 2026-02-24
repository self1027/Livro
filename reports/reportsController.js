const express = require('express')
const router = express.Router()
const denunciationsModel = require('../denunciations/denunciationsModel')
const reportsModel = require('./reportsModel')
const userModel = require('../users/usersModel')
const DENUNCIATION_SENDER = require('../constants/denunciationSenders')
const DENUNCIATION_STATUS = require('../constants/denunciationStatus')
const REPORT_TYPE = require('../constants/reportType')

router.post('/denuncia/:id/adicionar-relatorio', async (req, res) => {
    const denunciaId = req.params.id;
    const descriptionInput = req.body.description?.trim() || null;
    const userId = req.body.user_id;
    const novoStatus = req.body.status;

    try {
        if (!userId) return res.status(400).send('ID do usuário não informado');
        
        const denuncia = await denunciationsModel.findByPk(denunciaId);
        if (!denuncia) return res.status(404).send('Denúncia não encontrada');

        const statusAnterior = denuncia.status;
        const houveMudancaStatus = novoStatus && statusAnterior !== novoStatus;

        const statusAnteriorLabel = DENUNCIATION_STATUS[statusAnterior]?.label || statusAnterior;
        const novoStatusLabel = DENUNCIATION_STATUS[novoStatus]?.label || novoStatus;

        if (descriptionInput) {
            await reportsModel.create({
                description: `${descriptionInput}`,
                denunciation_id: denunciaId,
                user_id: userId,
                type: REPORT_TYPE.TEXT
            });
        }

        if (houveMudancaStatus) {
            await reportsModel.create({
                description: `Status alterado de "${statusAnteriorLabel}" para "${novoStatusLabel}"`,
                denunciation_id: denunciaId,
                user_id: userId,
                type: REPORT_TYPE.STATUS_CHANGE
            });

            denuncia.status = novoStatus;
            await denuncia.save();
        }

        if (!descriptionInput && !houveMudancaStatus) {
            return res.status(400).send('Nada para atualizar');
        }

        res.redirect(`/denuncia/${denunciaId}`);
    } catch (error) {
        console.error('Erro ao adicionar relatório:', error);
        res.status(500).send('Erro ao adicionar o relatório');
    }
});

router.get('/relatorio/:id', async (req, res) => {
    const reportId = req.params.id;

    try {
        const report = await reportsModel.findByPk(reportId);
        
        if (!report) {
            return res.status(404).send('Relatório não encontrado');
        }

        const denuncia = await denunciationsModel.findByPk(report.denunciation_id);

        if (!denuncia) {
            return res.status(404).send('Denúncia não encontrada');
        }

        res.render('reports/show', {
            report: report,
            denuncia: denuncia,
            reportTypeLabel: REPORT_TYPE[report.type],
            DENUNCIATION_STATUS: DENUNCIATION_STATUS
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar a página de edição');
    }
});

router.post('/relatorio/:id/editar', async (req, res) => {
    const reportId = req.params.id;
    const { description: newDescriptionRaw, status: newStatus } = req.body;

    try {
        const report = await reportsModel.findByPk(reportId);
        if (!report) return res.status(404).send('Relatório não encontrado');

        let finalDescription = newDescriptionRaw;

        if (report.type === REPORT_TYPE.STATUS_CHANGE) {
            const labelNew = DENUNCIATION_STATUS[newStatus]?.label || newStatus;
            finalDescription = `Status alterado para "${labelNew}"`
        }

        await report.update({
            description: finalDescription
        });
        
        if (newStatus && newStatus !== report.status) {
            const denuncia = await denunciationsModel.findByPk(report.denunciation_id);
            if (denuncia) {
                denuncia.status = newStatus;
                await denuncia.save();
            }
        }        

        res.redirect(`/denuncia/${report.denunciation_id}`);
    } catch (error) {
        console.error(error);
        res.redirect(`/relatorio/${reportId}`);
    }
});

router.post('/relatorio/:id/deletar', async (req, res) => {
    const reportId = req.params.id;

    try {
        const report = await reportsModel.findByPk(reportId);
        if (!report) return res.status(404).send('Relatório não encontrado');
ar
        const denunciaId = report.denunciation_id;

        await report.destroy();

        res.redirect(`/denuncia/${denunciaId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao excluir relatório');
    }
});


module.exports = router;
