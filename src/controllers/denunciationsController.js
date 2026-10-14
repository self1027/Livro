import express from 'express'
import DENUNCIATION_SENDER from '../constants/denunciationSenders.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'
import denunciationsService from '../services/denunciationsService.js'
import usersService from '../services/usersService.js'
import attendanceService from '../services/attendanceService.js'
import { reportDetails, senderDetails } from '../utils/catalogRegistry.js'

const router = express.Router()
const detailNotices = {
    'report-saved':'Relatório adicionado com sucesso.',
    'report-deleted':'Relatório excluído com sucesso.',
    'report-updated':'Relatório atualizado com sucesso.',
    'fiscal-saved':'Fiscal responsável atualizado com sucesso.'
}

router.get('/', async (req, res) => {
	try {
		const attendance = await attendanceService.get()

		const limit = parseInt(req.query.limit) || 50
		const offset = parseInt(req.query.offset) || 0

		// Busca usando o service ao invés do model direto
		const denuncias = await denunciationsService.listDenunciations({ limit, offset })

		res.render('index', {
			denuncias,
			DENUNCIATION_SENDER,
            SENDER_DETAILS: senderDetails,
			DENUNCIATION_STATUS,
			offset: offset + limit,
			limit,
			attendance
		})
	} catch (error) {
		console.error('Erro ao carregar denúncias na home:', error)
		res.status(500).send('Erro ao carregar denúncias.')
	}
})

router.get('/denuncias/new', async (req, res) => {
	try {

		const context = await denunciationsService.getCreateContext()

		res.render('denunciation/new', {
			...context,
			DENUNCIATION_SENDER
		})

	} catch (error) {
		console.error('Erro ao carregar dados da denúncia:', error)
		res.status(500).send('Erro ao carregar formulário de denúncia.')
	}
})

router.post('/denuncias', async (req, res) => {
	try {

		const result = await denunciationsService.createDenunciation(req.body)

		if (result.status !== 201) {

			const context = await denunciationsService.getCreateContext({
				body: req.body
			})

			return res.status(result.status).render('denunciation/new', {
				...context,
				message: result.message,
                existingId: result.meta?.id || null,
                fieldErrors: result.fieldErrors || {},
				DENUNCIATION_SENDER
			})
		}

		res.redirect('/')

	} catch (error) {
		console.error(error)
		res.status(500).send('Erro interno')
	}
})

router.get('/denuncias/:id', async (req, res, next) => {
	if (!/^\d+$/.test(req.params.id)) {
    	return next()
    }

	try {

		const result = await denunciationsService.getById(req.params.id)

		if (!result.ok) {
			return res.status(result.status).send(result.message)
		}

		let fiscais = await usersService.getActiveUsers()
		if (!Array.isArray(fiscais)) fiscais = []

		const denuncia = result.data

		res.render('denunciation/show', {
			denuncia,
			reports: denuncia.reports,
            REPORT_DETAILS: reportDetails,
            SENDER_DETAILS: senderDetails,
			fiscal: denuncia.user,
			fiscais,
			DENUNCIATION_SENDER,
			DENUNCIATION_STATUS,
            successMessages: Object.hasOwn(detailNotices,req.query.notice) ? [detailNotices[req.query.notice]] : []
		})

	} catch (error) {
		console.error('Erro ao buscar denúncia:', error)
		res.status(500).send('Erro ao carregar denúncia')
	}
})

router.get('/denuncias/:id/edit', async (req, res) => {
	try {

		const result = await denunciationsService.getEditData(req.params.id)

		if (!result.ok) {
			return res.status(result.status).send(result.message)
		}

		const { denuncia, districts } = result.data

		res.render('denunciation/edit', {
			denuncia,
			districts,
			DENUNCIATION_SENDER,
			DENUNCIATION_STATUS,
			year: denuncia.year,
			lastNumber: denuncia.number
		})

	} catch (error) {
		console.error('Erro ao carregar denúncia:', error)
		res.status(500).send('Erro ao carregar denúncia')
	}
})

router.post('/denuncias/:id/edit', async (req, res) => {
	try {

		const { id } = req.params

		const result = await denunciationsService.updateDenunciation(id, req.body)

		if (!result.ok) {
			return res.status(result.status).send(result.message)
		}

		res.redirect(`/denuncias/${id}`)

	} catch (err) {
		console.error('Erro ao atualizar:', err)
		res.status(500).send('Erro ao salvar alterações.')
	}
})

router.get('/atribuir',(req,res)=>{
    const query=new URLSearchParams()
    for(const key of ['denunciaId','page','success','error'])if(typeof req.query[key]==='string')query.set(key,req.query[key])
    res.redirect('/admin/assignments'+(query.size?'?'+query:''))
})
router.post('/atribuir/:denunciaId',(req,res)=>res.redirect(307,'/admin/assignments/'+encodeURIComponent(req.params.denunciaId)))

router.get('/buscar', async (req, res) => {
	try {

		const context = await denunciationsService.getSearchContext(req.query)

		res.status(context.searchErrors.length ? 400 : 200).render('denunciation/search', context)

	} catch (error) {
		console.error('Erro:', error)
		res.status(500).send('Erro ao carregar a página de busca')
	}
})

export default router
