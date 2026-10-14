import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {fileURLToPath} from 'node:url'
import service from '../src/services/denunciationsService.js'
import repo from '../src/repositories/denunciationsRepository.js'
import districts from '../src/services/districtsService.js'
import router from '../src/controllers/denunciationsController.js'
import {normalizeDenunciationForm,validateDenunciationForm} from '../src/utils/denunciationForm.js'
import SENDERS from '../src/constants/denunciationSenders.js'

const input={year:'2026',number:'123',registration_type:'PESSOA_TELEFONE',title:'Título <teste>',endereco:'das Flores',numero:'s/n',bairro:'Centro',complemento:'Atrás da praça',description:'Descrição <script>teste</script>'}

test('cadastro normaliza campos e valida texto obrigatório e origem no servidor', async () => {
    const form=normalizeDenunciationForm({...input,title:'  Título  ',numero:['12']})
    assert.equal(form.title,'Título')
    assert.equal(form.numero,'')
    const errors=validateDenunciationForm(form,SENDERS)
    assert.ok(errors.numero)
    assert.ok(validateDenunciationForm(normalizeDenunciationForm({...input,title:'  '}),SENDERS).title)
    assert.ok(validateDenunciationForm(normalizeDenunciationForm({...input,registration_type:'UNKNOWN'}),SENDERS).registration_type)
    const result=await service.createDenunciation({...input,description:'  '})
    assert.equal(result.status,400)
    assert.ok(result.fieldErrors.description)
})

test('falhas de cadastro preservam campos, origem e bairro; duplicidade oferece acesso ao registro', async () => {
    const original={getAll:districts.getAll,last:repo.findLastByYear,create:service.createDenunciation}
    districts.getAll=async()=>[{name:'Centro'}]
    repo.findLastByYear=async()=>({number:122})
    let failure={status:400,message:'Revise o bairro.',fieldErrors:{bairro:'Bairro inválido.'}}
    service.createDenunciation=async()=>failure
    const app=express()
    app.set('views',fileURLToPath(new URL('../views/',import.meta.url)))
    app.set('view engine','ejs')
    app.use(express.urlencoded({extended:true}))
    app.use(router)
    const server=app.listen(0)
    await new Promise(resolve=>server.once('listening',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    try{
        const submit=()=>fetch(base+'/denuncias',{method:'POST',body:new URLSearchParams(input)})
        let response=await submit()
        assert.equal(response.status,400)
        let html=await response.text()
        assert.ok(html.includes('value="Título &lt;teste&gt;"'))
        assert.ok(html.includes('value="Centro"'))
        assert.ok(html.includes('value="Atrás da praça"'))
        assert.ok(html.includes('value="PESSOA_TELEFONE" selected'))
        assert.ok(html.includes('Descrição &lt;script&gt;teste&lt;/script&gt;'))
        assert.ok(html.includes('Bairro inválido.'))
        failure={status:409,message:'Já existe uma denúncia para este endereço.',meta:{id:42}}
        response=await submit();html=await response.text()
        assert.equal(response.status,409)
        assert.ok(html.includes('href="/denuncias/42"'))
        assert.ok(html.includes('Ver denúncia existente'))
    }finally{
        districts.getAll=original.getAll;repo.findLastByYear=original.last;service.createDenunciation=original.create
        await new Promise(resolve=>server.close(resolve))
    }
})
