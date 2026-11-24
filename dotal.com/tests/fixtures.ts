import { test as base, expect, type Page } from '@playwright/test'
import { interceptBackend } from '../utils/network-interceptor'

export const test = base.extend<{ auditedPage: Page }>({
  auditedPage: async ({ page }, use, testInfo) => {
    const audit = interceptBackend(page)
    await use(page)
    await audit.save(testInfo)
  },
})

export { expect }
