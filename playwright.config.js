import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'node test_server.js',
    url: 'http://localhost:3000/viewer/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
