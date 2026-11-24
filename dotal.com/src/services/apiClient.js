const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSION_KEY = 'census-api-session'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export function readApiSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return session?.accessToken && session?.user?.role ? session : null
  } catch (error) {
    console.error('Não foi possível ler a sessão da API.', error)
    return null
  }
}

export function clearApiSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function apiRequest(path, { auth = true, body, headers, ...options } = {}) {
  const requestHeaders = new Headers(headers)
  let requestBody = body
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  if (auth) {
    const session = readApiSession()
    if (session?.accessToken) requestHeaders.set('Authorization', `Bearer ${session.accessToken}`)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      body: requestBody,
      headers: requestHeaders,
    })
  } catch {
    throw new ApiError('Não foi possível conectar à API. Verifique sua conexão e tente novamente.', 0)
  }
  if (response.status === 204) return null

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('A API retornou uma resposta inválida.', response.status)
  }
  if (!response.ok) {
    if (response.status === 401 && auth) clearApiSession()
    const message = payload?.error?.message ?? payload?.detail
    const validationMessages = payload?.error?.details
      ?.map((item) => item.msg)
      .filter((item) => typeof item === 'string')
    throw new ApiError(
      validationMessages?.length
        ? validationMessages.join(' ')
        : typeof message === 'string' ? message : 'Não foi possível concluir a solicitação.',
      response.status,
    )
  }
  return payload
}

export async function registerApiUser(credentials) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: credentials,
    auth: false,
  })
}

export async function loginApiUser(credentials) {
  return saveLoginSession('/api/auth/login', credentials)
}

export async function loginAdminApiUser(credentials) {
  return saveLoginSession('/api/admin/auth/login', credentials)
}

async function saveLoginSession(path, credentials) {
  const result = await apiRequest(path, {
    method: 'POST',
    body: credentials,
    auth: false,
  })
  const session = {
    accessToken: result.access_token,
    user: result.user,
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    throw new Error('Não foi possível salvar a sessão neste navegador.', { cause: error })
  }
  return session
}

export async function registerAdminApiUser(credentials) {
  return apiRequest('/api/admin/auth/register', {
    method: 'POST',
    body: credentials,
    auth: false,
  })
}

