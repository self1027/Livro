import connection from './database.js'
import catalogService from '../services/catalogService.js'

connection.options.logging = false
try {
    await catalogService.initialize()
    console.log('Cadastros inicializados. Os registros existentes foram preservados.')
} catch (error) {
    console.error('Falha ao inicializar cadastros:', error.message)
    process.exitCode = 1
} finally {
    await connection.close()
}
