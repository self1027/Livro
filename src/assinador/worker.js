import {Op} from 'sequelize'
import {AssinadorJob} from '../models/assinadorModels.js'
import {PauseException,Rules,TeamQueue,Workflow,formatPortalError,isPortalInstability} from './core.js'
import PlaywrightPortal from './portal.js'
import {decryptSecret} from './vault.js'
import {AssinadorSigner} from '../models/assinadorModels.js'
import {Audit,Account} from '../auth/models.js'
import {assinadorPdfRetention} from '../database/migrateAssinador.js'

const controllers=new Map()
const protocolLocks=new Set()
let active=0
const maxParallel=Math.max(1,Number(process.env.ASSINADOR_MAX_PARALLEL||1)||1)
const queue=[]
/** Último login SIVISA que autenticou com sucesso neste processo. */
let lastGoodScoutLogin=null

function pushLog(job,message){
    const log=[...(job.log||[]),{at:new Date().toISOString(),message:String(message||'').slice(0,500)}]
    return log.slice(-200)
}

async function patch(jobId,values){
    await AssinadorJob.update({...values,last_progress_at:new Date()},{where:{id:jobId}})
}

async function auditJob(jobId,action,details={}){
    const job=await AssinadorJob.findByPk(jobId)
    if(!job)return
    const account=await Account.findOne({where:{user_id:job.requested_by}})
    if(!account)return
    await Audit.create({actor_id:account.id,action,details:{job_id:job.id,protocol:job.protocol,status:job.status,...details}})
}

async function loadCatalog(){
    const rows=await AssinadorSigner.findAll({order:[['name','ASC']]})
    return rows.map(row=>({
        id:String(row.id),
        name:row.name,
        login:row.login,
        enabled:row.enabled!==false,
        hasPassword:!!row.secret_cipher,
        secret_cipher:row.secret_cipher
    }))
}

function orderScouts(catalog,preferredLogins=[]){
    const withPass=catalog.filter(item=>item.hasPassword&&item.enabled!==false)
    const seen=new Set()
    const ordered=[]
    const push=login=>{
        const key=String(login||'').toLowerCase()
        if(!key||seen.has(key))return
        const hit=withPass.find(item=>item.login.toLowerCase()===key)
        if(!hit)return
        seen.add(key)
        ordered.push(hit)
    }
    for(const login of preferredLogins)push(login)
    if(lastGoodScoutLogin)push(lastGoodScoutLogin)
    for(const item of withPass)push(item.login)
    return ordered
}

async function resolveQueue(portal,protocol,catalog,signal,onProgress=()=>{},preferredLogins=[]){
    const scouts=orderScouts(catalog,preferredLogins)
    if(!scouts.length)throw new PauseException('Cadastre ao menos um fiscal ativo com senha eletrônica antes de assinar.')
    let last=null
    for(const scout of scouts){
        try{
            await onProgress(`Consultando a ficha com ${scout.name} (${scout.login})…`)
            await portal.login(scout,signal)
            lastGoodScoutLogin=scout.login
            await onProgress('Pesquisando o protocolo no SIVISA…')
            const procedure=Rules.exactResult(protocol,await portal.search(protocol,signal))
            await onProgress('Lendo profissionais vinculados à ficha…')
            const linked=await portal.readLinkedProfessionalNames(procedure,signal)
            await onProgress('Consultando usuários da equipe no SIVISA…')
            const team=await portal.readTeamDirectory(signal)
            return TeamQueue.resolve(linked,team,catalog.map(({id,name,login,hasPassword,enabled})=>({id,name,login,hasPassword,enabled})))
        }catch(error){
            if(
                error instanceof PauseException&&
                error.recovery?.kind==='EditSigner'&&
                error.recovery.login?.toLowerCase()===scout.login.toLowerCase()&&
                scouts.length>1
            ){
                last=error
                await onProgress(`Falha ao entrar como ${scout.name}. Tentando outro fiscal cadastrado…`)
                continue
            }
            throw error
        }
    }
    throw last||new PauseException('Não foi possível consultar o procedimento com os fiscais cadastrados.')
}

