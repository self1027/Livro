import {test} from 'node:test'
import assert from 'node:assert/strict'
import ejs from 'ejs'
import {createSeed} from '../src/demo/data.js'
import {pageContext} from '../src/demo/pages.js'
import {renderPage} from '../src/demo/render.js'
import {runInNewContext} from 'node:vm'

test('o nome global da janela não sobrescreve o nome padrão do campo bairro',()=>{
  const template=ejs.compile('<% const inputName=typeof name!=="undefined"?name:"bairro" %><input name="<%= inputName %>">',{client:true,compileDebug:false})
  const html=renderPage({'field.ejs':runInNewContext('('+template.toString()+')',{name:''})},{view:'field',data:{}})
  assert.match(html,/name="bairro"/)
})

for(const path of ['/','/denuncias/new','/denuncias/1','/denuncias/2/edit','/buscar?status=REGISTRADA','/admin/assignments','/admin/assignments?denunciaId=1','/area-fiscal','/area-fiscal/2','/admin','/admin?view=sivisa','/admin?view=sivisa&actionMetric=pending','/admin?view=analytics','/admin?view=reports','/admin?tab=attendance','/escala','/admin/schedule','/admin/catalogs','/admin/catalogs?kind=sender','/admin/catalogs?kind=district','/admin/access','/recados','/sivisa/pendencias','/relatorio/1','/relatorio/1/sivisa','/inexistente']){
  test(`templates reais renderizam ${path}`,async()=>{
    const page=pageContext(createSeed(),new URL(path,'http://localhost'))
    const html=await ejs.renderFile(`views/${page.view}.ejs`,page.data)
    assert.match(html,/<html/)
    assert.doesNotMatch(html,/undefined\/|NaN/)
  })
}
