import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const denunciationsDoc = YAML.load(path.join(__dirname, './docs/denunciations.yaml'))
const usersDoc = YAML.load(path.join(__dirname, './docs/users.yaml'))
const reportsDoc = YAML.load(path.join(__dirname, './docs/reports.yaml'))
const adminDoc = YAML.load(path.join(__dirname, './docs/admin.yaml'))
const districtsDoc = YAML.load(path.join(__dirname, './docs/districts.yaml'))
const commonDoc = YAML.load(path.join(__dirname, './docs/common.yaml'))
const authDoc = YAML.load(path.join(__dirname, './docs/auth.yaml'))

const mergedDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Full API Documentation',
    version: '1.0.0',
    description: 'Combined API documentation for Users, Denunciations, Reports, Admin and Districts'
  },
  servers: [
    { url: process.env.APP_URL||`http://${os.hostname()}`, description: 'Servidor do Livro' }
  ],
  paths: {
    ...denunciationsDoc.paths,
    ...usersDoc.paths,
    ...reportsDoc.paths,
    ...adminDoc.paths,
    ...districtsDoc.paths,
    ...authDoc.paths
  },
  components: {
    ...commonDoc.components,
    parameters: {...commonDoc.components?.parameters,...reportsDoc.components?.parameters},
    responses: {...commonDoc.components?.responses,...reportsDoc.components?.responses},
    securitySchemes: {...commonDoc.components?.securitySchemes,...authDoc.components.securitySchemes},
    schemas: {
      ...commonDoc.components?.schemas,
      ...denunciationsDoc.components?.schemas,
      ...usersDoc.components?.schemas,
      ...reportsDoc.components?.schemas,
      ...adminDoc.components?.schemas,
      ...districtsDoc.components?.schemas,
      ...authDoc.components.schemas
    }
  }
}

if(process.env.AUTH_ENABLED==='true')mergedDoc.security=[{opaqueBearer:[]}]

export default function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(mergedDoc))

  app.get('/docs.json', (req, res) => {
    res.json(mergedDoc)
  })
}
