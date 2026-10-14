import test from 'node:test'
import assert from 'node:assert/strict'
import ejs from 'ejs'
import {fileURLToPath} from 'node:url'
import {Op} from 'sequelize'
import {normalizeSearchFilters,searchUrl} from '../src/utils/searchFilters.js'
import {buildSearchWhere} from '../src/utils/denunciationsQueryBuilder.js'
import service from '../src/services/denunciationsService.js'
import repo from '../src/repositories/denunciationsRepository.js'
import users from '../src/services/usersService.js'
import districts from '../src/services/districtsService.js'
import {senderDetails} from '../src/utils/catalogRegistry.js'

test('busca distingue estado inicial, vazio e resultados e preserva filtros combinados', async () => {
    const original = {search:repo.search,users:users.getAllOrdered,districts:districts.getAll}
    let calls = 0, where, rows = []
    repo.search = async input => {calls++;where=input;return rows}
    users.getAllOrdered = async () => [{id:1,name:'Fiscal'}]
    districts.getAll = async () => [{name:'Centro'}]
    const render = context => ejs.renderFile(fileURLToPath(new URL('../views/denunciation/search.ejs',import.meta.url)),{...context,SENDER_DETAILS:senderDetails})
    try {
        const initial = await service.getSearchContext({unused:'ignored',endereco:'  '})
        assert.equal(calls,0)
        assert.equal(initial.searchPerformed,false)
        const firstHtml = await render(initial)
        assert.ok(firstHtml.includes('Encontre a denúncia'))
        assert.ok(!firstHtml.includes('Nenhuma denúncia encontrada'))
        const empty = await service.getSearchContext({year:'2026',bairro:' Centro ',userId:'unassigned'})
        assert.equal(where.year,'2026')
        assert.equal(where.bairro[Op.like],'%Centro%')
        assert.equal(where.user_id,null)
        assert.equal(empty.bairro,'Centro')
        assert.equal(empty.activeFilters.length,3)
        assert.ok((await render(empty)).includes('Nenhuma denúncia encontrada'))
        rows = [{id:1,year:2026,number:123,title:'Título <teste>',endereco:'Rua',numero:'1',bairro:'Centro',created_at:'2026-10-14',status:'REGISTRADA',registration_type:'PESSOA_TELEFONE',user:null}]
        const results = await service.getSearchContext({number:'123'})
        const html = await render(results)
        assert.ok(html.includes('1 denúncia encontrada'))
        assert.ok(html.includes('123/2026'))
        assert.ok(html.includes('Título &lt;teste&gt;'))
        assert.ok(html.includes('Não atribuído'))
        assert.ok(html.includes('Remover filtro Número do protocolo'))
        const count = calls
        const invalid = await service.getSearchContext({year:'20ab',endereco:['Rua']})
        assert.ok(invalid.searchErrors.length)
        assert.equal(calls,count)
        assert.ok((await render(invalid)).includes('Revise os filtros'))
    } finally {repo.search=original.search;users.getAllOrdered=original.users;districts.getAll=original.districts}
})

test('remover filtros mantém os demais e endereço não perde prefixos que fazem parte do nome', () => {
    const {filters} = normalizeSearchFilters({year:'2026',number:'12',endereco:' A & B '})
    const url = new URL(searchUrl(filters,{year:''}),'http://localhost')
    assert.equal(url.searchParams.has('year'),false)
    assert.equal(url.searchParams.get('number'),'12')
    assert.equal(url.searchParams.get('endereco'),'A & B')
    assert.equal(searchUrl(normalizeSearchFilters({year:'2026'}).filters,{year:''}),'/buscar')
    assert.equal(buildSearchWhere({endereco:'Ruanda'}).endereco[Op.like],'%Ruanda%')
    assert.equal(buildSearchWhere({endereco:'Rua das Flores'}).endereco[Op.like],'%das Flores%')
    assert.ok(normalizeSearchFilters({status:'UNKNOWN'}).errors.length)
})
