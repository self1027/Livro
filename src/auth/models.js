import { DataTypes as D } from 'sequelize'
import db from '../database/database.js'
import {jsonAttribute} from '../database/jsonAttribute.js'

export const Role = db.define('auth_roles', {
    name: {type:D.STRING(80),allowNull:false,unique:true},
    maximum: {type:D.BOOLEAN,allowNull:false,defaultValue:false},
    permissions: jsonAttribute(D.JSON,'permissions',{allowNull:false,defaultValue:[]})
})
export const Account = db.define('auth_accounts', {
    user_id: {type:D.INTEGER,allowNull:false,unique:true,references:{model:'users',key:'id'}},
    username: {type:D.STRING(64),allowNull:false,unique:true},
    password_hash: {type:D.STRING(255),allowNull:false},
    role_id: {type:D.INTEGER,allowNull:false,references:{model:'auth_roles',key:'id'}},
    enabled: {type:D.BOOLEAN,allowNull:false,defaultValue:true},
    avatar_icon: {type:D.STRING(12),allowNull:false,defaultValue:'male'},
    avatar_color: {type:D.STRING(16),allowNull:false,defaultValue:'teal'},
    inspector: {type:D.BOOLEAN,allowNull:false,defaultValue:false}, // Legacy source for the one-time role permission migration.
    must_change_password: {type:D.BOOLEAN,allowNull:false,defaultValue:true}
})
export const Session = db.define('auth_sessions', {
    account_id: {type:D.INTEGER,allowNull:false,references:{model:'auth_accounts',key:'id'}},
    token_hash: {type:D.STRING(64),allowNull:false,unique:true},
    family: {type:D.STRING(36),allowNull:false},
    kind: {type:D.STRING(12),allowNull:false},
    csrf: {type:D.STRING(64),allowNull:true},
    expires_at: {type:D.DATE,allowNull:false},
    consumed: {type:D.BOOLEAN,allowNull:false,defaultValue:false}
}, {indexes:[{fields:['account_id']},{fields:['family']}]})
export const Reset = db.define('auth_resets', {
    account_id: {type:D.INTEGER,allowNull:false,references:{model:'auth_accounts',key:'id'}},
    token_hash: {type:D.STRING(64),allowNull:false,unique:true},
    expires_at: {type:D.DATE,allowNull:false}
})
export const Setting = db.define('auth_settings', {
    id: {type:D.INTEGER,primaryKey:true},
    recovery_email: {type:D.STRING(254),allowNull:true},
    roles_seeded: {type:D.BOOLEAN,allowNull:false,defaultValue:false},
    role_receiving_migrated: {type:D.BOOLEAN,allowNull:false,defaultValue:false},
    fiscal_area_permissions_migrated: {type:D.BOOLEAN,allowNull:false,defaultValue:false},
    denunciation_edit_permissions_migrated: {type:D.BOOLEAN,allowNull:false,defaultValue:false},
    chat_permissions_migrated: {type:D.BOOLEAN,allowNull:false,defaultValue:false}
})
export const Audit = db.define('auth_audits', {
    actor_id: {type:D.INTEGER,allowNull:true},
    action: {type:D.STRING(80),allowNull:false},
    target_id: {type:D.INTEGER,allowNull:true},
    details: jsonAttribute(D.JSON,'details',{allowNull:false,defaultValue:{}})
})
export const authModels = [Role,Account,Session,Reset,Setting,Audit]
