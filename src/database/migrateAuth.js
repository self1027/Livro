import {pathToFileURL} from 'node:url'
import db from './database.js'
import {authModels,Role,Setting,Account} from '../auth/models.js'
import {seedRoles} from '../auth/permissions.js'
import {migrateDenunciationCreators} from './migrateDenunciationCreators.js'

export async function migrateAuth() {
    // MySQL DDL is not transactional. Every step is safe to repeat after interruption.
    const tables=await db.getQueryInterface().showAllTables()
    if(!tables.includes('users'))throw new Error('A tabela users deve existir. Restaure a base do Livro antes de migrar.')
    if(tables.includes('denunciations'))await migrateDenunciationCreators()
    for(const model of authModels)await model.sync() // Never alter/drop existing tables.
    const columns=await db.getQueryInterface().describeTable(Setting.tableName)
    for(const field of ['role_receiving_migrated','fiscal_area_permissions_migrated','denunciation_edit_permissions_migrated']){
        if(!columns[field])await db.getQueryInterface().addColumn(Setting.tableName,field,Setting.rawAttributes[field])
    }
    await db.transaction(async transaction=>{
        const [setting]=await Setting.findOrCreate({where:{id:1},defaults:{recovery_email:null},transaction})
        const locked=await Setting.findByPk(setting.id,{transaction,lock:transaction.LOCK.UPDATE})
        if(!locked.roles_seeded){
            for(const role of seedRoles)await Role.findOrCreate({where:{name:role.name},defaults:role,transaction})
            await locked.update({roles_seeded:true},{transaction})
        }
        if(!locked.role_receiving_migrated){
            const roles=await Role.findAll({transaction})
            for(const role of roles){
                const accounts=await Account.findAll({where:{role_id:role.id},transaction})
                const receivers=accounts.filter(account=>account.inspector)
                const permissions=role.permissions.filter(key=>!['staff.manage','aif.use','denunciations.receive'].includes(key))
                if(receivers.length&&receivers.length<accounts.length){
                    let name=role.name.slice(0,48)+' — recebe denúncias',suffix=1
                    while(await Role.findOne({where:{name},transaction}))name=role.name.slice(0,48)+' — recebe denúncias '+suffix++
                    const receivingRole=await Role.create({name,maximum:role.maximum,permissions:[...permissions,'denunciations.receive']},{transaction})
                    for(const account of receivers)await account.update({role_id:receivingRole.id},{transaction})
                }else if(receivers.length||(!accounts.length&&role.permissions.includes('denunciations.receive')))permissions.push('denunciations.receive')
                await role.update({permissions},{transaction})
            }
            await locked.update({role_receiving_migrated:true},{transaction})
        }
        if(!locked.fiscal_area_permissions_migrated){
            for(const role of await Role.findAll({transaction})){
                const permissions=role.permissions.filter(key=>key!=='fiscal.read')
                if(role.permissions.includes('fiscal.read')){
                    permissions.push(role.permissions.includes('fiscal.all')||role.maximum?'fiscal.area.all':'fiscal.area.own')
                }else if(role.maximum)permissions.push('fiscal.area.all')
                await role.update({permissions:[...new Set(permissions)]},{transaction})
            }
            await locked.update({fiscal_area_permissions_migrated:true},{transaction})
        }
        if(!locked.denunciation_edit_permissions_migrated){
            for(const role of await Role.findAll({transaction})){
                const permissions=role.permissions.filter(key=>key!=='denunciations.edit')
                if(role.permissions.includes('denunciations.edit'))permissions.push(role.maximum||role.permissions.includes('fiscal.all')?'denunciations.edit.all':'denunciations.edit.own')
                await role.update({permissions:[...new Set(permissions)]},{transaction})
            }
            await locked.update({denunciation_edit_permissions_migrated:true},{transaction})
        }
    })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    try{await db.authenticate();await migrateAuth();console.log('Migração de autenticação concluída. Os fiscais existentes foram preservados sem credenciais automáticas.')}
    catch(error){console.error(error.message);process.exitCode=1}
    finally{await db.close()}
}
