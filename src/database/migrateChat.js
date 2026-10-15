import {pathToFileURL} from 'node:url'
import db from './database.js'
import {chatModels} from '../models/chatModels.js'

export async function migrateChat(){
    const tables=await db.getQueryInterface().showAllTables()
    if(!tables.includes('users')||!tables.includes('denunciations'))throw new Error('As tabelas users e denunciations devem existir antes da migração de recados.')
    // Additive only: running again never resets conversations or historical messages.
    for(const model of chatModels)await model.sync()
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    try{await migrateChat();console.log('Conversas, anúncios e comprovantes de leitura preparados.')}
    catch(error){console.error('Não foi possível preparar os recados:',error.message);process.exitCode=1}
    finally{await db.close()}
}
