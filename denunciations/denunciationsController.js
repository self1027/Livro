const express = require('express')
const router = express.Router()
const { Op } = require('sequelize');
const denunciationsModel = require('./denunciationsModel')
const reportsModel = require('../reports/reportsModel')
const userModel = require('../users/usersModel')
const DENUNCIATION_SENDER = require('../constants/denunciationSenders')
const DENUNCIATION_STATUS = require('../constants/denunciationStatus')
const dataAtual = new Date().toLocaleDateString('pt-BR');


router.get('/cadastro/denuncia', async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();

        // Verifica se existe QUALQUER denúncia no banco (independente do ano)
        const anyDenuncia = await denunciationsModel.findOne({
            order: [['createdAt', 'ASC']] // Pega a primeira denúncia criada
        });

        // Se NÃO existir nenhuma denúncia no banco, começa com 110
        if (!anyDenuncia) {
            return res.render('denunciation/new', {
                year: currentYear,
                lastNumber: 111, // Número inicial
                DENUNCIATION_SENDER: DENUNCIATION_SENDER
            });
        }

        // Caso contrário, busca a última denúncia do ANO ATUAL
        const lastDenuncia = await denunciationsModel.findOne({
            where: { year: currentYear },
            order: [['number', 'DESC']]
        });

        // Calcula o próximo número (último + 1 ou 1 se for o primeiro do ano)
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
            complemento,
            description
        } = req.body;

        // Verifica se já existe uma denúncia com o mesmo endereço e status diferente de 'Finalizado'
        const existingDenuncia = await denunciationsModel.findOne({
            where: {
                endereco: endereco,
                numero: numero,
                bairro: bairro,
                status: {
                    [Op.ne]: DENUNCIATION_STATUS.FINALIZADA.slug // Op.ne é usado para "diferente de" no Sequelize
                }
            }
        });

        // Se já existir uma denúncia com o mesmo endereço e status não finalizado, retorna erro
        if (existingDenuncia) {
            // Renderiza a página de cadastro novamente, passando a mensagem e o link para a denúncia repetida
            return res.render('denunciation/new', {
                message: `Já existe uma denúncia registrada com este endereço. Você pode visualizar a denúncia em: <a href="/denuncia/${existingDenuncia.id}">Clique aqui para visualizar</a>.`,
                year, // Passa os dados preenchidos no formulário para que não se percam
                lastNumber: number, // Passa o número da última denúncia
                DENUNCIATION_SENDER // Passa as opções de tipos de registro
            });
        }

        // Cria a denúncia no banco de dados
        const newDenuncia = await denunciationsModel.create({
            year,
            number,
            registration_type,
            title,
            endereco,
            numero,
            bairro,
            complemento: complemento || null,
            description,
            status: DENUNCIATION_STATUS.REGISTRADA.slug
        });

        // Redireciona para a página principal ou outra página de sucesso
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
        // Busca a denúncia com os relatórios associados
        const denuncia = await denunciationsModel.findByPk(req.params.id, {
            include: [
                {
                    model: reportsModel,
                    as: 'reports',
                    attributes: ['id', 'description', 'created_at'],
                },
                {
                    model: userModel, // Inclui o fiscal (usuário)
                    as: 'user',
                    attributes: ['name'],
                }
            ]
        });
        
        if (!denuncia) {
            return res.status(404).render('error', {
                message: 'Denúncia não encontrada'
            });
        }
        
        // Renderiza a view 'show' da denúncia, passando os relatórios e dados do fiscal também
        res.render('denunciation/show', {
            denuncia: denuncia,
            reports: denuncia.reports, // Passando os relatórios para a view
            fiscal: denuncia.user, // Passando o fiscal (usuário) para a view
            DENUNCIATION_SENDER: DENUNCIATION_SENDER,
            DENUNCIATION_STATUS: DENUNCIATION_STATUS
        });        

    } catch (error) {
        console.error('Erro ao buscar denúncia:', error);
        res.status(500).render('error', {
            message: 'Erro ao carregar denúncia'
        });
    }
});

router.post('/denuncia/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            registration_type,
            title,
            endereco,
            numero,
            bairro,
            complemento,
            description,
            status
        } = req.body;

        await denunciationsModel.update(
            {
                registration_type,
                title,
                endereco,
                numero,
                bairro,
                complemento,
                description,
                status
            },
            { where: { id } }
        );

        res.redirect(`/denuncia/${id}`);
    } catch (err) {
        console.error('Erro ao atualizar denúncia:', err);
        res.status(500).send('Erro ao atualizar denúncia.');
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
                DENUNCIATION_STATUS: DENUNCIATION_STATUS,
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
    
            const fiscaisValidos = await userModel.findAll({
                where: { ativo: 1 }
            });
            
            res.render('denunciation/associate', {
                denuncias: denuncias,
                fiscais: fiscaisValidos,
                DENUNCIATION_SENDER
            });
    
        } catch (error) {
            console.error('Erro:', error);
            res.status(500).send('Erro ao carregar página');
        }
});

