const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Load all YAML documentation files
const denunciationsDoc = YAML.load(path.join(__dirname, 'docs/denunciations.yaml'));
const usersDoc = YAML.load(path.join(__dirname, 'docs/users.yaml'));
const reportsDoc = YAML.load(path.join(__dirname, 'docs/reports.yaml'));
const commonDoc = YAML.load(path.join(__dirname, 'docs/common.yaml'));

// Merge all documents
const mergedDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Full API Documentation',
    version: '1.0.0',
    description: 'Combined API documentation for Users, Denunciations, and Reports'
  },
  servers: [
    { url: 'http://192.168.110.100/', description: 'Production server' }
  ],
  paths: {
    ...denunciationsDoc.paths,
    ...usersDoc.paths,
    ...reportsDoc.paths
  },
  components: commonDoc.components
};

module.exports = (app) => {
  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(mergedDoc));
  
  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.json(mergedDoc);
  });
};