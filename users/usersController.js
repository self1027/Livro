const express = require('express')
const router = express.Router()
const userModel = require('./usersModel')

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

module.exports = router