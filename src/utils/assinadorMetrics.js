const scalar=value=>typeof value==='string'?value.trim():''
const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))

function inPeriod(job,filters){
    const anchor=job.finished_at||job.started_at||job.createdAt
    if(!anchor)return false
    const at=new Date(anchor)
    if(filters.start){
        const start=new Date(`${filters.start}T00:00:00-03:00`)
        if(at<start)return false
    }
    if(filters.end){
        const end=new Date(`${filters.end}T00:00:00-03:00`)
        end.setUTCDate(end.getUTCDate()+1)
        if(at>=end)return false
    }
    if(filters.userId&&String(job.requested_by)!==String(filters.userId))return false
    return true
}

function median(values){
    if(!values.length)return null
    const sorted=[...values].sort((a,b)=>a-b)
    const mid=Math.floor(sorted.length/2)
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2
}

export function summarizeAssinador(jobs=[],usersById=new Map(),filters={}){
    const rows=jobs.filter(job=>inPeriod(job,filters))
    const completed=rows.filter(job=>job.status==='completed')
    const failed=rows.filter(job=>job.status==='failed')
    const cancelled=rows.filter(job=>job.status==='cancelled')
    const terminal=rows.filter(job=>['completed','failed','cancelled'].includes(job.status))
    const successRate=terminal.length?Math.round((completed.length/terminal.length)*100):null
    const protocols=new Set(rows.map(job=>job.protocol_key||job.protocol).filter(Boolean))
    const signatures=rows.reduce((sum,job)=>sum+Number(job.confirmed||0),0)
    const durations=completed.map(job=>{
        if(!job.started_at||!job.finished_at)return null
        return new Date(job.finished_at)-new Date(job.started_at)
    }).filter(value=>value!=null&&value>=0)
    const byAuthor=new Map()
    for(const job of rows){
        const id=job.requested_by
        const current=byAuthor.get(id)||{id,total:0,completed:0,failed:0,signatures:0}
        current.total+=1
        if(job.status==='completed')current.completed+=1
        if(job.status==='failed')current.failed+=1
        current.signatures+=Number(job.confirmed||0)
        byAuthor.set(id,current)
    }
    const topAutomators=[...byAuthor.values()]
        .map(row=>({
            id:row.id,
            name:usersById.get(row.id)?.name||`Operador #${row.id}`,
            total:row.total,
            completed:row.completed,
            failed:row.failed,
            signatures:row.signatures
        }))
        .sort((a,b)=>b.total-a.total||b.completed-a.completed||a.name.localeCompare(b.name,'pt-BR'))
    const monthly=new Map()
    for(const job of rows){
        const anchor=job.finished_at||job.started_at||job.createdAt
        if(!anchor)continue
        const date=new Date(anchor)
        const key=`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`
        const bucket=monthly.get(key)||{month:key,total:0,completed:0,failed:0}
        bucket.total+=1
        if(job.status==='completed')bucket.completed+=1
        if(job.status==='failed')bucket.failed+=1
        monthly.set(key,bucket)
    }
    return {
        total:rows.length,
        completed:completed.length,
        failed:failed.length,
        cancelled:cancelled.length,
        successRate,
        uniqueProtocols:protocols.size,
        signatures,
        medianMs:median(durations),
        topAutomators:topAutomators.filter(row=>row.total).slice(0,12),
        monthSeries:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month))
    }
}

export function normalizeAssinadorAdminFilters(query={}){
    return {
        start:dateOnly(scalar(query.start))?scalar(query.start):'',
        end:dateOnly(scalar(query.end))?scalar(query.end):'',
        userId:/^\d+$/.test(scalar(query.userId))?scalar(query.userId):''
    }
}
