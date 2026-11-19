import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  use: {
    channel: process.env.CI ? 'chrome' : undefined,
    actionTimeout: 15000,
    baseURL: 'http://127.0.0.1:4173/expenditure_tracker/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -w frontend -- --mode pages --port 4173',
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    url: 'http://127.0.0.1:4173/expenditure_tracker/',
    timeout: 30000,
  },
});
