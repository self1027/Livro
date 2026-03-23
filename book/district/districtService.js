const slugify = require('slugify')
const repo = require('./districtRepository')

async function getAll() {
    return repo.findAll()
}

async function getById(id) {
    const district = await repo.findByPk(id)

    if (!district) {
        return {
            ok: false,
            status: 404,
            message: 'Bairro não encontrado'
        }
    }

    return {
        ok: true,
        data: district
    }
}

async function findByName(name) {
    if (!name) return null

    return repo.findByName(name.trim())
}

async function create(data) {
    const { name } = data

    if (!name || !name.trim()) {
        return {
            ok: false,
            status: 400,
            message: 'Nome é obrigatório'
        }
    }

    const cleanedName = name.trim()

    const existing = await repo.findByName(cleanedName)

    if (existing) {
        return {
            ok: false,
            status: 409,
            message: 'Bairro já cadastrado'
        }
    }

    const slug = slugify(cleanedName, {
        lower: true,
        strict: true,
        locale: 'pt'
    })

    const district = await repo.create({
        name: cleanedName,
        slug
    })

    return {
        ok: true,
        status: 201,
        data: district
    }
}

async function update(id, data) {
    const { name } = data

    if (!name || !name.trim()) {
        return {
            ok: false,
            status: 400,
            message: 'Nome é obrigatório'
        }
    }

    const existing = await repo.findByPk(id)

    if (!existing) {
        return {
            ok: false,
            status: 404,
            message: 'Bairro não encontrado'
        }
    }

    const cleanedName = name.trim()

    const slug = slugify(cleanedName, {
        lower: true,
        strict: true,
        locale: 'pt'
    })

    await repo.update(id, {
        name: cleanedName,
        slug
    })

    return {
        ok: true,
        status: 200
    }
}

async function remove(id) {

    const existing = await repo.findByPk(id)

    if (!existing) {
        return {
            ok: false,
            status: 404,
            message: 'Bairro não encontrado'
        }
    }

    await repo.remove(id)

    return {
        ok: true,
        status: 200
    }
}

module.exports = {
    getAll,
    getById,
    findByName,
    create,
    update,
    remove
}