import { apiRequest } from './apiClient.js'

const regions = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
const categories = ['Ativo', 'Aposentado', 'Pensionista']
const statuses = ['Concluído', 'Em Revisão', 'Pendente']
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
      logins24h: metrics.successful_logins_24h,
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

export function fetchAdminMetrics() {
  return apiRequest('/api/admin/metrics')
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
