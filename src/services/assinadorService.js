import {Op} from 'sequelize'
import {can} from '../auth/permissions.js'
import {Audit} from '../auth/models.js'
import {AssinadorJob,AssinadorSigner} from '../models/assinadorModels.js'
import {assinadorPdfRetention,assinadorPdfRoot} from '../database/migrateAssinador.js'
import {PauseException,PdfFile,Rules,RunPolicy,isPortalInstability} from '../assinador/core.js'
import {decryptSecret,encryptSecret,vaultConfigured} from '../assinador/vault.js'
import {cancelAssinadorJob,enqueueAssinadorJob,isAssinadorJobActive} from '../assinador/worker.js'
import {createReadStream,existsSync} from 'node:fs'

export class AssinadorError extends Error{
    constructor(status,message){
        super(message)
        this.status=status
        this.name='AssinadorError'
    }
}

const fail=(status,message)=>{throw new AssinadorError(status,message)}
const protocolStarts=new Set()

function jobBanner(row){
    const run={protocol:row.protocol,confirmed:row.confirmed,stage:row.stage,signers:row.signers||[]}
    if(['queued','running'].includes(row.status)&&row.stage!=='PDF salvo')return ''
    if(row.recovery?.kind==='EditSigner'||row.recovery?.kind==='CreateSigner')return ''
    return RunPolicy.banner(run)
}

function requireUse(identity){
    if(!can(identity,'assinador.use'))fail(403,'Você não possui permissão para usar o Assinador SIVISA.')
}

function requireManage(identity){
    requireUse(identity)
    if(!can(identity,'assinador.manage'))fail(403,'Você não possui permissão para administrar fiscais do Assinador SIVISA.')
}

function canSeeAllJobs(identity){
    return can(identity,'assinador.manage')||!!identity.role.maximum
}

async function auditActor(identity,action,details={}){
    if(!identity?.account?.id)return
    await Audit.create({actor_id:identity.account.id,action,details})
}

function publicSigner(row,{includePasswordLength=false}={}){
    const signer={id:row.id,name:row.name,login:row.login,enabled:!!row.enabled,hasPassword:!!row.secret_cipher,updatedAt:row.updatedAt}
    if(includePasswordLength)signer.passwordLength=row.secret_cipher?(Number(row.secret_length)||null):null
    return signer
}

function publicJob(row){
    const expired=!!row.pdf_expires_at&&new Date(row.pdf_expires_at).getTime()<Date.now()
    const portalUnstable=isPortalInstability(row.error)||/portal SIVISA está lento|Portal SIVISA instável/i.test(String(row.stage||''))
    return {
        id:row.id,
        protocol:row.protocol,
        status:row.status,
        stage:row.stage,
        confirmed:row.confirmed,
        total:Array.isArray(row.signers)?row.signers.length:0,
        signers:row.signers||[],
        log:row.log||[],
        pdfReady:!!row.pdf_ready&&!expired,
        pdfExpired:expired,
        error:row.error||null,
        recovery:row.recovery||null,
        portalUnstable,
        lastProgressAt:row.last_progress_at||row.updatedAt||null,
        banner:jobBanner(row),
        requestedBy:row.requested_by,
        startedAt:row.started_at,
        finishedAt:row.finished_at,
        updatedAt:row.updatedAt,
        createdAt:row.createdAt
    }
}

async function getJob(identity,id){
    requireUse(identity)
    const job=await AssinadorJob.findByPk(id)
    if(!job)fail(404,'Execução não encontrada.')
    if(job.requested_by!==identity.user.id&&!canSeeAllJobs(identity))fail(403,'Você pode acompanhar apenas as próprias execuções.')
    return job
}

function pdfAnchor(job){
    return new Date(job.finished_at||job.started_at||job.createdAt||Date.now())
}

function pdfExpired(job){
    if(!job.pdf_ready)return true
    const now=Date.now()
    if(job.pdf_expires_at&&new Date(job.pdf_expires_at).getTime()<now)return true
    const {maxAgeMs}=assinadorPdfRetention()
    return now-pdfAnchor(job).getTime()>maxAgeMs
}

export async function pageContext(identity){
    requireUse(identity)
    return {
        canManage:can(identity,'assinador.manage'),
        vaultReady:vaultConfigured(),
        pollMs:200,
        stallMs:Number(process.env.ASSINADOR_STALL_MS||45_000)||45_000
    }
}

