import express from 'express'
import bodyParser from 'body-parser'
import connection from './database/database.js'

import user from './models/usersModel.js'
import denunciation from './models/denunciationsModel.js'
import report from './models/reportsModel.js'

import pagination from './middlewares/pagination.js'
import setupSwagger from '../swagger.js'

// Controllers
import adminController from './controllers/adminController.js'
import denunciationsController from './controllers/denunciationsController.js'
import denunciationsApiController from './controllers/denunciationsApiController.js'
import denunciarionsExportController from './controllers/denunciationsExportController.js'
import districtController from './controllers/districtsController.js'
import reportsController from './controllers/reportsController.js'
import scheduleController from './controllers/scheduleController.js'
import usersController from './controllers/usersController.js'


const app = express()

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.set('views', path.join(__dirname, '../views'))
app.set('view engine', 'ejs')

app.use(express.static('public'))

// Body Parser
app.use(bodyParser.urlencoded({
	extended: true
}))
app.use(bodyParser.json())

connection.authenticate().then(() => {
	console.log('Conexão feita com sucesso')
}).catch((error) => {
	console.log(error)
})

connection.sync().then(() => {
	console.log('Tabelas sincronizadas com sucesso')
})

user.hasMany(denunciation, {
	foreignKey: 'user_id'
})
denunciation.belongsTo(user, {
	foreignKey: 'user_id'
})

denunciation.hasMany(report, {
	foreignKey: 'denunciation_id'
})
report.belongsTo(denunciation, {
	foreignKey: 'denunciation_id'
})

user.hasMany(report, {
	foreignKey: 'user_id'
})
report.belongsTo(user, {
	foreignKey: 'user_id'
})

export default {
	user,
	denunciation,
	report
}

app.use(pagination)

setupSwagger(app)

app.use('/', adminController)
app.use('/', denunciationsController)
app.use('/', denunciationsApiController)
app.use('/', denunciarionsExportController)
app.use('/', districtController)
app.use('/', reportsController)
app.use('/', scheduleController)
app.use('/', usersController)

app.get('/aif', (req, res) => {
	res.render('aif_helper/index.ejs')
})

app.get('/GA', (req, res) => {
	res.render('foodstuff/index.ejs')
})

app.listen(80, () => {
	console.log('Swagger UI available at http://localhost/api-docs') 
})