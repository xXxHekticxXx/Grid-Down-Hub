// Acceptance tests. Every test here starts a fresh browser with the network switched off (airplane mode).
import { test, expect, waitForMap, proofPoints, PROOF, ROOT, openProfile } from './fixtures';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'generated', 'content.json'), 'utf8'));

test('1. starts offline after a restart, Home has EMERGENCY and no more than 8 tiles', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('EMERGENCY')).toBeVisible();
  const tiles = await page.locator('nav.tiles > *').count();
  expect(tiles).toBeLessThanOrEqual(8);
  expect(tiles).toBeGreaterThan(0);
  await expect(page.locator('.status')).toContainText(/offline/i);
  await page.screenshot({ path: `${PROOF}/01-home-offline.png` });
});

test('2. offline search finds tourniquet, snake, bleach, generator, shelter and Waterman', async ({ page }) => {
  const cases: [string, RegExp][] = [
    ['tourniquet', /Tourniquet/],
    ['snake', /Snakebite|venomous snakes/i],
    ['bleach', /bleach|Making water safe/i],
    ['generator', /Generator/],
    ['shelter', /shelter/i],
    ['Waterman', /Waterman/],
  ];
  for (const [q, re] of cases) {
    await page.goto(`/#/search?q=${encodeURIComponent(q)}`);
    const results = page.getByTestId('results');
    await expect(results).toContainText(re, { timeout: 20_000 });
    await page.screenshot({ path: `${PROOF}/02-search-${q.toLowerCase()}.png` });
  }
});

test('3. bleach: 1 gal clear = 8 drops, 5 gal cloudy = 80 drops, wait 30 minutes', async ({ page }) => {
  await page.goto('/#/tool/bleach');
  await page.getByTestId('bleach-amount').fill('1');
  await page.getByTestId('bleach-unit').selectOption('gal');
  await page.getByTestId('bleach-clarity').selectOption('clear');
  await expect(page.getByTestId('bleach-drops')).toHaveText('8 drops');
  await expect(page.getByTestId('bleach-wait')).toContainText('30 minutes');
  await page.screenshot({ path: `${PROOF}/03-bleach-1gal-clear.png` });
  await page.getByTestId('bleach-amount').fill('5');
  await page.getByTestId('bleach-clarity').selectOption('cloudy');
  await expect(page.getByTestId('bleach-drops')).toHaveText('80 drops');
  await page.screenshot({ path: `${PROOF}/03-bleach-5gal-cloudy.png` });
  await page.getByTestId('bleach-timer').click();
  await expect(page.getByText(/Bleach water/).first()).toBeVisible();
});

test('4. EMERGENCY reaches CPR in one tap and the metronome runs at 110 per minute', async ({ page }) => {
  await page.goto('/');
  await page.locator('a.emergency-btn').click();
  const start = page.getByTestId('cpr-start');
  await expect(start).toBeVisible();
  await page.screenshot({ path: `${PROOF}/04-emergency.png` });
  await start.click();
  await page.waitForTimeout(12_000);
  const rate = await page.evaluate(() => (window as unknown as { __cprMetronome?: { measured(): number } }).__cprMetronome!.measured());
  expect(Math.abs(rate - 110)).toBeLessThan(1);
  await expect(page.getByTestId('cpr-rate')).toContainText('110');
  await page.screenshot({ path: `${PROOF}/04-cpr-running.png` });
  fs.writeFileSync(`${PROOF}/04-cpr-rate.txt`, `measured ${rate.toFixed(2)} beats per minute over 12 s\n`);
  await start.click();
});

