import express from 'express'
import adminService from '../services/adminService.js'
import attendanceService from '../services/attendanceService.js'

const router = express.Router()

router.get('/admin', async (req, res) => {
    try {
        const attendance = await attendanceService.get()

        const years = await adminService.getYears()

        if (years.length === 0) {
            return res.render('admin/index.ejs', {
                year: null,
                years: [],
                stats: { total: 0, andamento: 0, resolvidas: 0, semFiscal: 0 },
                statusStats: [],
                reports: [],
                bairros: [],
                meses: []
            })
        }

        let year = parseInt(req.query.year)
        if (!years.includes(year)) year = years[0]

        const [stats, statusStats, meses, bairros, reports] = await Promise.all([
            adminService.getStats(year),
            adminService.getStatusStats(year),
            adminService.getMonthlyStats(year),
            adminService.getTopBairros(year),
            adminService.getRecentReports(year)
        ])

        res.render('admin/index.ejs', {
            year,
            years,
            stats,
            statusStats,
            meses,
            bairros,
            reports,
            attendance
        })

    } catch (error) {
        console.error('Erro ao carregar painel administrativo:', error)
        res.status(500).send("Erro ao carregar painel administrativo")
    }
})

router.post('/admin/attendance', async (req, res) => {
    try {
        const { weekdays, paused } = req.body

        await attendanceService.update({
            weekdays: Array.isArray(weekdays) ? weekdays : [weekdays].filter(Boolean),
            paused: paused === 'on'
        })

        res.redirect('/admin')

    } catch (error) {
        console.error(error)
        res.redirect('/admin')
    }
})

export default router