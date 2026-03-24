import repo from '../repositories/denunciationsRepository.js'
import reportsRepo from '../repositories/reportsRepository.js'
import Denunciation from '../models/denunciationsModel.js'
import User from '../models/usersModel.js'
import { Op, Sequelize } from 'sequelize'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'

async function getYears() {
    const yearsRaw = await repo.findAll({
        attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('year')), 'year']],
        order: [['year', 'DESC']]
    })
    return yearsRaw.map(y => y.year)
}

async function getStats(year) {
    const total = await repo.count({ year })
    const andamento = await repo.countInProgress(year, [
        DENUNCIATION_STATUS.REGISTRADA.slug,
        DENUNCIATION_STATUS.PENDENTE.slug,
        DENUNCIATION_STATUS.FINALIZADA.slug
    ])
    const resolvidas = await repo.countByStatus(year, DENUNCIATION_STATUS.FINALIZADA.slug)
    const semFiscal = await repo.countUnassigned(year)

    return { total, andamento, resolvidas, semFiscal }
}

async function getStatusStats(year) {
    const statusStats = []
    for (const key in DENUNCIATION_STATUS) {
        const status = DENUNCIATION_STATUS[key]
        const count = await repo.countByStatus(year, status.slug)
        statusStats.push({ label: status.label, color: status.color, count })
    }
    return statusStats
}

async function getMonthlyStats(year) {
    const mesesRaw = await repo.findAll({
        attributes: [
            [Sequelize.fn('MONTH', Sequelize.col('created_at')), 'mes'],
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'total']
        ],
        where: { year },
        group: ['mes'],
        order: [['mes', 'ASC']]
    })

    const meses = new Array(12).fill(0)
    mesesRaw.forEach(m => meses[m.dataValues.mes - 1] = parseInt(m.dataValues.total))
    return meses
}

async function getTopBairros(year, limit = 10) {
    const bairrosRaw = await repo.findAll({
        attributes: [
            'bairro', // nome original do campo
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'] // alias obrigatório
        ],
        where: { year },
        group: ['bairro'],
        order: [[Sequelize.literal('total'), 'DESC']],
        limit
    })

    return bairrosRaw
        .filter(b => b.bairro) // remove nulos
        .map(b => ({
            bairro: b.bairro, // mantém o nome original
            total: parseInt(b.dataValues.total, 10) // garante número correto
        }))
}

async function getRecentReports(year, limit = 10) {
    const reportsRaw = await reportsRepo.findAll({
        include: [
            { model: Denunciation, as: 'denunciation', where: { year } },
            { model: User, as: 'user', attributes: ['name'] }
        ],
        order: [['created_at', 'DESC']]
    })

    const seen = new Set()
    const reports = []
    for (const r of reportsRaw) {
        if (!seen.has(r.denunciation.id)) {
            seen.add(r.denunciation.id)
            reports.push(r)
        }
        if (reports.length >= limit) break
    }

    return reports
}

export default {
    getYears,
    getStats,
    getStatusStats,
    getMonthlyStats,
    getTopBairros,
    getRecentReports
}