const Report = require('./reportsModel')
const { Op } = require('sequelize')

function create(data) {
    return Report.create(data)
}

function findByPk(id) {
    return Report.findByPk(id)
}

function update(id, data) {
    return Report.update(data, { where: { id } })
}

function remove(id) {
    return Report.destroy({ where: { id } })
}

function findAllByDenunciationId(denunciationId) {
    return Report.findAll({
        where: { denunciation_id: denunciationId },
        order: [['created_at', 'DESC']]
    })
}

module.exports = {
    create,
    findByPk,
    update,
    remove,
    findAllByDenunciationId
}