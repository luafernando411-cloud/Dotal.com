import type { Page, Request, Response, TestInfo } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type ApiAuditEntry = {
  method: string
  url: string
  endpoint: string
  status: number | null
  latencyMs: number
  headers: Record<string, string>
  requestSummary: Record<string, unknown> | null
  responseSummary: Record<string, unknown> | null
  failure: string | null
}

const relevantHeaders = [
  'cache-control',
  'x-cache',
  'x-cache-status',
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'content-type',
]

export function interceptBackend(page: Page) {
  const entries: ApiAuditEntry[] = []
  const started = new WeakMap<Request, number>()
  const recorded = new WeakSet<Request>()
  const pendingResponses: Promise<void>[] = []

  page.on('request', (request) => {
    if (isBackendRequest(request)) started.set(request, Date.now())
  })

  page.on('response', (response) => {
    if (!isBackendRequest(response.request())) return
    pendingResponses.push(recordResponse(response, entries, started, recorded))
  })

  page.on('requestfailed', (request) => {
    if (!isBackendRequest(request) || recorded.has(request)) return
    recorded.add(request)
    entries.push({
      method: request.method(),
      url: request.url(),
      endpoint: endpoint(request.url()),
      status: null,
      latencyMs: Date.now() - (started.get(request) ?? Date.now()),
      headers: {},
      requestSummary: summarize(request.postData()),
      responseSummary: null,
      failure: request.failure()?.errorText || 'Request failed',
    })
  })

  page.route('**/api/**', async (route) => {
    try {
      await route.continue()
    } catch (error) {
      const request = route.request()
      if (!recorded.has(request)) {
        recorded.add(request)
        entries.push({
          method: request.method(),
          url: request.url(),
          endpoint: endpoint(request.url()),
          status: null,
          latencyMs: Date.now() - (started.get(request) ?? Date.now()),
          headers: {},
          requestSummary: summarize(request.postData()),
          responseSummary: null,
          failure: error instanceof Error ? error.message : 'Request could not be continued',
        })
      }
      await route.abort().catch(() => undefined)
    }
  })

  return {
    entries,
    async save(testInfo: TestInfo) {
      await Promise.allSettled(pendingResponses)
      await new Promise((resolve) => setTimeout(resolve, 25))
      const outputPath = testInfo.outputPath('network-audit.json')
      await mkdir(testInfo.outputDir, { recursive: true })
      await writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`)
      await testInfo.attach('network-audit', { path: outputPath, contentType: 'application/json' })
      const failures = entries.filter((entry) => entry.failure || (entry.status !== null && entry.status >= 500))
      if (failures.length) {
        throw new Error(`Backend network audit found ${failures.length} failure(s): ${failures.map((entry) => `${entry.method} ${entry.endpoint} (${entry.status ?? entry.failure})`).join('; ')}`)
      }
    },
  }
}

async function recordResponse(
  response: Response,
  entries: ApiAuditEntry[],
  started: WeakMap<Request, number>,
  recorded: WeakSet<Request>,
) {
  const request = response.request()
  if (recorded.has(request)) return
  recorded.add(request)
  const allHeaders = await response.allHeaders().catch(() => ({}))
  const headers = Object.fromEntries(
    relevantHeaders
      .filter((name) => allHeaders[name] !== undefined)
      .map((name) => [name, allHeaders[name]]),
  )
  let responseSummary: Record<string, unknown> | null = null
  if ((allHeaders['content-type'] || '').includes('application/json')) {
    const payload = await response.json().catch(() => null)
    responseSummary = summarize(payload)
  }
  entries.push({
    method: request.method(),
    url: request.url(),
    endpoint: endpoint(request.url()),
    status: response.status(),
    latencyMs: Math.max(0, Date.now() - (started.get(request) ?? Date.now())),
    headers,
    requestSummary: summarize(request.postData()),
    responseSummary,
    failure: response.status() >= 500 ? `HTTP ${response.status()}` : null,
  })
}

function isBackendRequest(request: Request): boolean {
  try { return new URL(request.url()).pathname.includes('/api/') } catch { return false }
}

function endpoint(value: string): string {
  const url = new URL(value)
  return `${url.origin}${url.pathname}`
}

function summarize(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined || raw === '') return null
  let value = raw
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) } catch { return { content: '[non-JSON omitted]' } }
  }
  if (Array.isArray(value)) return { itemCount: value.length }
  if (!value || typeof value !== 'object') return { type: typeof value }
  const object = value as Record<string, unknown>
  const sensitiveKeys = Object.keys(object).filter((key) => /password|token|secret|cpf|email|authorization|registration_key/i.test(key))
  const safeFields = Object.keys(object).filter((key) => !sensitiveKeys.includes(key))
  return {
    fields: Object.keys(object),
    safeFields,
    redactedFields: sensitiveKeys,
    ...(Array.isArray(object.items) ? { itemCount: object.items.length } : {}),
  }
}

export function networkAuditPath(testOutputPath: string): string {
  return resolve(testOutputPath)
}
