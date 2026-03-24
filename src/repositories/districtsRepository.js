import District from '../models/districtsModel.js'

function findAll() {
    return District.findAll({
        order: [['name', 'ASC']]
    })
}

function findByPk(id) {
    return District.findByPk(id)
}

function findByName(name) {
    return District.findOne({
        where: { name }
    })
}

function create(data) {
    return District.create(data)
}

function update(id, data) {
    return District.update(data, {
        where: { id }
    })
}

function remove(id) {
    return District.destroy({
        where: { id }
    })
}

export default {
    findAll,
    findByPk,
    findByName,
    create,
    update,
    remove
}