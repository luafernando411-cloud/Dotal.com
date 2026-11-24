import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/ui/index.jsx'
import { DashboardModelSwitcher } from '../components/admin/DashboardModelSwitcher.jsx'
import { ExecutiveDashboardModel } from '../components/admin/ExecutiveDashboardModel.jsx'
import { ObservabilityDashboardModel } from '../components/admin/ObservabilityDashboardModel.jsx'
import { AuditQualityDashboardModel } from '../components/admin/AuditQualityDashboardModel.jsx'
import {
  dashboardOptions,
  fetchAdminAccessLogs,
  fetchAdminUsers,
  fetchDashboardData,
  updateAdminUserStatus,
  updateRecordStatus,
} from '../services/adminDashboardService.js'
import { exportReport } from '../utils/exportReport.js'
import './AdminDashboardScreen.css'

const modelIds = ['executive', 'observability', 'quality']
const modelTitles = {
  executive: 'Visão executiva e territorial',
  observability: 'Observabilidade e performance',
  quality: 'Qualidade de dados e auditoria',
}
const statusClass = { Pendente: 'pending', 'Em Revisão': 'review', Concluído: 'complete' }

function readModelPreference() {
  try {
    const saved = localStorage.getItem('admin-dashboard-model')
    return modelIds.includes(saved) ? saved : 'executive'
  } catch (error) {
    console.error('Não foi possível carregar o modelo de dashboard salvo.', error)
    return 'executive'
  }
}

