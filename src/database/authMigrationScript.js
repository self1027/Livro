import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {readFile,writeFile,rename,unlink,stat,access} from 'node:fs/promises'
import {constants} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {createInterface} from 'node:readline/promises'
import {Writable} from 'node:stream'
import db from './database.js'
import {migrateAuth} from './migrateAuth.js'
import {Account,Setting,Audit} from '../auth/models.js'
import {bootstrap,assertAuthReady} from '../auth/service.js'
import {normalizeUsername,validatePassword} from '../auth/passwords.js'

async function readEnvironment(file){
    try{return await readFile(file,'utf8')}catch(error){if(error.code==='ENOENT')return '';throw error}
}
export function updateEnvironment(source,values){
    const newline=source.includes('\r\n')?'\r\n':'\n'
    const remaining={...values}
    const seen=new Set()
    const lines=source.split(/\r?\n/).flatMap(line=>{
        const key=/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1]
        if(!Object.hasOwn(values,key))return [line]
        if(seen.has(key))return [] // Duplicate keys must not override activation.
        seen.add(key);delete remaining[key]
        return [`${key}=${values[key]}`]
    })
    while(lines.at(-1)==='')lines.pop()
    for(const [key,value] of Object.entries(remaining))lines.push(`${key}=${value}`)
    return lines.join(newline)+newline
}
export function validateConfiguration(configuration){
    let url
    try{url=new URL(configuration.APP_URL)}catch{throw new Error('Informe APP_URL com o endereço completo do Livro.')}
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('APP_URL deve conter somente protocolo, host e porta, sem caminho ou credenciais.')
    const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    const secure=configuration.AUTH_COOKIE_SECURE!=='false'
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local&&!secure&&configuration.NODE_ENV!=='production'))throw new Error('Use HTTPS. HTTP só é permitido em localhost, fora de produção, com AUTH_COOKIE_SECURE=false.')
    if(url.protocol==='https:'&&!secure)throw new Error('APP_URL HTTPS exige AUTH_COOKIE_SECURE=true.')
    return {APP_URL:url.origin,AUTH_COOKIE_SECURE:String(secure)}
}

export async function runAuthMigration({initialChief,recoveryEmail,configuration=process.env,envPath=path.resolve('.env'),progress=()=>{}}={}){
    const values=validateConfiguration(configuration)
    const original=await readEnvironment(envPath)
    await access(path.dirname(envPath),constants.W_OK)
    // Validate input before creating any tables. No password is written to the .env file.
    if(initialChief){
        normalizeUsername(initialChief.username);validatePassword(initialChief.password,{minLength:1})
        if(typeof initialChief.name!=='string'||!initialChief.name.trim()||initialChief.name.length>255)throw new Error('Informe o nome da primeira Chefia.')
        if(initialChief.user_id&&!/^[1-9]\d*$/.test(String(initialChief.user_id)))throw new Error('ID do fiscal inválido.')
    }
    if(recoveryEmail!=null&&(typeof recoveryEmail!=='string'||recoveryEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)))throw new Error('Informe um e-mail institucional válido.')
    await db.authenticate()
    progress('Conexão validada. Criando as tabelas adicionais de autenticação…')
    await migrateAuth()
    let chiefCreated=false
    if(!await Account.count()){
        if(!initialChief)throw new Error('Não há contas. Informe os dados da primeira Chefia e execute novamente.')
        await bootstrap(initialChief);chiefCreated=true
        progress('Primeira Chefia criada. IDs e vínculos anteriores preservados.')
    }else progress('Contas existentes preservadas; nenhuma senha foi redefinida.')
    await db.transaction(async transaction=>{
        const setting=await Setting.findByPk(1,{transaction,lock:transaction.LOCK.UPDATE})
        if(!setting.recovery_email){
            if(!recoveryEmail)throw new Error('Informe o e-mail institucional de recuperação e execute novamente.')
            await setting.update({recovery_email:recoveryEmail.toLowerCase()},{transaction})
            await Audit.create({action:'recovery_email.initialized',details:{email:setting.recovery_email}},{transaction})
        }
    })
    await assertAuthReady({...configuration,...values})
    const updated=updateEnvironment(original,{...values,AUTH_ENABLED:'true'})
    if(updated!==original){
        if(await readEnvironment(envPath)!==original)throw new Error('O arquivo .env mudou durante a migração. Execute novamente para ativar com segurança.')
        let mode=0o600
        try{mode=(await stat(envPath)).mode&0o777}catch(error){if(error.code!=='ENOENT')throw error}
        const temporary=envPath+'.auth-'+randomBytes(8).toString('hex')+'.tmp'
        try{await writeFile(temporary,updated,{flag:'wx',mode});await rename(temporary,envPath)}
        finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error})}
    }
    progress('Acesso validado. AUTH_ENABLED=true salvo no .env.')
    return {chiefCreated,envPath,smtpConfigured:!!configuration.SMTP_HOST&&!!configuration.SMTP_FROM}
}

