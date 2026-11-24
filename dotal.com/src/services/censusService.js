import { apiRequest, loginApiUser } from './apiClient.js'

const wait = (milliseconds = 450) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function loginCensus(credentials) {
  return loginApiUser({ cpf: credentials.cpf, password: credentials.password })
}

export async function requestOtp(method, destination) {
  await wait()
  return { requested: true, method, destination }
}

export async function verifyOtp(code) {
  await wait()
  if (!/^\d{4}$/.test(code)) throw new Error('Digite os 4 números do código enviado.')
  return { verified: true }
}

export async function submitCensus(draft, formData = buildCensusFormData(draft)) {
  if (!(formData instanceof FormData)) throw new Error('Os dados do recenseamento não puderam ser preparados.')
  return apiRequest('/api/census/multipart', { method: 'POST', body: formData })
}

export function buildCensusFormData(draft) {
  const formData = new FormData()
  const attachments = draft.attachments || {}
  const data = { ...draft }
  delete data.attachments
  formData.append('census', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  for (const [type, files] of Object.entries(attachments)) {
    for (const file of files) {
      if (typeof File !== 'undefined' && file instanceof File) formData.append(`documents[${type}][]`, file, file.name)
    }
  }
  return formData
}
