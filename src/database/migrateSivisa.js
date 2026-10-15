import {pathToFileURL} from 'node:url'
import db from './database.js'
import {ReportSivisa,SivisaProtocol} from '../models/sivisaModels.js'

export async function migrateSivisa(){
    const tables=await db.getQueryInterface().showAllTables()
    if(!tables.includes('reports'))throw new Error('A tabela reports deve existir antes da migração SIVISA.')
    await ReportSivisa.sync();await SivisaProtocol.sync()
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    try{await migrateSivisa();console.log('SIVISA preparado. Relatórios anteriores preservados sem classificação automática.')}
    catch(error){console.error(error.message);process.exitCode=1}
    finally{await db.close()}
}
