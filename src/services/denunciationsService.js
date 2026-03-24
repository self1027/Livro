import repo from '../repositories/denunciationsRepository.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'
import DENUNCIATION_SENDER from '../constants/denunciationSenders.js'
import userService from '../services/usersService.js'
import districtService from '../services/districtsService.js'
import Report from '../models/reportsModel.js'
import { buildSearchWhere } from '../utils/denunciationsQueryBuilder.js'

async function getNextNumber() {
    const currentYear = new Date().getFullYear()

    const lastDenuncia = await repo.findLastByYear(currentYear)

    const nextNumber = (lastDenuncia && lastDenuncia.number)
        ? lastDenuncia.number + 1
        : 1

    return {
        year: currentYear,
        nextNumber
    }
}

async function createDenunciation(data) {
    const {
        year,
        number,
        registration_type,
        title,
        endereco,
        numero,
        bairro,
        complemento,
        description
    } = data

    if (!bairro || !bairro.trim()) {
        return {
            status: 400,
            message: 'Bairro é obrigatório.'
        }
    }

    const district = await districtService.findByName(bairro)

    if (!district) {
        return {
            status: 400,
            message: 'Bairro inválido.'
        }
    }

    const existing = await repo.findOpenByAddress({
        endereco,
        numero,
        bairro,
        statusFinalizado: DENUNCIATION_STATUS.FINALIZADA.slug
    })

    if (existing) {
        return {
            status: 409,
            message: 'Já existe uma denúncia para este endereço.',
            meta: { id: existing.id }
        }
    }

    const denuncia = await repo.create({
        year,
        number,
        registration_type,
        title,
        endereco,
        numero,
        bairro: district.name,
        complemento: complemento || null,
        description,
        status: DENUNCIATION_STATUS.REGISTRADA.slug
    })

    return {
        status: 201,
        data: denuncia
    }
}

async function getById(id) {
    const denuncia = await repo.findByIdWithRelations(id)

    if (!denuncia) {
        return {
            ok: false,
            status: 404,
            message: 'Denúncia não encontrada'
        }
    }

    return {
        ok: true,
        data: denuncia
    }
}

async function getCreateContext({ body } = {}) {
    const districts = await districtService.getAll()
    const { year, nextNumber } = await getNextNumber()

    return {
        districts,
        year: body?.year || year,
        lastNumber: body?.number || nextNumber
    }
}

async function getEditData(id) {
    const result = await getById(id)

    if (!result.ok) return result

    const districts = await districtService.getAll()

    return {
        ok: true,
        data: {
            denuncia: result.data,
            districts
        }
    }
}

async function updateDenunciation(id, data) {
    const {
        registration_type,
        title,
        endereco,
        numero,
        bairro,
        complemento,
        description,
        status
    } = data

    // validação
    if (!bairro || !bairro.trim()) {
        return {
            ok: false,
            status: 400,
            message: 'Bairro é obrigatório.'
        }
    }

    const district = await districtService.findByName(bairro)

    if (!district) {
        return {
            ok: false,
            status: 400,
            message: 'Bairro inválido.'
        }
    }

    // verifica existência
    const existing = await repo.findByPk(id)

    if (!existing) {
        return {
            ok: false,
            status: 404,
            message: 'Denúncia não encontrada'
        }
    }

    await repo.update(id, {
        registration_type,
        title,
        endereco,
        numero,
        bairro: district.name,
        complemento: complemento || null,
        description,
        ...(status && { status })
    })

    return {
        ok: true,
        status: 200
    }
}

async function getAssignContext({ denunciaId } = {}) {

    const denuncias = await repo.findUnassignedWithReports()
    const fiscais = await userService.getActiveUsers()

    let denunciaSelecionada = null

    if (denunciaId) {
        denunciaSelecionada = await repo.findByIdWithUser(denunciaId)
    }

    return {
        denuncias,
        fiscais,
        denunciaSelecionada
    }
}

async function assignDenunciation(denunciaId, userId) {

    if (!userId) {
        return {
            ok: false,
            status: 400,
            message: 'Fiscal é obrigatório.'
        }
    }

    const denuncia = await repo.findByPk(denunciaId)

    if (!denuncia) {
        return {
            ok: false,
            status: 404,
            message: 'Denúncia não encontrada.'
        }
    }

    const fiscal = await userService.findByPk(userId)

    if (!fiscal || !fiscal.ativo) {
        return {
            ok: false,
            status: 400,
            message: 'Fiscal inválido.'
        }
    }

    // update
    await repo.updateUser(denunciaId, userId)

    return {
        ok: true,
        status: 200
    }
}

async function getSearchContext(query = {}) {

    const users = await userService.getAllOrdered()
    const districts = await districtService.getAll()

    let denuncias = []

    if (Object.keys(query).length > 0) {

        const where = buildSearchWhere(query)

        denuncias = await repo.search(where)
    }

    return {
        DENUNCIATION_STATUS,
        DENUNCIATION_SENDER,

        denuncias,
        districts,
        users,

        // mantém os filtros preenchidos
        year: query.year || '',
        number: query.number || '',
        endereco: query.endereco || '',
        numero: query.numero || '',
        bairro: query.bairro || '',
        status: query.status || '',
        registration_type: query.registration_type || '',
        userId: query.userId || '',

        scroll: denuncias.length > 0
    }
}

async function getPdfData({ fiscalId, status }) {

    const where = {
        user_id: fiscalId
    }

    if (status && status !== 'ALL') {
        where.status = status
    }

    const fiscal = await userService.findByPk(fiscalId)

    if (!fiscal) {
        return {
            ok: false,
            status: 404,
            message: 'Fiscal não encontrado'
        }
    }

    const denuncias = await repo.search(where)

    return {
        ok: true,
        data: {
            fiscal,
            denuncias,
            status
        }
    }
}

async function listDenunciations({ limit = 50, offset = 0 } = {}) {
    const denuncias = await repo.findAllWithUser({ limit, offset })
    return denuncias
}

async function findAllByFiscal(fiscalId, status = 'ALL', limit = 50, offset = 0) {
    const where = { user_id: fiscalId }
    if (status !== 'ALL') where.status = status

    const denuncias = await repo.findAll({
        where,
        include: [{
            model: Report,
            as: 'reports',
            required: false
        }],
        order: [
            ['year', 'DESC'],
            ['number', 'DESC']
        ],
        limit,
        offset
    })

    const total = await repo.count(where)
    const hasMore = offset + limit < total

    return {
        ok: true,
        data: {
            denuncias,
            total,
            hasMore,
            nextPage: offset + limit < total ? (offset / limit) + 2 : null
        }
    }
}

async function countByFiscal(fiscalId, status = 'ALL') {
    const where = { user_id: fiscalId }
    if (status !== 'ALL') where.status = status

    const total = await repo.count(where)

    return {
        ok: true,
        total
    }
}

export default {
    getNextNumber,
    createDenunciation,
    getById,
    getCreateContext,
    getEditData,
    updateDenunciation,
    getAssignContext,
    assignDenunciation,
    getSearchContext,
    getPdfData,
    listDenunciations,
    findAllByFiscal,
    countByFiscal
}