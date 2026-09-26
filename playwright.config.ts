import { defineConfig } from '@playwright/test';

// Banc d'essai du panneau : le vrai panneau (npm run dev) dans un faux navigateur
// (tests/e2e/faux-navigateur.js) qui joue Salesforce, Doctolib et Acuitis.
// Lancer : npm test  (rapport : npx playwright show-report)
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/rapport' }]],
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 400, height: 860 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199/panel.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
