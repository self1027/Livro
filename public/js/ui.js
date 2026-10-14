(() => {
    const toggle = document.querySelector('.app-menu-toggle');
    const nav = document.getElementById('app-navigation');
    toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(expanded));
        nav.classList.toggle('is-open', expanded);
    });
    const path = location.pathname;
    let best;
    document.querySelectorAll('.app-nav-link, .app-create').forEach(link => {
        const target = link.getAttribute('href');
        if (path === target || (target !== '/' && path.startsWith(target + '/'))) {
            if (!best || target.length > best.getAttribute('href').length) best = link;
        }
    });
    if (!best && (path === '/buscar' || /^\/denuncias\/[^/]+/.test(path))) best = document.querySelector('.app-nav-link[href="/"]');
    best?.classList.add('current');
    best?.setAttribute('aria-current', 'page');
    // Reuse existing tables without changing forms, routes or pagination scripts.
    document.querySelectorAll('.table:not(#calendario)').forEach(table => {
        if (table.querySelector('[colspan], [rowspan]')) return;
        const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        if (!labels.length) return;
        table.classList.add('ui-responsive-table');
        const labelRows = () => table.querySelectorAll('tbody tr').forEach(row => {
            [...row.cells].forEach((cell, i) => { cell.dataset.label = labels[i] || ''; });
        });
        labelRows();
        const body = table.querySelector('tbody');
        if (body) new MutationObserver(labelRows).observe(body, {childList: true});
    });
})();
