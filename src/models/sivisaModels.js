import {DataTypes as D} from 'sequelize'
import db from '../database/database.js'
import Report from './reportsModel.js'

export const ReportSivisa=db.define('report_sivisa',{
    report_id:{type:D.INTEGER,primaryKey:true,references:{model:'reports',key:'id'},onDelete:'CASCADE'},
    applies:{type:D.BOOLEAN,allowNull:false}
},{freezeTableName:true})
export const SivisaProtocol=db.define('report_sivisa_protocols',{
    report_id:{type:D.INTEGER,allowNull:false,references:{model:'reports',key:'id'},onDelete:'CASCADE'},
    protocol:{type:D.STRING(64),allowNull:false,unique:true},
    note:{type:D.STRING(500),allowNull:false,defaultValue:''}
},{indexes:[{fields:['report_id']}]})
Report.hasOne(ReportSivisa,{foreignKey:'report_id',as:'sivisa',onDelete:'CASCADE'})
Report.hasMany(SivisaProtocol,{foreignKey:'report_id',as:'sivisaProtocols',onDelete:'CASCADE'})
export const sivisaInclude=[{model:ReportSivisa,as:'sivisa'},{model:SivisaProtocol,as:'sivisaProtocols'}]
