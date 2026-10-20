// These codes are backend operations, not administrator-defined categories.
const REPORT_TYPE = Object.freeze({ STATUS_CHANGE: 0, TEXT: 1 })
export const REPORT_DETAILS = Object.freeze({
    0: Object.freeze({code:0, slug:'STATUS_CHANGE', label:'Mudança de status', behavior:'status', color:'#66487c', backgroundColor:'#eee7f4'}),
    1: Object.freeze({code:1, slug:'TEXT', label:'Relatório', behavior:'text', color:'#245d45', backgroundColor:'#e1eee7'})
})
export default REPORT_TYPE
