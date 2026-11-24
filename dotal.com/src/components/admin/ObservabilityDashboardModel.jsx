import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../ui/index.jsx'
import { fetchTelemetryData } from '../../services/adminDashboardService.js'

const windows = [
  { id: '15m', label: '15 min' },
  { id: '1h', label: '1 hora' },
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 dias' },
]

const charts = [
  { key: 'latency', title: 'Latência da API', suffix: 'ms', color: '#00a8e8', icon: 'clock' },
  { key: 'requests', title: 'Requisições', suffix: '/min', color: '#3b4978', icon: 'activity' },
  { key: 'errors', title: 'Taxa de erro', suffix: '%', color: '#10b981', icon: 'chart' },
]

export function ObservabilityDashboardModel() {
  const [range, setRange] = useState('15m')
  const [live, setLive] = useState(true)
  const [snapshot, setSnapshot] = useState({ series: [], services: [], sampledAt: null })
  const [error, setError] = useState('')

  const loadSnapshot = useCallback(async () => {
    try {
      const result = await fetchTelemetryData(range)
      setSnapshot(result)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar a telemetria.')
    }
  }, [range])

  useEffect(() => {
    const initialTimer = window.setTimeout(loadSnapshot, 0)
    return () => window.clearTimeout(initialTimer)
  }, [loadSnapshot])

  useEffect(() => {
    if (!live) return undefined
    const liveTimer = window.setInterval(loadSnapshot, 10_000)
    return () => window.clearInterval(liveTimer)
  }, [live, loadSnapshot])

  const latest = snapshot.series.at(-1)
  const chartConfigs = useMemo(() => charts.map((chart) => ({
    ...chart,
    value: latest ? latest[chart.key] : null,
    data: snapshot.series,
  })), [latest, snapshot.series])

  return (
    <section className="model-content observability-model" data-testid="observability-dashboard-model">
      <div className="observability-model-toolbar">
        <div><h2>Telemetria do sistema</h2><p>Indicadores de performance ao longo do tempo</p></div>
        <div className="telemetry-controls">
          <div className="time-window-selector" aria-label="Janela temporal">
            {windows.map((item) => (
              <button type="button" key={item.id} className={range === item.id ? 'active' : ''} onClick={() => setRange(item.id)} aria-pressed={range === item.id} data-testid={`time-window-${item.id}`}>{item.label}</button>
            ))}
          </div>
          <button type="button" className={`live-poll-button ${live ? 'is-live' : 'is-paused'}`} onClick={() => setLive((current) => !current)} data-testid="live-poll-toggle">
            <span className="live-poll-indicator" />{live ? 'Ao vivo' : 'Pausado'}<Icon name={live ? 'pause' : 'play'} size={13} />
          </button>
        </div>
      </div>
      {error && <div className="admin-error" role="alert"><Icon name="info" size={15} />{error}</div>}
      <div className="telemetry-chart-grid">
        {chartConfigs.map((chart) => <TelemetryChart key={chart.key} {...chart} />)}
      </div>
      <div className="telemetry-sampled-at"><span className={`online-indicator ${live ? '' : 'indicator-paused'}`} />{live ? 'Atualização contínua ativa' : 'Atualização pausada'}{snapshot.sampledAt && <span> · amostra {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(snapshot.sampledAt))}</span>}</div>

      <section className="admin-panel model-panel service-health-panel">
        <div className="panel-heading"><div><h2>Saúde dos serviços</h2><p>Latência e disponibilidade por módulo integrado</p></div><span className="service-health-legend"><i className="service-healthy-dot" />Operacional <i className="service-warning-dot" />Atenção</span></div>
        <div className="service-health-grid">
          {snapshot.services.map((service) => (
            <article key={service.name} className="service-health-card">
              <div className={`service-health-icon ${service.health === 'Atenção' ? 'warning' : ''}`}><Icon name={serviceIcon(service.name)} size={19} /></div>
              <div className="service-health-heading"><strong>{service.name}</strong><span className={`service-status-pill ${service.health === 'Atenção' ? 'warning' : ''}`}><i />{service.health}</span></div>
              <div className="service-health-stats"><span><small>LATÊNCIA</small><strong>{service.latency} ms</strong></span><span><small>UPTIME</small><strong>{service.uptime.toFixed(2)}%</strong></span></div>
              <div className="service-uptime-track"><i style={{ width: `${service.uptime}%` }} /></div>
            </article>
          ))}
          {!snapshot.services.length && <div className="telemetry-loading">Carregando status dos serviços...</div>}
        </div>
      </section>
    </section>
  )
}

