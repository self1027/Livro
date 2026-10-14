import slugify from 'slugify'
import { Op, UniqueConstraintError } from 'sequelize'
import connection from '../database/database.js'
import CatalogEntry from '../models/catalogEntryModel.js'
import { applyCatalog, catalogDefaults } from '../utils/catalogRegistry.js'

export const catalogKinds = { status: 'Status de denúncias', sender: 'Origens de denúncias' }
const allowedBehaviors = { status: ['pending', 'progress', 'closed'], sender: [null] }
export const generateSlug = label => slugify(label, { replacement: '_', strict: true, lower: false, locale: 'pt' }).toUpperCase().slice(0, 90)
const inputError = message => Object.assign(new Error(message), { status: 400 })
export function validateEntry(kind, input, existing) {
    if (!Object.hasOwn(catalogKinds, kind)) throw inputError('Categoria inválida.')
    const label = typeof input.label === 'string' ? input.label.trim() : ''
    if (!label || label.length > 120 || !generateSlug(label)) throw inputError('Informe um nome de até 120 caracteres com letras ou números.')
    const colors = {}
    for (const field of ['color', 'backgroundColor']) {
        if (typeof input[field] !== 'string' || !/^#[0-9a-f]{6}$/i.test(input[field])) throw inputError('Informe cores RGB válidas.')
        colors[field] = input[field].toLowerCase()
    }
    let behavior = kind === 'sender' ? null : input.behavior
    // Initial/automatic records carry application behavior; renaming cannot break it.
    if (existing && kind === 'status' && ['REGISTRADA', 'FINALIZADA'].includes(existing.slug)) {
        behavior = existing.behavior
    } else if (!allowedBehaviors[kind].includes(behavior)) throw inputError('Classificação inválida.')
    return { label, ...colors, behavior }
}

export function createCatalogService({ model = CatalogEntry, db = connection, publish = applyCatalog } = {}) {
    const list = () => model.findAll({ where: {kind:{[Op.in]:Object.keys(catalogKinds)}}, order: [['kind', 'ASC'], ['id', 'ASC']], raw: true })
    async function refresh() {
        const rows = await list()
        publish(rows)
        return rows
    }
    async function initialize() {
        // Creates only the new catalog table; never alters existing records/tables.
        await model.sync()
        await db.transaction(async transaction => {
            for (const seed of catalogDefaults) {
                await model.findOrCreate({ where: { kind: seed.kind, slug: seed.slug }, defaults: seed, transaction })
            }
        })
        await refresh()
    }
    async function save(kind, input, id) {
        if (!Object.hasOwn(catalogKinds, kind)) throw inputError('Categoria inválida.')
        const numericId = id == null ? null : Number(id)
        if (id != null && (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(numericId) || numericId < 1)) throw inputError('Identificador inválido.')
        let result
        // Unique constraints also protect simultaneous creates from multiple processes.
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                result = await db.transaction(async transaction => {
                    if (numericId != null) {
                        const existing = await model.findByPk(numericId, { transaction, lock: transaction.LOCK.UPDATE })
                        if (!existing || existing.kind !== kind) throw Object.assign(new Error('Item não encontrado.'), { status: 404 })
                        const values = validateEntry(kind, input, existing)
                        await existing.update(values, { transaction })
                        return existing
                    }
                    const values = validateEntry(kind, input)
                    const base = generateSlug(values.label)
                    let slug = base, suffix = 2
                    while (await model.findOne({ where: { kind, slug }, transaction })) slug = `${base}_${suffix++}`
                    return model.create({ kind, slug, code: null, ...values }, { transaction })
                })
                break
            } catch (error) {
                if (!(error instanceof UniqueConstraintError) || attempt === 4) throw error
            }
        }
        await refresh()
        return result
    }
    return { list, refresh, initialize, save }
}
export default createCatalogService()
