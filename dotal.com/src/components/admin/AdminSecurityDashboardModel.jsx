import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../ui/index.jsx'
import { fetchAdminAccessLogs, fetchAdminMetrics } from '../../services/adminDashboardService.js'

function formatAccessTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function describeEvent(entry) {
  if (entry.event === 'account_blocked') return 'Conta bloqueada'
  if (entry.event === 'account_activated') return 'Conta reativada'
  return entry.success ? 'Login realizado' : 'Login recusado'
}

export function AdminSecurityDashboardModel() {
  const [metrics, setMetrics] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [nextMetrics, nextLogs] = await Promise.all([
        fetchAdminMetrics(),
        fetchAdminAccessLogs(20),
      ])
      setMetrics(nextMetrics)
      setLogs(nextLogs)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar os dados de segurança.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    const refreshTimer = window.setInterval(load, 30_000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(refreshTimer)
    }
  }, [load])

  return (
    <section className="model-content security-model" data-testid="security-dashboard-model">
      <div className="panel-heading security-heading">
        <div><h2>Segurança e acessos</h2><p>Contas e eventos de autenticação nas últimas 24 horas</p></div>
      </div>
      {error && <div className="admin-error" role="alert"><Icon name="info" size={15} />{error}</div>}
      <div className="security-metrics-grid">
        <SecurityMetric label="Contas cadastradas" value={metrics?.total_users} icon="users" />
        <SecurityMetric label="Contas bloqueadas" value={metrics?.blocked_users} icon="lock" />
        <SecurityMetric label="Logins recusados / 24h" value={metrics?.failed_logins_24h} icon="info" />
        <SecurityMetric label="Logins aceitos / 24h" value={metrics?.successful_logins_24h} icon="check" />
      </div>
      <section className="admin-panel security-access-panel">
        <div className="panel-heading"><div><h2>Eventos recentes</h2><p>Dados sensíveis de identificação e IP não são exibidos.</p></div></div>
        <div className="records-table-wrap">
          <table className="records-table">
            <thead><tr><th>TIPO DE CONTA</th><th>EVENTO</th><th>RESULTADO</th><th>DATA E HORA</th></tr></thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.account_type === 'admin' ? 'Administrador' : 'Usuário'}</td>
                  <td>{describeEvent(entry)}</td>
                  <td><span className={`security-event-result ${entry.success ? 'success' : 'failure'}`}>{entry.success ? 'Registrado' : 'Recusado'}</span></td>
                  <td>{formatAccessTime(entry.occurred_at)}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan="4" className="table-message">Nenhum evento de acesso registrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function SecurityMetric({ label, value, icon }) {
  return (
    <article className="admin-panel security-metric">
      <Icon name={icon} size={18} />
      <span><small>{label}</small><strong>{value ?? '—'}</strong></span>
    </article>
  )
}
