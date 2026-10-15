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
import adminScheduleController from './controllers/adminScheduleController.js'
import adminStaffController from './controllers/adminStaffController.js'
import usersController from './controllers/usersController.js'
import catalogController from './controllers/catalogController.js'
import catalogService from './services/catalogService.js'
import { reportDetails, senderDetails } from './utils/catalogRegistry.js'
import {authContext,protectRoutes,authEnabled} from './auth/middleware.js'
import {authRouter,accessRouter} from './auth/controller.js'
import {assertAuthReady} from './auth/service.js'
import {migrateReportOperations} from './database/migrateReportOperations.js'
import {migrateDenunciationCreators} from './database/migrateDenunciationCreators.js'


const app = express()
if(process.env.TRUST_PROXY==='true')app.set('trust proxy',1)

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.set('views', path.join(__dirname, '../views'))
app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, '../public')))

// Body Parser
app.use(bodyParser.urlencoded({
	extended: true
}))
app.use(bodyParser.json())
app.use(authContext)
app.use(authRouter)
app.use(protectRoutes)
app.use(accessRouter)

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

app.use(async (req, res, next) => {
    try {
        await catalogService.refresh()
        res.locals.REPORT_DETAILS = reportDetails
        res.locals.SENDER_DETAILS = senderDetails
        next()
    } catch (error) {
        console.error('Erro ao carregar configurações:', error)
        res.status(503).send('Não foi possível carregar as configurações. Tente novamente.')
    }
})

setupSwagger(app)

app.use('/', adminController)
app.use('/', catalogController)
app.use('/', denunciationsController)
app.use('/', denunciationsApiController)
app.use('/', denunciarionsExportController)
app.use('/', districtController)
app.use('/', reportsController)
app.use('/', scheduleController)
app.use('/admin/schedule',adminScheduleController)
app.use('/admin',adminStaffController)
app.use('/', usersController)

app.use((error,req,res,next)=>{
    console.error('Falha na requisição:',error.name)
    if(res.headersSent)return next(error)
    if(req.path.startsWith('/api/'))return res.status(500).json({error:'Não foi possível concluir a operação.'})
    res.status(500).send('Não foi possível concluir a operação. Tente novamente.')
})

try {
    await connection.authenticate()
    if(authEnabled())await assertAuthReady()
    // Authentication tables are managed exclusively by the explicit migration.
    const models=connection.modelManager.getModelsTopoSortedByForeignKey()
    if(!models)throw new Error('Dependências circulares entre tabelas.')
    for(const model of models.reverse())if(!model.tableName.startsWith('auth_'))await model.sync()
    await migrateReportOperations()
    await migrateDenunciationCreators()
    await catalogService.initialize()
    app.listen(80, () => console.log('Livro disponível em http://localhost'))
} catch (error) {
    console.error('Não foi possível inicializar o Livro:', error)
    await connection.close()
    process.exitCode = 1
}
