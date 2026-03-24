import Sequelize from 'sequelize'
import connection from '../database/database.js'

const denunciation = connection.define('denunciations', {
    year: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    number: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    registration_type: {
        type: Sequelize.STRING
    },
    status: {
        type: Sequelize.STRING
    },
    title: {
        type: Sequelize.STRING,
        allowNull: false
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    endereco: {
        type: Sequelize.STRING,
        allowNull: false
    },
    numero: {
        type: Sequelize.STRING,
        allowNull: false
    },
    bairro: {
        type: Sequelize.STRING,
        allowNull: false
    },
    complemento: {
        type: Sequelize.STRING,
        allowNull: true
    },
    created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
    },
    user_id: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
},  {
    underscored: true,   // converte automaticamente createdAt -> created_at
    timestamps: true,
    updatedAt: false     // DESABILITA updatedAt, pois não existe no seu banco
})

export default denunciation