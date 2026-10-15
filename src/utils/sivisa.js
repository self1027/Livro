export const SIVISA_LABELS=Object.freeze({pending:'Cabe SIVISA — ainda não registrado',registered:'SIVISA registrado',not_applicable:'Não cabe SIVISA',unclassified:'Sem classificação anterior à implantação'})
export const SIVISA_METRICS=Object.freeze({actions:'Ações',registered:'Com SIVISA',protocols:'Protocolos',pending:'Pendentes',notApplicable:'Não cabe SIVISA',unclassified:'Sem classificação'})
export function selectSivisaReports(reports,metric){
    const state={registered:'registered',protocols:'registered',pending:'pending',notApplicable:'not_applicable',unclassified:'unclassified'}[metric]
    return reports.filter(report=>Number(report.type)===1&&(metric==='actions'||state&&sivisaState(report)===state))
}
export function sivisaState(report){
    if(Number(report.type)===0)return 'not_applicable'
    if(report.sivisaProtocols?.length)return 'registered'
    if(report.sivisa?.applies===true||report.sivisa?.applies===1)return 'pending'
    if(report.sivisa?.applies===false||report.sivisa?.applies===0)return 'not_applicable'
    return 'unclassified'
}
const list=value=>value==null?[]:Array.isArray(value)?value:[value]
export function sivisaRows(input={}){
    const protocols=list(input.sivisa_protocol),notes=list(input.sivisa_note)
    return protocols.map((protocol,index)=>({protocol:typeof protocol==='string'?protocol:'',note:typeof notes[index]==='string'?notes[index]:''}))
}
export function normalizeSivisa(input,{editing=false}={}){
    const state=input.sivisa_state
    if(!['pending','registered','not_applicable'].includes(state))throw new Error('Informe se a ação cabe no SIVISA e se já foi registrada.')
    const rawProtocols=list(input.sivisa_protocol),rawNotes=list(input.sivisa_note)
    if(rawProtocols.length>100||rawNotes.length>100)throw new Error('Informe no máximo 100 protocolos por relatório.')
    const protocols=[]
    for(let index=0;index<rawProtocols.length;index++){
        const value=rawProtocols[index],noteValue=rawNotes[index]??''
        if(typeof value!=='string'||typeof noteValue!=='string')throw new Error('Protocolo ou observação SIVISA inválidos.')
        const protocol=value.trim().replace(/\s+/g,'').toUpperCase(),note=noteValue.trim()
        if(!protocol){if(note)throw new Error('Informe o protocolo correspondente à observação.');continue}
        if(protocol.length>64||!/^[A-Z0-9]+(?:[./-][A-Z0-9]+)*$/.test(protocol))throw new Error('Informe um protocolo SIVISA válido, com até 64 caracteres, como 01.000917/26.')
        if(note.length>500)throw new Error('A observação do protocolo deve ter até 500 caracteres.')
        protocols.push({protocol,note})
    }
    if(new Set(protocols.map(item=>item.protocol)).size!==protocols.length)throw new Error('O mesmo protocolo SIVISA foi informado mais de uma vez.')
    if(state==='not_applicable'&&protocols.length)throw new Error('Remova os protocolos antes de marcar que não cabe SIVISA.')
    if(state==='registered'&&!protocols.length&&!editing)throw new Error('Informe pelo menos um protocolo para marcar SIVISA registrado.')
    return {applies:state!=='not_applicable',protocols}
}
export function summarizeSivisa(reports,users=[]){
    const textual=reports.filter(report=>Number(report.type)===1)
    const count=rows=>({actions:rows.length,registered:rows.filter(report=>sivisaState(report)==='registered').length,pending:rows.filter(report=>sivisaState(report)==='pending').length,notApplicable:rows.filter(report=>sivisaState(report)==='not_applicable').length,unclassified:rows.filter(report=>sivisaState(report)==='unclassified').length,protocols:rows.reduce((sum,report)=>sum+(report.sivisaProtocols?.length||0),0)})
    return {...count(textual),byAuthor:users.map(user=>({...user,...count(textual.filter(report=>String(report.user_id)===String(user.id)))}))}
}
