const { Op } = require('sequelize')

function buildSearchWhere(query = {}) {

    const {
        year,
        number,
        endereco,
        numero,
        bairro,
        status,
        registration_type,
        userId
    } = query

    const where = {}

    if (year) where.year = year
    if (number) where.number = number

    if (endereco) {
        const cleanEndereco = endereco
            .replace(/^(rua|r\.|avenida|av\.|travessa|praça|estrada|alameda|rodovia)\s*/i, '')
            .trim()

        where.endereco = {
            [Op.like]: `%${cleanEndereco}%`
        }
    }

    if (numero) where.numero = numero

    if (bairro) {
        where.bairro = {
            [Op.like]: `%${bairro}%`
        }
    }

    if (status && status !== 'Selecione') where.status = status
    if (registration_type && registration_type !== 'Selecione') where.registration_type = registration_type
    if (userId) where.user_id = userId

    return where
}

module.exports = {
    buildSearchWhere
}