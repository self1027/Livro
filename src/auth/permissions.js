export const PERMISSIONS = Object.freeze({
    'denunciations.read':'Consultar denúncias',
    'denunciations.create':'Cadastrar denúncias',
    'denunciations.edit.own':'Editar denúncias que cadastrou',
    'denunciations.edit.all':'Editar todas as denúncias',
    'denunciations.assign':'Atribuir fiscal',
    'denunciations.receive':'Receber denúncias para fiscalização',
    'reports.create':'Registrar acompanhamento e SIVISA nas suas denúncias',
    'reports.edit':'Editar seus relatórios e gerenciar SIVISA',
    'reports.delete':'Excluir seus relatórios e vínculos SIVISA',
    'fiscal.area.own':'Acessar a própria área do fiscal',
    'fiscal.area.all':'Acessar todas as áreas dos fiscais',
    'fiscal.all':'Trabalhar nas denúncias de outros fiscais',
    'schedule.read':'Consultar escala',
    'schedule.manage':'Administrar escala',
    'catalogs.manage':'Administrar cadastros e cores',
    'attendance.manage':'Configurar atendimento',
    'dashboard.read':'Consultar painel e exportações'
})
export const PERMISSION_DESCRIPTIONS=Object.freeze({
    'denunciations.read':'Abre a listagem, a busca e os detalhes das denúncias, incluindo a situação e os protocolos SIVISA do histórico. Não permite alterar os registros ou os protocolos.',
    'denunciations.create':'Permite cadastrar novas denúncias e preencher seus dados iniciais.',
    'denunciations.edit.own':'Permite editar dados e situação apenas das denúncias cadastradas por você, mesmo após troca do fiscal responsável. Não permite editar cadastros de outras pessoas nem denúncias antigas sem autor identificado.',
    'denunciations.edit.all':'Permite editar dados e situação de qualquer denúncia, incluindo cadastros de outras pessoas e denúncias antigas sem autor identificado. Inclui a edição das denúncias que você cadastrou; não exige trabalhar nos registros de outros fiscais.',
    'denunciations.assign':'Permite escolher ou trocar o responsável por uma denúncia entre as pessoas habilitadas a recebê-la.',
    'denunciations.receive':'Inclui as pessoas deste cargo nas opções de responsável por novas denúncias, desde que o cadastro e o acesso estejam ativos. Não concede acesso às telas; selecione também as permissões de consulta e trabalho necessárias.',
    'reports.create':'Permite registrar acompanhamentos e atualizar a situação nas denúncias sob sua responsabilidade. Na nova ação textual, permite classificar SIVISA e informar seus protocolos iniciais.',
    'reports.edit':'Permite editar seus relatórios, acessar suas pendências SIVISA e adicionar ou remover seus protocolos, mesmo após reatribuição. Nesse caso, editar um relatório de status altera só o histórico. Não permite criar ou excluir relatórios.',
    'reports.delete':'Permite excluir relatórios de sua autoria, mesmo após a troca do responsável. A exclusão também remove os protocolos SIVISA vinculados. Não permite criar ou editar relatórios.',
    'fiscal.area.own':'Abre somente a sua área fiscal, com suas denúncias, filtros, paginação e exportação PDF. Não permite abrir a área de outra pessoa.',
    'fiscal.area.all':'Abre a seleção de fiscais e permite consultar a área e exportar as denúncias de qualquer pessoa, inclusive cadastros inativos. Inclui acesso à própria área. Não autoriza editar denúncias ou relatórios de outros fiscais.',
    'fiscal.all':'Amplia o alcance de registrar, editar ou excluir relatórios e gerenciar SIVISA para outros fiscais, respeitando a permissão de cada ação. A edição dos dados da denúncia e a consulta às áreas fiscais possuem permissões próprias.',
    'schedule.read':'Permite consultar a escala de trabalho, sem alterá-la.',
    'schedule.manage':'Permite criar e alterar os dias, equipes e horários da escala no painel administrativo.',
    'catalogs.manage':'Permite administrar bairros, situações, origens, tipos de relatório e suas cores.',
    'attendance.manage':'Permite configurar os dias de atendimento e pausar ou retomar o recebimento público.',
    'dashboard.read':'Abre os indicadores e filtros do painel administrativo, incluindo ações e registros SIVISA por autor. Também permite as exportações de denúncias em CSV ou PDF; não concede edição de relatórios ou protocolos.'
})
export const seedRoles = [
    {name:'Fiscal',maximum:false,permissions:['denunciations.read','denunciations.create','denunciations.receive','reports.create','reports.edit','fiscal.area.own','schedule.read']},
    {name:'Administrativo',maximum:false,permissions:Object.keys(PERMISSIONS).filter(key=>!['denunciations.receive','fiscal.area.own','denunciations.edit.own'].includes(key))},
    {name:'Chefia',maximum:true,permissions:Object.keys(PERMISSIONS).filter(key=>!['denunciations.receive','fiscal.area.own','denunciations.edit.own'].includes(key))}
]
export const can = (identity, permission) => !!identity && ((permission!=='denunciations.receive'&&identity.role.maximum) || identity.role.permissions.includes(permission) || (permission==='fiscal.area.own'&&identity.role.permissions.includes('fiscal.area.all')) || (permission==='denunciations.edit.own'&&identity.role.permissions.includes('denunciations.edit.all')))
const sameId=(left,right)=>left!=null&&right!=null&&String(left)===String(right)
export function canEditDenunciation(identity,denunciation){
    return !!denunciation&&(can(identity,'denunciations.edit.all')||(can(identity,'denunciations.edit.own')&&sameId(denunciation.created_by_user_id,identity.user.id)))
}
export function canWorkOnDenunciation(identity,permission,denunciation){
    if(permission==='denunciations.edit.own')return canEditDenunciation(identity,denunciation)
    if(permission==='denunciations.edit.all')return !!denunciation&&can(identity,permission)
    if(!denunciation||!can(identity,permission))return false
    if(permission==='reports.create'&&!denunciation.user_id)return false
    return can(identity,'fiscal.all')||sameId(denunciation.user_id,identity.user.id)
}
export function canManageReport(identity,permission,report){
    return !!report&&can(identity,permission)&&(can(identity,'fiscal.all')||sameId(report.user_id,identity.user.id))
}
export function validateRole({name,permissions,maximum}) {
    if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw new Error('Informe um nome de até 80 caracteres.')
    if(!Array.isArray(permissions)||permissions.some(p=>!Object.hasOwn(PERMISSIONS,p)))throw new Error('Permissões inválidas.')
    return {name:name.trim(),maximum:maximum===true,permissions:[...new Set(permissions)]}
}