async function execute(jobId,controller){
    let portal=null
    let lock=null
    let job=null
    try{
        job=await AssinadorJob.findByPk(jobId)
        if(!job||job.status==='cancelled'||controller.signal.aborted)return
        const protocol=Rules.protocol(job.protocol)
        const key=Rules.key(protocol)
        if(protocolLocks.has(key)){
            await patch(job.id,{status:'paused',stage:'Protocolo em uso',error:'Este protocolo já está em execução. Aguarde ou cancele a outra execução.',finished_at:new Date()})
            return
        }
        protocolLocks.add(key)
        lock=key
        portal=new PlaywrightPortal({
            passwordFor:async signer=>{
                const row=await AssinadorSigner.findOne({where:{login:signer.login,enabled:true}})
                if(!row?.secret_cipher)return null
                try{return decryptSecret(row.secret_cipher)}
                catch{throw new PauseException(`Não foi possível ler a senha de ${signer.name} (${signer.login}). Cadastre a senha de novo.`,{kind:'EditSigner',login:signer.login,name:signer.name})}
            },
            log:message=>console.log(`[assinador ${job.id}] ${message}`)
        })
        const [started]=await AssinadorJob.update({
            status:'running',
            started_at:job.started_at||new Date(),
            error:null,
            recovery:null,
            finished_at:null,
            last_progress_at:new Date()
        },{where:{id:job.id,status:{[Op.in]:['queued','running']}}})
        if(!started)return
        if(controller.signal.aborted){
            await patch(job.id,{status:'cancelled',stage:'Cancelado',error:'Execução cancelada pelo operador.',finished_at:new Date()})
            return
        }
        await auditJob(job.id,'assinador.job.started')
        const catalog=await loadCatalog()
        let signers=job.signers||[]
        if(!signers.length){
            await patch(job.id,{stage:'Montando fila de assinantes',log:pushLog(job,'Identificando profissionais vinculados…')})
            const preferred=[process.env.ASSINADOR_PREFERRED_SCOUT,job.destination?.scoutLogin].filter(Boolean)
            signers=await resolveQueue(portal,protocol,catalog,controller.signal,async message=>{
                const current=await AssinadorJob.findByPk(job.id)
                await patch(job.id,{stage:String(message).slice(0,180),log:pushLog(current||job,message)})
            },preferred)
            await patch(job.id,{signers:signers.map(({id,name,login})=>({id,name,login})),stage:'Fila identificada',log:pushLog(await AssinadorJob.findByPk(job.id),`Fila: ${signers.map(s=>s.name).join(', ')}`)})
        }else{
            signers=signers.map(item=>{
                const current=catalog.find(row=>row.login.toLowerCase()===String(item.login).toLowerCase())
                if(!current)throw new PauseException(`Fiscal ${item.login} não está mais no cadastro.`,{kind:'EditSigner',login:item.login,name:item.name})
                if(!current.enabled)throw new PauseException(`Fiscal ${item.name} (${item.login}) está desativado. Reative o cadastro em vez de criar outro login.`,{kind:'EditSigner',login:item.login,name:item.name})
                return {...item,hasPassword:current.hasPassword}
            })
        }
        const fresh=await AssinadorJob.findByPk(job.id)
        const run={
            protocol,
            signers:signers.map(({id,name,login,hasPassword})=>({id,name,login,hasPassword:hasPassword!==false})),
            destination:fresh.destination,
            confirmed:fresh.confirmed||0,
            stage:fresh.stage,
            replaceExisting:!!fresh.replace_existing
        }
        const workflow=new Workflow(portal,{
            progress:async message=>{
                const current=await AssinadorJob.findByPk(job.id)
                await patch(job.id,{stage:message.slice(0,180),log:pushLog(current,message)})
            },
            save:async state=>{
                await patch(job.id,{
                    confirmed:state.confirmed,
                    stage:String(state.stage||'').slice(0,180),
                    signers:state.signers.map(({id,name,login})=>({id,name,login})),
                    destination:state.destination
                })
            }
        })
        await workflow.run(run,controller.signal)
        const {ttlMs}=assinadorPdfRetention()
        await patch(job.id,{status:'completed',stage:'PDF salvo',pdf_ready:true,pdf_expires_at:new Date(Date.now()+ttlMs),finished_at:new Date(),error:null})
        await auditJob(job.id,'assinador.job.finished',{outcome:'completed'})
    }catch(error){
        if(!job)throw error
        const current=await AssinadorJob.findByPk(job.id)
        if(!controller.signal.aborted&&current?.stage==='PDF salvo'&&current.destination){
            const {ttlMs}=assinadorPdfRetention()
            await patch(job.id,{status:'completed',stage:'PDF salvo',pdf_ready:true,pdf_expires_at:new Date(Date.now()+ttlMs),finished_at:new Date(),error:null})
            await auditJob(job.id,'assinador.job.finished',{outcome:'completed'}).catch(()=>{})
            return
        }
        const recovery=error instanceof PauseException?error.recovery:(isPortalInstability(error?.message)?{kind:'Resume'}:null)
        const message=formatPortalError(error)
        const cancelled=controller.signal.aborted
        const unstable=!cancelled&&isPortalInstability(error?.message)
        await patch(job.id,{
            status:cancelled?'cancelled':(RunLooksResumable(current)||unstable?'paused':'failed'),
            stage:cancelled?'Cancelado':(unstable?'Portal SIVISA instável':String(current?.stage||'Interrompido').slice(0,180)),
            error:message.slice(0,2000),
            recovery:recovery||null,
            log:pushLog(current||job,error?.message||message),
            finished_at:new Date()
        })
        await auditJob(job.id,'assinador.job.finished',{outcome:cancelled?'cancelled':(RunLooksResumable(current)||unstable?'paused':'failed'),error:message.slice(0,500),portalUnstable:unstable||undefined})
    }finally{
        controllers.delete(Number(jobId))
        if(lock)protocolLocks.delete(lock)
        await portal?.dispose()
        active=Math.max(0,active-1)
        pump()
    }
}

function RunLooksResumable(job){
    if(!job||job.status==='completed'||job.stage==='PDF salvo')return false
    return !!(job.destination||(Array.isArray(job.signers)&&job.signers.length))
}

function pump(){
    while(active<maxParallel&&queue.length){
        const jobId=queue.shift()
        const controller=new AbortController()
        controllers.set(jobId,controller)
        active+=1
        execute(jobId,controller).catch(error=>console.error('Falha no worker do Assinador:',error))
    }
}

export function enqueueAssinadorJob(jobId){
    const id=Number(jobId)
    if(!queue.includes(id)&&!controllers.has(id))queue.push(id)
    pump()
}

export function cancelAssinadorJob(jobId){
    const id=Number(jobId)
    const pending=queue.indexOf(id)
    if(pending>=0)queue.splice(pending,1)
    const controller=controllers.get(id)
    if(controller)controller.abort(new PauseException('Execução cancelada pelo operador.'))
    return pending>=0||!!controller
}

export function isAssinadorJobActive(jobId){
    const id=Number(jobId)
    return controllers.has(id)||queue.includes(id)
}

export function assinadorWorkerSnapshot(){
    return {active,queued:queue.length,maxParallel,runningIds:[...controllers.keys()],lastGoodScoutLogin}
}
