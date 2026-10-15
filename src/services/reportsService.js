import reportsRepository from '../repositories/reportsRepository.js'
import denunciationsRepository from '../repositories/denunciationsRepository.js'
import REPORT_TYPE from '../constants/reportType.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'
import { reportDetails } from '../utils/catalogRegistry.js'
import {canWorkOnDenunciation} from '../auth/permissions.js'
import db from '../database/database.js'
import sivisaService from './sivisaService.js'
import {normalizeSivisa,sivisaRows} from '../utils/sivisa.js'
import {randomUUID} from 'node:crypto'

async function addReport({ denunciationId, userId, description, status, actor, ...sivisaInput }) {
    if(description!=null&&typeof description!=='string')return {ok:false,status:400,message:'Informe um texto válido para o relatório.'}
    description=description?.trim()
    if (!userId) return { ok: false, status: 400, message: 'ID do usuário não informado' }
    if (status && !Object.hasOwn(DENUNCIATION_STATUS, status)) return { ok: false, status: 400, message: 'Status inválido' }

    let sivisa
    try{if(description)sivisa=normalizeSivisa(sivisaInput);else if(sivisaRows(sivisaInput).some(item=>item.protocol.trim()))return {ok:false,status:400,message:'Descreva a ação para vincular protocolos SIVISA.'}}
    catch(error){return {ok:false,status:400,message:error.message}}
    try{return await db.transaction(async transaction=>{
        const denuncia = await denunciationsRepository.findByPk(denunciationId,{transaction,lock:transaction.LOCK.UPDATE})
        if (!denuncia) return { ok: false, status: 404, message: 'Denúncia não encontrada' }

        const statusAnterior = denuncia.status
        const houveMudancaStatus = status && statusAnterior !== status
        const operationId = randomUUID()

        // cria relatório de descrição
        if (description) {
            const report=await reportsRepository.create({
                description,
                denunciation_id: denunciationId,
                user_id: userId,
                operation_id: operationId,
                type: REPORT_TYPE.TEXT
            },{transaction})
            await sivisaService.saveForReport(report.id,sivisa,transaction,actor)
        }

        // cria relatório de mudança de status
        if (houveMudancaStatus) {
            const statusAnteriorLabel = DENUNCIATION_STATUS[statusAnterior]?.label || statusAnterior
            const novoStatusLabel = DENUNCIATION_STATUS[status]?.label || status

            await reportsRepository.create({
                description: `Status alterado de "${statusAnteriorLabel}" para "${novoStatusLabel}"`,
                denunciation_id: denunciationId,
                user_id: userId,
                operation_id: operationId,
                type: REPORT_TYPE.STATUS_CHANGE
            },{transaction})

            denuncia.status = status
            await denuncia.save({transaction})
        }

        if (!description && !houveMudancaStatus) {
            return { ok: false, status: 400, message: 'Nada para atualizar' }
        }

        return { ok: true, data: denuncia }
    })}catch(error){if(error.name==='SequelizeUniqueConstraintError')return {ok:false,status:400,message:'Um dos protocolos SIVISA já está vinculado a outro relatório.'};throw error}
}

async function editReport(reportId, { description, status, actor }) {
    return db.transaction(async transaction=>{
        const report = await reportsRepository.findByPk(reportId,{transaction,lock:transaction.LOCK.UPDATE})
        if (!report) return { ok: false, status: 404, message: 'Relatório não encontrado' }
        if (status && !Object.hasOwn(DENUNCIATION_STATUS, status)) return { ok: false, status: 400, message: 'Status inválido' }
        const isStatusChange = report.type === REPORT_TYPE.STATUS_CHANGE
        if(!isStatusChange&&(typeof description!=='string'||!description.trim()))return {ok:false,status:400,message:'A descrição do relatório não pode ficar vazia.'}

        let finalDescription = description

        if (isStatusChange && status) {
            const labelNew = DENUNCIATION_STATUS[status]?.label || status
            finalDescription = `Status alterado para "${labelNew}"`
        }

        await reportsRepository.update(reportId, { description: finalDescription },{transaction})

        if (isStatusChange && status) {
            const denuncia = await denunciationsRepository.findByPk(report.denunciation_id,{transaction,lock:transaction.LOCK.UPDATE})
            if (denuncia&&(!actor||canWorkOnDenunciation(actor,'reports.edit',denuncia))) {
                denuncia.status = status
                await denuncia.save({transaction})
            }
        }

        return { ok: true, data: report }
    })
}

async function saveSivisa(reportId,input,actor){
    let values
    try{values=normalizeSivisa(input,{editing:true})}catch(error){return {ok:false,status:400,message:error.message}}
    try{return await db.transaction(async transaction=>{
        const report=await reportsRepository.findByPk(reportId,{transaction,lock:transaction.LOCK.UPDATE})
        if(!report)return {ok:false,status:404,message:'Relatório não encontrado.'}
        if(Number(report.type)!==REPORT_TYPE.TEXT)return {ok:false,status:400,message:'Registros automáticos de status não recebem protocolos SIVISA.'}
        await sivisaService.saveForReport(report.id,values,transaction,actor)
        return {ok:true,data:report}
    })}catch(error){if(error.name==='SequelizeUniqueConstraintError')return {ok:false,status:400,message:'Um dos protocolos SIVISA já está vinculado a outro relatório.'};throw error}
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
            reportTypeLabel: reportDetails[report.type]?.label || 'Tipo não reconhecido',
            REPORT_DETAILS: reportDetails,
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
    saveSivisa,
    getReport,
    getReportsByDenunciationId 
}
