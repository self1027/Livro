export const AVATAR_ICONS = ['male','female']

export const AVATAR_COLORS = {
    teal: {label:'Verde petróleo',hex:'#28766D'},
    blue: {label:'Azul',hex:'#356DA8'},
    purple: {label:'Roxo',hex:'#7756A6'},
    rose: {label:'Rosa',hex:'#A64D72'},
    terracotta: {label:'Terracota',hex:'#AD5B3E'},
    slate: {label:'Cinza',hex:'#526578'}
}

export function validateAvatar(input) {
    const {avatar_icon,avatar_color}=input||{}
    if(!AVATAR_ICONS.includes(avatar_icon))throw new Error('Escolha um dos ícones disponíveis.')
    if(typeof avatar_color!=='string'||!Object.hasOwn(AVATAR_COLORS,avatar_color))throw new Error('Escolha uma das cores disponíveis.')
    return {avatar_icon,avatar_color}
}
