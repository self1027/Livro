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
    created_at: {
        type: sequelize.DATE,
        defaultValue: sequelize.NOW
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['year', 'number']
        }
    ]
});

denunciation.sync()

module.exports = denunciation;