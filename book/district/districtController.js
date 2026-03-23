const express = require('express')
const router = express.Router()

const districtService = require('./districtService')

// LISTAR
router.get('/bairros', async (req, res) => {
	try {
		const districts = await districtService.getAll()

		res.render('district/index', {
			districts,
			success: req.query.success,
			error: req.query.error
		})
	} catch (error) {
		console.error(error)
		res.status(500).send('Erro ao carregar bairros')
	}
})

// CRIAR
router.post('/bairros', async (req, res) => {
	try {
		const result = await districtService.create(req.body)

		if (!result.ok) {
			return res.redirect(
				`/bairros?error=${encodeURIComponent(result.message)}`
			)
		}

		res.redirect('/bairros?success=Bairro criado com sucesso')
	} catch (error) {
		console.error(error)
		res.redirect('/bairros?error=Erro interno ao criar bairro')
	}
})

// UPDATE (inline)
router.post('/bairros/:id', async (req, res) => {
	try {
		const result = await districtService.update(req.params.id, req.body)

		if (!result.ok) {
			return res.redirect(
				`/bairros?error=${encodeURIComponent(result.message)}`
			)
		}

		res.redirect('/bairros?success=Bairro atualizado com sucesso')
	} catch (error) {
		console.error(error)
		res.redirect('/bairros?error=Erro interno ao atualizar bairro')
	}
})

// DELETE
router.post('/bairros/:id/delete', async (req, res) => {
	try {
		const result = await districtService.remove(req.params.id)

		if (!result.ok) {
			return res.redirect(
				`/bairros?error=${encodeURIComponent(result.message)}`
			)
		}

		res.redirect('/bairros?success=Bairro removido com sucesso')
	} catch (error) {
		console.error(error)
		res.redirect('/bairros?error=Erro interno ao deletar bairro')
	}
})

module.exports = router