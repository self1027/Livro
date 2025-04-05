const express = require('express')
const router = express.Router()
const denunciationsModel = require('./denunciationsModel')
const reportsModel = require('../reports/reportsModel')
const userModel = require('../users/usersModel')
const DENUNCIATION_SENDER = require('../constants/denunciationSenders')

router.get('/cadastro/denuncia', async (req, res) => {
        try {
            const currentYear = new Date().getFullYear();
    
            const lastDenuncia = await denunciationsModel.findOne({
                where: { year: currentYear },
                order: [['number', 'DESC']]
            });
    
            // Verifica o valor de lastDenuncia
            const nextNumber = (lastDenuncia && lastDenuncia.number) ? lastDenuncia.number + 1 : 1;
    
            res.render('denunciation/new', {
                year: currentYear,
                lastNumber: nextNumber,
                DENUNCIATION_SENDER: DENUNCIATION_SENDER
            });
        } catch (error) {
            console.error('Erro ao carregar dados da denúncia:', error);
            res.status(500).send('Erro ao carregar formulário de denúncia.');
        }
});

// Rota POST para registrar a denúncia
router.post('/denuncia/registrar', async (req, res) => {
        try {
            // Extrai os dados do corpo da requisição (req.body)
            const {
                year,
                number,
                registration_type,
                title,
                endereco,
                numero,
                bairro,
                description
            } = req.body;
    
            // Cria a denúncia no banco de dados
            const newDenuncia = await denunciationsModel.create({
                year,
                number,
                registration_type,
                title,
                endereco,
                numero,
                bairro,
                description,
                status: "Aberta"
            });
    
            // Redireciona para uma página de sucesso
            res.redirect('/');
    
        } catch (error) {
            console.error('Erro ao registrar denúncia:', error);
    
            // Trata erros específicos (ex.: violação de chave única "year + number")
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).send('Já existe uma denúncia com este número no ano atual.');
            }
    
            res.status(500).send('Erro interno ao registrar denúncia.');
        }
});

router.get('/denuncia/:id', async (req, res) => {
        try {
            const denuncia = await denunciationsModel.findByPk(req.params.id);
            
            if (!denuncia) {
                return res.status(404).render('error', {
                    message: 'Denúncia não encontrada'
                });
            }
    
            res.render('denunciation/show', {
                denuncia: denuncia,
                DENUNCIATION_SENDER: DENUNCIATION_SENDER // Não esqueça de importar e passar o objeto
            });
    
        } catch (error) {
            console.error('Erro ao buscar denúncia:', error);
            res.status(500).render('error', {
                message: 'Erro ao carregar denúncia'
            });
        }
});

router.get('/denuncia/:id/edit', async (req, res) => {
        try {
            const denuncia = await denunciationsModel.findByPk(req.params.id);
            
            if (!denuncia) {
                return res.status(404).send('Denúncia não encontrada');
            }
    
            res.render('denunciation/edit', {
                denuncia: denuncia,
                DENUNCIATION_SENDER: DENUNCIATION_SENDER,
                year: denuncia.year,
                lastNumber: denuncia.number
            });
    
        } catch (error) {
            console.error('Erro ao carregar denúncia para edição:', error);
            res.status(500).send('Erro ao carregar formulário de edição');
        }
});

router.get('/atribuir', async (req, res) => {
        try {
            const denuncias = await denunciationsModel.findAll({
                where: { user_id: null },
                include: [
                    {
                        model: reportsModel,
                        as: 'reports',
                        include: [{
                            model: userModel,
                            as: 'user'
                        }]
                    }
                ]
            });
    
            const fiscais = await userModel.findAll();
            
            res.render('denunciation/associate', {
                denuncias: denuncias,
                fiscais: fiscais
            });
    
        } catch (error) {
            console.error('Erro:', error);
            res.status(500).send('Erro ao carregar página');
        }
});

router.post('/atribuir/:denunciaId', async (req, res) => {
        try {
            const { fiscalId } = req.body;
            const { denunciaId } = req.params;
    
            await denunciationsModel.update(
                { user_id: fiscalId },  
                { where: { id: denunciaId } }
            );

            await reportsModel.create({
                denunciation_id: denunciaId,
                user_id: fiscalId,        
                descricao: `Denúncia atribuída ao fiscal ${fiscalId}`,
                status: 'Atribuída'
            });
    
            res.redirect('/atribuir?success=Denúncia+atribuída+com+sucesso');
    
        } catch (error) {
            console.error('Erro ao atribuir fiscal:', error);
            res.redirect('/atribuir?error=Erro+ao+atribuir+fiscal');
        }
});
    

module.exports = router