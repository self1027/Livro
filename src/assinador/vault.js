import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto'

function keyBytes(){
    const raw=process.env.ASSINADOR_VAULT_KEY||''
    if(!/^[0-9a-fA-F]{64}$/.test(raw))throw new Error('Defina ASSINADOR_VAULT_KEY com 64 caracteres hexadecimais (32 bytes).')
    return Buffer.from(raw,'hex')
}

export function vaultConfigured(){
    return /^[0-9a-fA-F]{64}$/.test(process.env.ASSINADOR_VAULT_KEY||'')
}

export function encryptSecret(plain){
    const text=String(plain??'')
    if(!text)throw new Error('Informe a senha eletrônica.')
    const iv=randomBytes(12)
    const cipher=createCipheriv('aes-256-gcm',keyBytes(),iv)
    const encrypted=Buffer.concat([cipher.update(text,'utf8'),cipher.final()])
    const tag=cipher.getAuthTag()
    return Buffer.concat([iv,tag,encrypted]).toString('base64')
}

export function decryptSecret(payload){
    const buffer=Buffer.from(String(payload||''),'base64')
    if(buffer.length<29)throw new Error('Credencial armazenada inválida.')
    const iv=buffer.subarray(0,12)
    const tag=buffer.subarray(12,28)
    const data=buffer.subarray(28)
    const decipher=createDecipheriv('aes-256-gcm',keyBytes(),iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8')
}

export function fingerprint(plain){
    return createHash('sha256').update(String(plain||''),'utf8').digest('hex').slice(0,16)
}

export function sameSecret(left,right){
    const a=Buffer.from(String(left||''),'utf8')
    const b=Buffer.from(String(right||''),'utf8')
    return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)
}