router.post('/atribuir/:denunciaId', async (req, res) => {
        try {
            const { userId } = req.body;
            const { denunciaId } = req.params;
    
            await denunciationsModel.update(
                { user_id: userId },  
                { where: { id: denunciaId } }
            );
            const fiscal = await userModel.findByPk(userId);

            await reportsModel.create({
                denunciation_id: denunciaId,
                user_id: userId,        
                description: `Denúncia atribuída ao fiscal ${fiscal.name} - ${dataAtual}`,
                status: 'Atribuída'
            });
    
            res.redirect('/atribuir?success=Denúncia+atribuída+com+sucesso');
    
        } catch (error) {
            console.error('Erro ao atribuir fiscal:', error);
            res.redirect('/atribuir?error=Erro+ao+atribuir+fiscal');
        }
});

router.get('/atribuir/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const denuncia = await denunciationsModel.findByPk(id, {
            include: [{ model: userModel, as: 'user' }]
        });

        if (!denuncia) {
            req.flash('error', 'Report not found.');
            return res.redirect('/associate');
        }

        const users = await userModel.findAll({
            where: { ativo: true }
        });                

        res.render('denunciation/assign', { denuncia, users });
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred.');
        res.redirect('/associate');
    }
});

router.post('/atribuir/:id', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        const denuncia = await denunciationsModel.findByPk(id);
        if (!denuncia) {
            req.flash('error', 'Report not found.');
            return res.redirect('/associate');
        }

        denuncia.user_id = userId;
        await denuncia.save();

        res.redirect('/atribuir');
    } catch (err) {
        console.error(err);
    }
});

// Rota para exibir a página de busca (inicial)
router.get('/buscar', async (req, res) => {
    try {
        const users = await userModel.findAll({
            order: [['name', 'ASC']]
        });

        res.render('denunciation/search', {
            DENUNCIATION_STATUS,
            DENUNCIATION_SENDER,
            denuncias: [],
            year: '',
            number: '',
            endereco: '',
            numero: '',
            bairro: '',
            status: '',
            registration_type: '',
            userId: '',
            users,
            scroll: false
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        res.status(500).send('Erro ao carregar a página de busca');
    }
});

// Rota para processar a busca
router.get('/buscar/resultados', async (req, res) => {
    try {
        const {
            year,
            number,
            endereco,
            numero,
            bairro,
            status,
            registration_type,
            userId
        } = req.query;

        const whereConditions = {};

        if (year) whereConditions.year = year;
        if (number) whereConditions.number = number;

        if (endereco) {
            // Remove prefixos comuns como "Rua", "Av.", "Travessa", "Praça", etc.
            const cleanEndereco = endereco
                .replace(/^(rua|r\.|avenida|av\.|travessa|praça|estrada|alameda|rodovia)\s*/i, '')
                .trim();

            whereConditions.endereco = {
                [Op.like]: `%${cleanEndereco}%`
            };
        }

        if (numero) whereConditions.numero = numero;
        if (bairro) whereConditions.bairro = { [Op.like]: `%${bairro}%` };
        if (status && status !== 'Selecione') whereConditions.status = status;
        if (registration_type && registration_type !== 'Selecione') whereConditions.registration_type = registration_type;
        if (userId) whereConditions.user_id = userId;

        const users = await userModel.findAll({ order: [['name', 'ASC']] });

        const denuncias = await denunciationsModel.findAll({
            where: whereConditions,
            include: [{
                model: userModel,
                as: 'user',
                attributes: ['name']
            }],
            order: [
                ['year', 'DESC'],
                ['number', 'DESC']
            ]
        });

        res.render('denunciation/search', {
            denuncias,
            DENUNCIATION_STATUS,
            DENUNCIATION_SENDER,
            year,
            number,
            endereco,
            numero,
            bairro,
            status,
            registration_type,
            userId, // mantém o valor selecionado no dropdown
            users,
            scroll: true
        });

    } catch (error) {
        console.error('Erro ao buscar denúncias:', error);
        res.status(500).send('Erro ao buscar denúncias');
    }
});

module.exports = router
