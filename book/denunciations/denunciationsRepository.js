const Denunciation = require('./denunciationsModel')
const {Op} = require('sequelize') 
const reportsModel = require('../reports/reportsModel')
const userModel = require('../../users/usersModel')

function findAll({ limit, offset }) {
    return Denunciation.findAll({
        limit,
        offset,
        order: [['createdAt', 'DESC']]
    })
}

function findByPk(id, options = {}) {
    return Denunciation.findByPk(id, options)
}

function findByIdWithRelations(id) {
    return Denunciation.findByPk(id, {
        include: [
            {
                model: reportsModel,
                as: 'reports',
                attributes: ['id', 'description', 'created_at']
            },
            {
                model: userModel,
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
            model: reportsModel,
            as: 'reports',
            include: [{
                model: userModel,
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
            model: userModel,
            as: 'user'
        }]
    })
}

async function search(where) {
    return Denunciation.findAll({
        where,
        include: [{
            model: userModel,
            as: 'user',
            attributes: ['name']
        }],
        order: [
            ['year', 'DESC'],
            ['number', 'DESC']
        ]
    })
}

module.exports = {
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
    search
}