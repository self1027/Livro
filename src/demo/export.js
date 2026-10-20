import {dashboard,filterComplaints} from './store.js'
import {statuses,senders} from '../utils/catalogRegistry.js'

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function csv(rows){
  const cell=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"'
  return '\uFEFF'+[['Protocolo','Título','Endereço','Bairro','Status','Fiscal','Origem'],...rows.map(r=>[`${r.number}/${r.year}`,r.title,`${r.endereco}, ${r.numero}`,r.bairro,statuses[r.status]?.label||r.status,r.user?.name||'Não atribuído',senders[r.registration_type]||r.registration_type])].map(row=>row.map(cell).join(';')).join('\r\n')
}
export function exportData(state,url){
  const query=Object.fromEntries(url.searchParams)
  const rows=url.pathname==='/denuncias/pdf'?filterComplaints(state,{userId:query.fiscalId,status:query.status==='ALL'?'':query.status}):dashboard(state,query).exportRows
  if(url.pathname.endsWith('/csv')){
    const blob=new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download='livro-demonstracao.csv';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);return
  }
  const popup=window.open('','_blank');if(!popup)throw Error('Permita a janela de impressão para exportar o PDF.')
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Livro · Relatório demonstrativo</title><style>body{font:14px Arial;margin:32px;color:#182e2a}table{border-collapse:collapse;width:100%}td,th{padding:8px;text-align:left;border-bottom:1px solid #ccc}button{padding:12px}@media print{button{display:none}}</style></head><body><h1>Livro · Relatório de denúncias</h1><p>Demonstração de portfólio · dados fictícios · ${rows.length} registros nos filtros selecionados.</p><button onclick="window.print()">Imprimir / Salvar como PDF</button><table><thead><tr><th>Protocolo</th><th>Denúncia</th><th>Localização</th><th>Status</th><th>Fiscal</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.number}/${r.year}</td><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.endereco)}, ${escapeHtml(r.numero)} · ${escapeHtml(r.bairro)}</td><td>${escapeHtml(statuses[r.status]?.label)}</td><td>${escapeHtml(r.user?.name||'Não atribuído')}</td></tr>`).join('')}</tbody></table></body></html>`);popup.document.close()
}
