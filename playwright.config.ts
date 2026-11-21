import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4180', serviceWorkers: 'allow', actionTimeout: 5000 },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4180',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
