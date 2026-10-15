import express from 'express'
import * as service from './service.js'
import {Account,Role,Setting,Audit} from './models.js'
import User from '../models/usersModel.js'
import {PERMISSIONS,PERMISSION_DESCRIPTIONS,can} from './permissions.js'
import {authEnabled,checkCsrf,cookieOptions} from './middleware.js'
import {presentAudit} from './auditPresentation.js'

export const authRouter=express.Router()
export const accessRouter=express.Router()
const attempts=new Map()
export function rateLimit(req,res,next){
    const key=req.ip,now=Date.now(),previous=attempts.get(key)
    if(attempts.size>=10000){
        for(const [ip,item] of attempts)if(item.until<now)attempts.delete(ip)
        if(!previous&&attempts.size>=10000)return res.status(429).send('Muitas tentativas. Aguarde 15 minutos.')
    }
    if(!previous||previous.until<now)attempts.set(key,{count:1,until:now+15*60000})
    else if(++previous.count>15)return res.status(429).send('Muitas tentativas. Aguarde 15 minutos.')
    next()
}
authRouter.use((req,res,next)=>{
    if(!/^\/(?:auth|api\/auth)(?:\/|$)/.test(req.path))return next('router')
    return authEnabled()?next():res.status(404).send('Autenticação ainda não ativada.')
})
authRouter.use((req,res,next)=>{
    res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer')
    if(['/auth/password','/api/auth/password','/auth/logout','/api/auth/logout'].includes(req.path)&&!req.auth){
        return req.path.startsWith('/api/')?res.status(401).json({error:'Autenticação necessária.'}):res.redirect('/auth/login')
    }
    if(['/api/auth/login','/api/auth/refresh'].includes(req.path)&&!req.auth)return next()
    if(req.method==='POST'&&!req.usingBearer&&!checkCsrf(req,res.locals.csrfToken))return res.status(403).send('Recarregue o formulário e tente novamente.')
    next()
})
const render=(res,mode,error='',extra={})=>res.render('auth/index',{mode,error,...extra})
const clientError=error=>error.name==='SequelizeUniqueConstraintError'?'Username ou nome da responsabilidade já cadastrado.':error.name.startsWith('Sequelize')?'Não foi possível salvar a alteração. Verifique os campos e tente novamente.':error.message
authRouter.get('/auth/login',(req,res)=>render(res,'login'))
authRouter.post('/auth/login',rateLimit,async(req,res)=>{
    const tokens=await service.login(req.body.username,req.body.password)
    if(!tokens)return render(res.status(401),'login','Username ou senha inválidos.')
    res.cookie('livro_session',tokens.browser,cookieOptions());res.clearCookie('livro_csrf',cookieOptions())
    const identity=await service.authenticate(tokens.browser,'browser')
    const landing=identity?.role.maximum?'/':[
        ['denunciations.read','/'],['fiscal.area.own','/area-fiscal'],['dashboard.read','/admin'],['catalogs.manage','/admin/catalogs'],['denunciations.assign','/admin/assignments'],['schedule.manage','/admin/schedule'],['attendance.manage','/admin?tab=attendance'],['schedule.read','/escala'],['denunciations.create','/denuncias/new'],['chat.use','/recados']
    ].find(([permission])=>can(identity,permission))?.[1]||'/auth/password'
    res.redirect(tokens.must_change_password?'/auth/password':landing)
})
authRouter.post('/api/auth/login',rateLimit,async(req,res)=>{
    // Credentials are not ambient authority; the API login may be called without cookies.
    const tokens=await service.login(req.body.username,req.body.password)
    if(!tokens)return res.status(401).json({error:'Username ou senha inválidos.'})
    const {browser,...payload}=tokens;res.json(payload)
})
authRouter.post('/api/auth/refresh',rateLimit,async(req,res)=>{
    const result=await service.refresh(req.body.refresh_token)
    res.status(result?200:401).json(result||{error:'Token de renovação inválido.'})
})
authRouter.get('/auth/password',(req,res)=>req.auth?render(res,'password'):res.redirect('/auth/login'))
authRouter.post(['/auth/password','/api/auth/password'],rateLimit,async(req,res)=>{
    if(!req.auth)return res.status(401).send('Autenticação necessária.')
    try{
        await service.changePassword(req.auth,req.body.current_password,req.body.password)
        res.clearCookie('livro_session',cookieOptions())
        if(req.path.startsWith('/api/'))return res.json({message:'Senha alterada. Entre novamente.'})
        res.locals.auth=null
        render(res,'done','',{message:'Senha alterada. Entre novamente.'})
    }catch(error){if(req.path.startsWith('/api/'))return res.status(400).json({error:clientError(error)});render(res.status(400),'password',clientError(error))}
})
authRouter.post(['/auth/logout','/api/auth/logout'],async(req,res)=>{
    if(req.auth)await service.logout(req.auth)
    res.clearCookie('livro_session',cookieOptions())
    req.path.startsWith('/api/')?res.status(204).end():res.redirect('/auth/login')
})
authRouter.get('/api/auth/me',(req,res)=>{
    if(!req.auth)return res.status(401).json({error:'Autenticação necessária.'})
    res.json({id:req.auth.account.id,user_id:req.auth.user.id,username:req.auth.account.username,name:req.auth.user.name,role:{id:req.auth.role.id,name:req.auth.role.name,maximum:req.auth.role.maximum,permissions:req.auth.role.permissions},must_change_password:req.auth.account.must_change_password})
})
authRouter.get('/auth/recover',(req,res)=>render(res,'recover'))
authRouter.post('/auth/recover',rateLimit,async(req,res)=>{
    try{await service.requestRecovery(req.body.username)}catch(error){console.error('Falha no serviço de recuperação:',error.code||error.name)}
    render(res,'done','',{message:'Se a conta for uma Chefia ativa e a recuperação estiver configurada, enviaremos um link ao e-mail institucional. Para outras responsabilidades, procure a Chefia.'})
})
authRouter.get('/auth/recover/confirm',(req,res)=>render(res,'confirm','',{token:typeof req.query.token==='string'?req.query.token:''}))
authRouter.post('/auth/recover/confirm',rateLimit,async(req,res)=>{
    try{await service.completeRecovery(req.body.token,req.body.password);render(res,'done','',{message:'Senha recuperada. Entre novamente.'})}
    catch(error){render(res.status(400),'confirm',clientError(error),{token:typeof req.body.token==='string'?req.body.token:''})}
})
async function accessPage(req,res,error='',status=200){
    const [accounts,roles,users,setting,audits]=await Promise.all([
        Account.findAll({attributes:{exclude:['password_hash']},order:[['username','ASC']]}),Role.findAll({order:[['name','ASC']]}),User.findAll({order:[['name','ASC']]}),Setting.findByPk(1),Audit.findAll({order:[['id','DESC']],limit:50})
    ])
    const auditEntries=audits.map(event=>({id:event.id,createdAt:event.createdAt,...presentAudit(event,{accounts,roles,users})}))
    const selectedUser=users.find(user=>String(user.id)===req.query.user_id&&!accounts.some(account=>account.user_id===user.id))
    res.status(status).render('admin/access',{accounts,roles,users,setting,audits:auditEntries,permissions:PERMISSIONS,permissionDescriptions:PERMISSION_DESCRIPTIONS,selectedUser,error,success:req.query.saved==='1'})
}
accessRouter.get('/admin/access',(req,res)=>accessPage(req,res))
const input=body=>({...body,enabled:body.enabled==='on',ativo:body.ativo==='on'})
function save(handler){return async(req,res)=>{
    try{await handler(req);res.redirect('/admin/access?saved=1')}
    catch(error){await accessPage(req,res,clientError(error),400)}
}}
accessRouter.post('/admin/access/accounts',save(req=>service.saveAccount(req.auth,null,input(req.body))))
accessRouter.post('/admin/access/accounts/:id',save(req=>service.saveAccount(req.auth,req.params.id,input(req.body))))
accessRouter.post('/admin/access/accounts/:id/reset',rateLimit,save(req=>service.resetByChief(req.auth,req.params.id,req.body.password)))
accessRouter.post('/admin/access/people/:id',save(async req=>{
    if(!/^[1-9]\d*$/.test(req.params.id))throw new Error('Cadastro inválido.')
    const name=typeof req.body.name==='string'?req.body.name.trim():''
    if(!name||name.length>255)throw new Error('Informe um nome de até 255 caracteres.')
    const user=await service.updateLegacyUser(req.params.id,{name,ativo:req.body.ativo==='on',actor:req.auth})
    if(!user)throw new Error('Cadastro não encontrado.')
}))
const roleInput=body=>({name:body.name,maximum:body.maximum==='on',permissions:body.permissions==null?[]:Array.isArray(body.permissions)?body.permissions:[body.permissions]})
accessRouter.post('/admin/access/roles',save(req=>service.saveRole(req.auth,null,roleInput(req.body))))
accessRouter.post('/admin/access/roles/:id',save(req=>service.saveRole(req.auth,req.params.id,roleInput(req.body))))
accessRouter.post('/admin/access/email',rateLimit,save(req=>service.saveRecoveryEmail(req.auth,req.body.email,req.body.current_password)))
