const Sequelize = require('sequelize')
const connection = new Sequelize('livro-visa', 'root', 'masterkey', {
    host: 'localhost',
    dialect:'mysql'
})

module.exports = connection