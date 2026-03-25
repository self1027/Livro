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

const mergedDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Full API Documentation',
    version: '1.0.0',
    description: 'Combined API documentation for Users, Denunciations, Reports, Admin and Districts'
  },
  servers: [
    { url: `http://${os.hostname()}`, description: 'Intranet server' }
  ],
  paths: {
    ...denunciationsDoc.paths,
    ...usersDoc.paths,
    ...reportsDoc.paths,
    ...adminDoc.paths,
    ...districtsDoc.paths
  },
  components: {
    ...commonDoc.components,
    schemas: {
      ...commonDoc.components?.schemas,
      ...denunciationsDoc.components?.schemas,
      ...usersDoc.components?.schemas,
      ...adminDoc.components?.schemas,
      ...districtsDoc.components?.schemas
    }
  }
}

export default function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(mergedDoc))

  app.get('/docs.json', (req, res) => {
    res.json(mergedDoc)
  })
}