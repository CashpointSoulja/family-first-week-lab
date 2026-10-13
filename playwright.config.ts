import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: 'npx vite build && rm -rf .wrangler/e2e-state && npx wrangler dev --port 4174 --ip 127.0.0.1 --persist-to .wrangler/e2e-state',
    url: 'http://127.0.0.1:4174/api/state',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'mobile-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1366', use: { browserName: 'chromium', viewport: { width: 1366, height: 900 } } },
  ],
});
