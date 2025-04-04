const sequelize = require('sequelize');
const connection = require('../database/database.js');

const report = connection.define('reports', {
    description: {
        type: sequelize.TEXT
    },
    created_at: {
        type: sequelize.DATE,
        defaultValue: sequelize.NOW
    }
});

report.sync()

module.exports = report;