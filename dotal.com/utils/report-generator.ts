import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

type TestRecord = {
  title: string
  status: string
  durationMs: number
  attachments: Array<{ name: string; path?: string }>
}

type ApiEntry = {
  method: string
  url: string
  endpoint: string
  status: number | null
  latencyMs: number
  headers: Record<string, string>
  failure: string | null
}

export default class ConsolidatedReport implements Reporter {
  private readonly root = resolve(process.cwd(), 'artifacts')
  private readonly startedAt = Date.now()
  private readonly tests: TestRecord[] = []

  onTestEnd(test: TestCase, result: TestResult) {
    this.tests.push({
      title: test.title,
      status: result.status,
      durationMs: result.duration,
      attachments: result.attachments.map(({ name, path }) => ({ name, path })),
    })
  }

  async onEnd(result: FullResult) {
    const folders = {
      videos: resolve(this.root, 'videos'),
      screenshots: resolve(this.root, 'screenshots'),
      traces: resolve(this.root, 'traces'),
      reports: resolve(this.root, 'reports'),
    }
    await Promise.all(Object.values(folders).map((folder) => mkdir(folder, { recursive: true })))

    const evidence = new Map<string, string[]>()
    for (const [index, test] of this.tests.entries()) {
      const links: string[] = []
      for (const attachment of test.attachments) {
        if (!attachment.path) continue
        const extension = extname(attachment.path).toLowerCase()
        let destinationDirectory: string | null = null
        if (extension === '.webm' || attachment.name.toLowerCase().includes('video')) {
          destinationDirectory = folders.videos
        } else if (extension === '.zip' || attachment.name.toLowerCase().includes('trace')) {
          destinationDirectory = folders.traces
        } else if (extension === '.png' || attachment.name.toLowerCase().includes('screenshot')) {
          destinationDirectory = folders.screenshots
        }
        if (!destinationDirectory) continue
        const filename = `${String(index + 1).padStart(2, '0')}-${slug(test.title)}${extension}`
        const destination = resolve(destinationDirectory, filename)
        try {
          await copyFile(attachment.path, destination)
          links.push(relative(this.root, destination).replaceAll('\\', '/'))
        } catch {
          // A browser may omit an artifact when it closes before recording any frames.
        }
      }
      evidence.set(test.title, links)
    }

    const apiEntries = (await readJsonFiles<ApiEntry>(resolve(this.root, 'test-results'), 'network-audit.json'))
      .flat()
    const routeMap = await readFile(resolve(this.root, 'map-routes.json'), 'utf8')
      .then((value) => JSON.parse(value))
      .catch(() => ({ totalRoutes: 0, routes: [] }))
    const passed = this.tests.filter((item) => item.status === 'passed').length
    const failed = this.tests.filter((item) => item.status === 'failed' || item.status === 'timedOut').length
    const skipped = this.tests.length - passed - failed
    const failedApiCalls = apiEntries.filter((entry) => entry.failure || (entry.status !== null && entry.status >= 500))
    const byEndpoint = groupByEndpoint(apiEntries)
    const durationMs = Date.now() - this.startedAt
    const report = {
      generatedAt: new Date().toISOString(),
      status: result.status,
      summary: {
        routesMapped: routeMap.totalRoutes || routeMap.routes.length,
        tests: this.tests.length,
        passed,
        failed,
        skipped,
        durationMs,
        apiCalls: apiEntries.length,
        apiFailures: failedApiCalls.length,
      },
      routes: routeMap.routes,
      apiCalls: apiEntries,
      apiByEndpoint: byEndpoint,
      failedApiCalls,
      tests: this.tests.map((item) => ({ ...item, evidence: evidence.get(item.title) || [] })),
    }

    await writeFile(resolve(folders.reports, 'e2e-report.json'), `${JSON.stringify(report, null, 2)}\n`)
    await writeFile(resolve(folders.reports, 'e2e-report.md'), renderMarkdown(report))
    await writeFile(resolve(folders.reports, 'e2e-report.html'), renderHTML(report))
  }
}

async function readJsonFiles<T>(directory: string, filename: string): Promise<T[][]> {
  const found: T[][] = []
  async function visit(path: string) {
    const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const childPath = resolve(path, entry.name)
      if (entry.isDirectory()) await visit(childPath)
      else if (entry.name === filename) {
        try {
          found.push(JSON.parse(await readFile(childPath, 'utf8')) as T[])
        } catch {
          found.push([])
        }
      }
    }
  }
  await visit(directory)
  return found
}

function groupByEndpoint(entries: ApiEntry[]) {
  const grouped = new Map<string, ApiEntry[]>()
  for (const entry of entries) grouped.set(entry.endpoint, [...(grouped.get(entry.endpoint) || []), entry])
  return [...grouped].map(([endpoint, calls]) => ({
    endpoint,
    calls: calls.length,
    averageLatencyMs: Math.round(calls.reduce((sum, item) => sum + item.latencyMs, 0) / calls.length),
    statuses: calls.map((item) => item.status),
    failures: calls.filter((item) => item.failure || (item.status !== null && item.status >= 500)).length,
    cacheHeaders: calls.map((item) => item.headers['x-cache'] || item.headers['x-cache-status'] || null).filter(Boolean),
  }))
}

