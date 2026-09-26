import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.PW_PORT ?? 5199);

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
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 400, height: 860 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/panel.html`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
