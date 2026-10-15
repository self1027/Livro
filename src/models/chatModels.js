import {DataTypes as D} from 'sequelize'
import db from '../database/database.js'

const userReference={model:'users',key:'id'}
const textOptions={charset:'utf8mb4',collate:'utf8mb4_unicode_ci'}
export const ChatConversation=db.define('chat_conversations',{
    user_low_id:{type:D.INTEGER,allowNull:false,references:userReference},
    user_high_id:{type:D.INTEGER,allowNull:false,references:userReference}
},{...textOptions,indexes:[{unique:true,fields:['user_low_id','user_high_id'],name:'chat_conversations_pair'},{fields:['user_high_id']}]})

export const ChatAnnouncement=db.define('chat_announcements',{
    sender_id:{type:D.INTEGER,allowNull:false,references:userReference},
    body:{type:D.TEXT,allowNull:false},
    denunciation_id:{type:D.INTEGER,allowNull:true,references:{model:'denunciations',key:'id'},onDelete:'SET NULL'},
    audience:{type:D.JSON,allowNull:false},
    client_id:{type:D.STRING(80),allowNull:false}
},{...textOptions,indexes:[{unique:true,fields:['sender_id','client_id'],name:'chat_announcements_sender_client'}]})

export const ChatMessage=db.define('chat_messages',{
    conversation_id:{type:D.INTEGER,allowNull:false,references:{model:'chat_conversations',key:'id'}},
    sender_id:{type:D.INTEGER,allowNull:false,references:userReference},
    body:{type:D.TEXT,allowNull:false},
    denunciation_id:{type:D.INTEGER,allowNull:true,references:{model:'denunciations',key:'id'},onDelete:'SET NULL'},
    announcement_id:{type:D.INTEGER,allowNull:true,references:{model:'chat_announcements',key:'id'}},
    client_id:{type:D.STRING(80),allowNull:false}
},{...textOptions,indexes:[{fields:['conversation_id','id'],name:'chat_messages_conversation_cursor'},{unique:true,fields:['sender_id','client_id'],name:'chat_messages_sender_client'},{fields:['announcement_id']}]})

export const ChatMessageRead=db.define('chat_message_reads',{
    message_id:{type:D.INTEGER,allowNull:false,references:{model:'chat_messages',key:'id'},onDelete:'CASCADE'},
    user_id:{type:D.INTEGER,allowNull:false,references:userReference},
    read_at:{type:D.DATE,allowNull:false,defaultValue:D.NOW}
},{...textOptions,timestamps:false,indexes:[{unique:true,fields:['message_id','user_id'],name:'chat_reads_message_user'},{fields:['user_id','message_id'],name:'chat_reads_user_message'}]})

export const chatModels=[ChatConversation,ChatAnnouncement,ChatMessage,ChatMessageRead]
