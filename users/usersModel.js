const sequelize = require('sequelize');
const connection = require('../database/database.js');

const user = connection.define('users', {
    name: {
        type: sequelize.STRING,
        allowNull: false
    }
});

user.sync();
module.exports = user;