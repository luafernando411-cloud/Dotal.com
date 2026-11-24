import { getDataQuality, dashboardOptions } from '../../services/adminDashboardService.js'
import { Icon } from '../ui/index.jsx'

export function AuditQualityDashboardModel({ records, onOpenRecord, onStatusChange }) {
  const metrics = getDataQuality(records)
  const maxDistribution = Math.max(...metrics.distribution.map((item) => item.count), 1)
  const auditRecords = records.filter((record) => (
    record.status !== 'Concluído'
    || record.addressPending
    || record.otpPending
    || record.completion < 100
  )).sort((a, b) => a.completion - b.completion)

  return (
    <section className="model-content quality-model" data-testid="quality-dashboard-model">
      <div className="quality-indicator-grid">
        <QualityIndicator title="100% válidos" value={metrics.valid} detail="Cadastro completo e validado" icon="check" tone="green" />
        <QualityIndicator title="Pendência de endereço / CEP" value={metrics.addressPending} detail="Endereço requer conferência" icon="pin" tone="amber" />
        <QualityIndicator title="Aguardando validação OTP" value={metrics.otpPending} detail="Confirmação de contato pendente" icon="lock" tone="cyan" />
        <QualityIndicator title="Em revisão" value={metrics.inReview} detail="Aguardando auditoria do gestor" icon="file" tone="purple" />
      </div>

      <div className="quality-analysis-grid">
        <section className="admin-panel model-panel completeness-panel">
          <div className="panel-heading"><div><h2>Completude cadastral</h2><p>Distribuição por percentual de preenchimento</p></div><span className="quality-total">{records.length} registros</span></div>
          <div className="completeness-chart">
            {metrics.distribution.map((bucket) => (
              <div className="completeness-column" key={bucket.label} data-testid={`completeness-${bucket.label.replaceAll('%', '').replaceAll('–', '-')}`}>
                <strong>{bucket.count}</strong>
                <div className="completeness-bar-area"><i className={bucket.color} style={{ height: `${Math.max((bucket.count / maxDistribution) * 100, bucket.count ? 8 : 0)}%` }} /></div>
                <span>{bucket.label}</span>
              </div>
            ))}
          </div>
          <div className="completeness-footnote"><Icon name="info" size={14} />As faixas são recalculadas de acordo com os filtros globais.</div>
        </section>

        <section className="admin-panel model-panel quality-summary-panel">
          <div className="panel-heading"><div><h2>Resumo de qualidade</h2><p>Integridade dos registros filtrados</p></div><span className="quality-summary-icon"><Icon name="activity" size={17} /></span></div>
          <div className="quality-summary-main"><strong>{records.length ? Math.round((metrics.valid / records.length) * 100) : 0}%</strong><span>completos e válidos</span></div>
          <div className="quality-summary-track"><i style={{ width: `${records.length ? (metrics.valid / records.length) * 100 : 0}%` }} /></div>
          <div className="quality-summary-lines"><span>Registros analisados <strong>{records.length}</strong></span><span>Na fila de auditoria <strong>{auditRecords.length}</strong></span></div>
        </section>
      </div>

      <section className="admin-panel audit-queue-panel">
        <div className="panel-heading audit-queue-heading">
          <div><h2>Fila de auditoria</h2><p>Inspecione e atualize registros com validações pendentes</p></div>
          <span className="audit-queue-count"><Icon name="file" size={14} />{auditRecords.length} para revisar</span>
        </div>
        <div className="records-table-wrap">
          <table className="records-table audit-queue-table" data-testid="audit-queue">
            <thead><tr><th>PROTOCOLO / RECENSEADO</th><th>PENDÊNCIA IDENTIFICADA</th><th>COMPLETUDE</th><th>STATUS</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {auditRecords.map((record) => (
                <tr key={record.id}>
                  <td><span className="person-cell"><span className="person-avatar">{record.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{record.name}</strong><small>{record.protocol} · {record.cpf}</small></span></span></td>
                  <td><span className={`audit-issue ${record.addressPending || record.otpPending ? 'issue-warning' : ''}`}><i />{getIssue(record)}</span></td>
                  <td><span className="completion-cell"><i><span style={{ width: `${record.completion}%` }} /></i><strong>{record.completion}%</strong></span></td>
                  <td><label className={`status-select status-${statusClass(record.status)}`}><select value={record.status} aria-label={`Status de auditoria de ${record.name}`} onChange={(event) => onStatusChange(record.id, event.target.value)} data-testid={`audit-status-${record.id}`}>{dashboardOptions.statuses.map((status) => <option key={status}>{status}</option>)}</select></label></td>
                  <td><button type="button" className="details-button" onClick={() => onOpenRecord(record)} data-testid={`audit-inspect-${record.id}`}><Icon name="search" size={13} />Inspecionar</button></td>
                </tr>
              ))}
              {auditRecords.length === 0 && <tr><td colSpan="5"><div className="records-empty"><span><Icon name="check" size={22} /></span><strong>Nenhum registro na fila de auditoria</strong><p>Os registros deste recorte estão sem pendências.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function QualityIndicator({ title, value, detail, icon, tone }) {
  return (
    <article className="admin-panel quality-indicator-card">
      <span className={`quality-indicator-icon ${tone}`}><Icon name={icon} size={18} /></span>
      <span className="quality-indicator-title">{title}</span>
      <strong>{value.toLocaleString('pt-BR')}</strong>
      <small>{detail}</small>
    </article>
  )
}

function getIssue(record) {
  const issues = []
  if (record.addressPending) issues.push('Endereço / CEP')
  if (record.otpPending) issues.push('Validação OTP')
  if (record.status === 'Em Revisão') issues.push('Revisão manual')
  if (record.completion < 100) issues.push('Cadastro incompleto')
  return issues.join(' · ') || 'Aguardando conclusão'
}

function statusClass(status) {
  if (status === 'Concluído') return 'complete'
  if (status === 'Em Revisão') return 'review'
  return 'pending'
}
