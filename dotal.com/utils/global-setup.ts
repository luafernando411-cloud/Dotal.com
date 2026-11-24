import type { FullConfig } from '@playwright/test'
import { crawlApplication, routesFilePath } from './crawler'

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || config.projects[0].use.baseURL as string
  await crawlApplication(baseURL, routesFilePath())
}
