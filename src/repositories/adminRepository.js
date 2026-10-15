import { Op, Sequelize } from 'sequelize'
import Denunciation from '../models/denunciationsModel.js'
import Report from '../models/reportsModel.js'
import User from '../models/usersModel.js'
import District from '../models/districtsModel.js'
import { closedStatusSlugs } from '../utils/catalogRegistry.js'
import {sivisaInclude} from '../models/sivisaModels.js'

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
    const rows = await Report.findAll({
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
async function findSivisaReports(filters){
    const where={type:1}
    if(filters.userId)where.user_id=filters.userId==='unassigned'?null:Number(filters.userId)
    const period=whereFor({start:filters.start,end:filters.end})
    if(period.created_at)where.created_at=period.created_at
    const reports=await Report.findAll({where,attributes:['id','user_id','type','created_at'],include:[...sivisaInclude.map(item=>({...item,attributes:item.as==='sivisa'?['applies']:['id']})),{model:Denunciation,as:'denunciation',where:whereFor({...filters,userId:'',start:'',end:''}),attributes:['id']} ]})
    return reports.map(report=>report.get({plain:true}))
}
export default { findDenunciations, findRecentReports, findYears,findSivisaReports,
    findUsers: () => User.findAll({ attributes: ['id', 'name', 'ativo'], order: [['name', 'ASC']], raw: true }),
    findDistricts: () => District.findAll({ attributes: ['name'], order: [['name', 'ASC']], raw: true }) }
