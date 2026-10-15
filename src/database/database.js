import '../environment.js'
import Sequelize from 'sequelize'

const connection = new Sequelize(process.env.DB_NAME||'livro_visa', process.env.DB_USER||'root', process.env.DB_PASSWORD??'masterkey', {
    host: process.env.DB_HOST||'127.0.0.1',
    port: Number(process.env.DB_PORT||3306),
    logging: process.env.DB_LOG_SQL==='true'?console.log:false,
    dialect: 'mysql',
    dialectOptions: {
        connectTimeout: 60000
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
})

export default connection
