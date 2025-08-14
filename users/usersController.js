const express = require('express')
const router = express.Router()
const userModel = require('./usersModel')
const denunciation = require('../denunciations/denunciationsModel')
const reportsModel = require('../reports/reportsModel')
const denunciationStatus = require('../constants/denunciationStatus')

router.get('/cadastro/usuario', async (req, res) => {
    try {
        const users = await userModel.findAll({
            order: [['name', 'ASC']]
        });

        res.render('users/new', {
            username: users // cada item já inclui .name e .active
        });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).render('error', { message: 'Erro ao carregar usuários.' });
    }
});

router.post('/usuario/registrar', async (req, res) => {
    var username = req.body.username
    if(!username){
        return res.redirect('/')
    }
    await userModel.create({
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
        const selectedStatus = req.query.status || 'REGISTRADA';
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        const fiscal = await userModel.findByPk(fiscalId);
        if (!fiscal) {
            return res.status(404).render('error', {
                message: 'Fiscal não encontrado.'
            });
        }

        const denuncias = await denunciation.findAll({
            where: {
                user_id: fiscalId,
                ...(selectedStatus !== 'ALL' && { status: selectedStatus })
            },
            include: [
                {
                    model: reportsModel,
                    as: 'reports',
                    required: false
                }
            ],
            order: [
                ['year', 'DESC'],   // primeiro por ano
                ['number', 'DESC']  // depois por número
            ],
            limit,
            offset
        });        

        const total = await denunciation.count({
            where: {
                user_id: fiscalId,
                ...(selectedStatus !== 'ALL' && { status: selectedStatus })
            }
        });

        const hasMore = offset + limit < total;

        return res.render('users/home', {
            fiscal,
            denuncias,
            selectedStatus,
            hasMore,
            nextPage: page + 1
        });

    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            message: 'Erro ao carregar os dados do fiscal.'
        });
    }
});

router.get('/editar-usuario/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const user = await userModel.findByPk(id);

        console.log(user)

        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado.' });
        }

        res.render('users/edit', { user });
    } catch (error) {
        console.error('Erro ao carregar o usuário para edição:', error);
        res.status(500).render('error', { message: 'Erro ao carregar usuário para edição.' });
    }
});

router.post('/usuario/atualizar/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        const user = await userModel.findByPk(id);

        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado.' });
        }

        user.name = name;

        // Se checkbox veio marcada, inverte o valor atual de `active`
        if (req.body.active !== undefined) {
            user.ativo = !user.ativo;
        }

        await user.save();
        res.redirect('/cadastro/usuario');
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).render('error', { message: 'Erro ao atualizar o usuário.' });
    }
});

module.exports = router