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
    const novoStatus = req.body.status; // Corrigido para novo_status (nome do campo no form)

    try {
        // Validações básicas
        if (!userId) return res.status(400).send('ID do usuário não informado');
        
        const denuncia = await denunciationsModel.findByPk(denunciaId);
        if (!denuncia) return res.status(404).send('Denúncia não encontrada');

        const dataAtual = new Date().toLocaleDateString('pt-BR');
        const statusAnterior = denuncia.status;
        const houveMudancaStatus = novoStatus && statusAnterior !== novoStatus;

        // Obtém os labels dos status
        const statusAnteriorLabel = DENUNCIATION_STATUS[statusAnterior]?.label || statusAnterior;
        const novoStatusLabel = DENUNCIATION_STATUS[novoStatus]?.label || novoStatus;

        // Cria relatórios conforme necessário
        if (descriptionInput) {
            await reportsModel.create({
                description: `${descriptionInput} - ${dataAtual}`,
                denunciation_id: denunciaId,
                user_id: userId,
                type: REPORT_TYPE.TEXT
            });
        }

        if (houveMudancaStatus) {
            await reportsModel.create({
                description: `${dataAtual}\nStatus alterado de "${statusAnteriorLabel}" para "${novoStatusLabel}"`,
                denunciation_id: denunciaId,
                user_id: userId,
                type: REPORT_TYPE.STATUS_CHANGE
            });

            // Atualiza o status da denúncia
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
            reportTypeLabel: REPORT_TYPE[report.type],
            DENUNCIATION_STATUS: DENUNCIATION_STATUS
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar a página de edição');
    }
});

// Rota para editar um relatório
router.post('/relatorio/:id/editar', async (req, res) => {
    const reportId = req.params.id;
    const { description: newDescriptionRaw, status: newStatus } = req.body;
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    try {
        const report = await reportsModel.findByPk(reportId);
        if (!report) return res.status(404).send('Relatório não encontrado');

        // Atualiza o conteúdo com base no tipo
        let finalDescription = newDescriptionRaw;

        // Se o tipo for STATUS_CHANGE, sobrescreve a descrição
        if (report.type === REPORT_TYPE.STATUS_CHANGE) {
            const labelNew = DENUNCIATION_STATUS[newStatus]?.label || newStatus;
            finalDescription = `${dataAtual}\nStatus alterado para "${labelNew}"`
        }

        await report.update({
            description: finalDescription
        });
        
        // Atualiza o status da denúncia se for diferente
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

module.exports = router;
