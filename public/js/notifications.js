(() => {
    const userId=document.querySelector('meta[name="recados-user"]')?.content
    if(!userId)return
    const prefix=`livro:recados:${userId}:`, tabId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`
    const button=document.querySelector('[data-enable-notifications]'),status=document.querySelector('[data-notification-status]')
    let timer,busy=false,stopped=false,failures=0,lastSessionCheck=0,toastTimer,activeToast,queuedRefresh=false,memorySeen=null
    let channel
    try{channel=new BroadcastChannel(prefix+'updates')}catch{}
    const peers=new Map(),openNotifications=new Map()
    const readStorage=key=>{try{return JSON.parse(localStorage.getItem(prefix+key))}catch{return null}}
    const writeStorage=(key,value)=>{try{localStorage.setItem(prefix+key,JSON.stringify(value));return true}catch{return false}}
    const send=data=>channel?.postMessage({userId,...data})
    const reading=()=>document.visibilityState==='visible'&&document.hasFocus()&&!!window.LivroChat?.isReading?.()
    function announcePresence(){
        const data={type:'presence',tabId,conversationId:reading()?window.LivroChat.conversationId:null,at:Date.now()}
        peers.set(tabId,data);send(data)
    }
    function conversationVisible(conversationId){
        announcePresence()
        return [...peers.values()].some(peer=>Date.now()-peer.at<15000&&String(peer.conversationId)===String(conversationId))
    }
    function renderPermission(){
        if(!button)return
        const supported='Notification' in window&&window.isSecureContext
        button.hidden=!supported||Notification.permission!=='default'
        if(status)status.textContent=!supported?'':Notification.permission==='granted'?'Notificações ativadas':Notification.permission==='denied'?'Avisos disponíveis em Recados.':''
    }
    button?.addEventListener('click',async()=>{
        try{await Notification.requestPermission();renderPermission()}catch{if(status)status.textContent='Não foi possível ativar os avisos.'}
    })
    function showToast(message,count){
        activeToast?.remove();clearTimeout(toastTimer)
        activeToast=document.createElement('a');activeToast.className='recados-toast'
        activeToast.href=`/recados?conversation=${message.conversationId}`;activeToast.setAttribute('role','status')
        activeToast.textContent=count>1?`${count} novos recados. Abrir conversa com ${message.senderName}.`:`${message.senderName}: ${message.announcementId?'Anúncio recebido':'Novo recado'}`
        document.body.append(activeToast)
        toastTimer=setTimeout(()=>activeToast?.remove(),7000)
    }
    function apply(data){
        lastSessionCheck=Date.now()
        document.querySelectorAll('[data-recados-count]').forEach(badge=>{
            badge.textContent=String(data.unreadCount||0);badge.hidden=!data.unreadCount
        })
        for(const [id,notice] of openNotifications){
            if((data.unreadMessages||[]).some(message=>String(message.id)===id))continue
            // Only close a notice when the server confirms its message is no longer unread.
            if(data.unreadCount===0){notice.close();openNotifications.delete(id)}
        }
        document.dispatchEvent(new CustomEvent('livro:recados-updated',{detail:data}))
    }
    function notifyNew(data){
        const messages=data.unreadMessages||[],stored=readStorage('seen')||memorySeen
        // Existing unread messages populate the badge without replaying old desktop alerts.
        const seen=new Set(Array.isArray(stored?.ids)?stored.ids.map(String):messages.map(message=>String(message.id)))
        const newMessages=messages.filter(message=>!seen.has(String(message.id)))
        for(const message of messages)seen.add(String(message.id))
        memorySeen={ids:[...seen].slice(-500)};writeStorage('seen',memorySeen)
        const alerts=newMessages.filter(message=>!conversationVisible(message.conversationId)).sort((a,b)=>Number(b.id)-Number(a.id))
        if(!alerts.length)return
        const latest=alerts[0]
        if(document.visibilityState==='visible')showToast(latest,alerts.length)
        if(!('Notification' in window)||!window.isSecureContext||Notification.permission!=='granted')return
        try{
            const notice=new Notification(alerts.length>1?`${alerts.length} novos recados no Livro`:`${latest.senderName}${latest.announcementId?' · Anúncio':''}`,{
                body:alerts.length>1?'Abra os recados para acompanhar as conversas.':String(latest.body||'').slice(0,160),
                tag:`livro-recado-${userId}-${latest.id}`,icon:'/favicon/book.png'
            })
            openNotifications.set(String(latest.id),notice)
            notice.onclick=()=>{window.focus();location.assign(`/recados?conversation=${latest.conversationId}`);notice.close()}
        }catch{} // The internal unread counter remains available if the OS rejects an alert.
    }
    async function fetchUpdates(force){
        const previous=readStorage('poll')
        if(!force&&previous&&Date.now()-previous.at<8000)return
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000)
        try{
            const response=await window.fetch('/api/recados/notifications',{cache:'no-store',credentials:'same-origin',signal:controller.signal})
            if(response.status===401||response.status===403){
                stopped=true
                if(response.status===403){
                    const result=await response.json().catch(()=>({}))
                    if(result.code!=='PASSWORD_CHANGE_REQUIRED'){
                        document.querySelector('[data-recados-link]')?.setAttribute('hidden','')
                        if(button)button.hidden=true
                    }
                }
                return
            }
            if(!response.ok)throw new Error('poll')
            const data=await response.json();failures=0
            writeStorage('poll',{at:Date.now(),unreadCount:data.unreadCount||0})
            apply(data);notifyNew(data);send({type:'update',data})
        }finally{clearTimeout(timeout)}
    }
    async function withPollLock(force){
        if(navigator.locks?.request){
            return navigator.locks.request(prefix+'poll',{ifAvailable:true},lock=>lock?fetchUpdates(force):undefined)
        }
        // Short lease coordinates browsers without Web Locks; Notification.tag also deduplicates OS notices.
        const current=readStorage('lease')
        if(current&&current.until>Date.now()&&current.tabId!==tabId)return
        if(!writeStorage('lease',{tabId,until:Date.now()+12000}))return fetchUpdates(force)
        await new Promise(resolve=>setTimeout(resolve,30+Math.random()*40))
        if(readStorage('lease')?.tabId!==tabId)return
        try{return await fetchUpdates(force)}finally{
            if(readStorage('lease')?.tabId===tabId)writeStorage('lease',null)
        }
    }
    async function poll(force=false){
        clearTimeout(timer)
        if(stopped)return
        if(busy){queuedRefresh=queuedRefresh||force;return}
        busy=true;announcePresence()
        try{await withPollLock(force)}catch{failures=Math.min(failures+1,3)}
        finally{
            busy=false
            if(!stopped){
                const immediate=queuedRefresh;queuedRefresh=false
                timer=setTimeout(()=>poll(immediate),immediate?0:Math.min(10000*2**failures,60000))
            }
        }
    }
    function resumed(){
        renderPermission();announcePresence()
        if(document.visibilityState==='visible')poll(true)
    }
    channel?.addEventListener('message',event=>{
        const message=event.data
        if(message?.userId!==userId)return
        if(message.type==='update')apply(message.data)
        if(message.type==='presence')peers.set(message.tabId,message)
        if(message.type==='refresh')poll(true)
    })
    window.addEventListener('storage',event=>{
        if(channel)return
        if(event.key!==prefix+'poll'||!event.newValue)return
        try{const data=JSON.parse(event.newValue);if(data)apply(data)}catch{}
    })
    window.addEventListener('focus',resumed)
    window.addEventListener('online',()=>poll(true))
    window.addEventListener('pageshow',()=>{stopped=false;resumed()})
    document.addEventListener('visibilitychange',resumed)
    document.addEventListener('livro:chat-presence',announcePresence)
    document.addEventListener('livro:recados-read',()=>{send({type:'refresh'});poll(true)})
    window.addEventListener('pagehide',()=>{
        stopped=true;clearTimeout(timer);send({type:'presence',tabId,conversationId:null,at:Date.now()})
    })
    window.LivroRecados={refresh:()=>poll(true),get lastSessionCheck(){return lastSessionCheck}}
    renderPermission();poll(true)
})()
