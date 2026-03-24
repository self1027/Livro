import Sequelize from 'sequelize'
import connection from '../database/database.js'

const user = connection.define('users', {
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    ativo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
})

export default user