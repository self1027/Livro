import express from 'express'
import adminService from '../services/adminService.js'

const router = express.Router()

router.get('/admin', async (req, res) => {
    try {
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
            reports
        })

    } catch (error) {
        console.error('Erro ao carregar painel administrativo:', error)
        res.status(500).send("Erro ao carregar painel administrativo")
    }
})

export default router