test('5. My Plan exported on the phone imports identically on the laptop', async ({ page }) => {
  // fill a plan on the phone
  await page.goto('/#/plan/medical');
  await page.getByLabel('Allergies').fill('Test allergy: penicillin');
  await page.getByLabel('Blood type').fill('O+');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.goto('/#/plan/dog');
  await page.getByLabel('Name').fill('Test dog');
  await page.getByLabel('Weight (lb)').fill('90');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.goto('/#/plan/contacts');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByLabel('Name').fill('Test contact');
  await page.getByLabel('Phone', { exact: true }).fill('555-0100');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(500);
  const fpPhone = await page.evaluate(() => (window as unknown as { __gdhFingerprint: () => Promise<string> }).__gdhFingerprint());

  await page.goto('/#/plan');
  await page.getByRole('button', { name: /Export \/ import/ }).click();
  await page.getByTestId('pass').fill('correct horse battery');
  await page.getByTestId('pass2').fill('correct horse battery');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export file' }).click();
  const file = path.join(PROOF, 'plan-export.gdh');
  await (await dl).saveAs(file);
  const raw = fs.readFileSync(file, 'utf8');
  expect(raw).not.toContain('penicillin');
  expect(raw).not.toContain('Test contact');

  // import it on the laptop, offline
  const laptop = await openProfile('laptop', true);
  const lp = laptop.pages()[0] ?? (await laptop.newPage());
  await lp.goto('/#/plan');
  await lp.getByRole('button', { name: /Export \/ import/ }).click();
  await lp.getByTestId('pass-import').fill('correct horse battery');
  await lp.locator('select').last().selectOption('replace');
  await lp.getByTestId('import-file').setInputFiles(file);
  await expect(lp.getByTestId('backup-msg')).toContainText('Imported', { timeout: 30_000 });
  const fpLaptop = await lp.evaluate(() => (window as unknown as { __gdhFingerprint: () => Promise<string> }).__gdhFingerprint());
  await lp.goto('/#/plan/medical');
  await expect(lp.getByLabel('Allergies')).toHaveValue('Test allergy: penicillin');
  await lp.screenshot({ path: `${PROOF}/05-laptop-imported-plan.png` });
  await laptop.close();
  expect(fpLaptop).toBe(fpPhone);
  fs.writeFileSync(`${PROOF}/05-fingerprints.txt`, `phone  ${fpPhone}\nlaptop ${fpLaptop}\n`);
});

test('5b. the git repository holds no personal data', async () => {
  const root = ROOT;
  const files = execSync('git ls-files', { cwd: root }).toString().split('\n').filter(Boolean);
  expect(files.some((f) => /my-plan|\.gdh$|proof-points\.local/.test(f))).toBe(false);
  const local = path.join(ROOT, 'tests', 'proof-points.local.json');
  const needles = ['Mar' + 'tell', 'kyle' + 'martell']; // split so this file doesn't match itself
  if (fs.existsSync(local)) for (const p of JSON.parse(fs.readFileSync(local, 'utf8'))) needles.push(p.lat.toFixed(4), p.lon.toFixed(4));
  for (const n of needles) {
    let hit = '';
    try { hit = execSync(`git grep -I -l -F -- ${JSON.stringify(n)}`, { cwd: root }).toString(); } catch { /* no match */ }
    expect(hit, `"${n}" found in ${hit}`).toBe('');
  }
});

