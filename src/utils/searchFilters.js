import STATUS from '../constants/denunciationStatus.js'
import SENDERS from '../constants/denunciationSenders.js'

const labels = {year:'Ano',number:'Número do protocolo',endereco:'Endereço',numero:'Número do endereço',bairro:'Bairro',status:'Status',registration_type:'Origem',userId:'Fiscal'}
export function normalizeSearchFilters(query = {}) {
    const filters = {}, errors = []
    for (const [key,label] of Object.entries(labels)) {
        filters[key] = typeof query[key] === 'string' ? query[key].trim() : ''
        if (query[key] != null && typeof query[key] !== 'string') errors.push(`${label}: informe um único valor.`)
        if (filters[key].length > 255) errors.push(`${label}: use até 255 caracteres.`)
    }
    if (filters.year && !/^[1-9]\d{3}$/.test(filters.year)) errors.push('Ano: informe quatro dígitos.')
    if (filters.number && (!/^\d+$/.test(filters.number) || Number(filters.number) < 1 || Number(filters.number) > 2147483647)) errors.push('Número do protocolo: informe um número inteiro positivo.')
    if (filters.status && !Object.hasOwn(STATUS,filters.status)) errors.push('Selecione um status cadastrado.')
    if (filters.registration_type && !Object.hasOwn(SENDERS,filters.registration_type)) errors.push('Selecione uma origem cadastrada.')
    if (filters.userId && filters.userId !== 'unassigned' && (!/^\d+$/.test(filters.userId) || Number(filters.userId) < 1 || Number(filters.userId) > 2147483647)) errors.push('Selecione um fiscal válido.')
    const hasFilters = Object.values(filters).some(Boolean)
    return {filters, errors, hasFilters}
}
export function searchUrl(filters, changes = {}) {
    const query = new URLSearchParams()
    for (const key of Object.keys(labels)) {
        const value = Object.hasOwn(changes,key) ? changes[key] : filters[key]
        if (value) query.set(key,value)
    }
    return query.size ? `/buscar?${query}#search-results` : '/buscar'
}
export function describeSearchFilters(filters, users) {
    return Object.entries(labels).filter(([key]) => filters[key]).map(([key,label]) => ({
        key,label,
        value:key === 'status' ? STATUS[filters[key]]?.label || filters[key] : key === 'registration_type' ? SENDERS[filters[key]] || filters[key] : key === 'userId' ? filters[key] === 'unassigned' ? 'Não atribuído' : users.find(user => String(user.id) === filters[key])?.name || filters[key] : filters[key]
    }))
}
