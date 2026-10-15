import {timingSafeEqual} from 'node:crypto'
import {authenticate} from './service.js'
import {can,canWorkOnDenunciation,canManageReport} from './permissions.js'
import {randomToken} from './passwords.js'
import Denunciation from '../models/denunciationsModel.js'
import Report from '../models/reportsModel.js'
import sivisaService from '../services/sivisaService.js'
import {AVATAR_ICONS,AVATAR_COLORS} from './profile.js'

export const authEnabled=()=>process.env.AUTH_ENABLED==='true'
export const secureCookies=()=>process.env.AUTH_COOKIE_SECURE!=='false'
export function cookies(req) {
    const result={}
    for(const part of (req.headers.cookie||'').split(';')){
        const index=part.indexOf('=');if(index<0)continue
        try{result[part.slice(0,index).trim()]=decodeURIComponent(part.slice(index+1))}catch{}
    }
    return result
}
export const cookieOptions=()=>({httpOnly:true,secure:secureCookies(),sameSite:'strict',path:'/',maxAge:8*60*60*1000})
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
export function checkCsrf(req,expected){return same(req.get('X-CSRF-Token')||req.body?._csrf,expected)}
export function routePermission(path,method) {
    const read=method==='GET'||method==='HEAD'
    if(path==='/recados'&&read)return 'chat.use'
    if(path==='/api/recados/announcements'&&!read)return 'chat.announce'
    if(/^\/api\/recados(?:\/|$)/.test(path))return 'chat.use'
    if(path==='/docs'||path==='/docs.json'||path.startsWith('/docs/'))return 'maximum'
    if(/^\/admin\/access(?:\/|$)/.test(path))return 'maximum'
    if(/^\/admin\/schedule(?:\/|$)/.test(path))return 'schedule.manage'
    if(/^\/admin\/fiscais(?:\/|$)/.test(path)||/^\/(cadastro\/usuario|editar-usuario\/\d+|usuario\/(registrar|atualizar\/\d+))$/.test(path))return 'maximum'
    if(/^\/admin\/assignments(?:\/|$)/.test(path)||/^\/atribuir(?:\/\d+)?$/.test(path))return 'denunciations.assign'
    if(/^\/admin\/catalogs(?:\/|$)/.test(path)||/^\/bairros(?:\/|$)/.test(path))return 'catalogs.manage'
    if(path==='/admin/attendance'||(path==='/admin'&&read))return path==='/admin/attendance'?'attendance.manage':'dashboard.read'
    if(/^\/admin\/export\/(csv|pdf)$/.test(path))return 'dashboard.read'
    if(path==='/escala')return 'schedule.read'
    if(/^\/area-fiscal(?:\/\d+)?$/.test(path)||path==='/denuncias/pdf')return 'fiscal.area.own'
    if(/^\/denuncias\/\d+\/adicionar-relatorio$/.test(path)&&!read)return 'reports.create'
    if(/^\/relatorio\/\d+\/editar$/.test(path)&&!read)return 'reports.edit'
    if(/^\/relatorio\/\d+\/deletar$/.test(path)&&!read)return 'reports.delete'
    if(/^\/relatorio\/\d+(?:\/sivisa)?$/.test(path)&&read)return 'reports.edit'
    if(/^\/relatorio\/\d+\/sivisa$/.test(path))return 'reports.edit'
    if(path==='/sivisa/pendencias'&&read)return 'reports.edit'
    if(/^\/denuncias\/\d+\/edit$/.test(path))return 'denunciations.edit.own'
    if(path==='/denuncias/new'||(path==='/denuncias'&&!read))return 'denunciations.create'
    if(read&&(path==='/'||path==='/buscar'||path==='/api/denuncias'||path==='/denuncias/pdf'||/^\/denuncias\/\d+$/.test(path)))return 'denunciations.read'
    return null
}
export async function authContext(req,res,next){
    res.locals.avatarOptions={icons:AVATAR_ICONS,colors:AVATAR_COLORS}
    res.locals.authEnabled=authEnabled();res.locals.auth=null;res.locals.csrfToken='';res.locals.can=()=>!authEnabled()
    res.locals.canPath=()=>!authEnabled()
    res.locals.sivisaPendingCount=0
    res.locals.canWorkOnDenunciation=()=>!authEnabled()
    res.locals.canManageReport=()=>!authEnabled()
    if(!authEnabled())return next()
    try{
        res.set('Cache-Control','no-store')
        res.set('Referrer-Policy','same-origin')
        const header=req.get('Authorization')
        req.auth=header?await authenticate(/^Bearer ([A-Za-z0-9_-]+)$/i.exec(header)?.[1],'access'):await authenticate(cookies(req).livro_session,'browser')
        req.usingBearer=!!header
        if(!req.auth&&!header&&cookies(req).livro_session)res.clearCookie('livro_session',cookieOptions())
        res.locals.auth=req.auth||null;res.locals.can=p=>can(req.auth,p)
        // API polling must not repeatedly calculate unrelated sidebar data.
        if(!req.path.startsWith('/api/')&&can(req.auth,'reports.edit'))res.locals.sivisaPendingCount=await sivisaService.countPending(req.auth.user.id)
        res.locals.canWorkOnDenunciation=(permission,denunciation)=>canWorkOnDenunciation(req.auth,permission,denunciation)
        res.locals.canManageReport=(permission,report)=>canManageReport(req.auth,permission,report)
        res.locals.canPath=path=>{
            const parsed=new URL(path,'http://livro.local')
            const permission=parsed.pathname==='/admin'&&parsed.searchParams.get('tab')==='attendance'?'attendance.manage':routePermission(parsed.pathname,'GET')
            const fiscal=/^\/area-fiscal\/(\d+)$/.exec(parsed.pathname)?.[1]||(parsed.pathname==='/denuncias/pdf'?parsed.searchParams.get('fiscalId'):null)
            if(fiscal&&String(fiscal)!==String(req.auth?.user.id)&&!can(req.auth,'fiscal.area.all'))return false
            return permission==='maximum'?!!req.auth?.role.maximum:!!permission&&can(req.auth,permission)
        }
        const anonymousCsrf=cookies(req).livro_csrf
        const validCsrf=typeof anonymousCsrf==='string'&&/^[A-Za-z0-9_-]{43}$/.test(anonymousCsrf)
        res.locals.csrfToken=req.auth?.session.csrf||(validCsrf?anonymousCsrf:randomToken())
        if(!req.auth&&!validCsrf)res.cookie('livro_csrf',res.locals.csrfToken,cookieOptions())
        // Existing EJS forms receive a CSRF field server-side, including without JavaScript.
        const originalRender=res.render.bind(res)
        res.render=(view,options={},callback)=>{
            if(callback)return originalRender(view,options,callback)
            return originalRender(view,options,(error,html)=>{
                if(error)return next(error)
                const csrf=res.locals.csrfToken
                html=html.replace(/<form\b[^>]*>/gi,tag=>{
                    if(!/method\s*=\s*["']post["']/i.test(tag)||/action\s*=\s*["'](?:https?:)?\/\//i.test(tag))return tag
                    return `${tag}<input type="hidden" name="_csrf" value="${csrf}">`
                })
                res.send(html)
            })
        }
        next()
    }catch(error){next(error)}
}
export async function protectRoutes(req,res,next){
    if(!authEnabled())return next()
    const api=req.path.startsWith('/api/'),fail=(code,message)=>api?res.status(code).json({error:message}):res.status(code).send(message)
    if(!req.auth)return api?fail(401,'Autenticação necessária.'):res.redirect('/auth/login')
    if(req.auth.account.must_change_password)return api?res.status(403).json({error:'Troque sua senha antes de continuar.',code:'PASSWORD_CHANGE_REQUIRED'}):res.redirect('/auth/password')
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.usingBearer&&!checkCsrf(req,req.auth.session.csrf))return fail(403,'Sessão do formulário expirada. Recarregue a página.')
    const permission=req.path==='/admin'&&req.query.tab==='attendance'?'attendance.manage':routePermission(req.path,req.method)
    if(!permission||!(permission==='maximum'?req.auth.role.maximum:can(req.auth,permission)))return fail(403,'Você não possui permissão para esta operação.')
    try{
        const fiscal=/^\/area-fiscal\/(\d+)$/.exec(req.path)?.[1]||(req.path==='/denuncias/pdf'?req.query.fiscalId:null)
        if(fiscal&&String(fiscal)!==String(req.auth.user.id)&&!can(req.auth,'fiscal.area.all'))return fail(403,'Você pode acessar apenas sua área fiscal.')
        const reportId=/^\/relatorio\/(\d+)/.exec(req.path)?.[1]
        if(reportId){
            const report=await Report.findByPk(reportId)
            if(report&&!canManageReport(req.auth,permission,report))return fail(403,'Você pode alterar apenas seus relatórios.')
        }
        const denunciationId=/^\/denuncias\/(\d+)\/(adicionar-relatorio|edit)$/.exec(req.path)?.[1]
        if(denunciationId){
            const denunciation=await Denunciation.findByPk(denunciationId)
            if(denunciation&&!canWorkOnDenunciation(req.auth,permission,denunciation))return fail(403,permission==='denunciations.edit.own'?(denunciation.created_by_user_id==null?'Esta denúncia não tem autor de cadastro identificado. É necessária a permissão de editar todas as denúncias.':'Você pode editar apenas denúncias que cadastrou.'):'Denúncia fora das suas atribuições ou sem responsável.')
        }
        next()
    }catch(error){next(error)}
}
