import repo from '../repositories/adminRepository.js'
import { normalizeFilters, summarize, selectQueue } from '../utils/adminMetrics.js'

async function getDashboard(query = {}) {
    const filters = normalizeFilters(query)
    const [denuncias, users, districts, years, reports] = await Promise.all([
        repo.findDenunciations(filters), repo.findUsers(), repo.findDistricts(),
        repo.findYears(), repo.findRecentReports(filters)
    ])
    const metrics = summarize(denuncias, users, filters)
    const selected = selectQueue(metrics.rows, filters.queue)
    const page = Math.min(filters.page, Math.max(1, Math.ceil(selected.length / 25)))
    return {
        filters: { ...filters, page }, users, districts, years, reports, ...metrics,
        selectedCount: selected.length, pages: Math.max(1, Math.ceil(selected.length / 25)),
        selectedRows: selected.slice((page - 1) * 25, page * 25), exportRows: selected
    }
}
export default { getDashboard }
