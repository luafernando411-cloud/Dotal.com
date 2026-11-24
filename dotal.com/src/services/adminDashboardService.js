import { apiRequest } from './apiClient.js'

const regions = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
const categories = ['Ativo', 'Aposentado', 'Pensionista']
const statuses = ['Concluído', 'Em Revisão', 'Pendente']
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function fetchDashboardData() {
  const startedAt = performance.now()
  const [census, metrics] = await Promise.all([
    apiRequest('/api/admin/census?limit=100'),
    apiRequest('/api/admin/metrics'),
  ])
  const records = census.items.map((item) => ({
    id: item.id,
    protocol: item.protocol,
    name: item.fullName,
    cpf: formatCpf(item.cpf),
    category: item.employmentStatus,
    region: item.region || 'Não informado',
    city: item.city || 'Não informado',
    state: item.state || '--',
    status: item.status,
    completion: Number(item.payload?.completion || 0),
    addressPending: false,
    otpPending: false,
    updatedAt: item.updatedAt,
    email: item.email || '—',
    registration: '—',
  }))
  return {
    records,
    metrics: {
      apiStatus: 'Operacional',
      latency: Math.round(performance.now() - startedAt),
      availability: 100,
      activeSessions: metrics.successful_logins_24h,
      totalUsers: metrics.total_users,
      blockedUsers: metrics.blocked_users,
      failedLogins: metrics.failed_logins_24h,
      syncedAt: new Date().toISOString(),
    },
  }
}

export async function updateRecordStatus(recordId, status) {
  if (!statuses.includes(status)) throw new Error('Status selecionado inválido.')
  const item = await apiRequest(`/api/admin/census/${encodeURIComponent(recordId)}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return {
    id: item.id,
    protocol: item.protocol,
    name: item.fullName,
    cpf: formatCpf(item.cpf),
    category: item.employmentStatus,
    region: item.region || 'Não informado',
    city: item.city || 'Não informado',
    state: item.state || '--',
    status: item.status,
    completion: Number(item.payload?.completion || 0),
    addressPending: false,
    otpPending: false,
    updatedAt: item.updatedAt,
    email: item.email || '—',
    registration: '—',
  }
}

export function fetchAdminUsers({ search = '', status = '', limit = 10, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return apiRequest(`/api/admin/users?${params}`)
}

export function updateAdminUserStatus(userId, status) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export function fetchAdminAccessLogs(limit = 10) {
  return apiRequest(`/api/admin/access-logs?limit=${limit}`)
}

function formatCpf(value = '') {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return '***.***.***-**'
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

const telemetryRanges = {
  '15m': { points: 15, duration: 15 * 60_000 },
  '1h': { points: 12, duration: 60 * 60_000 },
  '24h': { points: 24, duration: 24 * 60 * 60_000 },
  '7d': { points: 28, duration: 7 * 24 * 60 * 60_000 },
}

function telemetryLabel(date, range) {
  if (range === '7d') return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
  if (range === '24h') return `${String(date.getHours()).padStart(2, '0')}h`
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export async function fetchTelemetryData(range = '15m') {
  const config = telemetryRanges[range]
  if (!config) throw new Error('Janela de telemetria inválida.')
  await pause(150)
  const now = Date.now()
  const series = Array.from({ length: config.points }, (_, index) => {
    const progress = index / Math.max(config.points - 1, 1)
    const timestamp = new Date(now - config.duration * (1 - progress))
    return {
      timestamp: timestamp.toISOString(),
      label: telemetryLabel(timestamp, range),
      latency: Math.round(108 + Math.sin(index * 0.83) * 21 + Math.cos(index * 0.37) * 9 + Math.random() * 10),
      requests: Math.round(260 + Math.sin(index * 0.57) * 65 + Math.cos(index * 0.29) * 30 + Math.random() * 24),
      errors: Number(Math.max(0.05, 0.48 + Math.sin(index * 0.74) * 0.25 + Math.random() * 0.28).toFixed(2)),
    }
  })

  return {
    range,
    sampledAt: new Date().toISOString(),
    series,
    services: [
      { name: 'Autenticação OTP', latency: 92, uptime: 99.99, health: 'Operacional' },
      { name: 'Consulta de CEP', latency: 218, uptime: 99.87, health: 'Atenção' },
      { name: 'Submissão do Censo', latency: 136, uptime: 99.96, health: 'Operacional' },
      { name: 'Persistência / Base de Dados', latency: 34, uptime: 99.99, health: 'Operacional' },
    ],
  }
}

export function getDataQuality(recordsToInspect) {
  const distribution = [
    { label: '0–49%', minimum: 0, maximum: 49, count: 0, color: 'quality-low' },
    { label: '50–79%', minimum: 50, maximum: 79, count: 0, color: 'quality-medium' },
    { label: '80–99%', minimum: 80, maximum: 99, count: 0, color: 'quality-high' },
    { label: '100%', minimum: 100, maximum: 100, count: 0, color: 'quality-perfect' },
  ]
  for (const record of recordsToInspect) {
    const bucket = distribution.find((item) => record.completion >= item.minimum && record.completion <= item.maximum)
    if (bucket) bucket.count += 1
  }
  return {
    valid: recordsToInspect.filter((record) => record.completion === 100 && !record.addressPending && !record.otpPending).length,
    addressPending: recordsToInspect.filter((record) => record.addressPending).length,
    otpPending: recordsToInspect.filter((record) => record.otpPending).length,
    inReview: recordsToInspect.filter((record) => record.status === 'Em Revisão').length,
    distribution,
  }
}

export const dashboardOptions = { regions, categories, statuses }
