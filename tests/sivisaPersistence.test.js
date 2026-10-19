import test from 'node:test'
import assert from 'node:assert/strict'
import ejs from 'ejs'
import {fileURLToPath} from 'node:url'
import {ReportSivisa} from '../src/models/sivisaModels.js'

test('observações SIVISA vindas do MariaDB podem ser reabertas após salvar',async()=>{
    for(const notes of [[],['Aguardando <vistoria>']]){
        const sivisa=ReportSivisa.build({report_id:1,applies:true})
        // The MySQL driver returns MariaDB JSON columns as text.
        sivisa.setDataValue('notes',JSON.stringify(notes))
        assert.deepEqual(sivisa.notes,notes)
        const fields=await ejs.renderFile(fileURLToPath(new URL('../views/partials/sivisaFields.ejs',import.meta.url)),{
            sivisaForm:{sivisa_protocol:sivisa.notes.map(()=>''),sivisa_note:sivisa.notes}
        })
        const summary=await ejs.renderFile(fileURLToPath(new URL('../views/partials/sivisaSummary.ejs',import.meta.url)),{
            report:{type:1,sivisa,sivisaProtocols:[{protocol:'01.000917/26'}]}
        })
        assert.match(summary,/01\.000917\/26/)
        if(notes.length){assert.match(fields,/Aguardando &lt;vistoria&gt;/);assert.match(summary,/Aguardando &lt;vistoria&gt;/)}
    }
    for(const notes of [null,[],['Observação']]){
        const sivisa=ReportSivisa.build({report_id:1,applies:true,notes})
        assert.deepEqual(sivisa.notes,notes)
    }
})