function formatTime(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(date))
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function AdminDashboardScreen({ theme, onThemeChange, onReturn, onLogout }) {
  const [records, setRecords] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [categoryFilter, setCategoryFilter] = useState('Todas')
  const [regionFilter, setRegionFilter] = useState('')
  const [model, setModel] = useState(readModelPreference)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    document.body.classList.add('admin-dashboard-body')
    return () => document.body.classList.remove('admin-dashboard-body')
  }, [])

  const loadData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const result = await fetchDashboardData()
      setRecords(result.records)
      setMetrics(result.metrics)
      setLastSync(new Date(result.metrics.syncedAt))
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível atualizar os dados do painel.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => loadData(), 0)
    const refreshTimer = window.setInterval(() => loadData(), 30_000)
    const sessionTimer = window.setInterval(() => {
      setMetrics((current) => current ? {
        ...current,
        latency: 78 + Math.floor(Math.random() * 65),
        activeSessions: 42 + Math.floor(Math.random() * 12),
      } : current)
    }, 5_000)
    return () => {
      window.clearTimeout(initialLoadTimer)
      window.clearInterval(refreshTimer)
      window.clearInterval(sessionTimer)
    }
  }, [loadData])

  const regionIndependentRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return records.filter((record) => {
      const matchesSearch = !query || [record.name, record.cpf, record.protocol, record.city]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(query))
      return matchesSearch
        && (statusFilter === 'Todos' || record.status === statusFilter)
        && (categoryFilter === 'Todas' || record.category === categoryFilter)
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [records, search, statusFilter, categoryFilter])

  const filteredRecords = useMemo(() => regionIndependentRecords
    .filter((record) => !regionFilter || record.region === regionFilter), [regionIndependentRecords, regionFilter])

  function chooseModel(nextModel) {
    setModel(nextModel)
    try {
      localStorage.setItem('admin-dashboard-model', nextModel)
    } catch (storageError) {
      console.error('Não foi possível salvar o modelo de dashboard escolhido.', storageError)
    }
  }

  async function changeStatus(recordId, status) {
    try {
      const updated = await updateRecordStatus(recordId, status)
      setRecords((current) => current.map((record) => record.id === recordId ? updated : record))
      setSelectedRecord((current) => current?.id === recordId ? updated : current)
      setToast(`Status atualizado para ${status}.`)
      window.setTimeout(() => setToast(''), 2800)
    } catch (statusError) {
      setError(statusError.message || 'Não foi possível atualizar o status.')
    }
  }

  function handleExport() {
    try {
      exportReport(filteredRecords)
      setToast(`${filteredRecords.length} registro(s) exportado(s) em CSV.`)
      window.setTimeout(() => setToast(''), 2800)
    } catch (exportError) {
      setError(exportError.message || 'Não foi possível exportar o relatório CSV.')
    }
  }

  const hasFilters = Boolean(search || statusFilter !== 'Todos' || categoryFilter !== 'Todas' || regionFilter)
  const pageTitle = modelTitles[model]

  return (
    <main className="admin-dashboard" data-theme={theme}>
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <div className="admin-brand-mark"><Icon name="shield" size={23} /></div>
          <div><strong>Painel do Gestor</strong><span>Observabilidade do Censo</span></div>
        </div>
        <div className="admin-topbar-actions">
          <button type="button" className="admin-top-button admin-return-button" onClick={onReturn} data-testid="return-to-census">
            <Icon name="arrow" size={17} /><span>Voltar ao Censo</span>
          </button>
          <button type="button" className="admin-top-button" onClick={onLogout} data-testid="admin-logout">
            <Icon name="logout" size={17} /><span>Sair</span>
          </button>
          <button type="button" className="admin-top-button" onClick={() => loadData(true)} disabled={refreshing} data-testid="refresh-data">
            <Icon name="refresh" size={17} className={refreshing ? 'refreshing-icon' : ''} /><span>{refreshing ? 'Atualizando' : 'Atualizar'}</span>
          </button>
          <button type="button" className="admin-export-button" onClick={handleExport} data-testid="export-report">
            <Icon name="download" size={17} /><span>Exportar Relatório</span>
          </button>
          <button type="button" className="admin-theme-button" onClick={onThemeChange} aria-label={`Ativar tema ${theme === 'light' ? 'escuro' : 'claro'}`} data-testid="theme-toggle">
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand"><div className="admin-brand-mark"><Icon name="shield" size={21} /></div><div><strong>Censo<span>Digital</span></strong><small>ADMINISTRAÇÃO</small></div></div>
          <div className="admin-nav-label">VISÃO GERAL</div>
          <button type="button" className="admin-nav-item active"><Icon name="activity" size={18} /> Painel do gestor</button>
          <button type="button" className="admin-nav-item" onClick={() => document.getElementById('records-section')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="file" size={18} /> Registros do censo</button>
          <button type="button" className="admin-nav-item" onClick={() => document.getElementById('users-section')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="users" size={18} /> Usuários e acessos</button>
          <div className="admin-sidebar-spacer" />
          <div className="admin-sidebar-status"><span className="online-indicator" /><span><strong>Sistema operacional</strong><small>Sincronização automática</small></span></div>
          <div className="admin-user"><div className="admin-user-avatar">GM</div><div><strong>Gestor Municipal</strong><small>Administrador</small></div><Icon name="logout" size={17} /></div>
        </aside>

        <section className="admin-main">
          <div className="admin-page-heading">
            <div><span className="admin-eyebrow">CENSO DIGITAL / GESTÃO</span><h1>{pageTitle}</h1><p>Indicadores do recenseamento e da plataforma atualizados em tempo real.</p></div>
            <span className="admin-live-badge"><span className="online-indicator" /> ATUALIZAÇÃO AO VIVO</span>
          </div>

          <section className="observability-strip" aria-label="Observabilidade do sistema">
            <div className="api-health">
              <span className="health-icon"><Icon name="activity" size={20} /></span>
              <span><small>STATUS DA API</small><strong><span className="online-indicator" />{metrics?.apiStatus || 'Conectando'}</strong></span>
            </div>
            <Metric icon="clock" label="LATÊNCIA MÉDIA" value={metrics ? `${metrics.latency} ms` : '—'} />
            <Metric icon="activity" label="DISPONIBILIDADE SLA" value={metrics ? `${metrics.availability.toFixed(2)}%` : '—'} />
            <Metric icon="refresh" label="ÚLTIMA SINCRONIZAÇÃO" value={formatTime(lastSync)} />
            <Metric icon="users" label="LOGINS EM 24H" value={metrics?.activeSessions ?? '—'} />
            <Metric icon="users" label="USUÁRIOS" value={metrics?.totalUsers ?? '—'} />
            <Metric icon="info" label="CONTAS BLOQUEADAS" value={metrics?.blockedUsers ?? '—'} />
            <Metric icon="info" label="FALHAS DE LOGIN / 24H" value={metrics?.failedLogins ?? '—'} />
          </section>

          <DashboardModelSwitcher value={model} onChange={chooseModel} />

          <section className="admin-panel global-filters-panel" aria-label="Filtros globais">
            <div className="global-filter-heading"><span><Icon name="search" size={16} /> Filtros globais</span><small>{filteredRecords.length} de {records.length} registros</small></div>
            <div className="filter-toolbar">
              <label className="admin-search">
                <Icon name="search" size={17} />
                <input type="search" placeholder="Buscar nome, CPF, protocolo ou cidade..." value={search} onChange={(event) => setSearch(event.target.value)} data-testid="search-records" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><Icon name="close" size={14} /></button>}
              </label>
              <label className="filter-select"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="status-filter"><option>Todos</option>{dashboardOptions.statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="filter-select"><span>Categoria</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} data-testid="category-filter"><option>Todas</option>{dashboardOptions.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="filter-select"><span>Região</span><select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} data-testid="region-filter"><option value="">Todas</option>{dashboardOptions.regions.map((region) => <option key={region}>{region}</option>)}</select></label>
              {hasFilters && <button type="button" className="clear-all-filters" onClick={() => { setSearch(''); setStatusFilter('Todos'); setCategoryFilter('Todas'); setRegionFilter('') }} data-testid="clear-all-filters"><Icon name="close" size={14} />Limpar filtros</button>}
            </div>
          </section>

          {error && <div className="admin-error" role="alert"><Icon name="info" size={16} />{error}<button type="button" onClick={() => setError('')} aria-label="Fechar aviso"><Icon name="close" size={15} /></button></div>}

          {model === 'executive' && <ExecutiveDashboardModel records={filteredRecords} regionRecords={regionIndependentRecords} selectedRegion={regionFilter} onRegionSelect={setRegionFilter} />}
          {model === 'observability' && <ObservabilityDashboardModel />}
          {model === 'quality' && <AuditQualityDashboardModel records={filteredRecords} onOpenRecord={setSelectedRecord} onStatusChange={changeStatus} />}

          <RecordsTable records={filteredRecords} loading={loading} onStatusChange={changeStatus} onOpenRecord={setSelectedRecord} onClearFilters={() => { setSearch(''); setStatusFilter('Todos'); setCategoryFilter('Todas'); setRegionFilter('') }} lastSync={lastSync} />
          <UserManagementPanel />
          <footer className="admin-footer"><span>Censo Digital · Painel de administração</span><span>Ambiente protegido</span></footer>
        </section>
      </div>

      {selectedRecord && <RecordDetails record={selectedRecord} onClose={() => setSelectedRecord(null)} onStatusChange={changeStatus} />}
      {toast && <div className="admin-toast" role="status"><Icon name="check" size={16} />{toast}</div>}
    </main>
  )
}

