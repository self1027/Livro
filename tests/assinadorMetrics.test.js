import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeAssinador} from '../src/utils/assinadorMetrics.js'

const users=new Map([[1,{id:1,name:'Ana'}],[2,{id:2,name:'Bruno'}]])

test('summarizeAssinador agrega volume, sucesso e top automatizadores',()=>{
    const jobs=[
        {id:1,protocol:'01.000001/26',protocol_key:'k1',status:'completed',confirmed:2,requested_by:1,started_at:new Date('2026-01-10T10:00:00Z'),finished_at:new Date('2026-01-10T10:05:00Z'),createdAt:new Date('2026-01-10T09:59:00Z')},
        {id:2,protocol:'01.000002/26',protocol_key:'k2',status:'failed',confirmed:0,requested_by:2,started_at:new Date('2026-01-11T10:00:00Z'),finished_at:new Date('2026-01-11T10:01:00Z'),createdAt:new Date('2026-01-11T09:59:00Z')},
        {id:3,protocol:'01.000003/26',protocol_key:'k3',status:'completed',confirmed:1,requested_by:1,started_at:new Date('2026-02-01T10:00:00Z'),finished_at:new Date('2026-02-01T10:02:00Z'),createdAt:new Date('2026-02-01T09:59:00Z')}
    ]
    const summary=summarizeAssinador(jobs,users,{start:'2026-01-01',end:'2026-02-28'})
    assert.equal(summary.total,3)
    assert.equal(summary.completed,2)
    assert.equal(summary.failed,1)
    assert.equal(summary.signatures,3)
    assert.equal(summary.uniqueProtocols,3)
    assert.equal(summary.successRate,67)
    assert.equal(summary.topAutomators[0].name,'Ana')
    assert.equal(summary.topAutomators[0].total,2)
    assert.equal(summary.monthSeries.length,2)
})

test('summarizeAssinador respeita filtro por operador',()=>{
    const jobs=[
        {id:1,protocol:'01.000001/26',protocol_key:'k1',status:'completed',confirmed:1,requested_by:1,finished_at:new Date('2026-03-01T12:00:00Z'),createdAt:new Date('2026-03-01T11:00:00Z')},
        {id:2,protocol:'01.000002/26',protocol_key:'k2',status:'completed',confirmed:2,requested_by:2,finished_at:new Date('2026-03-02T12:00:00Z'),createdAt:new Date('2026-03-02T11:00:00Z')}
    ]
    const summary=summarizeAssinador(jobs,users,{start:'2026-03-01',end:'2026-03-31',userId:'2'})
    assert.equal(summary.total,1)
    assert.equal(summary.topAutomators[0].name,'Bruno')
})
