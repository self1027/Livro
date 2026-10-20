(() => {
    const identity=document.querySelector('[data-account-identity]')
    if(!identity)return
    const form=identity.querySelector('[data-avatar-form]'),save=form.querySelector('[data-avatar-save]'),status=form.querySelector('[data-avatar-status]')
    let saved={icon:identity.dataset.avatarIcon,color:identity.dataset.avatarColor},saving=false
    const selected=()=>({icon:form.querySelector('[name="avatar_icon"]:checked')?.value,color:form.querySelector('[name="avatar_color"]:checked')?.value})
    function preview(value){
        const color=[...form.querySelectorAll('[name="avatar_color"]')].find(input=>input.value===value.color)
        if(!color||!['male','female'].includes(value.icon))return
        identity.querySelectorAll('[data-account-avatar], [data-avatar-choice]').forEach(avatar=>avatar.style.setProperty('--account-avatar-background',color.dataset.avatarHex))
        identity.querySelectorAll('[data-account-avatar] [data-avatar-symbol]').forEach(symbol=>symbol.toggleAttribute('hidden',symbol.dataset.avatarSymbol!==value.icon))
    }
    function restore(){
        for(const input of form.querySelectorAll('[name="avatar_icon"]'))input.checked=input.value===saved.icon
        for(const input of form.querySelectorAll('[name="avatar_color"]'))input.checked=input.value===saved.color
        preview(saved)
    }
    const channelName='livro:account-avatar'
    let channel
    try{channel=new BroadcastChannel(channelName)}catch{}
    const accountId=identity.dataset.accountId
    channel?.addEventListener('message',event=>{
        if(event.data?.accountId!==accountId||saving||identity.open)return
        const avatar=event.data.avatar
        if(!avatar||!['male','female'].includes(avatar.icon)||![...form.querySelectorAll('[name="avatar_color"]')].some(input=>input.value===avatar.color))return
        saved=avatar;restore()
    })
    form.addEventListener('change',()=>{preview(selected());status.textContent=''})
    form.querySelector('[data-avatar-cancel]').addEventListener('click',()=>{
        if(saving)return
        restore();identity.open=false;status.textContent=''
    })
    identity.addEventListener('toggle',()=>{if(!identity.open&&!saving){restore();status.textContent=''}})
    document.addEventListener('click',event=>{if(identity.open&&!saving&&!identity.contains(event.target))identity.open=false})
    document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&identity.open&&!saving){identity.open=false;identity.querySelector('summary').focus();event.preventDefault()}
    })
    form.addEventListener('submit',async event=>{
        event.preventDefault()
        if(saving)return
        const value=selected();saving=true;save.disabled=true;status.dataset.error='false';status.textContent='Salvando…'
        form.querySelectorAll('input, [data-avatar-cancel]').forEach(input=>{input.disabled=true})
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000)
        try{
            const response=await window.fetch('/api/auth/profile',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar_icon:value.icon,avatar_color:value.color}),signal:controller.signal})
            const data=await response.json().catch(()=>({}))
            if(!response.ok)throw new Error(data.error||'Não foi possível salvar. Tente novamente.')
            saved=data.avatar;identity.dataset.avatarIcon=saved.icon;identity.dataset.avatarColor=saved.color
            restore();status.textContent='Ícone salvo.'
            channel?.postMessage({accountId,avatar:saved})
        }catch(error){
            status.dataset.error='true';status.textContent=error.name==='AbortError'?'A conexão demorou. Tente salvar novamente.':error.message
        }finally{
            clearTimeout(timeout);saving=false;save.disabled=false
            form.querySelectorAll('input, [data-avatar-cancel]').forEach(input=>{input.disabled=false})
            if(!identity.open)restore()
        }
    })
    save.disabled=false
})()
