import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173'
const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:8000'
const python = process.env.PYTHON_BIN || resolve(projectRoot, '../.venv/bin/python')
const backendDirectory = resolve(projectRoot, '../backend')
const artifactsDirectory = resolve(projectRoot, 'artifacts')
const startLocalServers = process.env.E2E_START_SERVERS !== 'false'
const testAdminKey = process.env.E2E_ADMIN_REGISTRATION_KEY || 'playwright-local-provisioning-key'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: resolve(artifactsDirectory, 'test-results'),
  globalSetup: './utils/global-setup.ts',
  reporter: [
    ['list'],
    ['html', { outputFolder: resolve(artifactsDirectory, 'html-report'), open: 'never' }],
    ['./utils/report-generator.ts'],
  ],
  use: {
    baseURL,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(startLocalServers
    ? {
        webServer: [
          {
            command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
            cwd: backendDirectory,
            url: `${apiBaseURL}/api/health`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              CENSUS_DATABASE_URL: 'sqlite:///./playwright-e2e.db',
              CENSUS_REDIS_URL: 'redis://127.0.0.1:6379/15',
              CENSUS_SECRET_KEY: 'playwright-test-secret-key-at-least-32-bytes',
              CENSUS_ADMIN_REGISTRATION_KEY: testAdminKey,
              CENSUS_CORS_ORIGINS: new URL(baseURL).origin,
              CENSUS_LOGIN_MAX_ATTEMPTS: '8',
              CENSUS_REQUEST_RATE_LIMIT: '600',
              CENSUS_ENVIRONMENT: 'development',
            },
          },
          {
            command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
            cwd: projectRoot,
            url: baseURL,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { VITE_API_URL: apiBaseURL },
          },
        ],
      }
    : {}),
})
