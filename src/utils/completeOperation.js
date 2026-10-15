import {can} from '../auth/permissions.js'

export function completeOperation(req,res,{redirect,title,message,actionHref,actionLabel}){
    if(!req.auth||can(req.auth,'denunciations.read'))return res.redirect(redirect)
    if(!actionHref&&can(req.auth,'fiscal.area.own')){
        actionHref='/area-fiscal';actionLabel='Voltar à área fiscal'
    }
    return res.render('operationResult',{title,message,actionHref,actionLabel})
}
