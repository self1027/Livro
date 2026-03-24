import { Op } from 'sequelize'
import Schedule from '../models/scheduleModel.js'

async function findWeeks(weekKeys) {
    return Schedule.findAll({
        where: {
            tipo: 'semana',
            week_key: { [Op.in]: weekKeys }
        }
    });
}

async function findDays(startDate, endDate) {
    return Schedule.findAll({
        where: {
            tipo: { [Op.in]: ['sobrescrito', 'feriado'] },
            data: { [Op.between]: [startDate, endDate] }
        }
    });
}

async function removeWeek(weekKey) {
    return Schedule.destroy({
        where: { week_key: weekKey, tipo: 'semana' }
    });
}

async function createWeek(data) {
    return Schedule.create({ ...data, tipo: 'semana' });
}

async function removeDay(date) {
    return Schedule.destroy({
        where: { data: date }
    });
}

async function createDay(data) {
    return Schedule.create(data);
}

export default {
    findWeeks,
    findDays,
    removeWeek,
    createWeek,
    removeDay,
    createDay
};