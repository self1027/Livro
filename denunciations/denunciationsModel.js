const sequelize = require('sequelize');
const connection = require('../database/database.js');

const denunciation = connection.define('denunciations', {
    year: {
        type: sequelize.INTEGER,
        allowNull: false
    },
    number: {
        type: sequelize.INTEGER,
        allowNull: false
    },
    registration_type: {
        type: sequelize.STRING
    },
    status: {
        type: sequelize.STRING
    },
    title: {
        type: sequelize.STRING,
        allowNull: false
    },
    description: {
        type: sequelize.TEXT,
        allowNull: false
    },
    endereco: {
        type: sequelize.STRING,
        allowNull: false
    },
    numero: {
        type: sequelize.STRING,
        allowNull: false
    },
    bairro: {
        type: sequelize.STRING,
        allowNull: false
    },
    complemento: {
        type: sequelize.STRING,
        allowNull: true
    },
    created_at: {
        type: sequelize.DATE,
        defaultValue: sequelize.NOW
    },
    user_id: {  // Apenas mudei de userId para user_id
        type: sequelize.INTEGER,
        allowNull: true
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['year', 'number']
        }
    ]
});

denunciation.sync();
module.exports = denunciation;