test('6. maps render offline at zoom 15 for each proof point', async ({ page }) => {
  for (const p of proofPoints()) {
    await page.goto(`/#/map?lat=${p.lat}&lon=${p.lon}&z=15&mark=${encodeURIComponent(p.name)}`);
    await waitForMap(page);
    const n = await page.evaluate(() => (window as unknown as { __map: { queryRenderedFeatures(): unknown[] } }).__map.queryRenderedFeatures().length);
    expect(n, `${p.name}: features drawn`).toBeGreaterThan(50);
    await expect(page.getByTestId('coords')).toBeVisible();
    await page.screenshot({ path: `${PROOF}/06-map-z15-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
  }
});

test('7. USGS topo overlay draws over Sorrento', async ({ page }) => {
  await page.goto('/#/map?lat=28.8075&lon=-81.5603&z=14');
  await waitForMap(page);
  await page.getByTestId('layers-btn').click();
  const toggle = page.getByTestId('topo-toggle');
  if (!(await toggle.isChecked())) await toggle.check();
  await page.keyboard.press('Escape');
  await waitForMap(page);
  const topoVisible = await page.evaluate(() => {
    const m = (window as unknown as { __map: { getLayer(id: string): unknown; getLayoutProperty(id: string, p: string): string; getStyle(): { layers: { id: string; type: string }[] } } }).__map;
    const raster = m.getStyle().layers.find((l) => l.type === 'raster');
    return !!raster && m.getLayoutProperty(raster.id, 'visibility') !== 'none';
  });
  expect(topoVisible).toBe(true);
  await page.screenshot({ path: `${PROOF}/07-usgs-topo-sorrento.png` });
});

test('8. every medical page shows the medical footer; tap targets are at least 48 px', async ({ page }) => {
  const medical = content.articles.filter((a: { medical: boolean }) => a.medical);
  expect(medical.length).toBeGreaterThanOrEqual(35);
  for (const a of medical) {
    await page.goto(`/#/a/${a.id}`);
    await expect(page.locator('.medical-footer')).toHaveText('Not a substitute for training. If phones work, call 911 first.');
  }
  for (const route of ['/', '/emergency', '/tools', '/a/tourniquet', '/checklists', '/plan', '/settings']) {
    await page.goto(`/#${route}`);
    await page.waitForTimeout(300);
    const small = await page.evaluate(() => [...document.querySelectorAll('button, a.btn, .tile, .row, select, input:not([type=hidden])')]
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => ({ t: (e.textContent || (e as HTMLInputElement).name || e.tagName).trim().slice(0, 30), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width }))
      .filter((r) => r.h < 47.5 || r.w < 47.5));
    expect(small, `${route} small targets`).toEqual([]);
  }
});

test('9. night mode is red on black; library chapters and every article open offline', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByTestId('theme-night').click();
  await page.goto('/');
  const colors = await page.evaluate(() => { const s = getComputedStyle(document.body); return [s.color, s.backgroundColor]; });
  const [fg, bg] = colors.map((c) => c.match(/\d+/g)!.map(Number));
  expect(bg[0] + bg[1] + bg[2]).toBeLessThan(30);
  expect(fg[0]).toBeGreaterThan(120);
  expect(fg[1]).toBeLessThan(80);
  await page.screenshot({ path: `${PROOF}/09-home-night.png` });
  await page.goto('/#/settings');
  await page.getByTestId('theme-day').click();
  for (const a of content.articles) {
    await page.goto(`/#/a/${a.id}`);
    await expect(page.locator('h1').first()).toContainText(a.title.slice(0, 12));
  }
  for (const b of content.books) {
    await page.goto(`/#/book/${b.id}/${b.chapters[3].id}`);
    await expect(page.locator('main')).toContainText(/\w{4,}/);
  }
  await page.goto('/#/library');
  await page.screenshot({ path: `${PROOF}/09-library.png` });
});

test('10. every downloaded data file matches its SHA-256', async ({ page }) => {
  await page.goto('/#/setup');
  const result = await page.evaluate(async () => {
    const m = await (await fetch('data/manifest.json').catch(() => null))?.json().catch(() => null);
    return m ? 'online' : 'offline';
  });
  expect(result).toBe('offline');
  const checks = page.getByRole('button', { name: /Check files/ });
  const n = await checks.count();
  expect(n).toBeGreaterThanOrEqual(7);
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    await checks.nth(i).click();
    const status = page.locator('p[role=status]');
    await expect(status).toContainText(/every file matches its SHA-256|failed the check/, { timeout: 10 * 60_000 });
    const t = (await status.textContent()) || '';
    lines.push(t);
    expect(t).toContain('every file matches its SHA-256');
  }
  fs.writeFileSync(`${PROOF}/10-sha-check.txt`, lines.join('\n') + '\n');
  await page.screenshot({ path: `${PROOF}/10-setup-sha.png`, fullPage: true });
});
