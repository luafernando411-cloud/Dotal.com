import { expect, test } from './fixtures'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:8000'
const adminRegistrationKey = process.env.E2E_ADMIN_REGISTRATION_KEY || 'playwright-local-provisioning-key'

async function openLogin(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Acessar Censo' }).click()
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()
}

async function capture(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  const directory = resolve(process.cwd(), 'artifacts/screenshots')
  await mkdir(directory, { recursive: true })
  const path = resolve(directory, `${testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

function validCpfFor(seed: number): string {
  const base = String(seed).padStart(9, '0')
  const calculate = (digits: string) => {
    const total = [...digits].reduce(
      (sum, digit, index) => sum + Number(digit) * (digits.length + 1 - index),
      0,
    )
    const remainder = (total * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  const firstDigit = calculate(base)
  return `${base}${firstDigit}${calculate(`${base}${firstDigit}`)}`
}

async function registerTestUser(page: import('@playwright/test').Page, seed: number) {
  const cpf = validCpfFor(seed)
  const account = {
    cpf,
    fullName: `Playwright User ${seed}`,
    email: `playwright-${seed}@example.com`,
    password: 'ValidUser123',
  }
  const result = await page.evaluate(async ({ apiURL, data }) => {
    const response = await fetch(`${apiURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return { status: response.status, text: await response.text() }
  }, { apiURL: apiBaseURL, data: account })
  expect(result.status, result.text).toBe(201)
  return account
}

test('descobre rotas e navegação sem erros de console ou página', async ({ auditedPage: page }, testInfo) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const map = JSON.parse(await readFile(resolve(process.cwd(), 'artifacts/map-routes.json'), 'utf8'))
  expect(map.totalRoutes).toBeGreaterThan(0)
  const paths = [...new Set(map.routes.map((route: { path: string }) => route.path))]
  expect(paths).toContain('/admin/login')
  expect(paths).toContain('/admin/register')

  for (const path of paths) {
    const response = await page.goto(path)
    expect(response?.status(), `Expected ${path} to load`).toBeLessThan(400)
    await expect(page.locator('body')).toBeVisible()
  }

  await capture(page, testInfo, 'route-discovery')
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('cadastro de usuário comum valida CPF e senha e cria a conta', async ({ auditedPage: page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Primeiro Acesso' }).click()
  await page.getByTestId('signup-full-name').fill('Playwright Cadastro')
  await page.getByTestId('signup-cpf').fill('529.982.247-25')
  await page.getByLabel('Data de nascimento').fill('1990-04-15')
  await page.getByLabel('E-mail').fill(`signup-${Date.now()}@example.com`)
  await page.getByLabel('Celular').fill('11987654321')
  await page.getByLabel('Crie uma senha').fill('ValidUser123')
  await page.getByTestId('signup-cpf').fill('111.111.111-11')
  await page.getByRole('button', { name: /Continuar para Verificação/ }).click()
  await expect(page.getByTestId('signup-error')).toContainText('CPF válido')
  await page.getByTestId('signup-cpf').fill('529.982.247-25')
  await page.getByLabel('Crie uma senha').fill('senha-fraca')
  await page.getByRole('button', { name: /Continuar para Verificação/ }).click()
  await expect(page.getByTestId('signup-error')).toContainText('letras e números')
  await page.getByLabel('Crie uma senha').fill('ValidUser123')
  const cpf = validCpfFor(529982247)
  await page.getByTestId('signup-cpf').fill(cpf)
  await page.getByLabel('E-mail').fill(`signup-${cpf}@example.com`)
  await page.getByRole('button', { name: /Continuar para Verificação/ }).click()
  await expect(page.getByRole('heading', { name: 'Confirme seus dados' })).toBeVisible()
})

test('login por CPF aceita a senha correta, rejeita inválidas e protege endpoints', async ({ auditedPage: page }, testInfo) => {
  await page.goto('/')
  const account = await registerTestUser(page, 111444777)
  await openLogin(page)
  await expect(page.getByRole('button', { name: 'Acesso do gestor' })).toHaveCount(0)
  await page.getByLabel('CPF').fill('123.456.789-00')
  await page.getByLabel('Senha').fill('WrongPassword123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('CPF válido')
  await page.getByLabel('CPF').fill(account.cpf)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('CPF ou senha inválidos')
  await page.getByLabel('Senha').fill(account.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByTestId('census-form-screen')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dados pessoais e vínculo' })).toBeVisible()
  await capture(page, testInfo, 'user-login')

  const unauthorized = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/api/admin/metrics`)
    return response.status
  }, apiBaseURL)
  expect(unauthorized).toBe(401)
})

test('login principal recebe erro claro para CPF inválido da API', async ({ auditedPage: page }) => {
  await page.goto('/')
  const response = await page.evaluate(async (url) => {
    const result = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: 'invalid-cpf', password: 'ValidUser123' }),
    })
    return { status: result.status, body: await result.json() }
  }, apiBaseURL)
  expect(response.status).toBe(422)
  expect(response.body.error.message).toContain('dados inválidos')
})

test('cadastro e login admin são isolados e o painel exibe dados reais', async ({ auditedPage: page }, testInfo) => {
  const email = `admin-${Date.now()}@example.com`
  await page.goto('/admin/register')
  await expect(page.getByRole('heading', { name: 'Criar conta administrativa' })).toBeVisible()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha forte').fill('StrongAdminPass1!')
  await page.getByLabel('Chave de provisionamento').fill(adminRegistrationKey)
  await page.getByRole('button', { name: 'Criar acesso' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('StrongAdminPass1!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Visão executiva e territorial' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  await capture(page, testInfo, 'admin-dashboard')
  await page.getByTestId('dashboard-model-observability').click()
  await expect(page.getByRole('heading', { name: 'Segurança e acessos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Eventos recentes' })).toBeVisible()
  await page.getByRole('button', { name: 'Usuários e acessos' }).click()
  await expect(page.getByRole('heading', { name: 'Usuários e segurança' })).toBeVisible()
  await capture(page, testInfo, 'admin-security')
})

test('tentativas repetidas inválidas acionam rate limit temporário', async ({ auditedPage: page }) => {
  await page.goto('/')
  const account = await registerTestUser(page, 935411347)
  await openLogin(page)
  await page.getByLabel('CPF').fill(account.cpf)
  await page.getByLabel('Senha').fill('WrongPassword123')

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toContainText('CPF ou senha inválidos')
  }
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('Muitas tentativas')
})
