export function renderPage(templates,page){
  function render(name,data){
    const template=templates[name]
    if(!template)throw Error(`Template não encontrado: ${name}`)
    return template(data,undefined,(reference,extra={})=>{
      const parts=(reference.startsWith('/')?reference:`${name.slice(0,name.lastIndexOf('/')+1)}${reference}`).split('/'),resolved=[]
      for(const part of parts)if(part==='..')resolved.pop();else if(part&&part!=='.')resolved.push(part)
      const target=resolved.join('/');return render(target.endsWith('.ejs')?target:target+'.ejs',{...data,...extra})
    })
  }
  // window.name exists in browsers; EJS optional field names must remain undefined.
  return render(page.view+'.ejs',{name:undefined,...page.data})
}
