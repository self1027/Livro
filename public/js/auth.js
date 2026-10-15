(() => {
    const token=document.querySelector('meta[name="csrf-token"]')?.content
    if(!token)return
    const originalFetch=window.fetch.bind(window)
    let redirecting=false
    const redirect=path=>{
        if(redirecting||location.pathname===path)return
        redirecting=true
        location.replace(path)
    }
    window.fetch=async(input,init={})=>{
        const request=input instanceof Request?input:null
        const url=new URL(request?.url||input,location.href)
        const method=(init.method||request?.method||'GET').toUpperCase()
        if(url.origin===location.origin&&!['GET','HEAD','OPTIONS'].includes(method)){
            const headers=new Headers(init.headers||request?.headers)
            if(!headers.has('Authorization'))headers.set('X-CSRF-Token',token)
            init={...init,headers}
        }
        const response=await originalFetch(input,init)
        if(url.origin===location.origin){
            if(response.status===401)redirect('/auth/login')
            else if(response.redirected){
                const destination=new URL(response.url)
                if(destination.origin===location.origin&&['/auth/login','/auth/password'].includes(destination.pathname))redirect(destination.pathname)
            }
        }
        return response
    }
    if(!document.querySelector('meta[name="authenticated-session"]'))return
    let checking=false
    async function checkSession(){
        if(checking||redirecting||document.visibilityState==='hidden')return
        checking=true
        try{
            const response=await window.fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'})
            if(response.ok&&(await response.json()).must_change_password)redirect('/auth/password')
        }catch{} // A network failure does not establish that the session expired.
        finally{checking=false}
    }
    window.setInterval(checkSession,15000)
    window.addEventListener('focus',checkSession)
    window.addEventListener('pageshow',checkSession)
    document.addEventListener('visibilitychange',checkSession)
    checkSession()
})()
