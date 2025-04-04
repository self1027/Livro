const express = require('express')
const bodyParser = require('body-parser')
const connection = require('./database/database.js')
const user = require('./users/usersModel.js');
const denunciation = require('./denunciations/denunciationsModel.js');
const report = require('./reports/reportsModel.js');

const usersController = require('./users/usersController.js')
//const denunciationsController = require('./denunciations/denunciationsController.js')

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

// Configura os relacionamentos
user.hasMany(denunciation);       // Um usuário tem muitas denúncias
denunciation.belongsTo(user);     // Uma denúncia pertence a um usuário

denunciation.hasMany(report);     // Uma denúncia tem muitos relatórios
report.belongsTo(denunciation);   // Um relatório pertence a uma denúncia

user.hasMany(report);             // Um usuário tem muitos relatórios
report.belongsTo(user);           // Um relatório pertence a um usuário

module.exports = {
    user,
    denunciation,
    report
};

app.get('/', (req, res) => {
    res.render('index')
})

app.use('/', usersController)

app.listen(3000, () => {
    console.log('Server On')
})