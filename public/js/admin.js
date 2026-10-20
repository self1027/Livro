(() => {
    const source = document.getElementById('admin-chart-data')
    if (!source) return
    if (typeof Chart === 'undefined') {
        document.querySelectorAll('.chart-wrap').forEach(container => {
            container.textContent = 'Gráfico indisponível. Consulte os valores abaixo.'
        })
        return
    }
    const { monthly, bairros, statusStats, ages, origins, sivisa, filters } = JSON.parse(source.textContent)
    const theme = typeof getComputedStyle === 'function' ? getComputedStyle(document.querySelector('.admin-panel')) : null
    const color = (token, fallback) => theme?.getPropertyValue(token).trim() || fallback
    const primary = color('--chart-primary', '#18794e')
    const secondary = color('--chart-secondary', '#708779')
    const ink = color('--chart-ink', '#343c38')
    const warning = color('--chart-warning', '#9a6c2c')
    const muted = color('--ui-muted', '#6b6b6b')
    const grid = color('--chart-grid', '#ededed')
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const options = {
        responsive: true, maintainAspectRatio: false, locale: 'pt-BR', color: muted,
        font: { family: 'Inter, sans-serif', size: 12 },
        animation: reducedMotion ? false : { duration: 180 },
        transitions: { active: { animation: { duration: reducedMotion ? 0 : 120 } } },
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: ink, padding: 12, cornerRadius: 6, displayColors: true,
                animation: reducedMotion ? false : { duration: 120 },
                titleFont: { family: 'Inter, sans-serif', size: 12 }, bodyFont: { family: 'Inter, sans-serif', size: 12 } }
        }
    }
    const numericAxis = { beginAtZero: true, border: { display: false }, grid: { color: grid, drawTicks: false }, ticks: { precision: 0, padding: 10, color: muted, font: { family: 'Inter, sans-serif', size: 11 } } }
    const categoryAxis = { border: { display: false }, grid: { display: false }, ticks: { color: muted, font: { family: 'Inter, sans-serif', size: 11 } } }
    function navigate(changes, target = 'overview') {
        const params = new URLSearchParams({ ...filters, view: target, page: 1, queue: '', ...changes })
        window.location.href = `/admin?${params}#${target === 'sivisa' ? 'acoes' : 'denuncias'}`
    }
    function render(id, config) {
        const canvas = document.getElementById(id)
        if (!canvas) return
        if (!config.data.datasets.some(dataset => dataset.data.some(value => value > 0))) {
            canvas.hidden = true
            const message = document.createElement('p')
            message.className = 'chart-empty'
            message.textContent = 'Sem dados para estes filtros.'
            canvas.parentElement.append(message)
            return
        }
        new Chart(canvas, config)
    }
    function bars(id, rows, labelKey, countKey, onSelect) {
        if (!rows) return
        render(id, {
            type: 'bar',
            data: { labels: rows.map(row => row[labelKey]), datasets: [{ label: 'Denúncias', data: rows.map(row => row[countKey]), backgroundColor: primary, borderRadius: 3, maxBarThickness: 18 }] },
            options: { ...options, indexAxis: 'y', scales: { x: numericAxis, y: { ...categoryAxis, ticks: { ...categoryAxis.ticks, callback(value) {
                const label = this.getLabelForValue(value)
                return label.length > 25 ? `${label.slice(0, 23)}…` : label
            } } } }, onClick: (_event, elements) => { if (elements.length) onSelect(rows[elements[0].index]) } }
        })
    }
    if (monthly) render('monthChart', {
        type: 'line',
        data: { labels: monthly.map(row => row.month), datasets: [
            { label: 'Denúncias registradas', data: monthly.map(row => row.total), borderColor: primary, backgroundColor: primary, pointStyle: 'circle' },
            { label: 'Denúncias com relatório registrado', data: monthly.map(row => row.withReport ?? 0), borderColor: warning, backgroundColor: warning, borderDash: [6, 4], pointStyle: 'rectRot' },
            { label: 'Denúncias finalizadas', data: monthly.map(row => row.closed ?? 0), borderColor: ink, backgroundColor: ink, borderDash: [2, 3], pointStyle: 'triangle' }
        ].map(dataset => ({ ...dataset, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, pointHitRadius: 10, fill: false, tension: 0 })) },
        options: { ...options, interaction: { mode: 'nearest', intersect: true },
            plugins: { ...options.plugins, legend: { display: true, position: 'bottom', align: 'start', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 18, color: muted, font: { family: 'Inter, sans-serif', size: 11 } } }, tooltip: { ...options.plugins.tooltip, mode: 'index', intersect: false } },
            scales: { y: numericAxis, x: { ...categoryAxis, ticks: { ...categoryAxis.ticks, maxTicksLimit: 8, maxRotation: 0, padding: 12 } } },
            onClick: (_event, elements) => {
                // Only registrations share the creation-date filter of the complaint list.
                const registration = elements.find(element => (element.datasetIndex ?? 0) === 0)
                if (!registration) return
                const month = monthly[registration.index].month
                const date = new Date(`${month}-01T12:00:00Z`)
                date.setUTCMonth(date.getUTCMonth() + 1)
                date.setUTCDate(0)
                const start = `${month}-01`, end = date.toISOString().slice(0, 10)
                navigate({ start: filters.start && filters.start > start ? filters.start : start, end: filters.end && filters.end < end ? filters.end : end })
            }
        }
    })
    bars('districtChart', bairros, 'bairro', 'total', row => { if(row.bairro !== 'Sem bairro') navigate({ bairro: row.bairro }) })
    bars('statusChart', statusStats, 'label', 'count', row => { if(row.slug) navigate({ status: row.slug }) })
    bars('ageChart', ages, 'label', 'count', row => navigate({ queue: row.queue }))
    bars('originChart', origins, 'label', 'count', row => { if(row.slug) navigate({ registration_type: row.slug }) })
    if (sivisa) {
        const colors = [primary, warning, secondary, color('--ui-input-border', '#b0b0b0')]
        render('sivisaChart', {
            type: 'doughnut', data: { labels: sivisa.map(row => row.label), datasets: [{ data: sivisa.map(row => row.count), backgroundColor: colors, borderWidth: 3, borderColor: color('--ui-surface', '#fff'), hoverOffset: 2 }] },
            options: { ...options, cutout: '76%', onClick: (_event, elements) => { if(elements.length) navigate({ actionMetric: sivisa[elements[0].index].key }, 'sivisa') } }
        })
    }
})()
