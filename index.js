const express = require('express')
const bodyParser = require('body-parser')
const connection = require('./database/database.js')
const user = require('./users/usersModel.js');
const denunciation = require('./denunciations/denunciationsModel.js');
const report = require('./reports/reportsModel.js');
const pagination = require('./middlewares/pagination');
const setupSwagger = require('./swagger');

const DENUNCIATION_SENDER = require('./constants/denunciationSenders.js');

const usersController = require('./users/usersController.js')
const denunciationsController = require('./denunciations/denunciationsController.js')
const reportsController = require('./reports/reportsController.js')
const loadingsController = require('./loadings/loadingsController.js')

const app = express()

setupSwagger(app);

// View Engine
app.set('view engine', 'ejs')

// Static
app.use(express.static('public'))

// Body Parser
app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json())

// Database
connection.authenticate().then(() => {
    console.log('Conexão feita com sucesso')
}).catch((error) => {
    console.log(error)
})

// Relacionamentos
user.hasMany(denunciation, { foreignKey: 'user_id' });
denunciation.belongsTo(user, { foreignKey: 'user_id' });

denunciation.hasMany(report, { foreignKey: 'denunciation_id' });
report.belongsTo(denunciation, { foreignKey: 'denunciation_id' });

user.hasMany(report, { foreignKey: 'user_id' });
report.belongsTo(user, { foreignKey: 'user_id' });

module.exports = {
    user,
    denunciation,
    report
};

app.use(pagination);

app.get('/', async (req, res) => {
    try {
        // Pega os parâmetros de offset e limit da query string
        const limit = parseInt(req.query.limit) || 50;  // Limite de 50 por padrão
        const offset = parseInt(req.query.offset) || 0;  // Offset começa de 0

        // Busca as denúncias com base no offset e limit
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
        });

        // Retorna a renderização da página inicial
        res.render('index', { 
            denuncias: denuncias,
            DENUNCIATION_SENDER: DENUNCIATION_SENDER,
            offset: offset + limit, // Passa o próximo offset
            limit: limit
        });

    } catch (error) {
        console.error('Erro ao buscar denúncias:', error);
        res.status(500).send('Erro ao carregar denúncias.');
    }
});

app.use('/', usersController, denunciationsController, reportsController, loadingsController)

app.listen(80, () => {
    console.log('Server On')
    console.log('Swagger UI available at http://localhost/api-docs');
})