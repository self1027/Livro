import Report from '../../src/models/reportsModel.js'
import {sivisaInclude} from '../models/sivisaModels.js'

function create(data,options={}) {
    return Report.create(data,options)
}

function findByPk(id,options={}) {
    return Report.findByPk(id,{include:sivisaInclude,...options})
}

function update(id, data,options={}) {
    return Report.update(data, { where: { id },...options })
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
