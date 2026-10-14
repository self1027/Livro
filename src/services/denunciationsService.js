import repo from '../repositories/denunciationsRepository.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'
import DENUNCIATION_SENDER from '../constants/denunciationSenders.js'
import userService from '../services/usersService.js'
import districtService from '../services/districtsService.js'
import { buildSearchWhere } from '../utils/denunciationsQueryBuilder.js'
import { closedStatusSlugs } from '../utils/catalogRegistry.js'
import { normalizeSearchFilters, describeSearchFilters, searchUrl } from '../utils/searchFilters.js'
import {normalizeDenunciationForm, validateDenunciationForm} from '../utils/denunciationForm.js'

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
    const form = normalizeDenunciationForm(data)
    const fieldErrors = validateDenunciationForm(form,DENUNCIATION_SENDER)
    if (Object.keys(fieldErrors).length) return {status:400,message:'Revise os campos indicados para cadastrar a denúncia.',fieldErrors}
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
    } = {...data,...form}

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
            message: 'Selecione um bairro cadastrado.',
            fieldErrors: {bairro:'Selecione um bairro cadastrado.'}
        }
    }

    const existing = await repo.findOpenByAddress({
        endereco,
        numero,
        bairro,
        closedStatuses: closedStatusSlugs()
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
        form: normalizeDenunciationForm(body),
        fieldErrors: {},
        existingId: null,
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
    if (!Object.hasOwn(DENUNCIATION_SENDER, data.registration_type)) return { ok: false, status: 400, message: 'Origem da denúncia inválida.' }
    if (data.status && !Object.hasOwn(DENUNCIATION_STATUS, data.status)) return { ok: false, status: 400, message: 'Status inválido.' }
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

async function getAssignContext({ denunciaId, page = 1 } = {}) {
    const fiscais = await userService.getActiveUsers()

    let denunciaSelecionada = null

    if (denunciaId) {
        denunciaSelecionada = await repo.findByIdWithUser(denunciaId)
    }

    const total = denunciaId ? 0 : await repo.count({user_id:null})
    const pages = Math.max(1,Math.ceil(total / 25))
    const currentPage = Math.min(page,pages)
    const denuncias = denunciaId ? [] : await repo.findAll({where:{user_id:null},order:[['year','DESC'],['number','DESC'],['id','DESC']],limit:25,offset:(currentPage-1)*25})
    return {
        denuncias,
        fiscais,
        denunciaSelecionada,
        total,pages,page:currentPage
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
    const {filters, errors, hasFilters} = normalizeSearchFilters(query)

    const users = await userService.getAllOrdered()
    const districts = await districtService.getAll()

    let denuncias = []

    if (hasFilters && !errors.length) {

        const where = buildSearchWhere(filters)

        denuncias = await repo.search(where)
    }

    return {
        DENUNCIATION_STATUS,
        DENUNCIATION_SENDER,

        denuncias,
        districts,
        users,
        ...filters,
        searchPerformed: hasFilters && !errors.length,
        searchErrors: errors,
        activeFilters: describeSearchFilters(filters,users),
        searchUrl,

        // mantém os filtros preenchidos
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
