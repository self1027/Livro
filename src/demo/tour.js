import {inspectionDraft,closureDraft} from './data.js'
import {resetState} from './store.js'

export const steps=[
  {title:'Uma visão do trabalho da Vigilância',text:'Este é o Livro: denúncias, fiscalização e acompanhamento em um só lugar. Os 48 registros iniciais são fictícios. Vamos acompanhar um caso completo e ver seu efeito nos indicadores.',url:()=> '/',target:'.home-registers'},
  {title:'1. Registrar uma denúncia',text:'A denúncia já está preenchida. Revise a origem, o endereço, o bairro e a descrição. O protocolo é sequencial e o ano é automático. Você pode editar os campos antes de cadastrar.',url:()=>'/denuncias/new',target:'#denunciaForm',form:'#denunciaForm',button:'Cadastrar denúncia'},
  {title:'2. Protocolo e rastreabilidade',text:'A denúncia foi cadastrada e já aparece na listagem. O detalhe reúne origem, localização, responsável e histórico. Agora vamos distribuir o atendimento para uma fiscal.',url:s=>`/denuncias/${s.tour.complaintId}`,target:'.detail-summary'},
  {title:'3. Atribuir a fiscalização',text:'Ana Ribeiro está selecionada como responsável. A atribuição retira o registro da fila sem fiscal, registra a mudança no histórico e o disponibiliza na área da fiscal.',url:s=>`/admin/assignments?denunciaId=${s.tour.complaintId}`,target:'form[data-admin-save]',form:'form[data-admin-save]',fill:{userId:'2'},button:'Confirmar atribuição'},
  {title:'4. A área da fiscal',text:'A nova denúncia está na carteira de Ana. Cada fiscal pode consultar suas atribuições, filtrar o status e exportar a seleção para impressão ou PDF.',url:()=>'/area-fiscal/2',target:'.fiscal-area'},
  {title:'5. Registrar a vistoria',text:'O relatório técnico já está escrito. Vamos registrar a inspeção e mudar o status para Notificada no mesmo envio. Deixe o protocolo vazio para demonstrar a pendência SIVISA.',url:s=>`/denuncias/${s.tour.complaintId}#new-report`,target:'#new-report',form:'#detail-report-form',fill:{description:inspectionDraft,status:'NOTIFICADA'},button:'Salvar vistoria'},
  {title:'6. Histórico completo',text:'Texto e mudança de status foram registrados com data e autoria. A linha do tempo mantém também a atribuição. O relatório continua vinculado à autora mesmo se o responsável da denúncia mudar.',url:s=>`/denuncias/${s.tour.complaintId}#reports-section`,target:'#reports-section'},
  {title:'7. Controlar as pendências SIVISA',text:'O relatório criado aparece entre as ações que aguardam protocolo. A pendência pertence à ação e continua existindo mesmo quando a denúncia é finalizada. Na demo, você pode consultar as pendências de toda a equipe.',url:()=>'/sivisa/pendencias',target:'main'},
  {title:'8. Vincular o protocolo',text:'O protocolo fictício já está preenchido. Salve para retirar a ação da fila de pendências. O sistema também aceita vários protocolos e observações em um mesmo relatório.',url:s=>`/relatorio/${s.tour.reportId}/sivisa`,target:'form[data-sivisa-form]',form:'form[data-sivisa-form]',fill:{sivisa_protocol:'01.000917/26',sivisa_note:'Vistoria demonstrativa registrada no SIVISA'},button:'Salvar protocolo SIVISA'},
  {title:'9. Concluir a denúncia',text:'Após o retorno, a limpeza foi confirmada. O texto está pronto e o status será Finalizada. Este relatório de retorno está marcado como “Não cabe SIVISA”, uma decisão independente da ação anterior.',url:s=>`/denuncias/${s.tour.complaintId}#new-report`,target:'#new-report',form:'#detail-report-form',fill:{description:closureDraft,status:'FINALIZADA',sivisa_state:true},button:'Finalizar denúncia'},
  {title:'10. Caso concluído',text:'O status atual é Finalizada. O histórico preserva cadastro, atribuição, notificação, vistoria com protocolo e retorno. A conclusão já foi incorporada ao painel e à série mensal.',url:s=>`/denuncias/${s.tour.complaintId}`,target:'.detail-summary'},
  {title:'11. Buscar por protocolo e filtros',text:'Esta consulta localiza o caso que acabamos de concluir. Combine protocolo, ano, bairro, endereço, origem, status e fiscal. Os filtros aplicados podem ser removidos individualmente.',url:s=>`/buscar?number=${s.complaints.find(r=>r.id===s.tour.complaintId)?.number}&year=${s.complaints.find(r=>r.id===s.tour.complaintId)?.year}`,target:'.search-results'},
  {title:'12. Métricas e filas de atenção',text:'Os totais refletem as ações desta sessão. Veja abertas, finalizadas, sem fiscal, sem atividade e antigas. Clique nos indicadores para consultar as denúncias que compõem cada número.',url:()=>'/admin',target:'.admin-overview'},
  {title:'13. Ações, autoria e SIVISA',text:'Este painel conta ações por autora ou autor e diferencia protocolos, pendências e ações que não cabem no SIVISA. Uma ação pode ter vários protocolos. As datas consideram o registro do relatório.',url:()=>'/admin?view=sivisa',target:'.admin-panel'},
  {title:'14. Distribuições e evolução mensal',text:'Os gráficos cruzam registros, denúncias com relatório e finalizações ao longo dos meses. Também mostram bairros, status, origem, idade das abertas e carga por fiscal. Clique nos gráficos para detalhar os números.',url:()=>'/admin?view=analytics',target:'#monthChart'},
  {title:'15. Atividade recente',text:'A gestão acompanha as últimas ações com data, protocolo e autoria. Texto e status enviados juntos aparecem como uma única atividade no painel; o histórico da denúncia continua completo.',url:()=>'/admin?view=reports',target:'.admin-panel'},
  {title:'16. Exportar a seleção',text:'Use CSV para baixar os registros filtrados. Em Exportar PDF, uma janela abre o relatório de impressão: escolha “Imprimir / Salvar como PDF”. As exportações respeitam os filtros atuais.',url:()=>'/admin',target:'#denuncias'},
  {title:'17. Escala de fiscalização',text:'Consulte o mês ou edite a responsabilidade semanal, as exceções de cada dia e as anotações. Clique em uma semana ou dia útil para experimentar. As alterações ficam neste navegador.',url:()=>'/admin/schedule',target:'#calendario'},
  {title:'18. Cadastros e identidade visual',text:'Os nomes e cores dos status e das origens são configuráveis. A classificação define como o status entra nas métricas. A aba Bairros mantém os locais disponíveis no cadastro da denúncia.',url:()=>'/admin/catalogs',target:'.catalog-categories'},
  {title:'19. Pessoas, cargos e acessos',text:'Conheça a administração de pessoas e permissões. Você pode experimentar cadastros locais com dados fictícios. Credenciais são descartadas: esta demo pública não envia e-mails nem cria acessos reais.',url:()=>'/admin/access',target:'.access-grid'},
  {title:'20. Recados com contexto',text:'Abra uma conversa, envie um recado, referencie uma denúncia ou teste um anúncio. Tudo é uma simulação local: nenhuma pessoa real recebe mensagens e não há respostas automáticas se passando por uma equipe.',url:()=>'/recados?conversation=2',target:'#chat-app'},
  {title:'21. Configurar o atendimento',text:'Os dias, a pausa e a exibição do atendimento são administráveis. Salve uma configuração e veja a mudança no início. Isso completa a visão do fluxo de operação e gestão.',url:()=>'/admin?tab=attendance',target:'form[action="/admin/attendance"]'},
  {title:'Demonstração concluída',text:'Você acompanhou um caso do cadastro à conclusão, com atribuição, vistoria, SIVISA, métricas e gestão. Continue explorando livremente ou restaure os dados para repetir. O código e os contatos de Murilo estão nos créditos do rodapé.',url:()=> '/',target:'.footer',button:'Explorar livremente'}
]
export const tourUrl=state=>steps[Math.max(0,Math.min(steps.length-1,state.tour.step))].url(state)

