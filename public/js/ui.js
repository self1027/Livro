(() => {
    const toggle = document.querySelector('.app-menu-toggle');
    const nav = document.getElementById('app-navigation');
    toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(expanded));
        nav.classList.toggle('is-open', expanded);
    });
    document.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.key !== 'Escape' || !nav?.classList.contains('is-open') || document.querySelector('[data-account-identity][open]')) return;
        nav.classList.remove('is-open');
        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.focus();
    });
    const credits = document.querySelector('.footer-credits');
    document.addEventListener('click', event => {
        if (credits?.open && !credits.contains(event.target)) credits.open = false;
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && credits?.open) {
            credits.open = false;
            credits.querySelector('summary').focus();
        }
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
