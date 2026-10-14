export const denunciationFields = ['registration_type','title','endereco','numero','bairro','complemento','description']
export function normalizeDenunciationForm(input = {}) {
    return Object.fromEntries(denunciationFields.map(key => [key,typeof input[key] === 'string' ? input[key].trim() : '']))
}
export function validateDenunciationForm(form, senders) {
    const errors = {}
    const required = {title:'Informe um título.',endereco:'Informe o logradouro.',numero:'Informe o número ou s/n.',bairro:'Selecione um bairro cadastrado.',description:'Descreva a situação denunciada.'}
    for (const [key,message] of Object.entries(required)) if (!form[key]) errors[key] = message
    if (!Object.hasOwn(senders,form.registration_type)) errors.registration_type = 'Selecione a origem da denúncia.'
    for (const key of ['title','endereco','numero','bairro','complemento']) {
        if (form[key].length > 255) errors[key] = 'Use até 255 caracteres.'
    }
    return errors
}
