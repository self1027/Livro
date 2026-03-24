import Denunciation from '../models/denunciationsModel.js'
import {Op} from 'sequelize'
import Report from '../models/reportsModel.js'
import User from '../models/usersModel.js'

function findAll(options = {}) {
    return Denunciation.findAll(options)
}

function findByPk(id, options = {}) {
    return Denunciation.findByPk(id, options)
}

function findByIdWithRelations(id) {
    return Denunciation.findByPk(id, {
        include: [
            {
                model: Report,
                as: 'reports',
                attributes: ['id', 'description', 'created_at']
            },
            {
                model: User,
                as: 'user',
                attributes: ['name']
            }
        ]
    })
}

function findFirst() {
    return Denunciation.findOne({
        order: [['createdAt', 'ASC']]
    })
}

function findLastByYear(year) {
    return Denunciation.findOne({
        where: { year },
        order: [['number', 'DESC']]
    })
}

function create(data) {
    return Denunciation.create(data)
}

function findOpenByAddress({ endereco, numero, bairro, statusFinalizado }) {
    return Denunciation.findOne({
        where: {
            endereco,
            numero,
            bairro,
            status: {
                [Op.ne]: statusFinalizado
            }
        }
    })
}

function update(id, data) {
    return Denunciation.update(data, {
        where: { id }
    })
}

function findUnassignedWithReports() {
    return Denunciation.findAll({
        where: {
            user_id: null
        },
        include: [{
            model: Report,
            as: 'reports',
            include: [{
                model: User,
                as: 'user'
            }]
        }]
    })
}

function updateUser(id, userId) {
    return Denunciation.update(
        { user_id: userId },
        { where: { id } }
    )
}

async function findByIdWithUser(id) {
    return Denunciation.findByPk(id, {
        include: [{
            model: User,
            as: 'user'
        }]
    })
}

async function search(where) {
    return Denunciation.findAll({
        where,
        include: [{
            model: User,
            as: 'user',
            attributes: ['name']
        }],
        order: [
            ['year', 'DESC'],
            ['number', 'DESC']
        ]
    })
}

async function findAllWithUser({ limit = 50, offset = 0 } = {}) {
    return Denunciation.findAll({
        include: [{
            model: User,
            as: 'user',
            attributes: ['name']
        }],
        order: [
            ['year', 'DESC'],
            ['number', 'DESC']
        ],
        limit,
        offset
    })
}

function count(where = {}) {
    return Denunciation.count({ where })
}

function countByStatus(year, status) {
    return Denunciation.count({
        where: {
            year,
            status
        }
    })
}

function countInProgress(year, excludedStatuses = []) {
    return Denunciation.count({
        where: {
            year,
            status: {
                [Op.notIn]: excludedStatuses
            }
        }
    })
}

function countUnassigned(year) {
    return Denunciation.count({
        where: {
            year,
            user_id: null
        }
    })
}

export default {
    findAll,
    findByPk,
    findByIdWithRelations,
    findFirst,
    findLastByYear,
    findOpenByAddress,
    create,
    update,
    findUnassignedWithReports,
    updateUser,
    findByIdWithUser,
    search,
    findAllWithUser,
    count,
    countByStatus,
    countInProgress,
    countUnassigned
}