(() => {
    const calendar=window.ScheduleCalendar
    if(!calendar?.config.editable) return
    const {weeks,days}=calendar
    const modal=document.getElementById('modalSemana'),form=document.getElementById('schedule-edit-form')
    const name=document.getElementById('inputNome'),annotation=document.getElementById('inputAnotacao'),holiday=document.getElementById('checkboxFeriado'),button=document.getElementById('schedule-save'),feedback=document.getElementById('schedule-save-feedback')
    let selectedKey,selectedType,modalReady=false,editRevision=0
    function open(cell) {
        editRevision++;modalReady=false
        selectedKey=cell.dataset.scheduleEdit;selectedType=cell.dataset.editType
        const week=selectedType==='semana'
        const entry=(week?weeks:days).get(selectedKey)||{}
        document.getElementById('schedule-edit-title').textContent=week?'Configurar semana':'Configurar dia'
        document.getElementById('chaveSelecionada').value=selectedKey
        document.getElementById('tipoDiaContainer').hidden=week
        document.getElementById('schedule-day-help').hidden=week
        holiday.checked=entry.tipo==='feriado'
        name.value=week||entry.tipo==='sobrescrito'?entry.nome||'':''
        annotation.value=entry.anotacao||''
        feedback.hidden=true;button.disabled=false;button.textContent='Salvar alterações'
        window.jQuery(modal).modal('show')
    }
    const grid=document.getElementById('calendario')
    grid.addEventListener('click',event=>{const cell=event.target.closest('[data-schedule-edit]');if(cell&&!event.target.closest('details'))open(cell)})
    grid.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key)||event.target.closest('details'))return;const cell=event.target.closest('[data-schedule-edit]');if(cell){event.preventDefault();open(cell)}})
    window.jQuery(modal).on('shown.bs.modal',()=>{modalReady=true;name.focus()})
    window.jQuery(modal).on('hidden.bs.modal',()=>{modalReady=false})
    form.addEventListener('submit',async event=>{
        event.preventDefault()
        if(button.disabled)return
        if(selectedType==='semana'&&!name.value.trim()){feedback.textContent='Informe o responsável pela semana.';feedback.hidden=false;name.focus();return}
        const key=selectedKey,type=selectedType,revision=editRevision
        const payload=type==='semana'?{week_key:key,nome:name.value.trim(),anotacao:annotation.value.trim()}:{data:key,tipo:holiday.checked?'feriado':name.value.trim()?'sobrescrito':'remover',nome:name.value.trim(),anotacao:annotation.value.trim()}
        button.disabled=true;button.textContent='Salvando…';feedback.hidden=true
        try {
            const response=await fetch(`/admin/schedule/${type==='semana'?'week':'day'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
            if(!response.ok)throw Error(await response.text())
            if(type==='semana')weeks.set(key,payload)
            else if(payload.tipo==='remover')days.delete(key)
            else days.set(key,payload)
            calendar.render()
            if(revision===editRevision) {
                if(modalReady)window.jQuery(modal).modal('hide')
                else window.jQuery(modal).one('shown.bs.modal',()=>{if(revision===editRevision)window.jQuery(modal).modal('hide')})
            }
        } catch(error){if(revision===editRevision){feedback.textContent=error instanceof TypeError?'Não foi possível salvar. Tente novamente.':error.message;feedback.hidden=false}}
        finally{if(revision===editRevision){button.disabled=false;button.textContent='Salvar alterações'}}
    })
})()
