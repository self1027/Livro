import scheduleRepository from '../repositories/scheduleRepository.js';

function getWeekKey(date) {
    const d = new Date(date);
    if (isNaN(d)) return null;

    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDays = Math.floor((d - firstDayOfYear) / 86400000);
    const week = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);

    return `${week}-${d.getFullYear()}`;
}

function getGridStart(year, month) {
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = (firstDay.getDay() + 6) % 7;
    firstDay.setDate(firstDay.getDate() - dayOfWeek);
    return firstDay;
}

const MESES_PTBR = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

async function getCalendar(year, month) {
    const hoje = new Date();
    year = isNaN(year) ? hoje.getFullYear() : year;
    month = isNaN(month) ? hoje.getMonth() : month;

    const startGrid = getGridStart(year, month);
    const weeksSet = new Set();
    const gridDates = [];

    for (let i = 0; i < 42; i++) {
        const d = new Date(startGrid);
        d.setDate(startGrid.getDate() + i);

        const wk = getWeekKey(d);
        if (wk) weeksSet.add(wk);

        gridDates.push(d.toISOString().split('T')[0]);
    }

    const weeksRange = [...weeksSet];

    const semanas = await scheduleRepository.findWeeks(weeksRange);
    const dias = await scheduleRepository.findDays(gridDates[0], gridDates[gridDates.length - 1]);

    return {
        ano: year,
        mes: month,
        mesLabel: `${MESES_PTBR[month]} ${year}`, // para a view
        semanas,
        dias
    };
}

async function upsertWeek({ weekKey, nome, anotacao }) {
    await scheduleRepository.removeWeek(weekKey);
    return scheduleRepository.createWeek({ week_key: weekKey, nome, anotacao });
}

async function upsertDay({ data, tipo, nome, anotacao }) {
    await scheduleRepository.removeDay(data);
    if (tipo !== 'remover') {
        return scheduleRepository.createDay({ data, tipo, nome, anotacao });
    }
}

export default {
    getWeekKey,
    getGridStart,
    getCalendar,
    upsertWeek,
    upsertDay
};