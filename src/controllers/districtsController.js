import express from 'express'
import districtService from '../services/districtsService.js'

const router = express.Router()

router.get('/bairros', (req, res) => {
    const query = new URLSearchParams({kind:'district'})
    for (const key of ['success','error']) {
        if (typeof req.query[key] === 'string') query.set(key,req.query[key])
    }
    res.redirect(`/admin/catalogs?${query}`)
})

router.post('/bairros', async (req, res) => {
	try {
		const result = await districtService.create(req.body)

		if (!result.ok) {
			return res.redirect(
				`/admin/catalogs?kind=district&error=${encodeURIComponent(result.message)}`
			)
		}

		res.redirect('/admin/catalogs?kind=district&success=Bairro criado com sucesso')
	} catch (error) {
		console.error(error)
		res.redirect('/admin/catalogs?kind=district&error=Erro interno ao criar bairro')
	}
})

router.post('/bairros/:id', async (req, res) => {
	try {
		const result = await districtService.update(req.params.id, req.body)

		if (!result.ok) {
			return res.redirect(
				`/admin/catalogs?kind=district&error=${encodeURIComponent(result.message)}`
			)
		}

		res.redirect('/admin/catalogs?kind=district&success=Bairro atualizado com sucesso')
	} catch (error) {
		console.error(error)
		res.redirect('/admin/catalogs?kind=district&error=Erro interno ao atualizar bairro')
	}
})

router.post('/bairros/:id/delete', async (req, res) => {
	try {
		const result = await districtService.remove(req.params.id)

		if (!result.ok) {
			return res.redirect(
				`/admin/catalogs?kind=district&error=${encodeURIComponent(result.message)}`
			)
		}

		res.redirect('/admin/catalogs?kind=district&success=Bairro removido com sucesso')
	} catch (error) {
		console.error(error)
		res.redirect('/admin/catalogs?kind=district&error=Erro interno ao deletar bairro')
	}
})

export default router
