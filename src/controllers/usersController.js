import express from 'express'
import userService from '../services/usersService.js'
import denunciationService from '../services/denunciationsService.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'

const router = express.Router()

router.get('/cadastro/usuario', async (req, res) => {
  try {
    const users = await userService.getAllOrdered()
    res.render('users/new', { username: users })
  } catch (error) {
    console.error('Erro ao buscar usuários:', error)
    res.status(500).render('error', { message: 'Erro ao carregar usuários.' })
  }
})

router.post('/usuario/registrar', async (req, res) => {
  const username = req.body.username
  if (!username) return res.redirect('/')

  try {
    await userService.create({ name: username })
    res.redirect('/cadastro/usuario')
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    res.status(500).render('error', { message: 'Erro ao criar usuário.' })
  }
})

router.get('/area-fiscal', async (req, res) => {
  try {
    const fiscais = await userService.getActiveUsers()
    res.render('users/select', { fiscais })
  } catch (error) {
    console.error('Erro ao buscar fiscais:', error)
    res.status(500).send('Erro ao buscar fiscais.')
  }
})

router.get('/area-fiscal/:id', async (req, res) => {
  try {
    const fiscalId = req.params.id
    const selectedStatus = req.query.status || 'REGISTRADA'
    const page = parseInt(req.query.page) || 1
    const limit = 50
    const offset = (page - 1) * limit

    const fiscal = await userService.findByPk(fiscalId)
    if (!fiscal) return res.status(404).render('error', { message: 'Fiscal não encontrado.' })

    const result = await denunciationService.findAllByFiscal(fiscalId, selectedStatus, limit, offset)
    if (!result.ok) throw new Error('Erro ao buscar denúncias')

    const countResult = await denunciationService.countByFiscal(fiscalId, selectedStatus)
    if (!countResult.ok) throw new Error('Erro ao contar denúncias')

    res.render('users/home', {
      fiscal,
      denuncias: result.data.denuncias,
      selectedStatus,
      hasMore: result.data.hasMore,
      DENUNCIATION_STATUS,
      nextPage: result.data.nextPage
    })
  } catch (error) {
    console.error(error)
    res.status(500).render('error', { message: 'Erro ao carregar os dados do fiscal.' })
  }
})

router.get('/editar-usuario/:id', async (req, res) => {
  try {
    const user = await userService.findByPk(req.params.id)
    if (!user) return res.status(404).render('error', { message: 'Usuário não encontrado.' })
    res.render('users/edit', { user })
  } catch (error) {
    console.error('Erro ao carregar o usuário para edição:', error)
    res.status(500).render('error', { message: 'Erro ao carregar usuário para edição.' })
  }
})

router.post('/usuario/atualizar/:id', async (req, res) => {
  const { id } = req.params
  const { name } = req.body
  const ativoCheckbox = req.body.active !== undefined

  try {
    const user = await userService.findByPk(id)
    if (!user) return res.status(404).render('error', { message: 'Usuário não encontrado.' })

    await userService.update(id, { name, toggleActive: ativoCheckbox })
    res.redirect('/cadastro/usuario')
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    res.status(500).render('error', { message: 'Erro ao atualizar o usuário.' })
  }
})

export default router