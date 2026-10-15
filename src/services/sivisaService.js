import {Op,literal} from 'sequelize'
import Report from '../models/reportsModel.js'
import Denunciation from '../models/denunciationsModel.js'
import {ReportSivisa,SivisaProtocol} from '../models/sivisaModels.js'
import {Audit} from '../auth/models.js'

async function saveForReport(reportId,values,transaction,actor){
    await ReportSivisa.upsert({report_id:reportId,applies:values.applies},{transaction})
    await SivisaProtocol.destroy({where:{report_id:reportId},transaction})
    if(values.protocols.length)await SivisaProtocol.bulkCreate(values.protocols.map(item=>({...item,report_id:reportId})),{transaction})
    if(actor)await Audit.create({actor_id:actor.account.id,action:'sivisa.saved',details:{report_id:reportId,applies:values.applies,protocols:values.protocols}},{transaction})
}
const pendingWhere=userId=>({type:1,user_id:userId,[Op.and]:literal('NOT EXISTS (SELECT 1 FROM report_sivisa_protocols AS sp WHERE sp.report_id = reports.id)')})
const pendingInclude=()=>[{model:ReportSivisa,as:'sivisa',required:true,where:{applies:true}}]
async function countPending(userId){return Report.count({where:pendingWhere(userId),include:pendingInclude()})}
async function pendingPage(userId,page=1){
    const total=await countPending(userId),pages=Math.max(1,Math.ceil(total/25)),current=Math.min(page,pages)
    const reports=await Report.findAll({where:pendingWhere(userId),include:[...pendingInclude(),{model:Denunciation,as:'denunciation',attributes:['id','number','year','title','status']}],order:[['created_at','ASC'],['id','ASC']],limit:25,offset:(current-1)*25})
    return {reports,total,pages,page:current}
}
export default {saveForReport,countPending,pendingPage}
