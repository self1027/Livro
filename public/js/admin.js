(() => {
    const source = document.getElementById('admin-chart-data')
    if (!source) return
    if (typeof Chart === 'undefined') {
        document.querySelectorAll('.chart-wrap').forEach(container => {
            container.textContent = 'Gráfico indisponível. Consulte os valores abaixo.'
        })
        return
    }
    const { monthly, bairros, statusStats, filters } = JSON.parse(source.textContent)
    function navigate(changes) {
        const params = new URLSearchParams({ ...filters, view: 'overview', page: 1, queue: '', ...changes })
        window.location.href = `/admin?${params}#denuncias`
    }
    const theme = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null
    const primary = theme?.getPropertyValue('--ui-primary').trim() || '#17665e'
    const chartFill = theme?.getPropertyValue('--ui-info-background').trim() || '#e8eee6'
    const reportColor = theme?.getPropertyValue('--ui-warning').trim() || '#795116'
    const options = { responsive: true, maintainAspectRatio: false }
    new Chart(document.getElementById('monthChart'), {
        type: 'line',
        data: { labels: monthly.map(m => m.month), datasets: [
            { label: 'Denúncias registradas', data: monthly.map(m => m.total), borderColor: primary, backgroundColor: chartFill, fill: false, tension: .2 },
            { label: 'Denúncias com relatório registrado', data: monthly.map(m => m.withReport ?? 0), borderColor: reportColor, backgroundColor: reportColor, borderDash: [6, 4], pointStyle: 'rectRot', fill: false, tension: .2 }
        ] },
        options: { ...options, interaction: { mode: 'nearest', intersect: true }, plugins: { tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            onClick: (_event, elements) => {
                // Only registration points drill into the list filtered by denunciation creation date.
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
    new Chart(document.getElementById('districtChart'), {
        type: 'bar', data: { labels: bairros.map(b => b.bairro), datasets: [{ label: 'Denúncias', data: bairros.map(b => b.total), backgroundColor: primary }] },
        options: { ...options, indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
            onClick: (_event, elements) => { if (elements.length) navigate({ bairro: bairros[elements[0].index].bairro }) }
        }
    })
    new Chart(document.getElementById('statusChart'), {
        type: 'doughnut', data: { labels: statusStats.map(s => s.label), datasets: [{ data: statusStats.map(s => s.count), backgroundColor: statusStats.map(s => s.color) }] },
        options: { ...options, plugins: { legend: { position: 'bottom' } },
            onClick: (_event, elements) => {
                const status = elements.length ? statusStats[elements[0].index].slug : ''
                if (status) navigate({ status })
            }
        }
    })
})()
