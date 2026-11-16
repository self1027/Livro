import {DataTypes as D} from 'sequelize'
import db from '../database/database.js'
import {jsonAttribute} from '../database/jsonAttribute.js'

const textOptions={charset:'utf8mb4',collate:'utf8mb4_unicode_ci'}

export const AssinadorSigner=db.define('assinador_signers',{
    name:{type:D.STRING(160),allowNull:false},
    login:{type:D.STRING(80),allowNull:false,unique:true},
    secret_cipher:{type:D.TEXT,allowNull:true},
    secret_length:{type:D.INTEGER,allowNull:true},
    enabled:{type:D.BOOLEAN,allowNull:false,defaultValue:true}
},{...textOptions,indexes:[{fields:['enabled']}]})

export const AssinadorJob=db.define('assinador_jobs',{
    protocol:{type:D.STRING(100),allowNull:false},
    protocol_key:{type:D.STRING(64),allowNull:false},
    status:{type:D.STRING(24),allowNull:false,defaultValue:'queued'},
    stage:{type:D.STRING(180),allowNull:false,defaultValue:'Na fila'},
    confirmed:{type:D.INTEGER,allowNull:false,defaultValue:0},
    signers:jsonAttribute(D.JSON,'signers',{allowNull:false,defaultValue:[]}),
    log:jsonAttribute(D.JSON,'log',{allowNull:false,defaultValue:[]}),
    destination:{type:D.STRING(500),allowNull:true},
    pdf_ready:{type:D.BOOLEAN,allowNull:false,defaultValue:false},
    pdf_expires_at:{type:D.DATE,allowNull:true},
    replace_existing:{type:D.BOOLEAN,allowNull:false,defaultValue:false},
    error:{type:D.TEXT,allowNull:true},
    recovery:jsonAttribute(D.JSON,'recovery',{allowNull:true}),
    requested_by:{type:D.INTEGER,allowNull:false,references:{model:'users',key:'id'}},
    started_at:{type:D.DATE,allowNull:true},
    finished_at:{type:D.DATE,allowNull:true},
    last_progress_at:{type:D.DATE,allowNull:true}
},{...textOptions,indexes:[
    {fields:['protocol_key','status'],name:'assinador_jobs_protocol_status'},
    {fields:['requested_by','id'],name:'assinador_jobs_requester'},
    {fields:['status','id'],name:'assinador_jobs_status'}
]})

export const assinadorModels=[AssinadorSigner,AssinadorJob]
