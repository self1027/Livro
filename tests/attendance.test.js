import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import ejs from 'ejs'
import {createAttendanceService} from '../src/services/attendanceService.js'
import {statuses, senders, senderDetails} from '../src/utils/catalogRegistry.js'

test('desabilitar preserva dias e pausa; configurações antigas continuam habilitadas', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(),'livro-attendance-'))
    const file = path.join(directory,'attendance.json')
    const service = createAttendanceService(file)
    try {
        await fs.writeFile(file,JSON.stringify({weekdays:['SEG','SEX'],paused:true}))
        assert.equal((await service.get()).enabled,true)
        await service.update({enabled:false,weekdays:[],paused:false})
        const disabled = await service.get()
        assert.equal(disabled.enabled,false)
        assert.deepEqual(disabled.weekdays,['SEG','SEX'])
        assert.equal(disabled.paused,true)
        const render = attendance => ejs.renderFile(fileURLToPath(new URL('../views/index.ejs',import.meta.url)),{attendance,denuncias:[],DENUNCIATION_STATUS:statuses,DENUNCIATION_SENDER:senders,SENDER_DETAILS:senderDetails,offset:50,limit:50})
        assert.ok(!(await render(disabled)).includes('class="home-attendance"'))
        const enabled = await service.update({enabled:true,weekdays:disabled.weekdays,paused:disabled.paused})
        assert.ok((await render(enabled)).includes('class="home-attendance"'))
        assert.deepEqual(enabled.weekdays,['SEG','SEX'])
    } finally { await fs.rm(directory,{recursive:true,force:true}) }
})
