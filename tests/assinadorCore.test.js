import test from 'node:test'
import assert from 'node:assert/strict'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {unlink} from 'node:fs/promises'
import {PauseException,Rules,RunPolicy,SignatureEvidence,TeamQueue,Workflow,formatPortalError,isPortalInstability} from '../src/assinador/core.js'
import {isNetworkFailure,withNetworkRetry} from '../src/assinador/resilience.js'

test('formatPortalError traduz timeout/rede do SIVISA',()=>{
    assert.equal(isPortalInstability('page.goto: net::ERR_TIMED_OUT at https://sivisa.saude.sp.gov.br/sivisa/'),true)
    assert.match(formatPortalError(new Error('page.goto: Timeout 30000ms exceeded')),/instável|Retomar/i)
    assert.equal(formatPortalError(new Error('Login ou senha incorretos')),'Login ou senha incorretos')
})

test('withNetworkRetry tenta de novo só em falha de rede',async()=>{
    let attempts=0
    const value=await withNetworkRetry(async()=>{
        attempts+=1
        if(attempts<3)throw new Error('net::ERR_TIMED_OUT')
        return 'ok'
    },{delays:[1,1,1]})
    assert.equal(value,'ok')
    assert.equal(attempts,3)
    assert.equal(isNetworkFailure(new Error('Login inválido')),false)
    await assert.rejects(()=>withNetworkRetry(async()=>{throw new Error('Login inválido')},{attempts:3,delays:[1]}),/Login inválido/)
})

test('Rules.protocol rejeita valores inválidos e aceita protocolo normal',()=>{
    assert.equal(Rules.protocol(' 01.001358/26 '), '01.001358/26')
    assert.throws(()=>Rules.protocol(''),PauseException)
    assert.throws(()=>Rules.protocol('a'.repeat(101)),PauseException)
})

test('Rules.exactResult exige um único resultado idêntico',()=>{
    assert.deepEqual(Rules.exactResult('01.1',[{id:'9',protocol:'01.1'}]),{id:'9',protocol:'01.1'})
    assert.throws(()=>Rules.exactResult('01.1',[]),PauseException)
    assert.throws(()=>Rules.exactResult('01.1',[{id:'1',protocol:'01.1'},{id:'2',protocol:'01.1'}]),PauseException)
})

test('TeamQueue.resolve monta a fila na ordem da ficha',()=>{
    const catalog=[
        {id:'1',name:'Murilo',login:'murilo',hasPassword:true},
        {id:'2',name:'Eduardo',login:'eduardo',hasPassword:true}
    ]
    const team=[{name:'Murilo',login:'murilo'},{name:'Eduardo',login:'eduardo'}]
    const resolved=TeamQueue.resolve(['Murilo','Eduardo'],team,catalog)
    assert.deepEqual(resolved.map(item=>item.login),['murilo','eduardo'])
})

test('TeamQueue.resolve aceita espaço duplicado e recusa fiscal desativado',()=>{
    const catalog=[{id:'1',name:'Murilo Dias',login:'murilo',hasPassword:true}]
    const team=[{name:'Murilo  Dias',login:'murilo'}]
    assert.equal(TeamQueue.resolve(['Murilo Dias'],team,catalog)[0].login,'murilo')
    assert.throws(()=>TeamQueue.resolve(['Murilo'],[{name:'Murilo',login:'murilo'}],[{id:'1',name:'Murilo',login:'murilo',hasPassword:true,enabled:false}]),error=>{
        assert.equal(error.recovery.kind,'EditSigner')
        assert.match(error.message,/desativado/)
        return true
    })
})

test('TeamQueue.resolve aceita nome curto da ficha contra nome completo da equipe',()=>{
    const catalog=[{id:'1',name:'Ricardo Fontes',login:'ricardofontes',hasPassword:true}]
    const team=[{name:'RICARDO BOAVENTURA FONTES',login:'ricardofontes'}]
    assert.equal(TeamQueue.resolve(['Ricardo Fontes'],team,catalog)[0].login,'ricardofontes')
})

test('TeamQueue.resolve pede cadastro quando falta senha ou login',()=>{
    const catalog=[{id:'1',name:'Murilo',login:'murilo',hasPassword:false}]
    const team=[{name:'Murilo',login:'murilo'}]
    assert.throws(()=>TeamQueue.resolve(['Murilo'],team,catalog),error=>{
        assert.equal(error.recovery.kind,'EditSigner')
        return error instanceof PauseException
    })
    assert.throws(()=>TeamQueue.resolve(['Murilo'],team,[]),error=>{
        assert.equal(error.recovery.kind,'CreateSigner')
        return error instanceof PauseException
    })
})

test('SignatureEvidence.resolve ordena logins pelo carimbo do PDF',()=>{
    const professionals=[{name:'Murilo Dias',signed:true},{name:'Eduardo Silva',signed:true}]
    const identities={murilo:'Murilo Dias',eduardo:'Eduardo Silva'}
    const page='No. 01.001358/26 Assinado com senha eletrônica por: Eduardo Silva 13/11/2026 08:30:00 / Murilo Dias 13/11/2026 08:29:00 /'
    const state=SignatureEvidence.resolve('01.001358/26',professionals,identities,[page])
    assert.equal(state.verified,true)
    assert.deepEqual(state.logins,['murilo','eduardo'])
})

