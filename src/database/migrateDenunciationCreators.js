import {pathToFileURL} from 'node:url'
import {DataTypes} from 'sequelize'
import db from './database.js'

export async function migrateDenunciationCreators(){
    const schema=db.getQueryInterface()
    const columns=await schema.describeTable('denunciations')
    if(!columns.created_by_user_id)await schema.addColumn('denunciations','created_by_user_id',{type:DataTypes.INTEGER,allowNull:true})
    const indexes=await schema.showIndex('denunciations')
    if(!indexes.some(index=>index.fields.length===1&&index.fields[0].attribute==='created_by_user_id'))await schema.addIndex('denunciations',['created_by_user_id'],{name:'denunciations_created_by_user_id'})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    try{await migrateDenunciationCreators();console.log('Autoria de cadastro preparada. Denúncias antigas preservadas sem autor presumido.')}
    catch(error){console.error(error.message);process.exitCode=1}
    finally{await db.close()}
}
