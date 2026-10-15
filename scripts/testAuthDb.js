import {spawn} from 'node:child_process'
const child=spawn(process.execPath,['--test','tests/authDb.test.js'],{stdio:'inherit',windowsHide:true,env:{...process.env,AUTH_DB_TESTS:'true'}})
child.on('exit',code=>{process.exitCode=code??1})
