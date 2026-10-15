import {pathToFileURL} from 'node:url'
import {DataTypes} from 'sequelize'
import db from './database.js'

export async function migrateReportOperations(){
    const schema=db.getQueryInterface()
    const columns=await schema.describeTable('reports')
    if(!columns.operation_id)await schema.addColumn('reports','operation_id',{type:DataTypes.STRING(36),allowNull:true})
    const indexes=await schema.showIndex('reports')
    if(!indexes.some(index=>index.name==='reports_operation_id'))await schema.addIndex('reports',['operation_id'],{name:'reports_operation_id'})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    try{await migrateReportOperations();console.log('Agrupamento de relatórios preparado; histórico preservado.')}
    catch(error){console.error(error.message);process.exitCode=1}
    finally{await db.close()}
}
