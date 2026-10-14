import express from 'express'
import catalogService, { catalogKinds } from '../services/catalogService.js'
import districtService from '../services/districtsService.js'

const router = express.Router()
async function renderCatalog(req, res, error = '', form = {}, status = 200) {
    const kind = req.query.kind === 'district' ? 'district' : Object.hasOwn(catalogKinds, req.query.kind) ? req.query.kind : 'status'
    const entries = kind === 'district' ? [] : await catalogService.list()
    const districts = kind === 'district' ? await districtService.getAll() : []
    res.status(status).render('admin/catalogs', {
        entries, districts, kind, catalogKinds,
        error: error || (typeof req.query.error === 'string' ? req.query.error : ''), form,
        notice: req.query.notice === 'saved' ? 'Configuração salva.' : typeof req.query.success === 'string' ? req.query.success : '',
        editId: req.params.id || ''
    })
}
router.get('/admin/catalogs', async (req, res) => {
    try { await renderCatalog(req, res) } catch (error) {
        console.error('Erro ao carregar cadastros:', error)
        res.status(503).send('Não foi possível carregar os cadastros. Tente novamente.')
    }
})
async function save(req, res) {
    if (!Object.hasOwn(catalogKinds, req.params.kind)) return res.status(400).send('Categoria inválida.')
    try {
        await catalogService.save(req.params.kind, req.body, req.params.id)
        res.redirect(`/admin/catalogs?kind=${encodeURIComponent(req.params.kind)}&notice=saved`)
    } catch (error) {
        if (![400, 404].includes(error.status)) {
            console.error('Erro ao salvar cadastro:', error)
            return res.status(500).send('Não foi possível salvar o cadastro. Tente novamente.')
        }
        try {
            await renderCatalog({ ...req, query: { kind: req.params.kind }, params: req.params }, res, error.message, req.body, error.status)
        } catch (renderError) {
            console.error('Erro ao apresentar cadastro:', renderError)
            res.status(503).send('Não foi possível carregar os cadastros. Tente novamente.')
        }
    }
}
router.post('/admin/catalogs/:kind', save)
router.post('/admin/catalogs/:kind/:id', save)
export default router