function TelemetryChart({ title, suffix, color, icon, value, data }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const plot = { left: 44, right: 585, top: 17, bottom: 136 }
  const values = data.map((item) => item[charts.find((chart) => chart.suffix === suffix)?.key])
  const low = values.length ? Math.min(...values) : 0
  const high = values.length ? Math.max(...values) : 1
  const padding = Math.max((high - low) * 0.22, suffix === '%' ? 0.12 : 5)
  const min = Math.max(suffix === '%' ? 0 : 0, low - padding)
  const max = high + padding
  const points = data.map((item, index) => {
    const x = plot.left + (index / Math.max(data.length - 1, 1)) * (plot.right - plot.left)
    const y = plot.bottom - ((values[index] - min) / Math.max(max - min, 1)) * (plot.bottom - plot.top)
    return { x, y, item, value: values[index] }
  })
  const polyline = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const active = activeIndex == null ? null : points[activeIndex]
  const activeLeft = active ? Math.min(Math.max((active.x / 600) * 100, 17), 83) : 50
  const activeTop = active ? Math.max((active.y / 188) * 100 - 8, 2) : 10
  const middleIndex = Math.floor(data.length / 2)

  return (
    <article className="admin-panel telemetry-chart-card" onMouseLeave={() => setActiveIndex(null)}>
      <div className="telemetry-chart-heading"><span className="telemetry-chart-icon" style={{ color, backgroundColor: `${color}14` }}><Icon name={icon} size={17} /></span><span><small>{title}</small><strong>{value == null ? '—' : `${value} ${suffix}`}</strong></span><span className="telemetry-range-caption">NO PERÍODO</span></div>
      <div className="telemetry-svg-wrap">
        <svg viewBox="0 0 600 188" role="img" aria-label={`${title} ao longo do tempo`} className="telemetry-svg">
          {[0, 1, 2, 3].map((tick) => {
            const y = plot.top + (tick / 3) * (plot.bottom - plot.top)
            const tickValue = max - (tick / 3) * (max - min)
            return <g key={tick}><line x1={plot.left} x2={plot.right} y1={y} y2={y} className="telemetry-grid-line" /><text x="37" y={y + 3} textAnchor="end" className="telemetry-axis-label">{tickValue.toFixed(suffix === '%' ? 1 : 0)}</text></g>
          })}
          {data.length > 1 && <polygon points={`${plot.left},${plot.bottom} ${polyline} ${plot.right},${plot.bottom}`} fill={`${color}12`} />}
          <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map(({ x, y, item }, index) => (
            <circle
              key={item.timestamp}
              cx={x}
              cy={y}
              r={index === activeIndex ? 5 : 3}
              fill={color}
              stroke="var(--admin-panel)"
              strokeWidth="2"
              tabIndex={0}
              role="button"
              aria-label={`${item.label}: ${item[charts.find((chart) => chart.suffix === suffix)?.key]} ${suffix}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setActiveIndex(index)
              }}
            />
          ))}
          {[0, middleIndex, data.length - 1].filter((index, position, all) => all.indexOf(index) === position && data[index]).map((index) => (
            <text key={index} x={points[index].x} y="160" textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} className="telemetry-axis-label">{data[index].label}</text>
          ))}
        </svg>
        {active && <div className="telemetry-tooltip" style={{ left: `${activeLeft}%`, top: `${activeTop}%` }}><strong>{active.item.label}</strong><span>{active.value} {suffix}</span></div>}
      </div>
    </article>
  )
}

function serviceIcon(name) {
  if (name.includes('OTP')) return 'lock'
  if (name.includes('CEP')) return 'pin'
  if (name.includes('Submissão')) return 'file'
  return 'building'
}
