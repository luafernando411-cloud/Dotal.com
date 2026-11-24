import { useMemo } from 'react'
import { AdminRegionMap } from './AdminRegionMap.jsx'
import { Icon } from '../ui/index.jsx'
import { dashboardOptions } from '../../services/adminDashboardService.js'

export function ExecutiveDashboardModel({ records, regionRecords = records, selectedRegion, onRegionSelect }) {
  const regionCounts = useMemo(() => regionRecords.reduce((counts, record) => {
    counts[record.region] = (counts[record.region] || 0) + 1
    return counts
  }, {}), [regionRecords])

  const categoryStats = useMemo(() => dashboardOptions.categories.map((category) => {
    const members = records.filter((record) => record.category === category)
    return {
      category,
      count: members.length,
      completed: members.filter((record) => record.status === 'Concluído').length,
      review: members.filter((record) => record.status === 'Em Revisão').length,
      pending: members.filter((record) => record.status === 'Pendente').length,
    }
  }), [records])

  const completed = records.filter((record) => record.status === 'Concluído').length
  const completionRate = records.length ? Math.round((completed / records.length) * 100) : 0
  const maxCategory = Math.max(...categoryStats.map((item) => item.count), 1)

  return (
    <div className="model-content executive-model" data-testid="executive-dashboard-model">
      <section className="executive-kpis" aria-label="Indicadores executivos">
        <ExecutiveKpi title="Total recenseados" value={records.length} icon="users" tone="cyan" detail="Registros no recorte atual" />
        <ExecutiveKpi title="Ativos" value={categoryStats[0].count} icon="user" tone="navy" detail={`${share(categoryStats[0].count, records.length)}% da seleção`} />
        <ExecutiveKpi title="Aposentados" value={categoryStats[1].count} icon="user" tone="purple" detail={`${share(categoryStats[1].count, records.length)}% da seleção`} />
        <ExecutiveKpi title="Pensionistas" value={categoryStats[2].count} icon="users" tone="green" detail={`${share(categoryStats[2].count, records.length)}% da seleção`} />
        <ExecutiveKpi title="Taxa de conclusão" value={`${completionRate}%`} icon="check" tone="cyan" detail={`${completed} cadastros concluídos`} />
      </section>

      <div className="executive-grid">
        <section className="admin-panel model-panel executive-map-panel">
          <div className="panel-heading">
            <div><h2>Distribuição territorial</h2><p>{regionRecords.length} registros nos filtros atuais</p></div>
            {selectedRegion && <button type="button" className="clear-region-button" onClick={() => onRegionSelect('')} data-testid="clear-region-filter"><Icon name="close" size={14} />Limpar</button>}
          </div>
          <AdminRegionMap counts={regionCounts} selectedRegion={selectedRegion} onSelect={onRegionSelect} />
        </section>

        <section className="admin-panel model-panel category-chart-panel">
          <div className="panel-heading"><div><h2>Categoria por status</h2><p>Comparativo do recorte aplicado</p></div><span className="chart-period-label">REGISTROS</span></div>
          <div className="comparison-legend">
            <span><i className="complete-dot" />Concluído</span><span><i className="review-dot" />Em revisão</span><span><i className="pending-dot" />Pendente</span>
          </div>
          <div className="category-comparison-chart">
            {categoryStats.map((item) => {
              const barWidth = (item.count / maxCategory) * 100
              return (
                <div className="category-comparison-row" key={item.category}>
                  <div className="category-comparison-heading"><strong>{item.category}</strong><span>{item.count}</span></div>
                  <div className="comparison-track" aria-label={`${item.category}: ${item.completed} concluídos, ${item.review} em revisão, ${item.pending} pendentes`}>
                    <div className="comparison-stack" style={{ width: `${barWidth}%` }}>
                      <i className="stack-complete" style={{ flex: item.completed }} />
                      <i className="stack-review" style={{ flex: item.review }} />
                      <i className="stack-pending" style={{ flex: item.pending }} />
                    </div>
                  </div>
                  <div className="category-comparison-values"><span>{item.completed} concluídos</span><span>{item.review} em revisão</span><span>{item.pending} pendentes</span></div>
                </div>
              )
            })}
          </div>
          <div className="completion-summary"><span className="completion-summary-icon"><Icon name="check" size={17} /></span><span><small>TAXA DE CONCLUSÃO GERAL</small><strong>{completionRate}%</strong></span><i><span style={{ width: `${completionRate}%` }} /></i></div>
        </section>
      </div>
    </div>
  )
}

function ExecutiveKpi({ title, value, icon, tone, detail }) {
  return (
    <article className="executive-kpi-card">
      <span className={`executive-kpi-icon ${tone}`}><Icon name={icon} size={18} /></span>
      <span className="executive-kpi-title">{title}</span>
      <strong className="executive-kpi-value">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function share(value, total) {
  return total ? Math.round((value / total) * 100) : 0
}
