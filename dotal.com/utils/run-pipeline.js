import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const database = resolve(process.cwd(), '../backend/playwright-e2e.db')

if (existsSync(database)) unlinkSync(database)

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['playwright', 'test'], {
  stdio: 'inherit',
  env: process.env,
})

if (existsSync(database)) unlinkSync(database)
process.exit(result.status ?? 1)
