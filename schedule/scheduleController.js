const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const scheduleModel = require('./scheduleModel');

function getWeekKey(date) {
    const d = new Date(date);
    if (isNaN(d)) return null;

    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDays = Math.floor((d - firstDayOfYear) / 86400000);
    const week = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);

    return `${week}-${d.getFullYear()}`;
}

function getGridStart(ano, mes) {
    const primeiroDia = new Date(ano, mes, 1);
    const diaSemana = (primeiroDia.getDay() + 6) % 7;
    primeiroDia.setDate(primeiroDia.getDate() - diaSemana);
    return primeiroDia;
}

router.get('/escala', async (req, res) => {
    try {

        let ano = parseInt(req.query.ano);
        let mes = parseInt(req.query.mes);

        const hoje = new Date();

        if (isNaN(ano)) ano = hoje.getFullYear();
        if (isNaN(mes)) mes = hoje.getMonth();

        const inicioGrid = getGridStart(ano, mes);

        const semanasSet = new Set();
        const datasGrid = [];

        for (let i = 0; i < 42; i++) {
            const d = new Date(inicioGrid);
            d.setDate(inicioGrid.getDate() + i);

            const wk = getWeekKey(d);
            if (wk) semanasSet.add(wk);

            datasGrid.push(d.toISOString().split('T')[0]);
        }

        const semanasRange = [...semanasSet];

        const semanas = await scheduleModel.findAll({
            where: {
                tipo: 'semana',
                week_key: { [Op.in]: semanasRange }
            }
        });

        const dias = await scheduleModel.findAll({
            where: {
                tipo: { [Op.in]: ['sobrescrito', 'feriado'] },
                data: {
                    [Op.between]: [
                        datasGrid[0],
                        datasGrid[datasGrid.length - 1]
                    ]
                }
            }
        });

        res.render('schedule/index', {
            ano,
            mes,
            semanas,
            dias
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar calendário");
    }
});

router.post('/escala/semana', async (req,res)=>{

    const { week_key, nome, anotacao } = req.body;

    await scheduleModel.destroy({
        where:{ week_key, tipo:'semana' }
    });

    await scheduleModel.create({
        week_key,
        tipo:'semana',
        nome,
        anotacao
    });

    res.sendStatus(200);
});

router.post('/escala/dia', async (req,res)=>{

    const { data, tipo, nome, anotacao } = req.body;

    await scheduleModel.destroy({
        where:{ data }
    });

    if(tipo !== 'remover'){
        await scheduleModel.create({
            data,
            tipo,
            nome,
            anotacao
        });
    }

    res.sendStatus(200);
});

module.exports = router;