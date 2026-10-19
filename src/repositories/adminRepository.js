import { Op, Sequelize } from 'sequelize'
import Denunciation from '../models/denunciationsModel.js'
import Report from '../models/reportsModel.js'
import User from '../models/usersModel.js'
import usersRepository from './usersRepository.js'
import District from '../models/districtsModel.js'
import { closedStatusSlugs } from '../utils/catalogRegistry.js'
import {sivisaInclude} from '../models/sivisaModels.js'
import REPORT_TYPE from '../constants/reportType.js'
import {summarizeMonthlyClosures} from '../utils/adminMetrics.js'

export function whereFor(filters) {
    const where = {}
    if (filters.year) where.year = Number(filters.year)
    if (filters.status) where.status = filters.status
    if (filters.scope === 'open') where[Op.or] = [{ status: { [Op.notIn]: closedStatusSlugs() } }, { status: null }]
    if (filters.userId) where.user_id = filters.userId === 'unassigned' ? null : Number(filters.userId)
    if (filters.bairro) where.bairro = filters.bairro
    if (filters.registration_type) where.registration_type = filters.registration_type
    if (filters.start || filters.end) {
        where.created_at = {}
        if (filters.start) where.created_at[Op.gte] = new Date(`${filters.start}T00:00:00-03:00`)
        if (filters.end) {
            const end = new Date(`${filters.end}T00:00:00-03:00`)
            end.setUTCDate(end.getUTCDate() + 1)
            where.created_at[Op.lt] = end
        }
    }
    return where
}
async function findDenunciations(filters) {
    const rows = await Denunciation.findAll({
        where: whereFor(filters),
        attributes: ['id', 'number', 'year', 'title', 'status', 'bairro', 'endereco', 'numero', 'user_id', 'registration_type', 'created_at',
            [Sequelize.literal('(SELECT MAX(r.created_at) FROM reports AS r WHERE r.denunciation_id = denunciations.id)'), 'last_activity']],
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'ativo'] }]
    })
    return rows.map(row => row.get({ plain: true }))
}
async function findRecentReports(filters) {
    // New submissions have an explicit operation ID. Legacy pairs use consecutive IDs,
    // the same author/complaint and the exact stored timestamp, without a time window.
    const rows = await Report.findAll({
        where: Sequelize.literal(`(
            reports.type <> 0 OR NOT EXISTS (
                SELECT 1 FROM reports AS accompanying_text
                WHERE accompanying_text.type = 1
                  AND accompanying_text.denunciation_id = reports.denunciation_id
                  AND accompanying_text.user_id = reports.user_id
                  AND (
                    (reports.operation_id IS NOT NULL AND accompanying_text.operation_id = reports.operation_id)
                    OR (reports.operation_id IS NULL AND accompanying_text.operation_id IS NULL
                        AND accompanying_text.id = reports.id - 1
                        AND accompanying_text.created_at = reports.created_at)
                  )
            )
        )`),
        include: [{ model: Denunciation, as: 'denunciation', where: whereFor(filters), attributes: ['id', 'number', 'year', 'title'] },
            { model: User, as: 'user', attributes: ['name'] }],
        order: [['created_at', 'DESC'], ['id', 'DESC']], limit: 10
    })
    return rows.map(row => row.get({ plain: true }))
}
async function findYears() {
    const rows = await Denunciation.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('year')), 'year']], order: [['year', 'DESC']], raw: true })
    return rows.map(row => row.year)
}
async function findMonthlyReportedDenunciations(filters) {
    const month = Sequelize.fn('DATE_FORMAT',
        Sequelize.fn('CONVERT_TZ', Sequelize.col('reports.created_at'), '+00:00', '-03:00'), '%Y-%m')
    return Report.findAll({
        where: { type: 1, ...whereFor({ start: filters.start, end: filters.end }) },
        attributes: [[month, 'month'], [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('reports.denunciation_id'))), 'total']],
        include: [{ model: Denunciation, as: 'denunciation',
            where: whereFor({ ...filters, start: '', end: '' }), attributes: [] }],
        group: [month], order: [[month, 'ASC']], raw: true
    })
}
async function findMonthlyClosedDenunciations(filters) {
    const events = await Report.findAll({
        where: { type: REPORT_TYPE.STATUS_CHANGE, ...whereFor({ start: filters.start, end: filters.end }) },
        attributes: ['denunciation_id', 'type', 'description', 'created_at'],
        include: [{ model: Denunciation, as: 'denunciation',
            where: whereFor({ ...filters, start: '', end: '' }), attributes: [] }],
        raw: true
    })
    return summarizeMonthlyClosures(events)
}
async function findSivisaReports(filters){
    const where={type:1}
    if(filters.userId)where.user_id=filters.userId==='unassigned'?null:Number(filters.userId)
    const period=whereFor({start:filters.start,end:filters.end})
    if(period.created_at)where.created_at=period.created_at
    const reports=await Report.findAll({where,attributes:['id','user_id','type','created_at'],include:[...sivisaInclude.map(item=>({...item,attributes:item.as==='sivisa'?['applies']:['id']})),{model:Denunciation,as:'denunciation',where:whereFor({...filters,userId:'',start:'',end:''}),attributes:['id']} ]})
    return reports.map(report=>report.get({plain:true}))
}
async function findActionReports(ids) {
    if (!ids.length) return []
    const reports = await Report.findAll({
        where: { id: { [Op.in]: ids }, type: 1 },
        attributes: ['id','user_id','denunciation_id','type','description','created_at'],
        include: [...sivisaInclude,
            { model: Denunciation, as: 'denunciation', attributes: ['id','number','year','title','status','bairro'] },
            { model: User, as: 'user', attributes: ['id','name'] }],
        order: [['created_at','DESC'],['id','DESC']]
    })
    return reports.map(report=>report.get({plain:true}))
}
export default { findDenunciations, findRecentReports, findYears,findSivisaReports, findMonthlyReportedDenunciations, findMonthlyClosedDenunciations, findActionReports,
    findUsers: () => usersRepository.findAll({ attributes: ['id', 'name', 'ativo'], order: [['name', 'ASC']], raw: true }),
    findDistricts: () => District.findAll({ attributes: ['name'], order: [['name', 'ASC']], raw: true }) }
