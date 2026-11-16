import {isPortalInstability,PauseException} from './core.js'

export function isNetworkFailure(error){
    return isPortalInstability(error?.message||error)
}

export function sleep(ms,signal){
    return new Promise((resolve,reject)=>{
        if(signal?.aborted)return reject(signal.reason||new PauseException('Execução cancelada.'))
        const timer=setTimeout(resolve,ms)
        signal?.addEventListener('abort',()=>{
            clearTimeout(timer)
            reject(signal.reason||new PauseException('Execução cancelada.'))
        },{once:true})
    })
}

/** Até 3 tentativas só para falhas de rede/timeout do portal. */
export async function withNetworkRetry(fn,{attempts=3,delays=[1_500,4_000,8_000],signal,onRetry}={}){
    let last
    for(let index=0;index<attempts;index++){
        if(signal?.aborted)throw signal.reason||new PauseException('Execução cancelada.')
        try{return await fn(index)}
        catch(error){
            last=error
            if(!isNetworkFailure(error)||index===attempts-1)throw error
            onRetry?.(index+1,attempts,error)
            await sleep(delays[index]??5_000,signal)
        }
    }
    throw last
}