function renderMarkdown(report: any): string {
  const routeRows = report.routes.map((route: any) =>
    `| ${escapeMarkdown(route.path)} | ${escapeMarkdown(route.state)} | ${route.status ?? '—'} | ${route.loadTimeMs} ms |`).join('\n')
  const apiRows = report.apiByEndpoint.map((entry: any) =>
    `| ${entry.endpoint} | ${entry.calls} | ${entry.statuses.join(', ')} | ${entry.averageLatencyMs} ms | ${entry.failures} |`).join('\n')
  const evidenceRows = report.tests.map((item: any) =>
    `| ${escapeMarkdown(item.title)} | ${item.status} | ${item.evidence.map((path: string) => `[${path}](../${path})`).join(', ') || '—'} |`).join('\n')
  return `# E2E pipeline report

- **Status:** ${report.status}
- **Rotas mapeadas:** ${report.summary.routesMapped}
- **Testes:** ${report.summary.tests} (${report.summary.passed} aprovados, ${report.summary.failed} reprovados, ${report.summary.skipped} ignorados)
- **Duração:** ${(report.summary.durationMs / 1000).toFixed(1)} s
- **Chamadas API / falhas:** ${report.summary.apiCalls} / ${report.summary.apiFailures}

## Rotas

| Caminho | Estado | HTTP | Carregamento |
|---|---|---:|---:|
${routeRows || '| — | — | — | — |'}

## Auditoria de APIs

| Endpoint | Chamadas | Status | Latência média | Falhas |
|---|---:|---|---:|---:|
${apiRows || '| — | 0 | — | — | 0 |'}

## Evidências

| Cenário | Resultado | Arquivos |
|---|---|---|
${evidenceRows || '| — | — | — |'}

Relatório HTML nativo do Playwright: [abrir](../html-report/index.html).
`
}

function renderHTML(report: any): string {
  const routeRows = report.routes.map((route: any) =>
    `<tr><td>${escapeHTML(route.path)}</td><td>${escapeHTML(route.state)}</td><td>${route.status ?? '—'}</td><td>${route.loadTimeMs} ms</td><td>${escapeHTML(route.title)}</td></tr>`).join('')
  const apiRows = report.apiByEndpoint.map((entry: any) =>
    `<tr><td>${escapeHTML(entry.endpoint)}</td><td>${entry.calls}</td><td>${entry.statuses.join(', ')}</td><td>${entry.averageLatencyMs} ms</td><td>${entry.failures}</td></tr>`).join('')
  const testRows = report.tests.map((item: any) =>
    `<tr><td>${escapeHTML(item.title)}</td><td>${escapeHTML(item.status)}</td><td>${item.evidence.map((path: string) => `<a href="../${escapeHTML(path)}">${escapeHTML(path)}</a>`).join('<br>') || '—'}</td></tr>`).join('')
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Relatório E2E</title>
<style>body{font:15px system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;color:#17213a}h1,h2{color:#263b66}section{margin:28px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px;border-bottom:1px solid #dfe5ef}th{background:#f1f5fa}.cards{display:flex;flex-wrap:wrap;gap:12px}.card{padding:14px 18px;background:#f1f5fa;border-radius:8px}.ok{color:#087c5a}.fail{color:#b42336}a{color:#087aaa}</style>
<body><h1>Relatório consolidado da pipeline E2E</h1><p>Gerado em ${escapeHTML(report.generatedAt)} · status <strong>${escapeHTML(report.status)}</strong></p>
<div class="cards"><div class="card">Rotas mapeadas: <strong>${report.summary.routesMapped}</strong></div><div class="card">Testes: <strong>${report.summary.tests}</strong> · <span class="ok">${report.summary.passed} aprovados</span> · <span class="fail">${report.summary.failed} reprovados</span></div><div class="card">Duração: <strong>${(report.summary.durationMs / 1000).toFixed(1)} s</strong></div><div class="card">Chamadas API / falhas: <strong>${report.summary.apiCalls} / ${report.summary.apiFailures}</strong></div></div>
<section><h2>Rotas mapeadas</h2><table><thead><tr><th>URL</th><th>Estado</th><th>HTTP</th><th>Tempo</th><th>Título</th></tr></thead><tbody>${routeRows}</tbody></table></section>
<section><h2>Auditoria de APIs</h2><table><thead><tr><th>Endpoint</th><th>Chamadas</th><th>Status</th><th>Latência média</th><th>Falhas</th></tr></thead><tbody>${apiRows}</tbody></table></section>
<section><h2>Cenários e evidências</h2><table><thead><tr><th>Cenário</th><th>Resultado</th><th>Vídeo, screenshots e trace</th></tr></thead><tbody>${testRows}</tbody></table></section>
<p><a href="../html-report/index.html">Relatório interativo nativo do Playwright</a></p></body></html>`
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'test'
}

function escapeHTML(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

function escapeMarkdown(value: string): string {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
}
