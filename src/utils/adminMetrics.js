import STATUS from '../constants/denunciationStatus.js'
import SENDERS from '../constants/denunciationSenders.js'
import { isClosedStatus, closedStatusSlugs } from './catalogRegistry.js'
import REPORT_TYPE from '../constants/reportType.js'
import { SIVISA_METRICS } from './sivisa.js'

const scalar = value => typeof value === 'string' ? value.trim() : ''
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const currentYearStart = (now = new Date()) => `${calendarDay(now).slice(0, 4)}-01-01`
export function normalizeFilters(query = {}, now = new Date()) {
    const explicitPeriod = Object.hasOwn(query, 'start') || Object.hasOwn(query, 'end') || /^\d{4}$/.test(scalar(query.year))
    const filters = {
        year: /^\d{4}$/.test(scalar(query.year)) ? scalar(query.year) : '',
        start: explicitPeriod ? scalar(query.start) : currentYearStart(now), end: scalar(query.end),
        view: ['sivisa', 'analytics', 'reports'].includes(query.view) ? query.view : 'overview',
        actionMetric: Object.hasOwn(SIVISA_METRICS, scalar(query.actionMetric)) ? scalar(query.actionMetric) : '',
        userId: /^\d+$/.test(scalar(query.userId)) || query.userId === 'unassigned' ? query.userId : '',
        bairro: scalar(query.bairro),
        status: Object.hasOwn(STATUS, scalar(query.status)) ? scalar(query.status) : '',
        registration_type: Object.hasOwn(SENDERS, scalar(query.registration_type)) ? scalar(query.registration_type) : '',
        scope: query.scope === 'open' ? 'open' : 'all',
        queue: ['unassigned', 'inactive', 'noText', 'old', 'closed', 'open', 'progress', 'age0', 'age1', 'age2', 'age3'].includes(query.queue) ? query.queue : '',
        inactivityDays: [7, 15, 30, 60].includes(Number(query.inactivityDays)) ? Number(query.inactivityDays) : 30,
        page: /^\d+$/.test(scalar(query.page)) && Number.isSafeInteger(Number(query.page)) ? Math.max(1, Number(query.page)) : 1
    }
    if (!dateOnly(filters.start)) filters.start = ''
    if (!dateOnly(filters.end)) filters.end = ''
    if (filters.start && filters.end && filters.start > filters.end) throw new Error('A data inicial deve ser anterior ou igual à data final.')
    return filters
}
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const calendarDay = value => {
    const parts = dayFormatter.formatToParts(new Date(value))
    const get = type => parts.find(p => p.type === type).value
    return `${get('year')}-${get('month')}-${get('day')}`
}
const daysBetween = (now, date) => Math.max(0, Math.round((Date.parse(calendarDay(now)) - Date.parse(calendarDay(date))) / 86400000))
export const isOpen = row => !isClosedStatus(row.status)
export const isProgress = row => STATUS[row.status]?.behavior === 'progress'
export function summarizeMonthlyClosures(events) {
    // Status history predates structured status fields: read the destination, never
    // the complaint's current status or the previous status mentioned in the text.
    const labels = new Set(closedStatusSlugs().flatMap(slug => [slug, STATUS[slug].label]))
    labels.add('Finalizada') // Preserve the original label if the catalog was renamed.
    const months = new Map()
    for (const event of events) {
        if (Number(event.type) !== REPORT_TYPE.STATUS_CHANGE) continue
        const target = event.description?.match(/^Status alterado (?:de "[\s\S]*" )?para "([\s\S]*)"$/)?.[1]
        if (!labels.has(target)) continue
        const month = calendarDay(event.created_at).slice(0, 7)
        if (!months.has(month)) months.set(month, new Set())
        months.get(month).add(event.denunciation_id)
    }
    return [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, ids]) => ({month, total: ids.size}))
}
export function mergeMonthlyReports(registrations, reported, closed = []) {
    const months = new Map(registrations.map(row => [row.month, { ...row, withReport: 0, closed: 0 }]))
    for (const [rows, field] of [[reported, 'withReport'], [closed, 'closed']]) {
        for (const row of rows) {
            const entry = months.get(row.month) || { month: row.month, total: 0, withReport: 0, closed: 0 }
            entry[field] = Number(row.total)
            months.set(row.month, entry)
        }
    }
    const keys = [...months.keys()].sort()
    if (keys.length) {
        const cursor = new Date(`${keys[0]}-01T12:00:00Z`)
        while (cursor.toISOString().slice(0, 7) <= keys.at(-1)) {
            const month = cursor.toISOString().slice(0, 7)
            if (!months.has(month)) months.set(month, { month, total: 0, withReport: 0, closed: 0 })
            cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        }
    }
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
}
export function selectQueue(rows, queue) {
    const checks = {
        unassigned: row => isOpen(row) && !row.user_id,
        inactive: row => isOpen(row) && row.inactive,
        noText: row => isOpen(row) && row.first_text_report_at === null,
        old: row => isOpen(row) && row.age > 60,
        closed: row => !isOpen(row), open: isOpen, progress: isProgress,
        age0: row => isOpen(row) && row.age <= 7,
        age1: row => isOpen(row) && row.age > 7 && row.age <= 30,
        age2: row => isOpen(row) && row.age > 30 && row.age <= 60,
        age3: row => isOpen(row) && row.age > 60
    }
    return checks[queue] ? rows.filter(checks[queue]) : rows
}
export function summarize(data, users, filters, now = new Date()) {
    const rows = data.map(row => ({ ...row, age: daysBetween(now, row.created_at), idleDays: daysBetween(now, row.last_activity || row.created_at) }))
        .map(row => ({ ...row, inactive: row.idleDays >= filters.inactivityDays }))
        .sort((a, b) => b.age - a.age || a.id - b.id)
    const statusStats = Object.entries(STATUS).map(([slug, status]) => ({ ...status, slug, count: rows.filter(row => row.status === slug).length }))
    const unknown = rows.filter(row => !Object.hasOwn(STATUS, row.status)).length
    if (unknown) statusStats.push({ slug: '', label: 'Sem status reconhecido', color: '#6c757d', count: unknown })
    const months = new Map(), districts = new Map()
    rows.forEach(row => {
        const month = calendarDay(row.created_at).slice(0, 7)
        months.set(month, (months.get(month) || 0) + 1)
        districts.set(row.bairro || 'Sem bairro', (districts.get(row.bairro || 'Sem bairro') || 0) + 1)
    })
    const keys = [...months.keys()].sort()
    if (keys.length) {
        const cursor = new Date(`${keys[0]}-01T12:00:00Z`)
        const end = keys.at(-1)
        while (cursor.toISOString().slice(0, 7) <= end) {
            const key = cursor.toISOString().slice(0, 7)
            if (!months.has(key)) months.set(key, 0)
            cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        }
    }
    const workload = users.map(user => {
        const assigned = rows.filter(row => Number(row.user_id) === Number(user.id))
        const open = assigned.filter(isOpen)
        return { ...user, open: open.length, closed: assigned.length - open.length, inactive: open.filter(row => row.inactive).length,
            statuses: statusStats.filter(s => !isClosedStatus(s.slug) && s.slug).map(s => ({ ...s, count: open.filter(row => row.status === s.slug).length })) }
    }).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'pt-BR'))
    const median = values => {
        if (!values.length) return null
        const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    }
    const openRows = rows.filter(isOpen)
    const responseRows = rows.filter(row => row.first_text_report_at &&
        Number.isFinite(new Date(row.first_text_report_at).getTime()) &&
        new Date(row.first_text_report_at) >= new Date(row.created_at) && new Date(row.first_text_report_at) <= now)
    const originCounts = new Map()
    rows.forEach(row => {
        const slug = Object.hasOwn(SENDERS, row.registration_type) ? row.registration_type : ''
        originCounts.set(slug, (originCounts.get(slug) || 0) + 1)
    })
    return { rows, statusStats, workload,
        curation: {
            medianOpenAge: median(openRows.map(row => row.age)),
            assignedOpen: openRows.filter(row => row.user_id).length,
            assignedPercent: openRows.length ? Math.round(openRows.filter(row => row.user_id).length / openRows.length * 100) : null,
            openWithoutText: selectQueue(rows, 'noText').length,
            firstReportMedian: median(responseRows.map(row => daysBetween(row.first_text_report_at, row.created_at))),
            firstReportSample: responseRows.length
        },
        origins: [...originCounts].map(([slug, count]) => ({slug, label: SENDERS[slug] || 'Origem não informada', count})).sort((a,b) => b.count - a.count),
        monthly: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total })),
        bairros: [...districts].map(([bairro, total]) => ({ bairro, total })).sort((a, b) => b.total - a.total).slice(0, 10),
        ages: ['Até 7 dias', '8 a 30 dias', '31 a 60 dias', 'Mais de 60 dias'].map((label, i) => ({ label, queue: `age${i}`, count: selectQueue(rows, `age${i}`).length })),
        stats: { total: rows.length, open: selectQueue(rows, 'open').length, progress: selectQueue(rows, 'progress').length,
            closed: selectQueue(rows, 'closed').length, unassigned: selectQueue(rows, 'unassigned').length,
            inactive: selectQueue(rows, 'inactive').length, old: selectQueue(rows, 'old').length }
    }
}
