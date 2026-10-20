import {loadState,saveState} from './store.js'
import {pageContext} from './pages.js'
import {renderPage} from './render.js'
import {mutate} from './actions.js'
import {localApi} from './api.js'
import {exportData} from './export.js'
import {mountTour,tourUrl} from './tour.js'

let storage
try{storage=window.localStorage}catch{storage={getItem(){return null},setItem(){throw Error('blocked')}}}
const state=loadState(storage)
let templates
function feedback(message){let node=document.getElementById('demo-feedback');if(!node){node=document.createElement('p');node.id='demo-feedback';node.setAttribute('role','alert');node.className='alert alert-warning demo-feedback';document.body.append(node)}node.textContent=message;node.hidden=false}
function persist(){try{saveState(storage,state);return true}catch(error){feedback(error.message);return false}}
const nativeFetch=window.fetch.bind(window)
window.fetch=async(resource,options={})=>{
  const url=new URL(typeof resource==='string'?resource:resource.url,location.origin)
  if(url.origin!==location.origin)return nativeFetch(resource,options)
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin/schedule/')){
    try{const method=(options.method||'GET').toUpperCase(),data=localApi(state,url,method,options.body?JSON.parse(options.body):{});if(method!=='GET')persist();return Response.json(data)}catch(error){return Response.json({error:error.message},{status:400})}
  }
  if(url.pathname.startsWith('/area-fiscal/'))return new Response(renderPage(templates,pageContext(state,url)),{headers:{'Content-Type':'text/html; charset=utf-8'}})
  return nativeFetch(resource,options)
}

async function boot(){
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/demo-vendor/templates.js';script.onload=resolve;script.onerror=()=>reject(Error('As telas não estão disponíveis. Recarregue a página.'));document.head.append(script)})
  templates=window.LivroTemplates
  let page
  try{page=pageContext(state,new URL(location.href))}catch(error){page=pageContext(state,new URL('/inexistente',location.origin));page.data.message=error.message}
  const html=renderPage(templates,page),parsed=new DOMParser().parseFromString(html,'text/html')
  parsed.querySelector('link[href*="font-awesome/"]')?.setAttribute('href','/demo-vendor/fontawesome/css/all.min.css')
  document.documentElement.replaceWith(document.importNode(parsed.documentElement,true))
  document.title='Livro · Demo de portfólio'
  const css=document.createElement('link');css.rel='stylesheet';css.href='/demo.css';document.head.append(css)
  // As dependências do Bootstrap são locais; os templates copiados permanecem intactos.
  const originals=[...document.querySelectorAll('script')]
  const sources=originals.filter(s=>s.src&&new URL(s.src).origin===location.origin).map(s=>({src:s.src,type:s.type}))
  originals.filter(s=>s.type!=='application/json').forEach(s=>s.remove())
  for(const item of [{src:'/demo-vendor/jquery.min.js'},{src:'/js/bootstrap.bundle.min.js'},...sources]){
    await new Promise(resolve=>{const script=document.createElement('script');script.src=item.src;if(item.type==='module')script.type='module';script.onload=resolve;script.onerror=()=>{feedback('Um recurso da interface não carregou. Recarregue para tentar novamente.');resolve()};document.body.append(script)})
  }
  const contextMessage=location.pathname==='/admin/access'?'Contas e cargos nesta demonstração são locais. Use dados fictícios: senhas são descartadas e nenhum e-mail é enviado.':location.pathname==='/recados'?'Recados e anúncios são simulados neste navegador. Nenhuma mensagem é enviada a pessoas reais.':''
  if(contextMessage){const note=document.createElement('p');note.className='alert alert-info demo-context';note.setAttribute('role','note');note.textContent=contextMessage;document.querySelector('main .ui-page-heading, main .chat-heading')?.after(note)}
  document.addEventListener('submit',event=>{
    if(event.defaultPrevented)return
    const form=event.target;if(form.method.toLowerCase()!=='post')return
    event.preventDefault()
    const values=new FormData(form),body={}
    for(const key of new Set(values.keys())){const entries=values.getAll(key);body[key]=entries.length>1?entries:entries[0]}
    try{let next=mutate(state,new URL(form.action).pathname,body);if(state.tour.pendingStep!==undefined){state.tour.step=state.tour.pendingStep;delete state.tour.pendingStep;next=tourUrl(state)}if(persist())location.assign(next);else{form.querySelectorAll('button[type="submit"], [data-detail-submit], [data-registration-submit]').forEach(b=>{b.disabled=false});feedback('Alteração aplicada em memória. O navegador bloqueou a persistência; permita armazenamento para continuar entre páginas.')}}catch(error){delete state.tour.pendingStep;state.tour.playing=false;persist();feedback(error.message);form.querySelectorAll('button').forEach(b=>{b.disabled=false});document.querySelector('[data-detail-progress]')?.replaceChildren();document.querySelector('[data-registration-progress]')?.replaceChildren()}
  })
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');if(!anchor)return
    const url=new URL(anchor.href,location.href)
    if(url.origin===location.origin&&(url.pathname.startsWith('/admin/export/')||url.pathname==='/denuncias/pdf')){event.preventDefault();try{exportData(state,url)}catch(error){feedback(error.message)}}
  })
  mountTour(state,{persist,feedback})
  if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
}
boot().catch(error=>{document.body.replaceChildren();const p=document.createElement('p');p.textContent='Não foi possível abrir a demonstração: '+error.message;document.body.append(p)})
