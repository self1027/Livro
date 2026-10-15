(() => {
    const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
    const queueSearch=document.getElementById('assignment-search')
    if(queueSearch){const rows=[...document.querySelectorAll('[data-assignment-row]')],feedback=document.getElementById('assignment-filter-feedback');queueSearch.addEventListener('input',()=>{const term=normalize(queueSearch.value);let visible=0;rows.forEach(row=>{const match=normalize(row.textContent).includes(term);row.hidden=!match;row.style.display=match?'':'none';if(match)visible++});feedback.textContent=term?visible?`${visible} ${visible===1?'denúncia encontrada':'denúncias encontradas'} nesta página.`:'Nenhuma denúncia encontrada nesta página.':''})}
    document.querySelectorAll('[data-admin-save]').forEach(form=>{const button=form.querySelector('[type="submit"]');if(button)button.dataset.defaultLabel=button.textContent;form.addEventListener('submit',event=>{if(button?.disabled){event.preventDefault();return}if(button){button.disabled=true;button.textContent='Salvando…'}})})
    window.addEventListener('pageshow',()=>document.querySelectorAll('[data-admin-save] [type="submit"]').forEach(button=>{button.disabled=false;button.textContent=button.dataset.defaultLabel}))
})()
