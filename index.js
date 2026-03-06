const express = require('express')
const bodyParser = require('body-parser')
const connection = require('./database/database.js')
const user = require('./users/usersModel.js')
const denunciation = require('./denunciations/denunciationsModel.js')
const report = require('./reports/reportsModel.js')
const pagination = require('./middlewares/pagination')
const setupSwagger = require('./swagger')

const Sequelize = require('sequelize')
const {Op} = require('sequelize')

const DENUNCIATION_SENDER = require('./constants/denunciationSenders.js')

const usersController = require('./users/usersController.js')
const denunciationsController = require('./denunciations/denunciationsController.js')
const reportsController = require('./reports/reportsController.js')
const scheduleController = require('./schedule/scheduleController.js')
const loadingsController = require('./loadings/loadingsController.js')
const districtController = require('./district/districtController.js')

const denunciationsModel = require('./denunciations/denunciationsModel')
const reportsModel = require('./reports/reportsModel')
const userModel = require('./users/usersModel')
const DENUNCIATION_STATUS = require('./constants/denunciationStatus')

const app = express()

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

module.exports = {
	user,
	denunciation,
	report
}

app.use(pagination)

setupSwagger(app)

app.get('/', async (req, res) => {
	try {
		// Pega os parâmetros de offset e limit da query string
		const limit = parseInt(req.query.limit) || 50 // Limite de 50 por padrão
		const offset = parseInt(req.query.offset) || 0

		const denuncias = await denunciation.findAll({
			include: [{
				model: user,
				as: 'user',
				attributes: ['name']
			}],
			order: [
				['year', 'DESC'], // Ordena os anos em ordem decrescente
				['number', 'DESC'] // Para cada ano, ordena os números em ordem decrescente
			],
			limit: limit,
			offset: offset
		})

		// Retorna a renderização da página inicial
		res.render('index', {
			denuncias: denuncias,
			DENUNCIATION_SENDER: DENUNCIATION_SENDER,
			offset: offset + limit, // Passa o próximo offset
			limit: limit
		})

	} catch (error) {
		console.error('Erro ao buscar denúncias:', error) 
		res.status(500).send('Erro ao carregar denúncias.') 
	}
}) 

app.use('/', usersController, denunciationsController, reportsController, loadingsController, scheduleController, districtController)

app.get('/aif', (req, res) => {
	res.render('aif_helper/index.ejs')
})

app.get('/escala', (req, res) => {
	res.render('schedule/index.ejs')
})

app.get('/admin', async (req, res) => {

	try {

		const yearsRaw = await denunciationsModel.findAll({
			attributes: [
				[Sequelize.fn('DISTINCT', Sequelize.col('year')), 'year']
			],
			order: [
				['year', 'DESC']
			]
		}) 

		const years = yearsRaw.map(y => y.year) 

		if (years.length === 0) {
			return res.render('admin/index.ejs', {
				year: null,
				years: [],
				stats: {
					total: 0,
					andamento: 0,
					resolvidas: 0,
					semFiscal: 0
				},
				statusStats: [],
				reports: [],
				bairros: [],
				meses: []
			}) 
		}

		let year = parseInt(req.query.year) 

		if (!years.includes(year)) {
			year = years[0] 
		}

		const total = await denunciationsModel.count({
			where: {
				year
			}
		})

		const andamento = await denunciationsModel.count({
			where: {
				year: year, // Filtro de ano que você já possui
				status: {
					[Op.notIn]: [
						DENUNCIATION_STATUS.REGISTRADA.slug,
						DENUNCIATION_STATUS.PENDENTE.slug,
						DENUNCIATION_STATUS.FINALIZADA.slug
					]
				}
			},
		})

		const resolvidas = await denunciationsModel.count({
			where: {
				year,
				status: DENUNCIATION_STATUS.FINALIZADA.slug
			}
		}) 

		const semFiscal = await denunciationsModel.count({
			where: {
				year,
				user_id: null
			}
		}) 

		const stats = {
			total,
			andamento,
			resolvidas,
			semFiscal
		} 

		const statusStats = [] 

		for (const key in DENUNCIATION_STATUS) {

			const status = DENUNCIATION_STATUS[key] 

			const count = await denunciationsModel.count({
				where: {
					year,
					status: status.slug
				}
			}) 

			statusStats.push({
				label: status.label,
				color: status.color,
				count
			}) 

		}

		const mesesRaw = await denunciationsModel.findAll({

			attributes: [
				[Sequelize.fn('MONTH', Sequelize.col('created_at')), 'mes'],
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']
			],

			where: {
				year
			},

			group: ['mes'],
			order: [
				['mes', 'ASC']
			]

		}) 

		const meses = new Array(12).fill(0) 

		mesesRaw.forEach(m => {
			meses[m.dataValues.mes - 1] = parseInt(m.dataValues.total) 
		}) 

		const bairrosRaw = await denunciationsModel.findAll({

			attributes: [
				'bairro',
				[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']
			],

			where: {
				year
			},

			group: ['bairro'],
			order: [
				[Sequelize.literal('total'), 'DESC']
			],
			limit: 10

		}) 

		const bairros = bairrosRaw.map(b => ({
			bairro: b.bairro,
			total: b.dataValues.total
		})) 

		const reportsRaw = await reportsModel.findAll({

			include: [{
					model: denunciationsModel,
					as: 'denunciation',
					where: {
						year
					}
				},
				{
					model: userModel,
					as: 'user',
					attributes: ['name']
				}
			],

			order: [
				['created_at', 'DESC']
			]

		}) 

		const seen = new Set() 
		const reports = [] 

		for (const r of reportsRaw) {

			if (!seen.has(r.denunciation.id)) {

				seen.add(r.denunciation.id) 
				reports.push(r) 

			}

			if (reports.length >= 10) break 
		}

		res.render('admin/index.ejs', {
			year,
			years,
			stats,
			statusStats,
			reports,
			bairros,
			meses
		}) 

	} catch (error) {

		console.error(error) 
		res.status(500).send("Erro ao carregar painel administrativo") 

	}

}) 

app.listen(80, () => {
	console.log('Swagger UI available at http://localhost/api-docs') 
})