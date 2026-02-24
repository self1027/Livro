const sequelize = require('sequelize');
const connection = require('../database/database.js');

const report = connection.define('reports', {
    description: {
        type: sequelize.TEXT
    },
    created_at: {
        type: sequelize.DATE,
        defaultValue: sequelize.NOW
    },
    denunciation_id: {
        type: sequelize.INTEGER,
        allowNull: false
    },
    user_id: {
        type: sequelize.INTEGER,
        allowNull: false
    },
    type: {
        type: sequelize.INTEGER,
        allowNull: false
    }
});

report.sync();
module.exports = report;