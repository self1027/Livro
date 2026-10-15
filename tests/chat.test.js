import test from 'node:test'
import assert from 'node:assert/strict'
import {positiveId,messageInput} from '../src/services/chatService.js'

test('recados validam IDs estritos, tamanho e identificador de repetição',()=>{
    for(const value of ['1','2147483647',2])assert.equal(positiveId(value),Number(value))
    for(const value of [0,-1,'01','1.0','1e2',' 1','2147483648',[],{},true,null])assert.throws(()=>positiveId(value),/inválido/)
    const input={body:'  Olá, equipe!  ',clientId:'client-message-123',denunciationId:'2'}
    assert.deepEqual(messageInput(input),{body:'Olá, equipe!',clientId:input.clientId,denunciationId:2})
    assert.equal(messageInput({body:'x'.repeat(8000),clientId:input.clientId}).body.length,8000)
    for(const body of ['', '   ',null,{},'x'.repeat(8001)])assert.throws(()=>messageInput({...input,body}),/mensagem/)
    for(const clientId of [undefined,'short','x'.repeat(81),'invalid/id'])assert.throws(()=>messageInput({...input,clientId}),/Identificador/)
    assert.throws(()=>messageInput({...input,denunciationId:'1 OR 1'}),/Denúncia inválido/)
})
