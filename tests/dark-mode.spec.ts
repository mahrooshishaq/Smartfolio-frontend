import { test, expect } from '@playwright/test';
import { ROUTES } from './responsive.audit';

/**
 * Dark-mode audit. Seeds `theme=dark` (so the pre-hydration script applies
 * `.dark`), visits every route, screenshots it, and scans for "light leftovers"
 * — large elements still painting a near-white background, i.e. a card the dark
 * override layer missed. Runs at desktop, plus a mobile pass for the shell.
 *
 *   AUDIT_FAKE_AUTH=1 npx playwright test tests/dark-mode.spec.ts
 */

const FAKE = {
  accessToken: 'audit-fake-token',
  refreshToken: 'audit-fake-refresh',
  userName: 'Audit User',
};

/** Find big elements whose painted background is still near-white on dark. */
async function lightLeftovers(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const parse = (c: string): [number, number, number, number] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((s) => parseFloat(s));
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest('[data-audit-ignore]')) continue;
      const tag = el.tagName.toLowerCase();
      if (['img', 'svg', 'video', 'canvas', 'path', 'script', 'style'].includes(tag)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 15000) continue; // ignore small bits
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (cs.backgroundImage !== 'none') continue; // gradients/images judged visually
      const rgba = parse(cs.backgroundColor);
      if (!rgba) continue;
      const [rr, gg, bb, aa] = rgba;
      if (aa < 0.5) continue; // transparent/tinted overlay — not a solid surface
      if (lum(rr, gg, bb) > 0.7) {
        out.push(
          `${tag}.${Array.from(el.classList).slice(0, 4).join('.')} bg:${cs.backgroundColor} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
        if (out.length >= 12) break;
      }
    }
    return out;
  });
}

async function loadDark(page: import('@playwright/test').Page, path: string, auth: boolean) {
  await page.addInitScript((t) => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('userName', t.userName);
  }, FAKE);
  if (!auth) {
    // still fine to have tokens set; harmless on public pages
  }
  await page
    .goto(path, { waitUntil: 'networkidle' })
    .catch(() => page.goto(path, { waitUntil: 'domcontentloaded' }));
  await page.waitForTimeout(700);
}

test.describe('dark mode @ desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const route of ROUTES) {
    const slug = route.path === '/' ? 'landing' : route.path.replace(/^\//, '').replace(/\//g, '-');
    test(`${route.path}`, async ({ page }) => {
      await loadDark(page, route.path, route.auth);
      if (route.prepare) await route.prepare(page);
      await page.waitForTimeout(300);

      // Dark mode actually engaged.
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect.soft(isDark, `${route.path}: <html> should have .dark`).toBe(true);

      const leftovers = await lightLeftovers(page);
      expect.soft(leftovers, `light leftovers on ${route.path}:\n${leftovers.join('\n')}`).toEqual([]);

      await page.screenshot({ path: `audit-artifacts/dark/${slug}.png`, fullPage: true });
    });
  }
});

test.describe('dark mode @ mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of ['/dashboard', '/jobs', '/tracker']) {
    const slug = path.replace(/^\//, '').replace(/\//g, '-');
    test(`${path}`, async ({ page }) => {
      await loadDark(page, path, true);
      await page.waitForTimeout(300);
      const leftovers = await lightLeftovers(page);
      expect.soft(leftovers, `light leftovers on ${path} (mobile):\n${leftovers.join('\n')}`).toEqual([]);
      await page.screenshot({ path: `audit-artifacts/dark/${slug}-mobile.png`, fullPage: true });
    });
  }
});
