import PDFDocument from 'pdfkit'
import STATUS from '../constants/denunciationStatus.js'
import SENDERS from '../constants/denunciationSenders.js'

const statusLabel = row => STATUS[row.status]?.label || 'Sem status reconhecido'
const csvCell = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
}
export function exportCsv(res, data) {
    const lines = [['Protocolo', 'Título', 'Status', 'Bairro', 'Endereço', 'Número', 'Fiscal', 'Origem', 'Data de registro', 'Último relatório', 'Idade (dias)', 'Dias sem relatório']]
    data.exportRows.forEach(row => lines.push([
        `${row.number}/${row.year}`, row.title, statusLabel(row), row.bairro, row.endereco, row.numero,
        row.user?.name || 'Sem fiscal', SENDERS[row.registration_type] || row.registration_type, new Date(row.created_at).toISOString(),
        row.last_activity ? new Date(row.last_activity).toISOString() : '', row.age, row.idleDays
    ]))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="painel-denuncias.csv"')
    res.send('\uFEFF' + lines.map(line => line.map(csvCell).join(';')).join('\r\n'))
}
export function exportPdf(res, data) {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="painel-administrativo.pdf"')
    const doc = new PDFDocument({ margin: 45 })
    doc.pipe(res)
    doc.fontSize(18).text('Painel Administrativo — Livro')
    doc.fontSize(9).text(`Emitido em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
    doc.moveDown().text('Indicadores refletem os filtros gerais. A lista reflete também a fila selecionada.')
    const f = data.filters
    const user = data.users.find(user => String(user.id) === f.userId)
    doc.text(`Ano do protocolo: ${f.year || 'Todos'} | Situação: ${f.scope === 'open' ? 'Somente abertas' : 'Todas'}`)
    doc.text(`Registro: ${f.start || 'Sem início definido'} a ${f.end || 'Sem fim definido'}`)
    doc.text(`Fiscal: ${f.userId === 'unassigned' ? 'Sem fiscal' : user?.name || 'Todos'} | Bairro: ${f.bairro || 'Todos'}`)
    doc.text(`Status: ${STATUS[f.status]?.label || 'Todos'} | Origem: ${SENDERS[f.registration_type] || 'Todas'}`)
    const queues = { unassigned: 'Abertas sem fiscal', inactive: 'Abertas sem relatório', old: 'Abertas há mais de 60 dias', closed: 'Finalizadas', open: 'Em aberto', progress: 'Em andamento', age0: 'Abertas até 7 dias', age1: 'Abertas de 8 a 30 dias', age2: 'Abertas de 31 a 60 dias', age3: 'Abertas há mais de 60 dias' }
    doc.text(`Lista: ${queues[f.queue] || 'Todas as denúncias filtradas'}`)
    doc.moveDown().fontSize(11).text(`Total: ${data.stats.total} | Abertas: ${data.stats.open} | Finalizadas: ${data.stats.closed}`)
    doc.text(`Abertas sem fiscal: ${data.stats.unassigned} | Sem relatório há ${data.filters.inactivityDays} dias: ${data.stats.inactive}`)
    doc.moveDown().text(`Denúncias na lista: ${data.selectedCount}`)
    data.exportRows.forEach(row => {
        if (doc.y > 680) doc.addPage()
        doc.moveDown().fontSize(11).text(`${row.number}/${row.year} — ${row.title}`)
        doc.fontSize(9).text(`${statusLabel(row)} | ${row.bairro} | Fiscal: ${row.user?.name || 'Sem fiscal'}`)
        doc.text(`Idade: ${row.age} dias | Sem relatório: ${row.idleDays} dias`)
    })
    doc.end()
}
