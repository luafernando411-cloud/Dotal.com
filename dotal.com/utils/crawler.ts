import { chromium, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

type ElementMap = {
  links: Array<{ text: string; href: string }>
  forms: Array<{ name: string; fields: string[] }>
  buttons: string[]
}

type RouteRecord = {
  url: string
  path: string
  state: string
  title: string
  status: number | null
  loadTimeMs: number
  discoveredFrom: string | null
  elements: ElementMap
}

const navigationButtons = [
  'Acessar Censo',
  'Primeiro Acesso',
  'Acesso do gestor',
  'Exemplo da API',
  'Criar acesso',
  'Criar conta',
]

export async function crawlApplication(baseURL: string, outputPath: string): Promise<RouteRecord[]> {
  const browser: Browser = await chromium.launch()
  const context = await browser.newContext()
  const routes = new Map<string, RouteRecord>()
  const origin = new URL(baseURL).origin
  const pending: Array<{ url: string; discoveredFrom: string | null }> = [
    { url: baseURL, discoveredFrom: null },
    ...['/admin', '/admin/login', '/admin/register', '/api-example'].map((path) => ({
      url: new URL(path, baseURL).href,
      discoveredFrom: 'SPA route discovery',
    })),
  ]

  try {
    while (pending.length && routes.size < 40) {
      const current = pending.shift()!
      const routeKey = new URL(current.url).pathname
      if (routes.has(routeKey)) continue
      const page = await context.newPage()
      try {
        const startedAt = Date.now()
        const response = await page.goto(current.url, { waitUntil: 'domcontentloaded' })
        await page.locator('body').waitFor()
        const route = await inspectPage(page, current.url, current.discoveredFrom, response?.status() ?? null, Date.now() - startedAt)
        routes.set(routeKey, route)

        for (const link of route.elements.links) {
          const target = new URL(link.href, current.url)
          if (target.origin === new URL(baseURL).origin && !routes.has(target.pathname)) {
            pending.push({ url: target.href, discoveredFrom: current.url })
          }
        }

        for (const label of navigationButtons) {
          const actionPage = await context.newPage()
          try {
            await actionPage.goto(current.url, { waitUntil: 'domcontentloaded' })
            const button = actionPage.getByRole('button', { name: label, exact: true })
            if (!await button.count()) continue
            await button.first().click({ timeout: 2_000 })
            await actionPage.waitForTimeout(100)
            const state = await inspectPage(
              actionPage,
              actionPage.url(),
              current.url,
              response?.status() ?? null,
              0,
            )
            const stateKey = `${routeKey}#${state.state}`
            routes.set(stateKey, state)
            const stateURL = new URL(actionPage.url())
            if (stateURL.origin === origin && stateURL.pathname !== routeKey && !routes.has(stateURL.pathname)) {
              pending.push({ url: stateURL.href, discoveredFrom: current.url })
            }
            for (const link of state.elements.links) {
              const target = new URL(link.href, current.url)
              if (target.origin === origin && !routes.has(target.pathname)) {
                pending.push({ url: target.href, discoveredFrom: current.url })
              }
            }
          } catch {
            // Some navigation actions are only available after authentication or form input.
          } finally {
            await actionPage.close()
          }
        }
      } catch (error) {
        routes.set(routeKey, {
          url: current.url,
          path: routeKey,
          state: 'unavailable',
          title: '',
          status: null,
          loadTimeMs: 0,
          discoveredFrom: current.discoveredFrom,
          elements: { links: [], forms: [], buttons: [] },
        })
        if (error instanceof Error) console.warn(`Crawler could not load ${current.url}: ${error.message}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }

  const result = [...routes.values()]
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({
    baseURL,
    generatedAt: new Date().toISOString(),
    totalRoutes: result.length,
    routes: result,
  }, null, 2)}\n`)
  return result
}

async function inspectPage(
  page: Page,
  sourceURL: string,
  discoveredFrom: string | null,
  status: number | null,
  loadTimeMs: number,
): Promise<RouteRecord> {
  const url = page.url() || sourceURL
  const elements = await page.evaluate((internalOrigin) => {
    const links = [...document.querySelectorAll('a[href]')]
      .map((anchor) => ({
        text: anchor.textContent?.trim().replace(/\s+/g, ' ') || '',
        href: (anchor as HTMLAnchorElement).href,
      }))
      .filter((link) => {
        try { return new URL(link.href).origin === internalOrigin } catch { return false }
      })
    const forms = [...document.querySelectorAll('form')].map((form) => ({
      name: form.getAttribute('aria-label') || form.querySelector('h1,h2,h3')?.textContent?.trim() || 'Formulário',
      fields: [...form.querySelectorAll('input,select,textarea')]
        .map((field) => (field as HTMLInputElement).name || field.getAttribute('aria-label') || field.getAttribute('placeholder') || field.tagName.toLowerCase()),
    }))
    const buttons = [...document.querySelectorAll('button')]
      .map((button) => button.textContent?.trim().replace(/\s+/g, ' ') || button.getAttribute('aria-label') || '')
      .filter(Boolean)
    return { links, forms, buttons }
  }, origin)
  const title = await page.title()
  const heading = await page.locator('h1').first().textContent().catch(() => null)
  return {
    url,
    path: new URL(url).pathname,
    state: (heading || 'page').trim().replace(/\s+/g, ' '),
    title,
    status,
    loadTimeMs,
    discoveredFrom,
    elements,
  }
}

export function routesFilePath(): string {
  return resolve(process.cwd(), 'artifacts/map-routes.json')
}