test('SignatureEvidence.resolve aceita quebra de linha e nome parcial por contains',()=>{
    const professionals=[
        {name:'Murilo Dias',signed:true},
        {name:'Eduardo Mota',signed:true},
        {name:'Ricardo Fontes',signed:true}
    ]
    const identities={
        diasmurilo:'MURILO DIAS CHOSSANI',
        eduardomota:'EDUARDO MOTA',
        ricardofontes:'RICARDO BOAVENTURA FONTES'
    }
    const page=[
        'No. 01.001378/26 Assinado com senha eletrônica por:',
        'MURILO DIAS CHOSSANI 16/11/2026 10:47:41/',
        'EDUARDO MOTA 16/11/2026 10:47:50/',
        'RICARDO',
        'BOAVENTURA FONTES16/11/2026 10:48:00/',
        'Documento nº'
    ].join('\n')
    const state=SignatureEvidence.resolve('01.001378/26',professionals,identities,[page])
    assert.equal(state.verified,true)
    assert.deepEqual(state.logins,['diasmurilo','eduardomota','ricardofontes'])
})

test('SignatureEvidence.resolve aceita protocolo colado e carimbo sem barra final',()=>{
    const professionals=[{name:'EDUARDO MOTA',signed:true},{name:'MURILO DIAS CHOSSANI',signed:true}]
    const identities={eduardomota:'EDUARDO MOTA',diasmurilo:'MURILO DIAS CHOSSANI'}
    const page='No. 01.001378/26Assinado com senha eletrônica por: EDUARDO MOTA 16/11/2026 10:47:50 MURILO DIAS CHOSSANI 16/11/2026 10:47:41 Documento nº'
    const state=SignatureEvidence.resolve('01.001378/26',professionals,identities,[page])
    assert.equal(state.verified,true)
    assert.deepEqual(state.logins,['diasmurilo','eduardomota'])
})

test('RunPolicy distingue Assinar e Retomar',()=>{
    const incomplete={protocol:'01.1',confirmed:1,stage:'Estado consultado no portal',signers:[{},{}],destination:'/tmp/a.pdf'}
    const complete={...incomplete,stage:'PDF salvo',confirmed:2}
    assert.equal(RunPolicy.canResume(incomplete),true)
    assert.equal(RunPolicy.canResume(complete),false)
    assert.match(RunPolicy.banner(incomplete),/Prefira Retomar/)
})

test('Workflow assina na ordem e salva PDF com FakePortal',async()=>{
    const signers=[
        {id:'1',name:'A',login:'a',hasPassword:true},
        {id:'2',name:'B',login:'b',hasPassword:true}
    ]
    let signed=0
    const stages=[]
    const portal={
        async prepare(){},
        async login(){},
        async search(protocol){return [{id:'10',protocol}]},
        async readSignatures(){
            return {verified:true,logins:signers.slice(0,signed).map(item=>item.login),reason:null}
        },
        async awaitSignature(_procedure,signer){
            assert.equal(signer.login,signers[signed].login)
            signed+=1
        },
        async print(){return Buffer.from('%PDF-1.4\n%%EOF\n')}
    }
    const {tmpdir}=await import('node:os')
    const {join}=await import('node:path')
    const {unlink}=await import('node:fs/promises')
    const destination=join(tmpdir(),`sivisa-assinador-test-${Date.now()}.pdf`)
    await unlink(destination).catch(()=>{})
    const workflow=new Workflow(portal,{
        progress:message=>stages.push(message),
        save:async()=>{},
        delay:async()=>{}
    })
    const saved=await workflow.run({protocol:'01.1',signers,destination,confirmed:0,stage:'',replaceExisting:true},new AbortController().signal)
    assert.equal(saved,destination)
    assert.ok(stages.some(item=>/Assinando como A/.test(item)))
    assert.equal(signed,2)
    await unlink(destination).catch(()=>{})
})

test('Workflow não reassina se o portal perdeu uma assinatura já confirmada',async()=>{
    let signed=0
    const portal={
        async prepare(){},
        async login(){},
        async search(protocol){return [{id:'10',protocol}]},
        async readSignatures(){return {verified:true,logins:[],reason:null}},
        async awaitSignature(){signed+=1},
        async print(){return Buffer.from('%PDF-1.4\n%%EOF\n')}
    }
    const workflow=new Workflow(portal,{progress(){},save:async()=>{},delay:async()=>{}})
    await assert.rejects(()=>workflow.run({
        protocol:'01.1',
        signers:[{id:'1',name:'A',login:'a',hasPassword:true}],
        destination:join(tmpdir(),`sivisa-floor-${Date.now()}.pdf`),
        confirmed:1,
        stage:'',
        replaceExisting:true
    },new AbortController().signal),/deixou de apresentar/)
    assert.equal(signed,0)
})

test('Workflow relê uma vez quando a contagem da assinatura atrasa',async()=>{
    let reads=0
    const portal={
        async prepare(){},
        async login(){},
        async search(protocol){return [{id:'10',protocol}]},
        async readSignatures(){
            reads+=1
            return {verified:true,logins:reads>=3?['a']:[],reason:null}
        },
        async awaitSignature(){},
        async print(){return Buffer.from('%PDF-1.4\n%%EOF\n')}
    }
    const destination=join(tmpdir(),`sivisa-reread-${Date.now()}.pdf`)
    const workflow=new Workflow(portal,{progress(){},save:async()=>{},delay:async()=>{}})
    const saved=await workflow.run({
        protocol:'01.1',
        signers:[{id:'1',name:'A',login:'a',hasPassword:true}],
        destination,
        confirmed:0,
        stage:'',
        replaceExisting:true
    },new AbortController().signal)
    assert.equal(saved,destination)
    assert.equal(reads,4)
    await unlink(destination).catch(()=>{})
})