function UserManagementPanel() {
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pageSize = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [result, accessLogs] = await Promise.all([
        fetchAdminUsers({ search, status, limit: pageSize, offset }),
        fetchAdminAccessLogs(8),
      ])
      setUsers(result.items)
      setTotal(result.total)
      setLogs(accessLogs)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar os usuários.')
    } finally {
      setLoading(false)
    }
  }, [offset, search, status])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function changeStatus(userId, nextStatus) {
    try {
      await updateAdminUserStatus(userId, nextStatus)
      await load()
    } catch (statusError) {
      setError(statusError.message || 'Não foi possível atualizar o status da conta.')
    }
  }

  function applyFilters(event) {
    event.preventDefault()
    setOffset(0)
    setSearch(query.trim())
  }

  return (
    <section className="admin-panel records-panel user-management-panel" id="users-section">
      <div className="panel-heading records-heading">
        <div><h2>Usuários e segurança</h2><p>{total} conta(s) cadastrada(s)</p></div>
      </div>
      <form className="filter-toolbar" onSubmit={applyFilters}>
        <label className="admin-search"><Icon name="search" size={17} /><input type="search" placeholder="Buscar nome ou CPF" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="filter-select"><span>Status da conta</span><select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0) }}><option value="">Todos</option><option value="active">Ativa</option><option value="blocked">Bloqueada</option></select></label>
        <button type="submit" className="details-button">Buscar</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="records-table-wrap">
        <table className="records-table">
          <thead><tr><th>USUÁRIO</th><th>CPF</th><th>E-MAIL</th><th>CADASTRO</th><th>STATUS</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="table-message">Carregando usuários...</td></tr>}
            {!loading && users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name || '—'}</td><td>{user.cpf}</td><td>{user.email}</td><td>{formatDate(user.created_at)}</td>
                <td><label className={`status-select ${user.status === 'active' ? 'status-complete' : 'status-pending'}`}><select value={user.status} aria-label={`Status de ${user.full_name || user.cpf}`} onChange={(event) => changeStatus(user.id, event.target.value)}><option value="active">Ativa</option><option value="blocked">Bloqueada</option></select></label></td>
              </tr>
            ))}
            {!loading && users.length === 0 && <tr><td colSpan="5" className="table-message">Nenhum usuário encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <button type="button" className="details-button" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Anterior</button>
        <span>Exibindo {total ? offset + 1 : 0}–{Math.min(offset + users.length, total)} de {total}</span>
        <button type="button" className="details-button" disabled={offset + pageSize >= total || loading} onClick={() => setOffset((value) => value + pageSize)}>Próxima</button>
      </div>
      <h3 className="access-log-heading">Tentativas recentes de acesso</h3>
      <ul className="access-log-list">
        {logs.map((entry) => <li key={entry.id}><span className={entry.success ? 'online-indicator' : 'access-failed-indicator'} />{entry.account_type === 'admin' ? 'Administrador' : 'Usuário'} · {entry.success ? 'Acesso realizado' : 'Tentativa recusada'} · {formatDate(entry.occurred_at)}</li>)}
        {!logs.length && <li>Nenhum evento de acesso registrado.</li>}
      </ul>
    </section>
  )
}

