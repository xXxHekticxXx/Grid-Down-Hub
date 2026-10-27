// Shared browser profiles for the suite. "phone" is a Samsung Galaxy S-sized Android screen and holds the
// downloaded data packs; "laptop" is the HP laptop on the TV. Profiles persist between specs, like a real device.
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const BASE = 'http://localhost:4173';
const HERE = path.dirname(new URL(import.meta.url).pathname);
export const ROOT = path.resolve(HERE, '..');
export const PROOF = path.join(ROOT, 'proof');
fs.mkdirSync(PROOF, { recursive: true });

const PROFILES = {
  phone: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' },
  laptop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;
export type ProfileName = keyof typeof PROFILES;

export async function openProfile(name: ProfileName, offline = false): Promise<BrowserContext> {
  const dir = path.join(ROOT, 'test-results', `profile-${name}`);
  const ctx = await chromium.launchPersistentContext(dir, {
    ...PROFILES[name],
    baseURL: BASE,
    permissions: ['geolocation'],
    geolocation: { latitude: 28.8075, longitude: -81.5603, accuracy: 8 },
    acceptDownloads: true,
    serviceWorkers: 'allow',
  });
  if (offline) await ctx.setOffline(true);
  return ctx;
}

/** Points for the proof screenshots. A private file (not in git) may add the home location. */
export function proofPoints(): { name: string; lat: number; lon: number }[] {
  const pts = [
    { name: 'AdventHealth Waterman', lat: 28.8237, lon: -81.7108 },
    { name: 'Round Lake Elementary shelter', lat: 28.80576, lon: -81.59418 },
    { name: 'Downtown Sanford', lat: 28.8114, lon: -81.2673 },
  ];
  const local = path.join(HERE, 'proof-points.local.json');
  if (fs.existsSync(local)) pts.unshift(...JSON.parse(fs.readFileSync(local, 'utf8')));
  else if (process.env.GDH_HOME) {
    const [lat, lon] = process.env.GDH_HOME.split(',').map(Number);
    pts.unshift({ name: 'Home', lat, lon });
  }
  return pts;
}

export async function waitForMap(page: Page) {
  await page.waitForFunction(() => {
    const m = (window as unknown as { __map?: { loaded(): boolean; areTilesLoaded(): boolean } }).__map;
    return !!m && m.loaded() && m.areTilesLoaded();
  }, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
}

type Fixtures = { phone: BrowserContext; page: Page };
/** Every spec after setup runs with the network off, in the phone profile, after a fresh browser start. */
export const test = base.extend<Fixtures>({
  phone: async ({}, use) => {
    const ctx = await openProfile('phone', true);
    await use(ctx);
    await ctx.close();
  },
  page: async ({ phone }, use) => {
    const page = phone.pages()[0] ?? (await phone.newPage());
    await use(page);
  },
});
export { expect } from '@playwright/test';
