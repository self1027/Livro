import {defineConfig} from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import ejs from 'ejs'

const root=process.cwd()
function compiledTemplates(){
  const entries=[]
  function visit(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())visit(file);else if(file.endsWith('.ejs')){const name=path.relative(path.join(root,'views'),file).replaceAll('\\','/');entries.push(`${JSON.stringify(name)}:${ejs.compile(fs.readFileSync(file,'utf8'),{client:true,compileDebug:false}).toString()}`)}}}
  visit(path.join(root,'views'))
  return `window.LivroTemplates={${entries.join(',')}};`
}
export default defineConfig({
  plugins:[{
    name:'main-ejs-templates',
    configureServer(server){
      server.middlewares.use('/demo-vendor/templates.js',(_req,res)=>{res.setHeader('Content-Type','text/javascript');res.end(compiledTemplates())})
      server.middlewares.use('/demo-vendor/jquery.min.js',(_req,res)=>{res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(root,'node_modules/jquery/dist/jquery.min.js')))})
    },
    generateBundle(){
      // Classic scripts preserve the scope semantics of the original EJS templates.
      this.emitFile({type:'asset',fileName:'demo-vendor/templates.js',source:compiledTemplates()})
      this.emitFile({type:'asset',fileName:'demo-vendor/jquery.min.js',source:fs.readFileSync(path.join(root,'node_modules/jquery/dist/jquery.min.js'))})
    }
  }]
})
