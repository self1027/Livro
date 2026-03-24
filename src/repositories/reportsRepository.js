import Report from '../../src/models/reportsModel.js'

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

function findAll(options = {}) {
    return Report.findAll({
        ...options,
        order: options.order || [['created_at', 'DESC']]
    })
}

export default {
    create,
    findByPk,
    update,
    remove,
    findAllByDenunciationId,
    findAll
}