export function mountTour(state,{persist,feedback}){
  let timer,busy=false,filled=false
  const bar=document.createElement('div');bar.className='demo-bar';bar.innerHTML='<div><strong>DEMO DE PORTFÓLIO</strong><span>Dados fictícios · acesso livre · alterações neste navegador</span></div><nav aria-label="Demonstração"><button type="button" data-demo="tour">Tour guiado</button><a href="/recados">Recados</a><a href="/admin/access">Acessos</a><button type="button" data-demo="reset">Restaurar dados</button></nav>';document.body.prepend(bar)
  const dialog=document.createElement('dialog');dialog.className='demo-welcome';dialog.setAttribute('aria-labelledby','demo-welcome-title');dialog.innerHTML='<div class="demo-welcome-brand"><img src="/favicon/livro.svg" width="40" height="40" alt=""><span>LIVRO · PORTFÓLIO DE MURILO DIAS</span></div><h2 id="demo-welcome-title">Da denúncia à resolução.</h2><p>Conheça um sistema de gestão da Vigilância Sanitária em funcionamento. Acompanhe um caso completo ou explore as telas no seu ritmo.</p><ol><li>Cadastre uma denúncia já preenchida.</li><li>Atribua uma fiscal e registre a vistoria.</li><li>Vincule o SIVISA, conclua e acompanhe as métricas.</li></ol><p class="demo-fine-print">Sem cadastro ou senha. Todos os dados são fictícios e as alterações ficam neste navegador. O tour inclui os módulos de gestão e pode ser pausado a qualquer momento.</p><div class="demo-welcome-actions"><button class="btn btn-primary" type="button" data-start="manual">Iniciar tour guiado</button><button class="btn btn-outline-secondary" type="button" data-start="auto">Assistir automaticamente</button><button class="btn btn-link" type="button" data-start="free">Entrar e explorar</button></div>';document.body.append(dialog)
  const panel=document.createElement('section');panel.id='demo-guide';panel.setAttribute('aria-label','Guia da demonstração');document.body.append(panel)
  function stop(){clearTimeout(timer);state.tour.playing=false;persist()}
  function start(auto=false){state.tour.welcomed=true;state.tour.active=true;state.tour.playing=auto;dialog.close();persist();location.assign(tourUrl(state))}
  dialog.querySelectorAll('[data-start]').forEach(button=>button.onclick=()=>{if(button.dataset.start==='free'){state.tour.welcomed=true;state.tour.active=false;state.tour.playing=false;persist();dialog.close();draw()}else start(button.dataset.start==='auto')})
  dialog.addEventListener('cancel',()=>{state.tour.welcomed=true;persist()})
  bar.querySelector('[data-demo="tour"]').onclick=()=>{stop();dialog.showModal()}
  bar.querySelector('[data-demo="reset"]').onclick=()=>{
    stop()
    if(!confirm('Restaurar os dados fictícios e reiniciar o tour? Suas alterações locais serão descartadas.')){draw();return}
    resetState(state);state.tour.welcomed=true;persist();location.assign('/')
  }
  const onStep=()=>{const url=new URL(tourUrl(state),location.origin);return url.pathname===location.pathname&&[...url.searchParams].every(([k,v])=>new URLSearchParams(location.search).get(k)===v)}
  function fill(){const step=steps[state.tour.step];if(!onStep())return
    for(const [name,value] of Object.entries(step.fill||{})){
      const field=document.querySelector(`${step.form} [name="${name}"]`);if(!field)continue
      if(field.type==='checkbox')field.checked=!!value;else field.value=value
      field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}))
    }
  }
  async function next(){
    if(busy)return;busy=true;clearTimeout(timer)
    if(!onStep()){persist();location.assign(tourUrl(state));return}
    const step=steps[state.tour.step]
    if(state.tour.step===steps.length-1){state.tour.active=false;stop();draw();busy=false;return}
    const completed=state.tour.step===1&&state.tour.complaintId||state.tour.step===3&&state.complaints.find(r=>r.id===state.tour.complaintId)?.user_id||state.tour.step===5&&state.tour.reportId||state.tour.step===8&&state.reports.find(r=>r.id===state.tour.reportId)?.sivisaProtocols?.length||state.tour.step===9&&state.complaints.find(r=>r.id===state.tour.complaintId)?.status==='FINALIZADA'
    if(step.form&&!completed){
      const form=document.querySelector(step.form)
      if(!form){feedback('Volte à etapa para continuar.');busy=false;stop();draw();return}
      state.tour.pendingStep=state.tour.step+1
      form.requestSubmit()
      // Validações dos formulários originais podem impedir o envio.
      setTimeout(()=>{if(document.visibilityState==='visible'){delete state.tour.pendingStep;busy=false;stop();draw()}},500)
    }else{state.tour.step++;persist();location.assign(tourUrl(state))}
  }
  function schedule(){clearTimeout(timer);if(state.tour.active&&state.tour.playing&&document.visibilityState==='visible'&&!dialog.open)timer=setTimeout(next,6500)}
  function draw(){
    panel.hidden=!state.tour.active
    document.body.classList.toggle('demo-touring',state.tour.active)
    document.querySelectorAll('.demo-spotlight').forEach(n=>n.classList.remove('demo-spotlight'))
    if(!state.tour.active)return
    state.tour.step=Math.max(0,Math.min(steps.length-1,Number(state.tour.step)||0))
    const step=steps[state.tour.step]
    panel.replaceChildren()
    const top=document.createElement('div');top.className='demo-guide-top';const count=document.createElement('span');count.textContent=`PASSO ${state.tour.step+1} DE ${steps.length}`;const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.setAttribute('aria-label','Fechar guia e explorar livremente');close.onclick=()=>{state.tour.active=false;stop();draw()};top.append(count,close)
    const progress=document.createElement('progress');progress.max=steps.length;progress.value=state.tour.step+1;progress.setAttribute('aria-label','Progresso da demonstração')
    const heading=document.createElement('h2');heading.textContent=step.title;const description=document.createElement('p');description.textContent=step.text
    const actions=document.createElement('div');actions.className='demo-guide-actions'
    const previous=document.createElement('button');previous.type='button';previous.className='btn btn-outline-secondary';previous.textContent='Voltar';previous.disabled=state.tour.step===0;previous.onclick=()=>{stop();state.tour.step--;persist();location.assign(tourUrl(state))}
    const play=document.createElement('button');play.type='button';play.className='btn btn-outline-secondary';play.dataset.tourPlay='';play.textContent=state.tour.playing?'Pausar':'Automático';play.setAttribute('aria-pressed',String(state.tour.playing));play.onclick=()=>{state.tour.playing=!state.tour.playing;persist();draw();panel.querySelector('[data-tour-play]')?.focus();schedule()}
    const advance=document.createElement('button');advance.type='button';advance.className='btn btn-primary';advance.dataset.tourNext='';advance.textContent=onStep()?step.button||'Próximo passo':'Retomar etapa';advance.onclick=next
    actions.append(previous,play,advance);panel.append(top,progress,heading,description,actions)
    if(!onStep()){stop();play.textContent='Automático';return}
    if(!filled){fill();filled=true}
    const target=document.querySelector(step.target);target?.classList.add('demo-spotlight')
    if(target&&!location.hash)target.scrollIntoView({block:'center',behavior:'instant'})
    schedule()
  }
  document.addEventListener('visibilitychange',schedule)
  if(!state.tour.welcomed){dialog.showModal()}
  draw()
}
