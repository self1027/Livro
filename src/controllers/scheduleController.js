import express from 'express';
import scheduleService from '../services/scheduleService.js';

const router = express.Router();

router.get('/escala', async (req, res) => {
    try {
        const ano = parseInt(req.query.ano);
        const mes = parseInt(req.query.mes);

        const calendar = await scheduleService.getCalendar(ano, mes);
        res.render('schedule/index', calendar);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar calendário');
    }
});

router.post('/escala/semana', async (req, res) => {
    const { week_key, nome, anotacao } = req.body;
    try {
        await scheduleService.upsertWeek({ weekKey: week_key, nome, anotacao });
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar semana');
    }
});

router.post('/escala/dia', async (req, res) => {
    const { data, tipo, nome, anotacao } = req.body;
    try {
        await scheduleService.upsertDay({ data, tipo, nome, anotacao });
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar dia');
    }
});

export default router;