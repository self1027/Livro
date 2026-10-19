import repo from '../repositories/adminRepository.js'
import { normalizeFilters, summarize, selectQueue, mergeMonthlyReports } from '../utils/adminMetrics.js'
import {summarizeSivisa, selectSivisaReports, SIVISA_METRICS} from '../utils/sivisa.js'

async function getDashboard(query = {}, { exporting = false } = {}) {
    const filters = normalizeFilters(query)
    const needsDenunciations = exporting || ['overview', 'analytics'].includes(filters.view)
    const needsMonthlyReports = !exporting && filters.view === 'analytics'
    const [denuncias, users, districts, years, reports,sivisaReports, monthlyReports, monthlyClosed] = await Promise.all([
        needsDenunciations ? repo.findDenunciations(filters) : [], repo.findUsers(), repo.findDistricts(),
        repo.findYears(), !exporting && filters.view === 'reports' ? repo.findRecentReports(filters) : [],
        !exporting && filters.view === 'sivisa' ? repo.findSivisaReports(filters) : [],
        needsMonthlyReports ? repo.findMonthlyReportedDenunciations(filters) : [],
        needsMonthlyReports ? repo.findMonthlyClosedDenunciations(filters) : []
    ])
    const metrics = summarize(denuncias, users, filters)
    const selected = selectQueue(metrics.rows, filters.queue)
    const page = Math.min(filters.page, Math.max(1, Math.ceil(selected.length / 25)))
    let actionDetails = null
    if (!exporting && filters.view === 'sivisa' && filters.actionMetric) {
        const matching = selectSivisaReports(sivisaReports, filters.actionMetric)
            .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)||b.id-a.id)
        const pages = Math.max(1, Math.ceil(matching.length / 25))
        const actionPage = Math.min(filters.page, pages)
        actionDetails = {
            metric: filters.actionMetric, label: SIVISA_METRICS[filters.actionMetric],
            author: filters.userId ? users.find(user=>String(user.id)===filters.userId)?.name || 'Autor indisponível' : '',
            count: filters.actionMetric === 'protocols' ? matching.reduce((sum,report)=>sum+(report.sivisaProtocols?.length||0),0) : matching.length,
            actionCount: matching.length, page: actionPage, pages,
            reports: await repo.findActionReports(matching.slice((actionPage-1)*25,actionPage*25).map(report=>report.id))
        }
    }
    return {
        filters: { ...filters, page: actionDetails?.page || page }, users, districts, years, reports, ...metrics, actionDetails,
        monthly: needsMonthlyReports ? mergeMonthlyReports(metrics.monthly, monthlyReports, monthlyClosed) : metrics.monthly,
        sivisaMetrics: filters.view === 'sivisa' && !exporting ? summarizeSivisa(sivisaReports,users) : null,
        selectedCount: selected.length, pages: Math.max(1, Math.ceil(selected.length / 25)),
        selectedRows: selected.slice((page - 1) * 25, page * 25), exportRows: selected
    }
}
export default { getDashboard }
