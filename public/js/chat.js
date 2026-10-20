(() => {
    'use strict'
    const app=document.getElementById('chat-app')
    if(!app)return
    const userId=Number(app.dataset.userId)
    const $=id=>document.getElementById(id)
    const apiRoot='/api/recados'
    const state={people:[],audiences:[],conversations:[],conversation:null,messages:new Map(),messageCursor:0,older:false,epoch:0,polling:false,pollTimer:null,failures:0,listRequest:null,reading:false,readTimer:null,sending:false}
    const thread=$('chat-messages'),messageList=$('chat-message-list'),compose=$('chat-compose'),bodyInput=$('chat-message-body')
    const dateTime=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})
    const fullDateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})
    const safeTime=(value,full=false)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':(full?fullDateTime:dateTime).format(date)}
    const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
    const isFocused=()=>document.visibilityState==='visible'&&document.hasFocus()&&!app.querySelector('dialog[open]')
    const atBottom=()=>thread.scrollHeight-thread.scrollTop-thread.clientHeight<85
    const newClientId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`
    const changed=()=>document.dispatchEvent(new CustomEvent('livro:recados-read'))
    const presence=()=>document.dispatchEvent(new CustomEvent('livro:chat-presence'))
    let statusTimer
    function status(message,error=false,persistent=false){
        const node=$('chat-status');clearTimeout(statusTimer);node.hidden=!message;node.textContent=message;node.dataset.error=String(error)
        if(message&&!persistent)statusTimer=setTimeout(()=>{node.hidden=true},7000)
    }
    async function api(path,{method='GET',body,timeout=15000}={}){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout)
        try{
            const response=await window.fetch(`${apiRoot}${path}`,{method,cache:'no-store',credentials:'same-origin',signal:controller.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
            const type=response.headers.get('content-type')||''
            const data=type.includes('application/json')?await response.json():null
            if(!response.ok){const error=new Error(data?.error||data?.message||'Não foi possível concluir esta ação. Tente novamente.');error.status=response.status;throw error}
            if(!data)throw new Error('Não foi possível carregar os recados. Atualize a página e tente novamente.')
            return data
        }catch(error){if(error.name==='AbortError')throw new Error('O servidor demorou para responder. Tente novamente.');throw error}
        finally{clearTimeout(timer)}
    }
    function renderConversations(){
        const list=$('chat-conversations'),query=$('chat-people-search').value.trim().toLocaleLowerCase('pt-BR')
        list.replaceChildren()
        const conversations=state.conversations.filter(item=>!query||String(item.peer?.name||'').toLocaleLowerCase('pt-BR').includes(query))
        for(const conversation of conversations){
            const button=element('button','chat-conversation-item');button.type='button';button.dataset.conversationId=conversation.id;button.setAttribute('aria-current',String(Number(conversation.id)===Number(state.conversation?.id)))
            const content=element('span','chat-person-content');content.append(element('span','chat-person-name',conversation.peer?.name||'Pessoa indisponível'))
            const preview=conversation.lastMessage;content.append(element('span','chat-preview',preview?`${preview.announcementId?'Anúncio · ':''}${Number(preview.senderId)===userId?'Você: ':''}${preview.body}`:'Envie o primeiro recado'))
            button.append(content)
            if(conversation.unreadCount){button.append(element('span','chat-unread',conversation.unreadCount>99?'99+':String(conversation.unreadCount)));button.setAttribute('aria-label',`${conversation.peer?.name||'Conversa'}, ${conversation.unreadCount} mensagens não lidas`)}
            list.append(button)
        }
        if(!conversations.length)list.append(element('p','chat-muted chat-list-empty',query?'Nenhuma conversa encontrada.':'Suas conversas aparecerão aqui.'))
    }
    function renderPeople(){
        const list=$('chat-people-results'),query=$('chat-people-search').value.trim().toLocaleLowerCase('pt-BR');list.replaceChildren();list.hidden=!query
        if(!query)return
        const people=state.people.filter(person=>Number(person.id)!==userId&&String(person.name||'').toLocaleLowerCase('pt-BR').includes(query)).slice(0,25)
        for(const person of people){const button=element('button','chat-person-item');button.type='button';button.dataset.personId=person.id;const content=element('span','chat-person-content');content.append(element('span','chat-person-name',person.name),element('span','chat-person-role',person.roleName||'Equipe'));button.append(content);list.append(button)}
        if(!people.length)list.append(element('p','chat-muted chat-list-empty','Nenhuma pessoa encontrada.'))
    }
    async function refreshConversations(){
        if(state.listRequest)return state.listRequest
        state.listRequest=api('/conversations').then(data=>{state.conversations=data.conversations||[];renderConversations();return data}).finally(()=>{state.listRequest=null})
        return state.listRequest
    }
    function scrollBottom(){thread.scrollTop=thread.scrollHeight;$('chat-new-messages').hidden=true;queueVisibleReads();presence()}
    function updateReceipt(message){
        const node=messageList.querySelector(`[data-message-id="${Number(message.id)}"] [data-read-receipt]`)
        if(node)node.textContent=message.readAt?`Visto em ${safeTime(message.readAt)}`:'Enviado'
    }
    function renderMessage(message){
        const own=Number(message.senderId)===userId
        const article=element('article',`chat-message${own?' chat-message-own':''}`);article.dataset.messageId=message.id;article.dataset.incoming=String(!own)
        const bubble=element('div','chat-bubble'),tags=element('div','chat-message-tags')
        if(message.announcementId)tags.append(element('span','chat-tag chat-tag-announcement','Anúncio'))
        if(message.denunciation){const link=element('a','chat-tag',`Denúncia ${message.denunciation.protocol}`);link.href=`/denuncias/${Number(message.denunciation.id)}`;tags.append(link)}
        if(tags.childElementCount)bubble.append(tags)
        bubble.append(element('p','chat-message-body',message.body))
        const meta=element('div','chat-message-meta'),time=element('time','',safeTime(message.createdAt));time.dateTime=message.createdAt;time.title=safeTime(message.createdAt,true);meta.append(time)
        if(own){const receipt=element('span','chat-read-receipt',message.readAt?`Visto em ${safeTime(message.readAt)}`:'Enviado');receipt.dataset.readReceipt='';meta.append(receipt)
            if(message.announcementId){const button=element('button','chat-link-button','Ver visualizações');button.type='button';button.dataset.announcementId=message.announcementId;meta.append(button)}}
        bubble.append(meta);article.append(bubble)
        if(!own&&!message.readAt)readObserver?.observe(article)
        return article
    }
    function appendMessages(messages){
        const fresh=[]
        for(const message of messages||[]){const id=Number(message.id),previous=state.messages.get(id);if(previous){Object.assign(previous,message);updateReceipt(previous)}else{state.messages.set(id,message);fresh.push(message)}}
        fresh.sort((a,b)=>Number(a.id)-Number(b.id))
        // A POST can finish before an older incoming message is fetched. Keep the display ordered in that case too.
        for(const message of fresh){const last=messageList.lastElementChild;const following=last&&Number(last.dataset.messageId)>Number(message.id)?[...messageList.children].find(node=>Number(node.dataset.messageId)>Number(message.id)):null;messageList.insertBefore(renderMessage(message),following||null)}
        $('chat-no-messages').hidden=state.messages.size>0
        queueVisibleReads()
        return fresh
    }
    // Only a fetched page establishes that every earlier message was considered; a POST response never moves this cursor.
    function advanceMessageCursor(messages){for(const message of messages||[])state.messageCursor=Math.max(state.messageCursor,Number(message.id))}
    async function openPerson(id){
        try{const data=await api('/conversations',{method:'POST',body:{userId:Number(id)}});$('chat-people-search').value='';renderPeople();await refreshConversations();await openConversation(data.conversation.id,data.conversation)}catch(error){status(error.message,true)}
    }
    function changeLocation(conversationId){const url=new URL(location.href);url.searchParams.set('conversation',conversationId);url.searchParams.delete('userId');history.replaceState(null,'',url)}
    async function openConversation(id,supplied){
        if(Number(state.conversation?.id)===Number(id))return
        const conversation=supplied||state.conversations.find(item=>Number(item.id)===Number(id))
        if(!conversation){status('Esta conversa não está disponível para sua conta.',true);return}
        const epoch=++state.epoch;clearTimeout(state.pollTimer);state.messages.clear();state.messageCursor=0;readObserver?.disconnect();messageList.replaceChildren();state.older=false;state.failures=0
        state.conversation=conversation;compose.reset();composerPicker?.clear();$('chat-empty').hidden=true;$('chat-conversation').hidden=false;$('chat-new-messages').hidden=true;$('chat-no-messages').hidden=true;$('chat-load-older').hidden=true
        $('chat-peer-name').textContent=conversation.peer?.name||'Conversa';setPeerActive(conversation.peer?.active!==false);thread.setAttribute('aria-busy','true');renderConversations();changeLocation(id);presence()
        try{const data=await api(`/conversations/${Number(id)}/messages`);if(epoch!==state.epoch)return;appendMessages(data.messages);advanceMessageCursor(data.messages);state.older=Boolean(data.hasMore);$('chat-load-older').hidden=!state.older;setPeerActive(data.peerActive!==false);scrollBottom();await applyPendingReference()}
        catch(error){if(epoch===state.epoch)status(error.message,true)}
        finally{if(epoch===state.epoch){thread.setAttribute('aria-busy','false');schedulePoll(3000)}}
    }
    function setPeerActive(active){$('chat-peer-status').textContent=active?'Conversa individual':'Esta pessoa está desativada. O histórico permanece disponível.';bodyInput.disabled=!active;$('chat-send').disabled=!active||state.sending;state.conversation.peerActive=active}
    async function loadOlder(){
        if(!state.conversation||!state.older||$('chat-load-older').disabled)return
        const epoch=state.epoch,first=Math.min(...state.messages.keys()),button=$('chat-load-older');button.disabled=true;button.textContent='Carregando…'
        try{const data=await api(`/conversations/${Number(state.conversation.id)}/messages?before=${first}`);if(epoch!==state.epoch)return;const height=thread.scrollHeight,top=thread.scrollTop;appendMessages(data.messages);thread.scrollTop=top+thread.scrollHeight-height;state.older=Boolean(data.hasMore);button.hidden=!state.older}
        catch(error){if(epoch===state.epoch)status(error.message,true)}finally{button.disabled=false;button.textContent='Carregar mensagens anteriores'}
    }
    function schedulePoll(delay=3000){clearTimeout(state.pollTimer);if(state.conversation)state.pollTimer=setTimeout(pollConversation,delay)}
    function receiptQuery(){
        const rect=thread.getBoundingClientRect(),top=Math.max(rect.top,0),bottom=Math.min(rect.bottom,window.innerHeight),visible=[]
        for(const node of messageList.querySelectorAll('[data-incoming="false"]')){const item=node.getBoundingClientRect();if(item.height>0&&Math.min(bottom,item.bottom)>Math.max(top,item.top))visible.push(Number(node.dataset.messageId))}
        const recent=[...state.messages.values()].filter(message=>Number(message.senderId)===userId).map(message=>Number(message.id)).sort((a,b)=>b-a).slice(0,100)
        const ids=[...new Set([...visible,...recent])].slice(0,200)
        return ids.length?`?${new URLSearchParams({messageIds:ids.join(',')})}`:''
    }
    async function pollConversation(){
        if(!state.conversation)return
        if(state.polling){schedulePoll();return}
        if(document.visibilityState!=='visible'){schedulePoll(10000);return}
        state.polling=true
        const epoch=state.epoch,id=Number(state.conversation.id)
        let nextDelay=3000
        try{
            const last=state.messageCursor
            const [data,readData]=await Promise.all([api(`/conversations/${id}/messages${last?`?after=${last}`:''}`),api(`/conversations/${id}/reads${receiptQuery()}`)])
            if(epoch!==state.epoch)return
            const bottom=atBottom(),fresh=appendMessages(data.messages);advanceMessageCursor(data.messages)
            if(!last){state.older=Boolean(data.hasMore);$('chat-load-older').hidden=!state.older}
            setPeerActive(data.peerActive!==false)
            for(const read of readData.reads||[]){const message=state.messages.get(Number(read.messageId));if(message){message.readAt=read.readAt;updateReceipt(message)}}
            if(fresh.length){if(bottom)scrollBottom();else $('chat-new-messages').hidden=false}
            state.failures=0
            if(data.hasMore&&last)nextDelay=100
        }catch(error){if(epoch===state.epoch){state.failures++;nextDelay=Math.min(30000,3000*2**Math.min(state.failures,4));if(state.failures===2)status('A conexão com os recados foi interrompida. Tentaremos novamente.',true)}}
        finally{state.polling=false;if(epoch===state.epoch)schedulePoll(nextDelay)}
    }
    // Visibility is checked again when sending: polling and background tabs never establish a read receipt.
    const readObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(()=>queueVisibleReads(),{root:thread,threshold:[0,.1,.5,1]}):null
    function visibleIncoming(){
        if(!isFocused()||!state.conversation)return[]
        const rect=thread.getBoundingClientRect(),top=Math.max(rect.top,0),bottom=Math.min(rect.bottom,window.innerHeight)
        if(bottom<=top)return[]
        const ids=[]
        for(const node of messageList.querySelectorAll('[data-incoming="true"]')){const id=Number(node.dataset.messageId),message=state.messages.get(id);if(message?.readAt)continue;const item=node.getBoundingClientRect(),overlap=Math.min(bottom,item.bottom)-Math.max(top,item.top);if(item.height>0&&overlap>=Math.min(35,item.height))ids.push(id)}
        return ids.slice(0,100)
    }
    function queueVisibleReads(){clearTimeout(state.readTimer);if(isFocused())state.readTimer=setTimeout(markVisibleRead,650)}
    async function markVisibleRead(){
        if(state.reading)return
        const ids=visibleIncoming();if(!ids.length)return
        const epoch=state.epoch,id=Number(state.conversation.id);state.reading=true
        try{await api(`/conversations/${id}/read`,{method:'POST',body:{messageIds:ids}});if(epoch!==state.epoch)return;for(const messageId of ids){const message=state.messages.get(messageId);if(message)message.readAt=new Date().toISOString();const node=messageList.querySelector(`[data-message-id="${messageId}"]`);if(node)readObserver?.unobserve(node)}changed();await refreshConversations()}
        catch{}finally{state.reading=false}
    }
    function createDenunciationPicker(root){
        if(!root)return null
        const input=root.querySelector('[data-denunciation-search]'),panel=root.querySelector('[data-denunciation-search-panel]'),results=root.querySelector('[data-denunciation-results]'),selection=root.querySelector('[data-denunciation-selection]'),toggle=root.querySelector('[data-denunciation-toggle]')
        let selected=null,timer,request=0
        const clear=()=>{selected=null;selection.hidden=true;toggle.hidden=false;panel.hidden=true;input.value='';results.replaceChildren();++request}
        const select=denunciation=>{selected=denunciation;root.querySelector('[data-denunciation-label]').textContent=`Denúncia ${denunciation.protocol}`;selection.hidden=false;toggle.hidden=true;panel.hidden=true;input.value='';results.replaceChildren();++request}
        toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)input.focus()})
        root.querySelector('[data-denunciation-clear]').addEventListener('click',clear)
        input.addEventListener('input',()=>{clearTimeout(timer);const serial=++request,query=input.value.trim();results.replaceChildren();if(query.length<2)return;timer=setTimeout(async()=>{try{const data=await api(`/denunciations?q=${encodeURIComponent(query)}`);if(serial!==request)return;for(const item of data.denunciations||[]){const button=element('button','chat-denunciation-result',`${item.protocol} · ${item.title||'Denúncia'}`);button.type='button';button.addEventListener('click',()=>select(item));results.append(button)}if(!results.childElementCount)results.append(element('p','chat-muted','Nenhuma denúncia encontrada.'))}catch(error){if(serial===request)results.append(element('p','chat-muted',error.message))}},300)})
        return{clear,select,get id(){return selected?.id||null}}
    }
    const composerPicker=createDenunciationPicker(compose.querySelector('[data-denunciation-picker]'))
    const announcementForm=$('chat-announcement-form'),announcementPicker=createDenunciationPicker(announcementForm?.querySelector('[data-denunciation-picker]'))
    let pendingDenunciationId=Number(new URLSearchParams(location.search).get('denunciationId'))||null
    async function applyPendingReference(){if(!pendingDenunciationId||!composerPicker)return;const id=pendingDenunciationId;pendingDenunciationId=null;try{const data=await api(`/denunciations?id=${id}`),denunciation=(data.denunciations||[]).find(item=>Number(item.id)===id);if(denunciation)composerPicker.select(denunciation)}catch(error){status(error.message,true)}}
    let pendingSend=null
    compose.addEventListener('submit',async event=>{
        event.preventDefault();const draft=bodyInput.value,text=draft.trim();if(!text||!state.conversation||state.conversation.peerActive===false||state.sending)return
        const id=Number(state.conversation.id),epoch=state.epoch,denunciationId=composerPicker?.id||null,signature=JSON.stringify([id,text,denunciationId]);if(!pendingSend||pendingSend.signature!==signature)pendingSend={signature,clientId:newClientId()}
        const payload={body:text,clientId:pendingSend.clientId,...(denunciationId?{denunciationId}:{})};state.sending=true;$('chat-send').disabled=true
        try{const data=await api(`/conversations/${id}/messages`,{method:'POST',body:payload});pendingSend=null;if(epoch===state.epoch){appendMessages([data.message]);if(bodyInput.value===draft){bodyInput.value='';if((composerPicker?.id||null)===denunciationId)composerPicker?.clear()}scrollBottom();bodyInput.focus()}await refreshConversations();changed()}
        catch(error){status(error.message,true)}finally{state.sending=false;if(state.conversation)$('chat-send').disabled=state.conversation.peerActive===false}
    })
    bodyInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&window.matchMedia('(min-width: 768px)').matches){event.preventDefault();if(!$('chat-send').disabled)compose.requestSubmit()}})
    $('chat-load-older').addEventListener('click',loadOlder)
    $('chat-new-messages').addEventListener('click',scrollBottom)
    let presenceTimer
    thread.addEventListener('scroll',()=>{if(atBottom())$('chat-new-messages').hidden=true;queueVisibleReads();clearTimeout(presenceTimer);presenceTimer=setTimeout(presence,100)},{passive:true})
    window.addEventListener('scroll',queueVisibleReads,{passive:true})
    $('chat-people-search').addEventListener('input',()=>{renderPeople();renderConversations()})
    $('chat-people-results').addEventListener('click',event=>{const button=event.target.closest('[data-person-id]');if(button)openPerson(button.dataset.personId)})
    $('chat-conversations').addEventListener('click',event=>{const button=event.target.closest('[data-conversation-id]');if(button)openConversation(button.dataset.conversationId)})
    app.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()))
    app.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}});dialog.addEventListener('close',()=>{presence();queueVisibleReads()})})
    function renderAudienceChoices(){
        const type=$('chat-audience-type').value,list=$('chat-audience-choices');list.replaceChildren();$('chat-audience-options').hidden=type==='all'
        const choices=type==='roles'?state.audiences:state.people.filter(person=>Number(person.id)!==userId)
        if(type!=='all')for(const choice of choices){const label=element('label'),input=element('input');input.type='checkbox';input.value=choice.id;label.append(input,document.createTextNode(choice.name));list.append(label)}
        updateAudienceCount()
    }
    function announcementAudience(){const type=$('chat-audience-type').value,ids=[...$('chat-audience-choices').querySelectorAll('input:checked')].map(input=>Number(input.value));return type==='all'?{type:'all'}:type==='roles'?{type:'roles',roleIds:ids}:{type:'users',userIds:ids}}
    function updateAudienceCount(){
        if(!announcementForm)return
        const audience=announcementAudience(),recipients=state.people.filter(person=>Number(person.id)!==userId&&(audience.type==='all'||audience.type==='users'&&audience.userIds.includes(Number(person.id))||audience.type==='roles'&&audience.roleIds.includes(Number(person.roleId))))
        $('chat-audience-count').textContent=`${recipients.length} ${recipients.length===1?'pessoa receberá':'pessoas receberão'} este anúncio.`;$('chat-announcement-submit').disabled=!recipients.length
    }
    let pendingAnnouncement=null
    if(announcementForm){
        $('chat-announce-open').addEventListener('click',()=>{renderAudienceChoices();$('chat-announcement-error').hidden=true;$('chat-announcement-dialog').showModal();presence()})
        $('chat-audience-type').addEventListener('change',renderAudienceChoices);$('chat-audience-choices').addEventListener('change',updateAudienceCount)
        announcementForm.addEventListener('submit',async event=>{
            event.preventDefault();const text=$('chat-announcement-body').value.trim();if(!text)return
            const audience=announcementAudience(),signature=JSON.stringify([text,audience,announcementPicker?.id||null]);if(!pendingAnnouncement||pendingAnnouncement.signature!==signature)pendingAnnouncement={signature,clientId:newClientId()}
            $('chat-announcement-submit').disabled=true;$('chat-announcement-error').hidden=true
            try{const data=await api('/announcements',{method:'POST',body:{body:text,audience,clientId:pendingAnnouncement.clientId,...(announcementPicker?.id?{denunciationId:announcementPicker.id}:{})}});pendingAnnouncement=null;announcementForm.reset();announcementPicker?.clear();$('chat-announcement-dialog').close();status(`Anúncio enviado para ${data.announcement.recipientCount} ${data.announcement.recipientCount===1?'pessoa':'pessoas'}.`);await refreshConversations();schedulePoll(50);changed()}
            catch(error){$('chat-announcement-error').textContent=error.message;$('chat-announcement-error').hidden=false}finally{updateAudienceCount()}
        })
    }
    messageList.addEventListener('click',async event=>{
        const button=event.target.closest('[data-announcement-id]');if(!button)return
        const dialog=$('chat-receipts-dialog'),list=$('chat-receipts-list');list.replaceChildren();$('chat-receipts-summary').textContent='Carregando visualizações…';dialog.showModal();presence()
        try{const {announcement}=await api(`/announcements/${Number(button.dataset.announcementId)}`);button.textContent=`${announcement.readCount} de ${announcement.recipientCount} visualizaram`;$('chat-receipts-summary').textContent=`${announcement.readCount} de ${announcement.recipientCount} pessoas visualizaram.`;for(const person of announcement.recipients||[]){const li=element('li');li.append(element('span','',person.name),element('small','',person.readAt?`Visto em ${safeTime(person.readAt,true)}`:'Ainda não visualizou'));list.append(li)}}catch(error){$('chat-receipts-summary').textContent=error.message}
    })
    function resume(){presence();if(document.visibilityState==='visible'){queueVisibleReads();schedulePoll(50);refreshConversations().catch(()=>{})}}
    window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume)
    window.addEventListener('blur',presence)
    document.addEventListener('livro:recados-updated',()=>{refreshConversations().catch(()=>{});if(state.conversation)schedulePoll(100)})
    window.LivroChat={get conversationId(){return state.conversation?.id||null},isReading:()=>Boolean(state.conversation&&isFocused()&&atBottom())}
    presence()
    async function initialize(){
        try{
            const [data]=await Promise.all([api('/people'),refreshConversations()]);state.people=data.people||[];state.audiences=data.audiences||[];renderPeople();if(announcementForm&&$('chat-announcement-dialog').open)renderAudienceChoices()
            const params=new URLSearchParams(location.search),conversationId=Number(params.get('conversation')),peerId=Number(params.get('userId'))
            if(conversationId)await openConversation(conversationId)
            else if(peerId)await openPerson(peerId)
        }catch(error){status(error.message,true,true);$('chat-conversations').replaceChildren(element('p','chat-muted chat-list-empty','Não foi possível carregar as conversas.'))}
    }
    initialize()
})()
