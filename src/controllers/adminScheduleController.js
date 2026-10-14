import express from 'express'
import scheduleService from '../services/scheduleService.js'
import {schedulePage} from '../utils/schedulePage.js'

const router=express.Router()
// This router is mounted at /admin/schedule, ready for the admin authorization middleware.
router.get('/',schedulePage(true))
const validText = (value,max) => value == null || (typeof value==='string' && value.length<=max)
router.post('/week',async(req,res)=>{
    const {week_key,nome,anotacao}=req.body || {}
    if (typeof week_key!=='string' || !/^(?:[1-9]|[1-4]\d|5[0-4])-[1-9]\d{3}$/.test(week_key) || !validText(nome,255) || !nome?.trim() || !validText(anotacao,10000)) return res.status(400).send('Informe uma semana e um responsável válidos.')
    try {
        await scheduleService.upsertWeek({weekKey:week_key,nome:nome.trim(),anotacao:anotacao?.trim() || ''})
        res.sendStatus(200)
    } catch(error) {console.error(error);res.status(500).send('Não foi possível salvar a semana.')}
})
router.post('/day',async(req,res)=>{
    const {data,tipo,nome,anotacao}=req.body || {}
    const validDate=typeof data==='string' && /^\d{4}-\d{2}-\d{2}$/.test(data) && !isNaN(Date.parse(data)) && new Date(data).toISOString().slice(0,10)===data
    if (!validDate || !['sobrescrito','feriado','remover'].includes(tipo) || !validText(nome,255) || !validText(anotacao,10000) || (tipo==='sobrescrito' && !nome?.trim())) return res.status(400).send('Informe uma data e uma configuração válidas.')
    try {
        await scheduleService.upsertDay({data,tipo,nome:tipo==='sobrescrito'?nome.trim():null,anotacao:anotacao?.trim() || ''})
        res.sendStatus(200)
    } catch(error) {console.error(error);res.status(500).send('Não foi possível salvar o dia.')}
})
export default router
