import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'

const script=await readFile(new URL('../public/js/auth.js',import.meta.url),'utf8')
function browser(authenticated=true){
    const redirects=[],calls=[],events={},documentEvents={}
    const state={response:{ok:true,status:200,json:async()=>({must_change_password:false})}}
    const location={href:'http://livro.local/admin',origin:'http://livro.local',pathname:'/admin',replace:path=>redirects.push(path)}
    const document={visibilityState:'visible',querySelector:selector=>selector.includes('csrf-token')?{content:'csrf'}:authenticated?{}:null,addEventListener:(name,handler)=>{documentEvents[name]=handler}}
    const window={fetch:async(input,init)=>{calls.push({input,init});if(state.error)throw state.error;return state.response},setInterval:handler=>{events.interval=handler},addEventListener:(name,handler)=>{events[name]=handler}}
    runInNewContext(script,{window,document,location,URL,Request,Headers})
    return {state,window,document,events,documentEvents,redirects,calls}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('tela aberta volta ao login após revogação e ao retomar a aba',async()=>{
    for(const trigger of ['interval','focus','pageshow','visibilitychange']){
        const page=browser();await settle()
        page.state.response={status:401,ok:false}
        await (page.events[trigger]||page.documentEvents[trigger])()
        assert.deepEqual(page.redirects,['/auth/login'])
    }
})
test('fetch trata 401 e redirecionamentos de formulários; preserva CSRF',async()=>{
    for(const response of [{status:401},{status:200,redirected:true,url:'http://livro.local/auth/login'}]){
        const page=browser(false);page.state.response=response
        await page.window.fetch('/admin/schedule/day',{method:'POST'})
        assert.deepEqual(page.redirects,['/auth/login'])
        assert.equal(page.calls[0].init.headers.get('X-CSRF-Token'),'csrf')
    }
})
test('permissão negada e falha de rede não encerram sessão; troca obrigatória encaminha à senha',async()=>{
    const page=browser();await settle()
    page.state.response={status:403,ok:false};await page.events.focus()
    page.state.error=new Error('offline');await page.events.interval()
    assert.deepEqual(page.redirects,[])
    page.state.error=null;page.state.response={status:200,ok:true,json:async()=>({must_change_password:true})}
    await page.events.pageshow()
    assert.deepEqual(page.redirects,['/auth/password'])
})

test('fetch encaminha a troca obrigatória ao receber o código de erro 403',async()=>{
    const page=browser(false)
    page.state.response={status:403,ok:false,clone:()=>({json:async()=>({code:'PASSWORD_CHANGE_REQUIRED'})})}
    await page.window.fetch('/api/recados/notifications')
    assert.deepEqual(page.redirects,['/auth/password'])
})

test('checagem global reaproveita polling recente de recados e retoma após doze segundos',async()=>{
    const page=browser();await settle()
    const calls=page.calls.length
    page.window.LivroRecados={lastSessionCheck:Date.now()}
    await page.events.interval()
    await page.events.focus()
    assert.equal(page.calls.length,calls)
    page.window.LivroRecados.lastSessionCheck=Date.now()-13000
    await page.events.interval()
    assert.equal(page.calls.length,calls+1)
    assert.equal(page.calls.at(-1).input,'/api/auth/me')
})
