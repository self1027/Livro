const Sequelize = require('sequelize');
const connection = new Sequelize('livro_visa', 'root', 'masterkey', {
    host: '127.0.0.1',
    dialect: 'mysql',
    dialectOptions: {
        connectTimeout: 60000
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    logging: console.log
});

module.exports = connection
