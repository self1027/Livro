import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'

const script=await readFile(new URL('../public/js/notifications.js',import.meta.url),'utf8')
const settle=()=>new Promise(resolve=>setImmediate(resolve))
const message=(id,conversationId=42)=>({id,conversationId,senderName:'Edna',body:`Mensagem ${id}`,announcementId:null})
const response=data=>({ok:true,status:200,json:async()=>data})

function browser({permission='granted',storage=new Map(),data={unreadCount:0,unreadMessages:[]},fetchHandler,authenticated=true,storageUnavailable=false,webLocks=true}={}){
    let now=1000000,timerSequence=0
    const timers=new Map(),windowEvents={},documentEvents={},calls=[],notices=[],toasts=[],dispatched=[]
    const badge={textContent:'',hidden:true},attributes=new Map()
    const button={hidden:false,events:{},addEventListener(name,handler){this.events[name]=handler}}
    const status={textContent:''},link={setAttribute:(name,value)=>attributes.set(name,value)}
    const state={response:response(data),fetchHandler,permissionRequests:0,permissionResult:'granted',focused:true,reading:false,conversationId:42}
    const setTimeout=(handler,delay)=>{const id=++timerSequence;timers.set(id,{handler,due:now+delay});return id}
    const clearTimeout=id=>timers.delete(id)
    class ClockDate extends Date{static now(){return now}}
    class BrowserNotification{
        static permission=permission
        static async requestPermission(){state.permissionRequests++;this.permission=state.permissionResult;return this.permission}
        constructor(title,options){this.title=title;this.options=options;this.closed=false;notices.push(this)}
        close(){this.closed=true}
    }
    const document={
        visibilityState:'visible',hasFocus:()=>state.focused,
        querySelector(selector){
            if(selector==='meta[name="recados-user"]')return authenticated?{content:'7'}:null
            if(selector==='[data-enable-notifications]')return button
            if(selector==='[data-notification-status]')return status
            if(selector==='[data-recados-link]')return link
            return null
        },
        querySelectorAll:selector=>selector==='[data-recados-count]'?[badge]:[],
        addEventListener:(name,handler)=>{documentEvents[name]=handler},
        dispatchEvent:event=>dispatched.push(event),
        createElement:()=>({setAttribute(){},remove(){this.removed=true}}),
        body:{append:element=>toasts.push(element)}
    }
    const window={
        isSecureContext:true,Notification:BrowserNotification,
        addEventListener:(name,handler)=>{windowEvents[name]=handler},focus(){state.focused=true},
        LivroChat:{isReading:()=>state.reading,get conversationId(){return state.conversationId}},
        fetch:async(input,init)=>{
            calls.push({input,init})
            if(state.fetchHandler)return state.fetchHandler(input,init)
            if(state.response instanceof Error)throw state.response
            return state.response
        }
    }
    const location={assign:path=>{state.location=path}}
    const localStorage={getItem:key=>{if(storageUnavailable)throw new Error('Storage blocked');return storage.get(key)??null},setItem:(key,value)=>{if(storageUnavailable)throw new Error('Storage blocked');storage.set(key,value)}}
    const navigator=webLocks?{locks:{request:async(name,options,callback)=>callback({name})}}:{}
    runInNewContext(script,{window,document,location,localStorage,navigator,Notification:BrowserNotification,Date:ClockDate,
        setTimeout,clearTimeout,AbortController,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}})
    async function advance(milliseconds){
        const target=now+milliseconds
        for(;;){
            const next=[...timers.entries()].filter(([,timer])=>timer.due<=target).sort((a,b)=>a[1].due-b[1].due)[0]
            if(!next)break
            now=next[1].due;timers.delete(next[0]);next[1].handler();await settle()
        }
        now=target;await settle()
    }
    return {state,window,document,windowEvents,documentEvents,calls,notices,toasts,dispatched,badge,button,status,attributes,
        Notification:BrowserNotification,timers,storage,advance,delays:()=>[...timers.values()].map(timer=>timer.due-now)}
}

test('polling consulta a cada dez segundos, sem sobrepor uma requisição em andamento',async()=>{
    let finish
    const pending=new Promise(resolve=>{finish=resolve})
    const page=browser({fetchHandler:()=>pending})
    assert.equal(page.calls.length,1)
    await page.window.LivroRecados.refresh()
    page.windowEvents.focus()
    assert.equal(page.calls.length,1)
    page.state.fetchHandler=null;finish(response({unreadCount:2,unreadMessages:[message(1),message(2)]}))
    await settle()
    assert.deepEqual(page.delays(),[0]) // A refresh requested during the in-flight poll is queued.
    assert.equal(page.badge.textContent,'2')
    assert.equal(page.badge.hidden,false)
    assert.equal(page.window.LivroRecados.lastSessionCheck,1000000)
    await page.advance(0);assert.equal(page.calls.length,2)
    assert.deepEqual(page.delays(),[10000])
    await page.advance(9999);assert.equal(page.calls.length,2)
    await page.advance(1);assert.equal(page.calls.length,3)
    assert.equal(page.badge.hidden,true)
    assert.ok(page.calls.every(call=>call.input==='/api/recados/notifications'))
    assert.ok(page.calls.every(call=>!call.init.method||call.init.method==='GET'))
    assert.equal(page.dispatched[0].type,'livro:recados-updated')
})

