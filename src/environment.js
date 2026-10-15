import {loadEnvFile} from 'node:process'

// Load before database configuration, including when started directly or via nodemon.
// Variables supplied by the service or terminal retain precedence.
try{loadEnvFile()}catch(error){if(error.code!=='ENOENT')throw error}
