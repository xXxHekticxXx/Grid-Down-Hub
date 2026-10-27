import { defineConfig } from '@playwright/test';

// The suite runs against the built app served locally with the real data packs. The first spec downloads
// every pack into a persistent browser profile; every spec after it runs with the network switched off.
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'node scripts/serve.mjs 4173',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
