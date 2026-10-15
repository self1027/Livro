import express from 'express'
import adminService from '../services/adminService.js'
import attendanceService from '../services/attendanceService.js'
import STATUS from '../constants/denunciationStatus.js'
import SENDERS from '../constants/denunciationSenders.js'
import { normalizeFilters, currentYearStart, isOpen } from '../utils/adminMetrics.js'
import { reportDetails } from '../utils/catalogRegistry.js'
import { exportCsv, exportPdf } from '../utils/adminExport.js'

const router = express.Router()
export function adminUrl(filters, changes = {}, path = '/admin') {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...filters, page: 1, ...changes })) {
        if (value != null && (value !== '' || key === 'start' || key === 'end')) params.set(key, String(value))
    }
    return `${path}?${params}`
}
const formatDate = value => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Sem relatório'

router.get('/admin', async (req, res) => {
    try {
        let filters
        try { filters = normalizeFilters(req.query) } catch (error) { return res.status(400).send(error.message) }
        const tab = req.query.tab === 'attendance' ? 'attendance' : 'overview'
        const dashboard = tab === 'overview' ? await adminService.getDashboard(req.query) : { filters }
        const attendance = tab === 'attendance' ? await attendanceService.get() : null
        res.render('admin/index', {
            ...dashboard, attendance, STATUS, SENDERS, adminUrl, formatDate, currentYearStart: currentYearStart(), isOpen, REPORT_DETAILS: reportDetails,
            tab,
            notice: req.query.notice === 'saved' ? 'Configuração de atendimento salva.' : req.query.notice === 'error' ? 'Não foi possível salvar a configuração. Tente novamente.' : '',
            noticeError: req.query.notice === 'error'
        })
    } catch (error) {
        console.error('Erro ao carregar painel administrativo:', error)
        res.status(500).send('Erro ao carregar painel administrativo')
    }
})

router.get('/admin/export/:format', async (req, res) => {
    if (!['csv', 'pdf'].includes(req.params.format)) return res.sendStatus(404)
    try {
        try { normalizeFilters(req.query) } catch (error) { return res.status(400).send(error.message) }
        const data = await adminService.getDashboard(req.query, { exporting: true })
        if (req.params.format === 'csv') return exportCsv(res, data)
        exportPdf(res, data)
    } catch (error) {
        console.error('Erro ao exportar painel:', error)
        if (!res.headersSent) res.status(500).send('Erro ao exportar os dados')
        else res.end()
    }
})

router.post('/admin/attendance', async (req, res) => {
    try {
        const { weekdays, paused, module_disabled } = req.body
        await attendanceService.update({ weekdays: Array.isArray(weekdays) ? weekdays : [weekdays].filter(Boolean), paused: paused === 'on', enabled: module_disabled !== 'on' })
        res.redirect('/admin?tab=attendance&notice=saved')
    } catch (error) {
        console.error('Erro ao salvar atendimento:', error)
        res.redirect('/admin?tab=attendance&notice=error')
    }
})
export default router
