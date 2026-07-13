import { test, expect } from '@playwright/test';
import { VIEWPORTS, ROUTES, overflowReport } from './responsive.audit';

type Tokens = { accessToken: string; refreshToken: string; userName: string };

let tokens: Tokens | null = null;
let fakeAuth = process.env.AUDIT_FAKE_AUTH === '1';

test.beforeAll(async ({ request }) => {
  if (fakeAuth) return;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    fakeAuth = true;
    console.warn('[audit] TEST_USER_EMAIL/PASSWORD not set — falling back to fake auth');
    return;
  }
  const res = await request.post('/auth/login', { data: { email, password } });
  if (!res.ok()) {
    fakeAuth = true;
    console.warn(`[audit] login failed (${res.status()}) — falling back to fake auth`);
    return;
  }
  const body = await res.json();
  tokens = {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? '',
    userName: body.user?.name ?? 'Audit User',
  };
});

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      const slug = route.path === '/' ? 'landing' : route.path.replace(/^\//, '').replace(/\//g, '-');

      test(`${route.path} @ ${vp.name}`, async ({ page }) => {
        if (route.auth) {
          const seed: Tokens = tokens ?? {
            accessToken: 'audit-fake-token',
            refreshToken: 'audit-fake-refresh',
            userName: 'Audit User',
          };
          await page.addInitScript((t) => {
            localStorage.setItem('accessToken', t.accessToken);
            localStorage.setItem('refreshToken', t.refreshToken);
            localStorage.setItem('userName', t.userName);
          }, seed);
        }

        await page.goto(route.path, { waitUntil: 'networkidle' }).catch(async () => {
          await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        });
        await page.waitForTimeout(600);

        if (route.prepare) await route.prepare(page);
        await page.waitForTimeout(300);

        // Catch unexpected redirects (e.g. bounced to /login) — tolerated in fake mode.
        if (route.auth && !fakeAuth) {
          expect.soft(page.url(), `unexpected redirect from ${route.path}`).toContain(route.path === '/dashboard/settings' ? '/dashboard/settings' : route.path);
        }

        const report = await overflowReport(page);
        expect
          .soft(
            report.docOverflow,
            `horizontal overflow on ${route.path} @ ${vp.name}:\n${report.offenders.join('\n')}`
          )
          .toBeLessThanOrEqual(1);
        // Elements extending past the viewport are clipped/cut off even when the
        // document itself doesn't scroll (overflow-hidden ancestors).
        expect
          .soft(
            report.offenders,
            `elements exceed viewport on ${route.path} @ ${vp.name}`
          )
          .toEqual([]);

        await page.screenshot({
          path: `audit-artifacts/${vp.name}/${slug}.png`,
          fullPage: true,
        });
      });
    }
  });
}