async function command(){
    if(process.argv.includes('--help')){
        console.log('npm run auth:migrate\nMigra as tabelas, cria a primeira Chefia, inicializa o e-mail do setor e ativa AUTH_ENABLED no .env.\n\nSem terminal interativo: -- --non-interactive\nVariáveis: BOOTSTRAP_USERNAME, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD, BOOTSTRAP_USER_ID (opcional), AUTH_RECOVERY_EMAIL, APP_URL.\nSenhas não são exibidas ou persistidas no .env. Reinicie o serviço após concluir.')
        return
    }
    const interactive=process.stdin.isTTY&&!process.argv.includes('--non-interactive')
    let muted=false,rl
    if(interactive){
        const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk);callback()}})
        output.isTTY=true;output.columns=process.stdout.columns||80
        rl=createInterface({input:process.stdin,output,terminal:true})
    }
    async function ask(label,current,{secret=false,optional=false}={}){
        if(current)return current
        if(!rl){if(optional)return undefined;throw new Error(`Configuração ausente: ${label}. Execute em terminal interativo ou forneça as variáveis indicadas em --help.`)}
        if(secret){process.stdout.write(label+': ');muted=true}
        let value
        try{value=await rl.question(secret?'':label+': ')}finally{if(secret){muted=false;process.stdout.write('\n')}}
        if(!value&&!optional)throw new Error(`${label} é obrigatório.`)
        return secret?value:value.trim()||undefined
    }
    try{
        console.log(`Base selecionada: ${db.config.database}. Execute após o backup e durante a manutenção.`)
        await db.authenticate()
        const tables=await db.getQueryInterface().showAllTables()
        const hasAccounts=tables.includes('auth_accounts')&&await Account.count()>0
        const setting=tables.includes('auth_settings')?await Setting.findByPk(1):null
        const configuration={...process.env}
        configuration.APP_URL=await ask('Endereço do Livro (APP_URL)',configuration.APP_URL)
        if(/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/.test(configuration.APP_URL)&&configuration.NODE_ENV!=='production')configuration.AUTH_COOKIE_SECURE='false'
        const recoveryEmail=setting?.recovery_email?undefined:await ask('E-mail institucional do setor (AUTH_RECOVERY_EMAIL)',process.env.AUTH_RECOVERY_EMAIL)
        let initialChief
        if(!hasAccounts){
            initialChief={
                username:await ask('Username da primeira Chefia (BOOTSTRAP_USERNAME)',process.env.BOOTSTRAP_USERNAME),
                name:await ask('Nome da primeira Chefia (BOOTSTRAP_NAME)',process.env.BOOTSTRAP_NAME),
                user_id:await ask('ID de um fiscal ativo existente; Enter cria novo cadastro',process.env.BOOTSTRAP_USER_ID,{optional:true}),
                password:await ask('Senha da primeira Chefia, até 128 caracteres (BOOTSTRAP_PASSWORD)',process.env.BOOTSTRAP_PASSWORD,{secret:true})
            }
            if(rl){const confirmation=await ask('Repita a senha',undefined,{secret:true});if(confirmation!==initialChief.password)throw new Error('As senhas não coincidem.')}
        }
        const result=await runAuthMigration({initialChief,recoveryEmail,configuration,progress:console.log})
        console.log('Concluído. Reinicie o Livro (npm start ou o gerenciador de serviço) e acesse /auth/login. Fiscais anteriores recebem credenciais em /admin/access, vinculando o cadastro existente.')
        if(!result.smtpConfigured)console.log('SMTP ainda não configurado: login e reset pela Chefia estão disponíveis; o envio de recuperação exige SMTP_HOST e SMTP_FROM, além das credenciais do provedor.')
        console.log('Se o gerenciador de serviço define AUTH_ENABLED externamente, atualize também esse valor para true. A migração não reinicia processos em andamento.')
    }finally{rl?.close();delete process.env.BOOTSTRAP_PASSWORD;await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    command().catch(error=>{console.error('Migração não concluída:',error.name.startsWith('Sequelize')?'Falha no banco. Confira a conexão, o esquema e as permissões.':error.message);process.exitCode=1})
}
