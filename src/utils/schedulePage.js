import scheduleService from '../services/scheduleService.js'

export function schedulePage(editable) {
    return async (req,res) => {
        const {ano,mes} = req.query
        if ((ano != null && (typeof ano !== 'string' || !/^[1-9]\d{3}$/.test(ano))) || (mes != null && (typeof mes !== 'string' || !/^\d{1,2}$/.test(mes) || Number(mes)>11))) return res.status(400).send('Ano ou mês inválido.')
        try {
            const calendar = await scheduleService.getCalendar(ano == null ? NaN : Number(ano),mes == null ? NaN : Number(mes))
            res.render('schedule/index',{...calendar,editable,basePath:editable?'/admin/schedule':'/escala'})
        } catch (error) {
            console.error('Erro ao carregar escala:',error)
            res.status(500).send('Não foi possível carregar a escala.')
        }
    }
}
