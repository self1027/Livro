import test from 'node:test'
import assert from 'node:assert/strict'
import {updateEnvironment,validateConfiguration,runAuthMigration} from '../src/database/authMigrationScript.js'

test('ativação preserva configuração e comentários e elimina duplicatas de AUTH_ENABLED',()=>{
    const source='# Configuração existente\r\nDB_PASSWORD="valor#preservado"\r\nAUTH_ENABLED=false # preparação\r\nCUSTOM_OPTION=yes\r\nexport AUTH_ENABLED=false\r\n'
    const result=updateEnvironment(source,{AUTH_ENABLED:'true',APP_URL:'https://livro.example.gov.br',AUTH_COOKIE_SECURE:'true'})
    assert.ok(result.includes('DB_PASSWORD="valor#preservado"\r\n'))
    assert.ok(result.includes('CUSTOM_OPTION=yes\r\n'))
    assert.equal(result.match(/AUTH_ENABLED=/g).length,1)
    assert.ok(result.includes('AUTH_ENABLED=true\r\n'))
    assert.equal(updateEnvironment(result,{AUTH_ENABLED:'true',APP_URL:'https://livro.example.gov.br',AUTH_COOKIE_SECURE:'true'}),result)
})
test('validação recusa configuração insegura antes de acessar o banco ou gravar arquivos',async()=>{
    assert.deepEqual(validateConfiguration({APP_URL:'https://livro.example.gov.br/'}),{APP_URL:'https://livro.example.gov.br',AUTH_COOKIE_SECURE:'true'})
    assert.deepEqual(validateConfiguration({APP_URL:'http://localhost:80',AUTH_COOKIE_SECURE:'false'}),{APP_URL:'http://localhost',AUTH_COOKIE_SECURE:'false'})
    for(const configuration of [
        {},{APP_URL:'http://livro.example.gov.br',AUTH_COOKIE_SECURE:'false'},
        {APP_URL:'https://livro.example.gov.br',AUTH_COOKIE_SECURE:'false'},
        {APP_URL:'http://localhost',AUTH_COOKIE_SECURE:'false',NODE_ENV:'production'},
        {APP_URL:'https://user:password@livro.example.gov.br'},
        {APP_URL:'https://livro.example.gov.br/subpath'}
    ])await assert.rejects(runAuthMigration({configuration}))
})
