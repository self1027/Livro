import userRepository from'../repositories/usersRepository.js'

async function getActiveUsers() {
    return userRepository.findActive()
}

function findByPk(id, options = {}) {
    return userRepository.findByPk(id, options)
}

async function getAllOrdered() {
    return userRepository.findAll({
        order: [['name', 'ASC']]
    })
}

async function create(data) {
  return userRepository.create(data)
}

async function update(id, { name, toggleActive } = {}) {
  const updated = await userRepository.update(id, { name, toggleActive })
  if (!updated) throw new Error('Usuário não encontrado')
  return updated
}

export default {
    getActiveUsers,
    findByPk,
    getAllOrdered,
    create,
    update
}