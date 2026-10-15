import User from '../models/usersModel.js'
import {Op} from 'sequelize'
import {Account,Role} from '../auth/models.js'
import {updateLegacyUser} from '../auth/service.js'

async function receivingFilter() {
    if(process.env.AUTH_ENABLED!=='true')return {}
    const roles=await Role.findAll({attributes:['id','permissions']})
    const roleIds=roles.filter(role=>role.permissions.includes('denunciations.receive')).map(role=>role.id)
    const accounts=await Account.findAll({where:{enabled:true,role_id:{[Op.in]:roleIds}},attributes:['user_id']})
    return {id:{[Op.in]:accounts.map(account=>account.user_id)}}
}

async function findAll(options = {}) {
    return User.findAll(options)
}

async function findActive() {
    return User.findAll({
        where: {
            ativo: true,
            ...await receivingFilter()
        }
    })
}

function findByPk(id, options = {}) {
    return User.findByPk(id, options)
}

function create(data) {
  return User.create(data)
}

async function update(id, { name, toggleActive, ativo, actor } = {}) {
  if(process.env.AUTH_ENABLED==='true')return updateLegacyUser(id,{name,toggleActive,ativo,actor})
  const user = await User.findByPk(id)
  if (!user) return null

  if (name !== undefined) user.name = name
  if (typeof ativo === 'boolean') user.ativo = ativo
  else if (toggleActive) user.ativo = !user.ativo

  return user.save()
}

export default {
    findActive,
    findByPk,
    findAll,
    create,
    update
}
