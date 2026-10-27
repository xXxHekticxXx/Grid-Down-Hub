// One-time install while online: load the app, let the service worker cache it, and download every
// required data pack with SHA-256 checks. This is the only spec that uses the network.
import { test, expect } from '@playwright/test';
import { openProfile, PROOF } from './fixtures';

test.setTimeout(45 * 60_000);

for (const name of ['phone', 'laptop'] as const) {
  test(`install the app on the ${name}`, async () => {
    const ctx = await openProfile(name);
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('/');
    await expect(page.getByText('EMERGENCY')).toBeVisible();
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.ready;
      return !!r.active;
    }, null, { timeout: 60_000 });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60_000 });
    if (name === 'phone') {
      await page.goto('/#/setup');
      const btn = page.getByRole('button', { name: /Download everything/ });
      await expect(btn.or(page.getByText('Offline ready').first())).toBeVisible({ timeout: 30_000 });
      if (await btn.isVisible()) await btn.click();
      await expect(page.getByText('Offline ready').first()).toBeVisible({ timeout: 40 * 60_000 });
      await page.screenshot({ path: `${PROOF}/setup-offline-ready.png`, fullPage: true });
    }
    await ctx.close();
  });
}
