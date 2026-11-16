import {pathToFileURL} from 'node:url'
import {mkdir,readdir,unlink,stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {Op} from 'sequelize'
import db from './database.js'
import {AssinadorJob,AssinadorSigner,assinadorModels} from '../models/assinadorModels.js'
import {decryptSecret,vaultConfigured} from '../assinador/vault.js'

export function assinadorPdfRoot(){
    return process.env.ASSINADOR_PDF_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'../../data/assinador/pdfs')
}

function toMs(value,fallback){
    const parsed=Number(value)
    return Number.isFinite(parsed)&&parsed>0?parsed:fallback
}

export function assinadorPdfRetention(){
    const ttlMs=toMs(process.env.ASSINADOR_PDF_TTL_MS,60*60*1000)
    const maxAgeMs=Math.max(toMs(process.env.ASSINADOR_PDF_MAX_AGE_MS,24*60*60*1000),ttlMs)
    const sweepMs=toMs(process.env.ASSINADOR_PDF_SWEEP_MS,5*60*1000)
    return {ttlMs,maxAgeMs,sweepMs}
}

let sweepTimer=null

export async function sweepAssinadorPdfs(){
    const {maxAgeMs}=assinadorPdfRetention()
    const now=Date.now()
    const root=assinadorPdfRoot()
    const expiredJobs=await AssinadorJob.findAll({
        where:{
            pdf_ready:true,
            [Op.or]:[
                {pdf_expires_at:{[Op.lt]:new Date(now)}},
                {pdf_expires_at:null,finished_at:{[Op.lt]:new Date(now-maxAgeMs)}}
            ]
        },
        attributes:['id','destination']
    })
    for(const job of expiredJobs){
        if(job.destination)await unlink(job.destination).catch(()=>{})
        await job.update({pdf_ready:false,pdf_expires_at:null,destination:null})
    }
    try{
        const names=await readdir(root)
        const referenced=new Set((await AssinadorJob.findAll({where:{pdf_ready:true},attributes:['destination']})).map(row=>row.destination).filter(Boolean).map(item=>path.resolve(item)))
        for(const name of names){
            if(!name.toLowerCase().endsWith('.pdf')||name.startsWith('.'))continue
            const full=path.resolve(root,name)
            if(referenced.has(full))continue
            const info=await stat(full).catch(()=>null)
            if(!info?.isFile()||now-info.mtimeMs<maxAgeMs)continue
            await unlink(full).catch(()=>{})
        }
    }catch{}
    return {clearedJobs:expiredJobs.length}
}

export function startAssinadorPdfSweep(log=message=>console.log(`[assinador] ${message}`)){
    if(sweepTimer)return sweepTimer
    const {sweepMs}=assinadorPdfRetention()
    const tick=async()=>{
        try{
            const result=await sweepAssinadorPdfs()
            if(result.clearedJobs)log(`Limpeza de PDFs: ${result.clearedJobs} execução(ões) expirada(s).`)
        }catch(error){log(`Falha na limpeza de PDFs: ${error.message||error}`)}
    }
    tick()
    sweepTimer=setInterval(tick,sweepMs)
    if(typeof sweepTimer.unref==='function')sweepTimer.unref()
    return sweepTimer
}

export async function migrateAssinador(){
    const tables=await db.getQueryInterface().showAllTables()
    if(!tables.includes('users'))throw new Error('A tabela users deve existir antes da migração do Assinador SIVISA.')
    for(const model of assinadorModels)await model.sync()
    if(tables.includes(AssinadorJob.tableName)){
        const columns=await db.getQueryInterface().describeTable(AssinadorJob.tableName)
        if(!columns.pdf_expires_at)await db.getQueryInterface().addColumn(AssinadorJob.tableName,'pdf_expires_at',AssinadorJob.rawAttributes.pdf_expires_at)
        if(!columns.last_progress_at)await db.getQueryInterface().addColumn(AssinadorJob.tableName,'last_progress_at',AssinadorJob.rawAttributes.last_progress_at)
    }
    if(tables.includes(AssinadorSigner.tableName)||(await db.getQueryInterface().showAllTables()).includes(AssinadorSigner.tableName)){
        const columns=await db.getQueryInterface().describeTable(AssinadorSigner.tableName)
        if(!columns.secret_length)await db.getQueryInterface().addColumn(AssinadorSigner.tableName,'secret_length',AssinadorSigner.rawAttributes.secret_length)
        if(vaultConfigured()){
            const pending=await AssinadorSigner.findAll({where:{secret_cipher:{[Op.ne]:null},secret_length:null}})
            for(const row of pending){
                try{
                    const password=decryptSecret(row.secret_cipher)
                    await row.update({secret_length:password.length})
                }catch{}
            }
        }
    }
    await mkdir(assinadorPdfRoot(),{recursive:true})
    if(!vaultConfigured())console.warn('ASSINADOR_VAULT_KEY ainda não está definida. O cadastro de senhas ficará indisponível até configurar a chave.')
}

/** Jobs queued/running sem worker após restart do processo. */
export async function reclaimAssinadorOrphans(){
    const now=new Date()
    const [count]=await AssinadorJob.update({
        status:'paused',
        stage:'Interrompido pelo reinício do servidor',
        error:'A execução foi interrompida quando o servidor reiniciou. Prefira Retomar.',
        finished_at:now,
        last_progress_at:now
    },{where:{status:{[Op.in]:['queued','running']}}})
    return count
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    try{await migrateAssinador();console.log('Assinador SIVISA preparado.')}
    catch(error){console.error('Não foi possível preparar o Assinador SIVISA:',error.message);process.exitCode=1}
    finally{await db.close()}
}
