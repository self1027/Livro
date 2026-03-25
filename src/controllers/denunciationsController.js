import express from 'express'
import DENUNCIATION_SENDER from '../constants/denunciationSenders.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'
import denunciationsService from '../services/denunciationsService.js'
import usersService from '../services/usersService.js'

const router = express.Router()

router.get('/', async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 50
		const offset = parseInt(req.query.offset) || 0

		// Busca usando o service ao invés do model direto
		const denuncias = await denunciationsService.listDenunciations({ limit, offset })

		res.render('index', {
			denuncias,
			DENUNCIATION_SENDER,
			DENUNCIATION_STATUS,
			offset: offset + limit,
			limit
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
				message: result.meta?.id
					? `${result.message} <a href="/denuncias/${result.meta.id}">Ver denúncia</a>`
					: result.message,
				DENUNCIATION_SENDER
			})
		}

		res.redirect('/')

	} catch (error) {
		console.error(error)
		res.status(500).send('Erro interno')
	}
})

router.get('/denuncias/:id', async (req, res) => {
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
			fiscal: denuncia.user,
			fiscais,
			DENUNCIATION_SENDER,
			DENUNCIATION_STATUS
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

router.get('/atribuir', async (req, res) => {
	try {

		const { denunciaId } = req.query

		const { denuncias, fiscais, denunciaSelecionada } =
			await denunciationsService.getAssignContext({ denunciaId })

		res.render('denunciation/associate', {
			denuncias,
			fiscais,
			denunciaSelecionada,
			DENUNCIATION_SENDER,
			success: req.query.success,
			error: req.query.error
		})

	} catch (error) {
		console.error('Erro:', error)
		res.status(500).send('Erro ao carregar página')
	}
})

router.post('/atribuir/:denunciaId', async (req, res) => {
	try {
		const { denunciaId } = req.params
		const { userId, redirectToShow } = req.body

		const result = await denunciationsService.assignDenunciation(
			denunciaId,
			userId
		)

		if (!result.ok) {
			return res.redirect(`/atribuir?error=${encodeURIComponent(result.message)}`)
		}

		if (redirectToShow) {
			return res.redirect(`/denuncias/${denunciaId}`)
		}

		res.redirect('/atribuir?success=Denúncia+atribuída+com+sucesso')

	} catch (error) {
		console.error('Erro ao atribuir fiscal:', error)
		res.redirect('/atribuir?error=Erro+ao+atribuir+fiscal')
	}
})

router.get('/buscar', async (req, res) => {
	try {

		const context = await denunciationsService.getSearchContext(req.query)

		res.render('denunciation/search', context)

	} catch (error) {
		console.error('Erro:', error)
		res.status(500).send('Erro ao carregar a página de busca')
	}
})

export default router