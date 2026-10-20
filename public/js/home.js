(() => {
    const button = document.getElementById('carregarMais');
    if (!button) return;
    const config = JSON.parse(document.getElementById('home-data').textContent);
    const feedback = document.getElementById('load-feedback');
    const tbody = document.querySelector('#tabela-denuncias tbody');
    let offset = config.offset;
    button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = 'Carregando…';
        tbody.setAttribute('aria-busy', 'true');
        feedback.textContent = '';
        let finished = false;
        try {
            const response = await fetch(`/api/denuncias?limit=${config.limit}&offset=${offset}`);
            if (!response.ok) throw new Error('Falha na consulta');
            const rows = await response.json();
            if (!Array.isArray(rows)) throw new Error('Resposta inválida');
            const fragment = document.createDocumentFragment();
            for (const row of rows) {
                const tr = document.createElement('tr');
                const status = config.statuses[row.status?.trim()] || {label:'Desconhecido', slug:'UNKNOWN'};
                const cells = [['Protocolo',`${row.number}/${row.year}`],['Tipo',config.senders[row.registration_type] || row.registration_type || 'Não informado'],['Título',row.title],['Endereço',`${row.endereco || ''}, ${row.numero || ''} — ${row.bairro || ''}`],['Data',new Date(row.created_at).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'})],['Status',status.label],['Fiscal',row.user?.name || 'Não atribuído'],['Ações','']];
                for (const [label,value] of cells) {
                    const td = document.createElement('td');
                    td.dataset.label = label;
                    td.textContent = value ?? '';
                    if (label === 'Protocolo') td.className = 'home-protocol';
                    if (label === 'Título') td.className = 'home-title';
                    if (label === 'Status' || label === 'Tipo') {
                        td.textContent = '';
                        const detail = label === 'Status' ? status : config.senderDetails?.[row.registration_type] || {label:value};
                        const badge = document.createElement('span');
                        badge.className = 'ui-status';
                        badge.dataset.status = detail.slug || '';
                        if (detail.color) badge.style.setProperty('--status-color', detail.color);
                        if (detail.backgroundColor) badge.style.setProperty('--status-background', detail.backgroundColor);
                        badge.textContent = detail.label;
                        td.append(badge);
                    }
                    if (label === 'Ações') {
                        const link = document.createElement('a');
                        link.className = 'home-view';
                        link.href = `/denuncias/${encodeURIComponent(row.id)}`;
                        link.textContent = 'Ver ↗';
                        link.setAttribute('aria-label', `Ver denúncia ${row.number}/${row.year}`);
                        td.append(link);
                    }
                    tr.append(td);
                }
                fragment.append(tr);
            }
            tbody.append(fragment);
            const count = document.getElementById('home-record-count');
            if (count) count.textContent = `${tbody.rows.length} ${tbody.rows.length === 1 ? 'registro exibido' : 'registros exibidos'}`;
            offset += config.limit;
            finished = rows.length < config.limit;
            feedback.textContent = rows.length ? `${rows.length} registros adicionados.` : 'Não há mais registros.';
        } catch {
            feedback.textContent = 'Não foi possível carregar as denúncias. Tente novamente.';
        } finally {
            tbody.setAttribute('aria-busy', 'false');
            button.disabled = finished;
            button.textContent = finished ? 'Todas carregadas' : 'Carregar mais';
        }
    });
})();
