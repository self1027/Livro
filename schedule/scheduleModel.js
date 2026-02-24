const sequelize = require('sequelize');
const connection = require('../database/database.js');

const schedule = connection.define('schedules', {

    week_key: {
        type: sequelize.STRING, // ex: "09-2026"
        allowNull: true
    },

    data: {
        type: sequelize.DATEONLY,
        allowNull: true
    },

    tipo: {
        type: sequelize.ENUM('semana', 'sobrescrito', 'feriado'),
        allowNull: false
    },

    nome: {
        type: sequelize.STRING,
        allowNull: true
    },

    anotacao: {
        type: sequelize.TEXT,
        allowNull: true
    },

    created_at: {
        type: sequelize.DATE,
        defaultValue: sequelize.NOW
    }

}, {
    indexes: [
        { fields: ['week_key'] },
        { fields: ['data'] }
    ]
});

schedule.sync();
module.exports = schedule;