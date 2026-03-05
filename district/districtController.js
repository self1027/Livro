const express = require('express')
const router = express.Router()

const districtModel = require('./districtModel')
const slugify = require('slugify')

router.get('/cadastro/bairro', async (req, res) => {

    try {

        const districts = await districtModel.findAll({
            order: [['name', 'ASC']]
        })

        res.render('district/index', {
            districts
        })

    } catch (error) {

        console.error('Erro ao carregar bairros:', error)
        res.status(500).send('Erro ao carregar bairros')

    }

})

router.post('/bairro/registrar', async (req, res) => {

    try {

        const { name } = req.body

        const slug = slugify(name, {
            lower: true,
            strict: true,
            locale: 'pt'
        })

        await districtModel.create({
            name,
            slug
        })

        res.redirect('/cadastro/bairro')

    } catch (error) {

        console.error('Erro ao criar bairro:', error)
        res.status(500).send('Erro ao criar bairro')

    }

})

router.get('/editar-bairro/:id', async (req, res) => {

    try {

        const district = await districtModel.findByPk(req.params.id)

        if (!district) {
            return res.status(404).send('Bairro não encontrado')
        }

        res.render('district/edit', {
            district
        })

    } catch (error) {

        console.error('Erro ao carregar bairro:', error)
        res.status(500).send('Erro ao carregar bairro')

    }

})

router.post('/bairro/atualizar/:id', async (req, res) => {

    try {

        const { name } = req.body
        const { id } = req.params

        const slug = slugify(name, {
            lower: true,
            strict: true,
            locale: 'pt'
        })

        await districtModel.update(
            {
                name,
                slug
            },
            {
                where: { id }
            }
        )

        res.redirect('/cadastro/bairro')

    } catch (error) {

        console.error('Erro ao atualizar bairro:', error)
        res.status(500).send('Erro ao atualizar bairro')

    }

})

router.post('/bairro/deletar/:id', async (req, res) => {

    try {

        const { id } = req.params

        await districtModel.destroy({
            where: { id }
        })

        res.redirect('/cadastro/bairro')

    } catch (error) {

        console.error('Erro ao deletar bairro:', error)
        res.status(500).send('Erro ao deletar bairro')

    }

})

module.exports = router