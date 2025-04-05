const express = require('express')
const bodyParser = require('body-parser')
const connection = require('./database/database.js')
const user = require('./users/usersModel.js');
const denunciation = require('./denunciations/denunciationsModel.js');
const report = require('./reports/reportsModel.js');

const DENUNCIATION_SENDER = require('./constants/denunciationSenders.js');

const usersController = require('./users/usersController.js')
const denunciationsController = require('./denunciations/denunciationsController.js')

const app = express()

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

app.get('/', async (req, res) => {
    try {
        // Busca todas as denúncias no banco de dados
        const denuncias = await denunciation.findAll({
            order: [['created_at', 'DESC']] // Ordena por data de criação (mais recente primeiro)
        });

        // Renderiza a view 'index' passando as denúncias como variável
        res.render('index', { 
            denuncias: denuncias,
            DENUNCIATION_SENDER: DENUNCIATION_SENDER 
        });

    } catch (error) {
        console.error('Erro ao buscar denúncias:', error);
        res.status(500).send('Erro ao carregar denúncias.');
    }
});

app.use('/', usersController, denunciationsController)

app.listen(3000, () => {
    console.log('Server On')
})