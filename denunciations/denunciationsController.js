const express = require('express')
const router = express.Router()
const denunciationsModel = require('./denunciationsModel')

router.get('/cadastro/denuncia', (req, res) => {
    denunciationsModel.findAll().then(denunciation =>{
        res.render('', {
            denunciation : denunciation
        })
    })
})

module.exports = router