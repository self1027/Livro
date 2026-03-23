const express = require('express')
const router = express.Router()

const DENUNCIATION_SENDER = require('../../constants/denunciationSenders')
const DENUNCIATION_STATUS = require('../../constants/denunciationStatus')
const denunciationsService = require('./denunciationsService')
const usersService = require('../../users/usersService')


router.get('/denuncias/new', async (req, res) => {
	try {

		const context = await denunciationsService.getCreateContext()

		res.render('book/denunciation/new', {
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

			return res.status(result.status).render('book/denunciation/new', {
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

		res.render('book/denunciation/show', {
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

		res.render('book/denunciation/edit', {
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

		res.render('book/denunciation/associate', {
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
		const { userId } = req.body

		const result = await denunciationsService.assignDenunciation(
			denunciaId,
			userId
		)

		if (!result.ok) {
			return res.redirect(`/atribuir?error=${encodeURIComponent(result.message)}`)
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

		res.render('book/denunciation/search', context)

	} catch (error) {
		console.error('Erro:', error)
		res.status(500).send('Erro ao carregar a página de busca')
	}
})

router.get('/denuncias/pdf', async (req, res) => {
	try {

		const { fiscalId, status } = req.query

		if (!fiscalId) {
			return res.status(400).send('fiscalId é obrigatório')
		}

		const result = await denunciationsService.getPdfData({
			fiscalId,
			status
		})

		if (!result.ok) {
			return res.status(result.status).send(result.message)
		}

		res.setHeader('Content-Type', 'application/pdf')
		res.setHeader('Content-Disposition', 'inline; filename=denuncias.pdf')

		pdfService.generateDenunciasPdf(res, result.data)

	} catch (error) {
		console.error(error)
		res.status(500).send('Erro ao gerar PDF')
	}
})

module.exports = router 