import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(derive)
const options = {N:131072,r:8,p:1,maxmem:256*1024*1024}
let running=0
const queue=[]
async function derivePassword(value,salt){
    if(running>=2){
        if(queue.length>=32)throw new Error('Serviço de senhas ocupado. Tente novamente.')
        await new Promise(resolve=>queue.push(resolve))
    }else running++
    try{return await scrypt(value,salt,64,options)}
    finally{const next=queue.shift();if(next)next();else running--}
}
export const randomToken = () => randomBytes(32).toString('base64url')
export const tokenHash = value => createHash('sha256').update(value).digest('hex')
export function validatePassword(value,{minLength=15}={}) {
    if(typeof value!=='string'||value.length<minLength||value.length>128)throw new Error(`A senha deve ter de ${minLength} a 128 caracteres.`)
}
export function normalizeUsername(value) {
    if(typeof value!=='string'||!/^[a-zA-Z0-9._-]{3,64}$/.test(value))throw new Error('Username: use de 3 a 64 letras, números, pontos, hífens ou sublinhados.')
    return value.toLowerCase()
}
export async function hashPassword(value,options) {
    validatePassword(value,options)
    const salt=randomBytes(16).toString('hex')
    const hash=await derivePassword(value,salt)
    return `scrypt:${salt}:${hash.toString('hex')}`
}
export async function verifyPassword(value,stored) {
    if(typeof value!=='string'||value.length>128)return false
    const [scheme,salt,hex]=String(stored||'').split(':')
    if(scheme!=='scrypt'||!salt||!hex)return false
    const hash=await derivePassword(value,salt), expected=Buffer.from(hex,'hex')
    return hash.length===expected.length&&timingSafeEqual(hash,expected)
}
