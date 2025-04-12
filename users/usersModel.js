const sequelize = require('sequelize');
const connection = require('../database/database.js');  

const user = connection.define('users', {
    name: {
        type: sequelize.STRING,
        allowNull: false
    },
    ativo: {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
});


user.sync();

module.exports = user;