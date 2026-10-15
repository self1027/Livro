const actions={
    'account.saved':'Cadastro de acesso salvo',
    'staff.updated':'Cadastro de fiscal atualizado',
    login:'Entrada no sistema',
    bootstrap:'Primeira Chefia criada',
    'role.saved':'Responsabilidade salva',
    'password.changed':'Senha alterada pelo usuário',
    'password.reset.chief':'Senha temporária definida pela Chefia',
    'password.recovery.requested':'Recuperação de senha solicitada',
    'password.recovered':'Senha recuperada',
    'recovery_email.initialized':'E-mail de recuperação configurado',
    'recovery_email.changed':'E-mail de recuperação alterado'
}

export function presentAudit(event,{accounts,users,roles}){
    const details=event.details||{}
    const person=id=>{
        const account=accounts.find(item=>item.id===id)
        if(!account)return `Conta #${id} (indisponível)`
        const user=users.find(item=>item.id===account.user_id)
        return user?`${user.name} (@${account.username})`:`@${account.username}`
    }
    let target=''
    if(event.action==='role.saved'){
        target=details.name||roles.find(item=>item.id===event.target_id)?.name||`Responsabilidade #${event.target_id}`
    }else if(event.action==='staff.updated'){
        target=users.find(item=>item.id===details.user_id)?.name||(event.target_id?person(event.target_id):'Fiscal indisponível')
    }else if(event.target_id)target=person(event.target_id)
    else if(event.action.startsWith('recovery_email.'))target=details.email||'E-mail institucional do setor'
    const notes=[]
    if(event.action==='account.saved'){
        const role=roles.find(item=>item.id===details.role_id)
        if(role)notes.push(`Responsabilidade: ${role.name}`)
        if(typeof details.enabled==='boolean')notes.push(details.enabled?'Acesso habilitado':'Acesso desabilitado')
        if(typeof details.inspector==='boolean')notes.push(details.inspector?'Pode receber denúncias':'Não recebe denúncias')
        if(typeof details.receives_denunciations==='boolean')notes.push(details.receives_denunciations?'Cargo permite receber denúncias':'Cargo não permite receber denúncias')
    }
    if(event.action==='staff.updated'&&typeof details.ativo==='boolean')notes.push(details.ativo?'Fiscal ativo':'Fiscal inativo')
    return {action:actions[event.action]||`Evento não reconhecido (${event.action})`,actor:event.actor_id?person(event.actor_id):event.action==='password.recovery.requested'||event.action==='password.recovered'?'Solicitação sem sessão autenticada':'Sistema (configuração inicial)',target,notes:notes.join(' · ')}
}
