import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import {fileURLToPath} from 'node:url';
import STATUS from '../src/constants/denunciationStatus.js';
import SENDERS from '../src/constants/denunciationSenders.js';
import {reportDetails, senderDetails} from '../src/utils/catalogRegistry.js';
import {searchUrl} from '../src/utils/searchFilters.js';
import {normalizeDenunciationForm} from '../src/utils/denunciationForm.js';
import {PERMISSIONS,PERMISSION_DESCRIPTIONS} from '../src/auth/permissions.js';

test('formulário de cargos exibe todas as permissões, informa SIVISA e oculta categorias vazias',async()=>{
    const file=fileURLToPath(new URL('../views/partials/accessRoleForm.ejs',import.meta.url));
    const render=permissions=>ejs.renderFile(file,{role:null,permissions,permissionDescriptions:PERMISSION_DESCRIPTIONS});
    const html=await render(PERMISSIONS);
    for(const permission of Object.keys(PERMISSIONS))assert.ok(html.includes(`value="${permission}"`),permission);
    assert.equal((html.match(/name="permissions"/g)||[]).length,Object.keys(PERMISSIONS).length);
    assert.match(html,/Relatórios e SIVISA/);
    assert.match(html,/Editar denúncias que cadastrou/);
    assert.match(html,/Editar todas as denúncias/);
    assert.ok(!html.includes('value="denunciations.edit"'));
    assert.match(html,/Áreas dos fiscais e alcance de atuação/);
    assert.ok(!html.includes('>Fiscais</h3>'));
    const restricted=await render({'reports.edit':PERMISSIONS['reports.edit']});
    assert.match(restricted,/gerenciar SIVISA/);
    assert.ok(!restricted.includes('>Escala</h3>'));
    assert.ok(!restricted.includes('>Painel</h3>'));
});

test('telas compartilham navegação e tema e renderizam com dados de exemplo', async () => {
    const row = {id:1,year:2026,number:123,title:'Denúncia <teste>',description:'Descrição',endereco:'Avenida',numero:100,bairro:'Centro',created_at:'2026-10-14',status:'PENDENTE',registration_type:Object.keys(SENDERS)[0],reports:[],user:null};
    const data = {DENUNCIATION_STATUS:STATUS,DENUNCIATION_SENDER:SENDERS,denuncias:[row],denuncia:row,denunciaSelecionada:null,report:{id:1,type:1,description:'Teste'},reports:[],fiscal:{id:1,name:'Fiscal'},user:{id:1,name:'Fiscal',ativo:true},users:[],fiscais:[],username:[],districts:[],attendance:{paused:false,weekdays:['SEG']},offset:50,limit:50,year:2026,lastNumber:1,number:'',endereco:'',numero:'',bairro:'',status:'',registration_type:'',userId:'',selectedStatus:'REGISTRADA',nextPage:null,ano:2026,mes:9,mesLabel:'Outubro',semanas:[],dias:[],page:1,totalPages:1};
    data.hasMore = false;
    data.REPORT_DETAILS = reportDetails;
    data.SENDER_DETAILS = senderDetails;
    data.searchPerformed = true;
    data.searchErrors = [];
    data.activeFilters = [];
    data.searchUrl = searchUrl;
    data.form = normalizeDenunciationForm({});
    data.fieldErrors = {};
    data.existingId = null;
    data.total = data.denuncias.length;
    data.editable = false;
    data.basePath = '/escala';
    data.formName = '';
    data.pages = 1;
    data.mode = 'login';
    data.error = '';
    const root = fileURLToPath(new URL('../views/', import.meta.url));
    const files = fs.readdirSync(root,{recursive:true}).filter(file => file.endsWith('.ejs') && !file.startsWith('partials') && !file.startsWith('admin'));
    for (const file of files) {
        const html = await ejs.renderFile(path.join(root,file),data);
        assert.equal((html.match(/id="app-navigation"/g) || []).length,file.replaceAll('\\','/').startsWith('auth/')?0:1,file);
        assert.equal((html.match(/href="\/css\/theme.css"/g) || []).length,1,file);
        assert.ok(html.includes('/js/ui.js'),file);
        assert.ok(!html.includes('Denúncia <teste>'),file);
    }
});
