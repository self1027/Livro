const Sequelize = require('sequelize');
const connection = new Sequelize('livro-visa', 'root', 'masterkey', {
    host: '127.0.0.1', // Use IP explícito
    dialect: 'mysql',
    dialectOptions: {
        connectTimeout: 60000 // Para servidores lentos
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    logging: console.log // Ative apenas em desenvolvimento
});

module.exports = connection
