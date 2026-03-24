import User from '../models/usersModel.js'

function findAll(options = {}) {
    return User.findAll(options)
}

function findActive() {
    return User.findAll({
        where: {
            ativo: true
        }
    })
}

function findByPk(id, options = {}) {
    return User.findByPk(id, options)
}

function create(data) {
  return User.create(data)
}

async function update(id, { name, toggleActive } = {}) {
  const user = await User.findByPk(id)
  if (!user) return null

  if (name !== undefined) user.name = name
  if (toggleActive) user.ativo = !user.ativo

  return user.save()
}

export default {
    findActive,
    findByPk,
    findAll,
    create,
    update
}