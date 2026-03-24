import Sequelize from 'sequelize'
import connection from '../database/database.js'

const report = connection.define('reports', {
    description: {
        type: Sequelize.TEXT
    },
    created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    denunciation_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    type: {
        type: Sequelize.INTEGER,
        allowNull: false
    }
})

export default report