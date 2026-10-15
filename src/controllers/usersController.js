import express from 'express'
import userService from '../services/usersService.js'
import denunciationService from '../services/denunciationsService.js'
import DENUNCIATION_STATUS from '../constants/denunciationStatus.js'

const router = express.Router()

router.get('/cadastro/usuario',(req,res)=>res.redirect('/admin/access'))

router.post('/usuario/registrar',(req,res)=>res.redirect(303,'/admin/access'))

router.get('/area-fiscal', async (req, res) => {
  if(req.auth&&!res.locals.can('fiscal.area.all'))return res.redirect(`/area-fiscal/${req.auth.user.id}`)
  try {
    const fiscais = req.auth?await userService.getAllOrdered():await userService.getActiveUsers()
    res.render('users/select', { fiscais })
  } catch (error) {
    console.error('Erro ao buscar fiscais:', error)
    res.status(500).send('Erro ao buscar fiscais.')
  }
})

router.get('/area-fiscal/:id', async (req, res) => {
  try {
    const fiscalId = req.params.id
    const selectedStatus = req.query.status == null || req.query.status === '' ? 'ALL' : req.query.status
    if (!/^\d+$/.test(fiscalId) || (selectedStatus !== 'ALL' && !Object.hasOwn(DENUNCIATION_STATUS, selectedStatus)) || typeof selectedStatus !== 'string') return res.status(400).send('Fiscal ou status inválido.')
    if (req.query.page != null && (typeof req.query.page !== 'string' || !/^[1-9]\d*$/.test(req.query.page))) return res.status(400).send('Página inválida.')
    const page = Number(req.query.page || 1)
    if (!Number.isSafeInteger(page) || page > Math.floor(Number.MAX_SAFE_INTEGER / 50)) return res.status(400).send('Página inválida.')
    const limit = 50
    const offset = (page - 1) * limit

    const fiscal = await userService.findByPk(fiscalId)
    if (!fiscal) return res.status(404).send('Fiscal não encontrado.')

    const result = await denunciationService.findAllByFiscal(fiscalId, selectedStatus, limit, offset)
    if (!result.ok) throw new Error('Erro ao buscar denúncias')

    res.render('users/home', {
      fiscal,
      denuncias: result.data.denuncias,
      selectedStatus,
      hasMore: result.data.hasMore,
      DENUNCIATION_STATUS,
      nextPage: result.data.nextPage,
      total: result.data.total
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao carregar os dados do fiscal.')
  }
})

router.get('/editar-usuario/:id',(req,res)=>res.redirect('/admin/access'))

router.post('/usuario/atualizar/:id',(req,res)=>res.redirect(303,'/admin/access'))

export default router
