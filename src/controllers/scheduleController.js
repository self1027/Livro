import express from 'express'
import {schedulePage} from '../utils/schedulePage.js'

const router=express.Router()
router.get('/escala',schedulePage(false))
// Public schedule endpoints are read-only, including direct requests to legacy URLs.
router.all(['/escala/semana','/escala/dia'],(req,res)=>{
    res.status(405).send('A edição da escala é realizada no painel administrativo.')
})
export default router
