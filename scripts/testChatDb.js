import {spawn} from 'node:child_process'
const child=spawn(process.execPath,['--test','tests/chatDb.test.js'],{stdio:'inherit',windowsHide:true,env:{...process.env,CHAT_DB_TESTS:'true'}})
child.on('exit',code=>{process.exitCode=code??1})
