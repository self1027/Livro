(() => {
    const source=document.getElementById('schedule-data')
    if (!source) return
    const config=JSON.parse(source.textContent)
    const weeks=new Map(config.semanas.map(week=>[week.week_key,week]))
    const days=new Map(config.dias.map(day=>[day.data,day]))
    const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    const weekKey=date=>{
        const first=new Date(date.getFullYear(),0,1)
        const days=Math.floor((date-first)/86400000)
        return `${Math.ceil((days+first.getDay()+1)/7)}-${date.getFullYear()}`
    }
    function nameBadge(name) {
        const badge=document.createElement('div');badge.className='nome-badge';badge.textContent=name
        let hash=0
        for(let i=0;i<name.length;i++)hash=name.charCodeAt(i)+((hash<<5)-hash)
        badge.style.background=`hsl(${Math.abs(hash*137.508)%360}, 45%, 32%)`
        return badge
    }
    function note(text) {
        const details=document.createElement('details');details.className='schedule-note'
        const summary=document.createElement('summary');summary.textContent='Anotação'
        const content=document.createElement('p');content.textContent=text
        details.append(summary,content);return details
    }
    function editableCell(cell,key,type) {
        if (!config.editable) return
        cell.dataset.scheduleEdit=key;cell.dataset.editType=type
        cell.setAttribute('role','button');cell.tabIndex=0
        cell.setAttribute('aria-label',`Editar ${type==='semana'?'semana':'dia'} ${key}`)
    }
    function render() {
        const body=document.getElementById('corpoCalendario');body.replaceChildren()
        const start=new Date(config.ano,config.mes,1)
        start.setDate(start.getDate()-(start.getDay()+6)%7)
        const end=new Date(config.ano,config.mes+1,0)
        end.setDate(end.getDate()+((7-end.getDay())%7))
        for(let cursor=new Date(start);cursor<=end;cursor.setDate(cursor.getDate()+7)) {
            const row=document.createElement('tr'),key=weekKey(cursor),week=weeks.get(key)
            const control=document.createElement('td');control.className='controle-col'
            if(week?.nome) control.append(nameBadge(week.nome))
            else {const empty=document.createElement('span');empty.className='text-muted';empty.textContent=config.editable?'Definir semana':'Não definido';control.append(empty)}
            if(week?.anotacao)control.append(note(week.anotacao))
            editableCell(control,key,'semana');row.append(control)
            for(let i=0;i<7;i++) {
                const date=new Date(cursor);date.setDate(cursor.getDate()+i)
                const cell=document.createElement('td'),label=document.createElement('div');label.className='dia-numero';label.textContent=date.getDate();cell.append(label)
                const weekend=date.getDay()===0||date.getDay()===6
                cell.className=weekend?'fds':'dia-util'
                if(date.getMonth()!==config.mes)cell.classList.add('schedule-outside-month')
                if(!weekend) {
                    const day=days.get(iso(date))
                    if(day?.tipo==='feriado') {
                        cell.classList.add('feriado')
                        const holiday=document.createElement('div');holiday.className='small text-danger mt-4';holiday.textContent='FERIADO';cell.append(holiday)
                    } else {const name=day?.tipo==='sobrescrito'?day.nome:week?.nome;if(name)cell.append(nameBadge(name))}
                    const annotation=day?.tipo==='feriado'||day?.tipo==='sobrescrito'?day.anotacao:week?.anotacao
                    if(annotation)cell.append(note(annotation))
                    editableCell(cell,iso(date),'dia')
                }
                row.append(cell)
            }
            body.append(row)
        }
    }
    window.ScheduleCalendar={config,weeks,days,render}
    render()
})()
