import {randomUUID} from 'node:crypto'
import {Op} from 'sequelize'
import nodemailer from 'nodemailer'
import db from '../database/database.js'
import User from '../models/usersModel.js'
import {Account,Role,Session,Reset,Setting,Audit} from './models.js'
import {hashPassword,verifyPassword,randomToken,tokenHash,normalizeUsername} from './passwords.js'
import {validateRole,can} from './permissions.js'
import {validateAvatar} from './profile.js'

const minutes=n=>new Date(Date.now()+n*60000)
const audit=(actor,action,target,details,transaction)=>Audit.create({actor_id:actor?.account.id||null,action,target_id:target||null,details:details||{}},{transaction})
async function lock(transaction){
    const setting=await Setting.findByPk(1,{transaction,lock:transaction.LOCK.UPDATE})
    if(!setting)throw new Error('Execute a migração de autenticação.')
    return setting
}
export async function identity(accountId,transaction) {
    const account=await Account.findByPk(accountId,{transaction})
    if(!account?.enabled)return null
    const [role,user]=await Promise.all([Role.findByPk(account.role_id,{transaction}),User.findByPk(account.user_id,{transaction})])
    return role&&user?.ativo?{account,role,user}:null
}
export async function authenticate(token,kind) {
    if(typeof token!=='string'||token.length>128)return null
    const session=await Session.findOne({where:{token_hash:tokenHash(token),kind,consumed:false,expires_at:{[Op.gt]:new Date()}}})
    if(!session)return null
    const auth=await identity(session.account_id)
    return auth?{...auth,session}:null
}
async function createSession(account,kind,family,transaction) {
    const token=randomToken()
    await Session.create({account_id:account.id,token_hash:tokenHash(token),kind,family,csrf:kind==='browser'?randomToken():null,expires_at:minutes(kind==='access'?15:480)},{transaction})
    return token
}
async function issue(account,transaction) {
    const family=randomUUID()
    return {access_token:await createSession(account,'access',family,transaction),refresh_token:await createSession(account,'refresh',family,transaction),browser:await createSession(account,'browser',family,transaction),token_type:'Bearer',expires_in:900}
}
let dummyHash
export async function login(username,password) {
    dummyHash??=hashPassword('invalid-account-placeholder-password')
    let normalized
    try{normalized=normalizeUsername(username)}catch{normalized=''}
    const account=normalized?await Account.findOne({where:{username:normalized}}):null
    const valid=await verifyPassword(password,account?.password_hash||await dummyHash)
    if(!valid||!account)return null
    return db.transaction(async transaction=>{
        await lock(transaction)
        const auth=await identity(account.id,transaction)
        // Recheck after locking so a simultaneous reset cannot issue an old-password session.
        if(!auth||auth.account.password_hash!==account.password_hash)return null
        const tokens=await issue(auth.account,transaction)
        await audit(auth,'login',account.id,{},transaction)
        return {...tokens,must_change_password:auth.account.must_change_password}
    })
}
export async function refresh(token) {
    if(typeof token!=='string'||token.length>128)return null
    return db.transaction(async transaction=>{
        await lock(transaction)
        const session=await Session.findOne({where:{token_hash:tokenHash(token),kind:'refresh'},transaction,lock:transaction.LOCK.UPDATE})
        if(!session)return null
        if(session.consumed||session.expires_at<=new Date()){
            await Session.destroy({where:{family:session.family},transaction});return null
        }
        const auth=await identity(session.account_id,transaction)
        if(!auth)return null
        await session.update({consumed:true},{transaction})
        await Session.destroy({where:{family:session.family,kind:{[Op.in]:['access','browser']}},transaction})
        return {access_token:await createSession(auth.account,'access',session.family,transaction),refresh_token:await createSession(auth.account,'refresh',session.family,transaction),token_type:'Bearer',expires_in:900,must_change_password:auth.account.must_change_password}
    })
}
export async function logout(auth) {
    await Session.destroy({where:{family:auth.session.family}})
}
export async function saveOwnAvatar(auth,input) {
    const data=validateAvatar(input)
    return db.transaction(async transaction=>{
        const fresh=auth?.account?await identity(auth.account.id,transaction):null
        const session=auth?.session?await Session.findByPk(auth.session.id,{transaction}):null
        if(!fresh||!session||session.account_id!==fresh.account.id||session.consumed||session.expires_at<=new Date()){
            throw Object.assign(new Error('Sessão expirada. Entre novamente.'),{status:401})
        }
        if(fresh.account.must_change_password)throw Object.assign(new Error('Troque sua senha antes de continuar.'),{status:403,code:'PASSWORD_CHANGE_REQUIRED'})
        await fresh.account.update(data,{transaction,fields:['avatar_icon','avatar_color']})
        return {icon:fresh.account.avatar_icon,color:fresh.account.avatar_color}
    })
}
export async function updateLegacyUser(id,changes) {
    return db.transaction(async transaction=>{
        await lock(transaction)
        const user=await User.findByPk(id,{transaction})
        if(!user)return null
        if(changes.actor){
            const fresh=await identity(changes.actor.account.id,transaction)
            const session=await Session.findByPk(changes.actor.session.id,{transaction})
            if(!fresh||fresh.account.must_change_password||!session||session.consumed||session.expires_at<=new Date()||!fresh.role.maximum)throw new Error('A operação exige uma Chefia com acesso regular.')
            const target=await Account.findOne({where:{user_id:id},transaction}),role=target?await Role.findByPk(target.role_id,{transaction}):null
            if(role?.maximum&&!fresh.role.maximum)throw new Error('Somente a Chefia pode alterar outra Chefia.')
        }
        if(changes.name!==undefined)user.name=changes.name
        if(typeof changes.ativo==='boolean')user.ativo=changes.ativo
        else if(changes.toggleActive)user.ativo=!user.ativo
        await user.save({transaction})
        await preserveMaximum(transaction)
        const account=await Account.findOne({where:{user_id:id},transaction})
        if(account&&!user.ativo)await revoke(account.id,transaction)
        await audit(changes.actor,'staff.updated',account?.id,{user_id:user.id,ativo:user.ativo},transaction)
        return user
    })
}
export async function assertAuthReady(configuration=process.env) {
    if(configuration.NODE_ENV==='production'&&(configuration.AUTH_COOKIE_SECURE==='false'||!/^https:\/\//.test(configuration.APP_URL||'')))throw new Error('Produção exige APP_URL HTTPS e cookies seguros.')
    // Check schemas before connection.sync(): startup must not perform the migration.
    for(const model of [Role,Account,Session,Reset,Setting,Audit])await model.findOne()
    if(!await Setting.findByPk(1))throw new Error('Execute npm run migrate:auth antes de ativar AUTH_ENABLED.')
    const roles=await Role.findAll({where:{maximum:true}})
    const accounts=await Account.findAll({where:{enabled:true,role_id:{[Op.in]:roles.map(r=>r.id)}}})
    if(!await User.count({where:{ativo:true,id:{[Op.in]:accounts.map(a=>a.user_id)}}}))throw new Error('Crie a primeira Chefia antes de ativar AUTH_ENABLED.')
}
async function revoke(accountId,transaction){
    await Session.destroy({where:{account_id:accountId},transaction})
    await Reset.destroy({where:{account_id:accountId},transaction})
}
export async function changePassword(auth,current,password) {
    const hash=await hashPassword(password)
    return db.transaction(async transaction=>{
        await lock(transaction)
        const account=await Account.findByPk(auth.account.id,{transaction})
        const session=await Session.findByPk(auth.session.id,{transaction})
        if(!session||session.consumed||session.expires_at<=new Date()||!await identity(account.id,transaction))throw new Error('Sessão expirada. Entre novamente.')
        if(!await verifyPassword(current,account.password_hash))throw new Error('Senha atual inválida.')
        if(password===current)throw new Error('Escolha uma senha diferente da atual.')
        await account.update({password_hash:hash,must_change_password:false},{transaction})
        await revoke(account.id,transaction)
        await audit(auth,'password.changed',account.id,{},transaction)
    })
}
async function maximum(auth,transaction){
    const fresh=await identity(auth?.account.id,transaction)
    const session=auth?.session?await Session.findByPk(auth.session.id,{transaction}):null
    if(!session||session.consumed||session.expires_at<=new Date()||!fresh?.role.maximum||fresh.account.must_change_password)throw new Error('A operação exige uma Chefia com acesso regular.')
    return fresh
}
async function preserveMaximum(transaction){
    const roles=await Role.findAll({where:{maximum:true},transaction})
    const accounts=await Account.findAll({where:{role_id:{[Op.in]:roles.map(r=>r.id)},enabled:true},transaction})
    const count=await User.count({where:{id:{[Op.in]:accounts.map(a=>a.user_id)},ativo:true},transaction})
    if(!count)throw new Error('Mantenha pelo menos uma Chefia ativa.')
}
export async function saveRole(auth,id,input) {
    const data=validateRole(input)
    return db.transaction(async transaction=>{
        await lock(transaction);await maximum(auth,transaction)
        let role
        if(id){role=await Role.findByPk(id,{transaction});if(!role)throw new Error('Responsabilidade não encontrada.');await role.update(data,{transaction})}
        else role=await Role.create(data,{transaction})
        await preserveMaximum(transaction)
        await audit(auth,'role.saved',role.id,{name:data.name,maximum:data.maximum,permissions:data.permissions},transaction)
        return role
    })
}
export async function saveAccount(auth,id,input) {
    const username=normalizeUsername(input.username)
    const name=typeof input.name==='string'?input.name.trim():''
    if(!name||name.length>255)throw new Error('Informe o nome de até 255 caracteres.')
    const hash=!id?await hashPassword(input.password):null
    return db.transaction(async transaction=>{
        await lock(transaction);await maximum(auth,transaction)
        const role=await Role.findByPk(input.role_id,{transaction})
        if(!role)throw new Error('Responsabilidade inválida.')
        let account,user
        if(id){
            account=await Account.findByPk(id,{transaction});if(!account)throw new Error('Conta não encontrada.')
            user=await User.findByPk(account.user_id,{transaction})
        }else if(input.user_id){
            user=await User.findByPk(input.user_id,{transaction});if(!user)throw new Error('Fiscal não encontrado.')
            if(await Account.findOne({where:{user_id:user.id},transaction}))throw new Error('Este cadastro já possui uma conta.')
        }else user=await User.create({name,ativo:true},{transaction})
        const data={username,role_id:role.id,enabled:input.enabled===true}
        await user.update({name,...(typeof input.ativo==='boolean'?{ativo:input.ativo}:{})},{transaction})
        if(account){await account.update(data,{transaction});await revoke(account.id,transaction)}
        else account=await Account.create({...data,user_id:user.id,password_hash:hash,must_change_password:true},{transaction})
        await preserveMaximum(transaction)
        await audit(auth,'account.saved',account.id,{username,role_id:role.id,enabled:data.enabled,receives_denunciations:role.permissions.includes('denunciations.receive')},transaction)
        return account
    })
}
export async function resetByChief(auth,id,password) {
    const hash=await hashPassword(password)
    await db.transaction(async transaction=>{
        await lock(transaction);await maximum(auth,transaction)
        const account=await Account.findByPk(id,{transaction});if(!account)throw new Error('Conta não encontrada.')
        await account.update({password_hash:hash,must_change_password:true},{transaction})
        await revoke(account.id,transaction);await audit(auth,'password.reset.chief',account.id,{},transaction)
    })
}
export async function saveRecoveryEmail(auth,email,password) {
    if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('E-mail institucional inválido.')
    await db.transaction(async transaction=>{
        const setting=await lock(transaction),fresh=await maximum(auth,transaction)
        if(!await verifyPassword(password,fresh.account.password_hash))throw new Error('Confirme sua senha atual.')
        await setting.update({recovery_email:email.trim().toLowerCase()},{transaction})
        await Reset.destroy({where:{},transaction})
        await audit(auth,'recovery_email.changed',null,{email:setting.recovery_email},transaction)
    })
}
export async function requestRecovery(username) {
    let normalized
    try{normalized=normalizeUsername(username)}catch{return}
    const token=randomToken()
    const result=await db.transaction(async transaction=>{
        const setting=await lock(transaction)
        const account=await Account.findOne({where:{username:normalized},transaction})
        const auth=account?await identity(account.id,transaction):null
        if(!auth?.role.maximum||!setting.recovery_email)return null
        await Reset.destroy({where:{account_id:account.id},transaction})
        await Reset.create({account_id:account.id,token_hash:tokenHash(token),expires_at:minutes(20)},{transaction})
        await audit(null,'password.recovery.requested',account.id,{},transaction)
        return {email:setting.recovery_email,username:account.username}
    })
    if(!result)return
    const base=process.env.APP_URL
    if(!base||!/^https:\/\//.test(base)||!process.env.SMTP_HOST||!process.env.SMTP_FROM)throw new Error('Configure APP_URL HTTPS e SMTP para recuperação.')
    const url=new URL('/auth/recover/confirm',base);url.searchParams.set('token',token)
    const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',requireTLS:process.env.SMTP_PORT!=='465',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,socketTimeout:10000})
    await transporter.sendMail({from:process.env.SMTP_FROM,to:result.email,subject:'Livro VISA — recuperação de acesso',text:`Foi solicitada a recuperação da conta ${result.username}.\n\n${url}\n\nO link expira em 20 minutos e pode ser usado uma vez. Se não reconhece a solicitação, ignore esta mensagem.`})
}
export async function completeRecovery(token,password) {
    if(typeof token!=='string'||token.length>128)throw new Error('Link inválido ou expirado.')
    const hash=await hashPassword(password)
    await db.transaction(async transaction=>{
        await lock(transaction)
        const reset=await Reset.findOne({where:{token_hash:tokenHash(token),expires_at:{[Op.gt]:new Date()}},transaction,lock:transaction.LOCK.UPDATE})
        const auth=reset?await identity(reset.account_id,transaction):null
        if(!auth?.role.maximum)throw new Error('Link inválido ou expirado.')
        await auth.account.update({password_hash:hash,must_change_password:false},{transaction})
        await revoke(auth.account.id,transaction);await audit(null,'password.recovered',auth.account.id,{},transaction)
    })
}
export async function bootstrap({username,password,name,user_id}) {
    const hash=await hashPassword(password,{minLength:1}),login=normalizeUsername(username)
    if(typeof name!=='string'||!name.trim()||name.length>255)throw new Error('Informe um nome válido.')
    return db.transaction(async transaction=>{
        await lock(transaction)
        if(await Account.count({transaction}))throw new Error('Bootstrap permitido apenas antes da primeira conta.')
        const role=await Role.findOne({where:{maximum:true},transaction});if(!role)throw new Error('Execute a migração primeiro.')
        const user=user_id?await User.findByPk(user_id,{transaction}):await User.create({name:name.trim(),ativo:true},{transaction})
        if(!user?.ativo)throw new Error('O cadastro escolhido deve existir e estar ativo.')
        const account=await Account.create({user_id:user.id,username:login,password_hash:hash,role_id:role.id,enabled:true,must_change_password:false},{transaction})
        await audit(null,'bootstrap',account.id,{user_id:user.id},transaction)
        return account
    })
}
