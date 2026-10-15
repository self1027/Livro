import db from './database.js'
import {bootstrap} from '../auth/service.js'
try {
    await db.authenticate()
    const account=await bootstrap({username:process.env.BOOTSTRAP_USERNAME,password:process.env.BOOTSTRAP_PASSWORD,name:process.env.BOOTSTRAP_NAME,user_id:process.env.BOOTSTRAP_USER_ID||undefined})
    console.log(`Chefia criada: ${account.username}. Guarde a senha de forma segura e remova BOOTSTRAP_PASSWORD do ambiente.`)
}catch(error){console.error(error.message);process.exitCode=1}
finally{await db.close()}