export async function listSigners(identity){
    requireUse(identity)
    const includePasswordLength=can(identity,'assinador.manage')
    const rows=await AssinadorSigner.findAll({order:[['name','ASC']]})
    return {signers:rows.map(row=>publicSigner(row,{includePasswordLength}))}
}

export async function saveSigner(identity,body={},id=null){
    requireManage(identity)
    if(!vaultConfigured())fail(503,'Configure ASSINADOR_VAULT_KEY antes de cadastrar senhas.')
    const name=String(body.name||'').trim()
    const login=String(body.login||'').trim()
    const password=body.password==null?'':String(body.password)
    if(!name||name.length>160)fail(400,'Informe o nome do fiscal (até 160 caracteres).')
    if(!login||login.length>80)fail(400,'Informe o login SIVISA (até 80 caracteres).')
    const duplicate=await AssinadorSigner.findOne({where:{login,...(id?{id:{[Op.ne]:id}}:{})}})
    if(duplicate)fail(409,'Já existe um fiscal com este login.')
    if(id){
        const row=await AssinadorSigner.findByPk(id)
        if(!row)fail(404,'Fiscal não encontrado.')
        const patch={name,login,enabled:body.enabled!==false}
        if(password){
            patch.secret_cipher=encryptSecret(password)
            patch.secret_length=password.length
        }else if(!row.secret_cipher)fail(400,'Informe a senha eletrônica.')
        await row.update(patch)
        await auditActor(identity,'assinador.signer.saved',{signer_id:row.id,login:row.login,name:row.name})
        return {signer:publicSigner(await row.reload(),{includePasswordLength:true})}
    }
    if(!password)fail(400,'Informe a senha eletrônica.')
    const row=await AssinadorSigner.create({name,login,secret_cipher:encryptSecret(password),secret_length:password.length,enabled:body.enabled!==false})
    await auditActor(identity,'assinador.signer.saved',{signer_id:row.id,login:row.login,name:row.name})
    return {signer:publicSigner(row,{includePasswordLength:true})}
}

export async function deleteSigner(identity,id){
    requireManage(identity)
    const row=await AssinadorSigner.findByPk(id)
    if(!row)fail(404,'Fiscal não encontrado.')
    await auditActor(identity,'assinador.signer.deleted',{signer_id:row.id,login:row.login,name:row.name})
    await row.destroy()
    return {ok:true}
}

export async function revealSignerSecret(identity,id){
    requireManage(identity)
    if(!vaultConfigured())fail(503,'Configure ASSINADOR_VAULT_KEY antes de consultar senhas.')
    const row=await AssinadorSigner.findByPk(id)
    if(!row)fail(404,'Fiscal não encontrado.')
    if(!row.secret_cipher)fail(404,'Este fiscal ainda não tem senha eletrônica cadastrada.')
    let password
    try{password=decryptSecret(row.secret_cipher)}
    catch{fail(500,'Não foi possível decifrar a senha armazenada.')}
    if(row.secret_length!==password.length)await row.update({secret_length:password.length})
    await auditActor(identity,'assinador.signer.secret_revealed',{signer_id:row.id,login:row.login})
    return {password,passwordLength:password.length}
}

export async function listJobs(identity,query={}){
    requireUse(identity)
    const limit=Math.min(100,Math.max(1,Number(query.limit)||25))
    const offset=Math.max(0,Number(query.offset)||0)
    const where={}
    if(query.status){
        const status=String(query.status).trim()
        if(status)where.status=status
    }
    const scopeAll=query.scope==='all'&&canSeeAllJobs(identity)
    if(scopeAll&&/^\d+$/.test(String(query.user_id||'')))where.requested_by=Number(query.user_id)
    else if(!scopeAll)where.requested_by=identity.user.id
    const {rows,count}=await AssinadorJob.findAndCountAll({
        where,
        order:[['id','DESC']],
        limit,
        offset
    })
    return {jobs:rows.map(publicJob),total:count,limit,offset}
}

export async function latestForProtocol(identity,protocol){
    requireUse(identity)
    const value=Rules.protocol(protocol)
    const where={protocol_key:Rules.key(value)}
    if(!canSeeAllJobs(identity))where.requested_by=identity.user.id
    const job=await AssinadorJob.findOne({where,order:[['id','DESC']]})
    const view=job?publicJob(job):null
    return {job:view,banner:view?.banner||''}
}

