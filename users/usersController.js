const express = require('express')
const router = express.Router()
const userModel = require('./usersModel')
const denunciation = require('../denunciations/denunciationsModel')

router.get('/cadastro/usuario', (req, res) => {
    userModel.findAll().then(username =>{
        res.render('users/new', {
            username : username
        })
    })
})

router.post('/usuario/registrar', (req, res) => {
    var username = req.body.username
    if(!username){
        return res.redirect('/')
    }
    userModel.create({
        name: username
    }).then(() => {
        res.redirect('/cadastro/usuario')
    })

})

router.get('/area-fiscal', async (req, res) => {
    try {
        // Busca os fiscais no banco de dados (assumindo que são os usuários com cargo de fiscal)
        const fiscais = await userModel.findAll({
            attributes: ['id', 'name']  // Busca os campos id e nome
        });

        // Passa os fiscais para a view
        res.render('users/select', {
            fiscais: fiscais
        });
    } catch (error) {
        console.error('Erro ao buscar fiscais:', error);
        res.status(500).send('Erro ao buscar fiscais.');
    }
});

router.get('/area-fiscal/:id', async (req, res) => {
    try {
        const fiscalId = req.params.id;

        // Buscar o fiscal pelo ID
        const fiscal = await userModel.findByPk(fiscalId);
        
        // Se o fiscal não for encontrado, retorna erro
        if (!fiscal) {
            return res.status(404).render('error', {
                message: 'Fiscal não encontrado.'
            });
        }

        // Buscar todas as denúncias atribuídas ao fiscal
        const denuncias = await denunciation.findAll({
            where: {
                user_id: fiscalId // Considerando que você tenha a coluna userId na tabela Denunciation
            }
        });

        // Renderiza a página da área do fiscal com os dados do fiscal e suas denúncias
        return res.render('users/home', {
            fiscal,
            denuncias
        });
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            message: 'Erro ao carregar os dados do fiscal.'
        });
    }
});

module.exports = router