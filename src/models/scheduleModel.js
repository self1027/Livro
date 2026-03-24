import Sequelize from 'sequelize'
import connection from '../database/database.js'

const schedule = connection.define('schedules', {
    week_key: {
        type: Sequelize.STRING,
        allowNull: true
    },

    data: {
        type: Sequelize.DATEONLY,
        allowNull: true
    },

    tipo: {
        type: Sequelize.ENUM('semana', 'sobrescrito', 'feriado'),
        allowNull: false
    },

    nome: {
        type: Sequelize.STRING,
        allowNull: true
    },

    anotacao: {
        type: Sequelize.TEXT,
        allowNull: true
    },

    created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }

})

export default schedule