test('armazenamento bloqueado não impede polling nem repete notificações na mesma página',async()=>{
    const page=browser({storageUnavailable:true,webLocks:false,data:{unreadCount:1,unreadMessages:[message(1)]}})
    await settle();assert.equal(page.calls.length,1);assert.equal(page.notices.length,0)
    page.state.response=response({unreadCount:2,unreadMessages:[message(1),message(2)]})
    await page.window.LivroRecados.refresh();assert.equal(page.notices.length,1)
    await page.window.LivroRecados.refresh();assert.equal(page.notices.length,1)
    assert.equal(page.badge.textContent,'2')
})

test('primeira carga atualiza o contador sem repetir avisos antigos; recado novo gera um aviso',async()=>{
    const page=browser({data:{unreadCount:1,unreadMessages:[message(1)]}})
    await settle()
    assert.equal(page.notices.length,0)
    assert.equal(page.toasts.length,0)
    page.state.response=response({unreadCount:2,unreadMessages:[message(1),message(2)]})
    await page.window.LivroRecados.refresh()
    assert.equal(page.notices.length,1)
    assert.equal(page.notices[0].options.body,'Mensagem 2')
    assert.equal(page.toasts.length,1)
    page.notices[0].onclick()
    assert.equal(page.state.location,'/recados?conversation=42')
    assert.equal(page.notices[0].closed,true)
    await page.window.LivroRecados.refresh()
    assert.equal(page.notices.length,1)
    const reloaded=browser({storage:page.storage,data:{unreadCount:2,unreadMessages:[message(1),message(2)]}})
    await settle()
    assert.equal(reloaded.notices.length,0)
    assert.equal(reloaded.badge.textContent,'2')
})

test('leitura na conversa em foco suprime aviso; outra conversa ou aba sem foco recebe aviso',async()=>{
    const page=browser();await settle()
    page.state.reading=true
    page.state.response=response({unreadCount:1,unreadMessages:[message(1)]})
    await page.window.LivroRecados.refresh()
    assert.equal(page.notices.length,0)
    page.state.response=response({unreadCount:2,unreadMessages:[message(1),message(2,43)]})
    await page.window.LivroRecados.refresh()
    assert.equal(page.notices.length,1)
    page.state.focused=false
    page.state.response=response({unreadCount:3,unreadMessages:[message(1),message(2,43),message(3)]})
    await page.window.LivroRecados.refresh()
    assert.equal(page.notices.length,2)
    assert.ok(page.calls.every(call=>call.input==='/api/recados/notifications'),'polling não confirma leitura')
})

test('falha de rede agenda retentativa com intervalo maior e recupera o intervalo normal',async()=>{
    const page=browser();await settle()
    page.state.response=new Error('offline')
    await page.window.LivroRecados.refresh()
    assert.deepEqual(page.delays(),[20000])
    page.state.response=response({unreadCount:0,unreadMessages:[]})
    await page.advance(19999);assert.equal(page.calls.length,2)
    await page.advance(1);assert.equal(page.calls.length,3)
    assert.deepEqual(page.delays(),[10000])
})

test('401 e 403 interrompem consultas periódicas; falta de permissão esconde a entrada',async()=>{
    for(const code of [401,403]){
        const page=browser();await settle()
        page.state.response={ok:false,status:code,json:async()=>({code:'FORBIDDEN'})}
        await page.window.LivroRecados.refresh()
        assert.deepEqual(page.delays(),[])
        await page.advance(60000)
        assert.equal(page.calls.length,2)
        if(code===403){assert.equal(page.attributes.has('hidden'),true);assert.equal(page.button.hidden,true)}
    }
})

test('permissão do navegador só é solicitada no clique e negá-la preserva o contador',async()=>{
    const page=browser({permission:'default'});await settle()
    assert.equal(page.state.permissionRequests,0)
    assert.equal(page.button.hidden,false)
    page.state.permissionResult='denied'
    await page.button.events.click()
    assert.equal(page.state.permissionRequests,1)
    assert.equal(page.button.hidden,true)
    page.state.response=response({unreadCount:1,unreadMessages:[message(1)]})
    await page.window.LivroRecados.refresh()
    assert.equal(page.badge.textContent,'1')
    assert.equal(page.badge.hidden,false)
    assert.equal(page.notices.length,0)
    assert.equal(page.toasts.length,1)
})

test('página sem identificação de recados não instala polling',async()=>{
    const page=browser({authenticated:false});await settle()
    assert.equal(page.calls.length,0)
    assert.equal(page.window.LivroRecados,undefined)
    assert.equal(page.timers.size,0)
})