function Metric({ icon, label, value }) {
  return <div className="observability-metric"><Icon name={icon} size={16} /><span><small>{label}</small><strong>{value}</strong></span></div>
}

function RecordsTable({ records, loading, onStatusChange, onOpenRecord, onClearFilters, lastSync }) {
  return (
    <section className="admin-panel records-panel" id="records-section">
      <div className="panel-heading records-heading">
        <div><h2>Registros do censo</h2><p>{records.length} registro(s) no recorte atual</p></div>
      </div>
      <div className="records-table-wrap">
        <table className="records-table" data-testid="records-table">
          <thead><tr><th>PROTOCOLO</th><th>RECENSEADO</th><th>CATEGORIA</th><th>LOCALIDADE</th><th>STATUS</th><th>ATUALIZAÇÃO</th><th><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="table-message">Carregando registros...</td></tr>}
            {!loading && records.map((record) => (
              <tr key={record.id} data-testid={`record-row-${record.id}`}>
                <td><span className="protocol-text">{record.protocol}</span></td>
                <td><span className="person-cell"><span className="person-avatar">{record.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{record.name}</strong><small>{record.cpf}</small></span></span></td>
                <td><span className="category-label"><span className={`category-mark ${record.category.toLowerCase()}`} />{record.category}</span></td>
                <td><span className="locality-cell">{record.city}<small>{record.region} · {record.state}</small></span></td>
                <td><label className={`status-select status-${statusClass[record.status]}`}><select value={record.status} aria-label={`Status de ${record.name}`} onChange={(event) => onStatusChange(record.id, event.target.value)} data-testid={`status-select-${record.id}`}>{dashboardOptions.statuses.map((status) => <option key={status}>{status}</option>)}</select></label></td>
                <td><span className="updated-cell">{formatDate(record.updatedAt)}</span></td>
                <td><button type="button" className="details-button" onClick={() => onOpenRecord(record)} aria-label={`Ver detalhes de ${record.name}`} data-testid={`record-details-${record.id}`}>Detalhes</button></td>
              </tr>
            ))}
            {!loading && records.length === 0 && <tr><td colSpan="7"><div className="records-empty"><span><Icon name="search" size={22} /></span><strong>Nenhum registro encontrado</strong><p>Ajuste os filtros ou tente buscar por outro termo.</p><button type="button" onClick={onClearFilters}>Limpar todos os filtros</button></div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Exibindo <strong>{records.length}</strong> registros</span><span>Dados atualizados às {formatTime(lastSync)}</span></div>
    </section>
  )
}

function RecordDetails({ record, onClose, onStatusChange }) {
  return (
    <div className="admin-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-record-modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title" data-testid="record-details-modal">
        <div className="modal-top">
          <span className="modal-icon"><Icon name="file" size={21} /></span>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Fechar detalhes"><Icon name="close" size={19} /></button>
        </div>
        <span className="admin-eyebrow">DETALHES DO REGISTRO</span>
        <h2 id="record-modal-title">{record.name}</h2>
        <p className="modal-protocol">{record.protocol}</p>
        <div className="record-detail-grid">
          <DetailItem label="CPF" value={record.cpf} />
          <DetailItem label="Categoria" value={record.category} />
          <DetailItem label="E-mail" value={record.email} />
          <DetailItem label="Matrícula" value={record.registration} />
          <DetailItem label="Cidade / UF" value={`${record.city} / ${record.state}`} />
          <DetailItem label="Região" value={record.region} />
          <DetailItem label="Completude" value={`${record.completion}%`} />
          <DetailItem label="Última atualização" value={formatDate(record.updatedAt)} />
          <div className="record-detail-item"><span>Status do cadastro</span><label className={`status-select status-${statusClass[record.status]}`}><select value={record.status} onChange={(event) => onStatusChange(record.id, event.target.value)} data-testid="modal-status-select">{dashboardOptions.statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
        </div>
        <button type="button" className="modal-done-button" onClick={onClose}>Fechar detalhes</button>
      </section>
    </div>
  )
}

function DetailItem({ label, value }) {
  return <div className="record-detail-item"><span>{label}</span><strong>{value}</strong></div>
}
