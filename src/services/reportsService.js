import reportsRepository from '../repositories/reportsRepository.js'
import denunciationsRepository from '../repositories/denunciationsRepository.js'
import REPORT_TYPE from '../constants/reportType.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'

async function addReport({ denunciationId, userId, description, status }) {
    if (!userId) return { ok: false, status: 400, message: 'ID do usuário não informado' }

    const denuncia = await denunciationsRepository.findByPk(denunciationId)
    if (!denuncia) return { ok: false, status: 404, message: 'Denúncia não encontrada' }

    const statusAnterior = denuncia.status
    const houveMudancaStatus = status && statusAnterior !== status

    // cria relatório de descrição
    if (description) {
        await reportsRepository.create({
            description,
            denunciation_id: denunciationId,
            user_id: userId,
            type: REPORT_TYPE.TEXT
        })
    }

    // cria relatório de mudança de status
    if (houveMudancaStatus) {
        const statusAnteriorLabel = DENUNCIATION_STATUS[statusAnterior]?.label || statusAnterior
        const novoStatusLabel = DENUNCIATION_STATUS[status]?.label || status

        await reportsRepository.create({
            description: `Status alterado de "${statusAnteriorLabel}" para "${novoStatusLabel}"`,
            denunciation_id: denunciationId,
            user_id: userId,
            type: REPORT_TYPE.STATUS_CHANGE
        })

        denuncia.status = status
        await denuncia.save()
    }

    if (!description && !houveMudancaStatus) {
        return { ok: false, status: 400, message: 'Nada para atualizar' }
    }

    return { ok: true, data: denuncia }
}

async function editReport(reportId, { description, status }) {
    const report = await reportsRepository.findByPk(reportId)
    if (!report) return { ok: false, status: 404, message: 'Relatório não encontrado' }

    let finalDescription = description

    if (report.type === REPORT_TYPE.STATUS_CHANGE && status) {
        const labelNew = DENUNCIATION_STATUS[status]?.label || status
        finalDescription = `Status alterado para "${labelNew}"`
    }

    await reportsRepository.update(reportId, { description: finalDescription })

    if (status && status !== report.status) {
        const denuncia = await denunciationsRepository.findByPk(report.denunciation_id)
        if (denuncia) {
            denuncia.status = status
            await denuncia.save()
        }
    }

    return { ok: true, data: report }
}

async function deleteReport(reportId) {
    const report = await reportsRepository.findByPk(reportId)
    if (!report) return { ok: false, status: 404, message: 'Relatório não encontrado' }

    await reportsRepository.remove(reportId)
    return { ok: true, denunciationId: report.denunciation_id }
}

async function getReport(reportId) {
    const report = await reportsRepository.findByPk(reportId)
    if (!report) return { ok: false, status: 404, message: 'Relatório não encontrado' }

    const denuncia = await denunciationsRepository.findByPk(report.denunciation_id)
    if (!denuncia) return { ok: false, status: 404, message: 'Denúncia não encontrada' }

    return {
        ok: true,
        data: {
            report,
            denuncia,
            reportTypeLabel: REPORT_TYPE[report.type],
            DENUNCIATION_STATUS
        }
    }
}

async function getReportsByDenunciationId(denunciationId) {
    const reports = await reportsRepository.findAllByDenunciationId(denunciationId)
    return reports
}

export default {
    addReport,
    editReport,
    deleteReport,
    getReport,
    getReportsByDenunciationId 
}