export async function startJob(identity,{protocol,mode='assinar'}={}){
    requireUse(identity)
    if(!vaultConfigured())fail(503,'Configure ASSINADOR_VAULT_KEY antes de iniciar uma assinatura.')
    let value
    try{value=Rules.protocol(protocol)}
    catch(error){fail(400,error.message)}
    const key=Rules.key(value)
    // shortcut: a trava é deste processo; com mais de um Node no mesmo banco, serializar protocol_key no MySQL.
    if(protocolStarts.has(key))fail(409,'Este protocolo já possui uma execução em andamento.')
    protocolStarts.add(key)
    try{
        const running=await AssinadorJob.findOne({where:{protocol_key:key,status:{[Op.in]:['queued','running']}}})
        if(running){
            if(isAssinadorJobActive(running.id))fail(409,'Este protocolo já possui uma execução em andamento.')
            // Job órfão após restart do processo: libera o protocolo.
            await running.update({
                status:'paused',
                stage:'Interrompido pelo reinício do servidor',
                error:'A execução anterior foi interrompida quando o servidor reiniciou. Use Retomar.',
                finished_at:new Date()
            })
        }
        const previous=await AssinadorJob.findOne({where:{protocol_key:key},order:[['id','DESC']]})
        const resume=mode==='retomar'
        if(resume&&!RunPolicy.canResume(previous&&{stage:previous.stage,destination:previous.destination,protocol:previous.protocol,confirmed:previous.confirmed,signers:previous.signers})){
            fail(409,'Não há execução incompleta para retomar neste protocolo.')
        }
        const resumePrevious=resume&&previous?{
            stage:previous.stage,
            destination:previous.destination,
            protocol:previous.protocol,
            confirmed:previous.confirmed,
            signers:previous.signers||[]
        }:null
        const destination=RunPolicy.pdfDestination(assinadorPdfRoot(),value,resumePrevious)
        const replaceExisting=RunPolicy.shouldReplaceExisting(resumePrevious,destination)
        const job=await AssinadorJob.create({
            protocol:value,
            protocol_key:key,
            status:'queued',
            stage:resume?'Retomando':'Na fila',
            confirmed:resume?(previous.confirmed||0):0,
            signers:resume?(previous.signers||[]):[],
            log:[{at:new Date().toISOString(),message:resume?'Retomada solicitada.':'Assinatura solicitada.'}],
            destination,
            pdf_ready:false,
            pdf_expires_at:null,
            replace_existing:replaceExisting,
            requested_by:identity.user.id
        })
        enqueueAssinadorJob(job.id)
        return {job:publicJob(job)}
    }finally{
        protocolStarts.delete(key)
    }
}

export async function cancelJob(identity,id){
    const job=await getJob(identity,id)
    if(!['queued','running'].includes(job.status))fail(409,'Esta execução não está em andamento.')
    const active=cancelAssinadorJob(job.id)
    if(job.status==='queued'||!active){
        await job.update({
            status:'cancelled',
            stage:'Cancelado',
            error:'Execução cancelada pelo operador.',
            finished_at:new Date(),
            log:[...(job.log||[]),{at:new Date().toISOString(),message:'Execução cancelada pelo operador.'}].slice(-200)
        })
    }
    return {job:publicJob(await job.reload())}
}

export async function jobStatus(identity,id){
    return {job:publicJob(await getJob(identity,id))}
}

export async function openPdf(identity,id){
    const job=await getJob(identity,id)
    if(!job.pdf_ready||!job.destination||!existsSync(job.destination))fail(404,'PDF ainda não disponível.')
    if(pdfExpired(job))fail(410,'O PDF desta execução expirou. Inicie uma nova assinatura se precisar do arquivo.')
    const {ttlMs,maxAgeMs}=assinadorPdfRetention()
    const now=Date.now()
    const anchor=pdfAnchor(job).getTime()
    const renewed=new Date(Math.min(now+ttlMs,anchor+maxAgeMs))
    if(!job.pdf_expires_at||renewed.getTime()>new Date(job.pdf_expires_at).getTime()){
        await job.update({pdf_expires_at:renewed})
    }
    return {stream:createReadStream(job.destination),filename:job.destination.split(/[\\/]/).pop(),protocol:job.protocol}
}

export default {
    pageContext,
    listSigners,
    saveSigner,
    deleteSigner,
    revealSignerSecret,
    listJobs,
    latestForProtocol,
    startJob,
    cancelJob,
    jobStatus,
    openPdf,
    AssinadorError,
    PdfFile,
    PauseException
}
