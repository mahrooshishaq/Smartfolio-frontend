import { test, expect } from '@playwright/test';

/**
 * Dark-mode audit. Seeds `theme=dark`, visits every route, screenshots it, and
 * runs two scans:
 *   1. light leftovers — big elements still painting a near-white background.
 *   2. low contrast   — text/buttons whose colour vs its *composited* background
 *      falls below WCAG (catches faint secondary buttons, dark-on-dark text).
 *
 *   AUDIT_FAKE_AUTH=1 npx playwright test tests/dark-mode.spec.ts
 */

const FAKE = { accessToken: 'audit-fake-token', refreshToken: 'audit-fake-refresh', userName: 'Audit User' };

const ROUTES: { path: string; auth: boolean; prepare?: (p: import('@playwright/test').Page) => Promise<void> }[] = [
  { path: '/', auth: false },
  { path: '/login', auth: false },
  { path: '/signup', auth: false },
  { path: '/forgot-password', auth: false },
  { path: '/reset-password', auth: false },
  { path: '/verify-otp', auth: false },
  { path: '/this-page-does-not-exist', auth: false },
  { path: '/dashboard', auth: true },
  { path: '/dashboard/settings', auth: true },
  { path: '/jobs', auth: true, prepare: openFilters },
  { path: '/courses', auth: true, prepare: openFilters },
  { path: '/tracker', auth: true },
  { path: '/document-generation', auth: true },
  { path: '/mock-interview', auth: true },
  { path: '/upload-resume', auth: true },
  { path: '/resume-editor', auth: true },
  { path: '/onboarding', auth: true },
  { path: '/analysis-results', auth: true },
];

async function openFilters(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /filters/i }).first().click({ timeout: 3000 }).catch(() => {});
}

/** Both scans run in-page; return offender strings. */
function scan(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const parse = (c: string): [number, number, number, number] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((s) => parseFloat(s));
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const over = (t: number[], b: number[]) => [
      t[0] * t[3] + b[0] * (1 - t[3]),
      t[1] * t[3] + b[1] * (1 - t[3]),
      t[2] * t[3] + b[2] * (1 - t[3]),
    ];
    const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const ratio = (a: number[], b: number[]) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
    const APP: number[] = [11, 15, 25];
    const effBg = (el: Element): number[] => {
      const layers: number[][] = [];
      let e: Element | null = el;
      while (e && e !== document.documentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c[3] > 0.001) layers.push(c);
        e = e.parentElement;
      }
      let bg = APP.slice();
      for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
      return bg;
    };
    const label = (el: Element) => `${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0, 3).join('.')}`;

    const lightLeftovers: string[] = [];
    const lowContrast: string[] = [];

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest('[data-audit-ignore]')) continue;
      const tag = el.tagName.toLowerCase();
      if (['svg', 'img', 'video', 'canvas', 'path', 'script', 'style', 'input', 'textarea'].includes(tag)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;

      // (1) light leftover: big solid near-white background
      if (r.width * r.height >= 15000 && cs.backgroundImage === 'none') {
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] >= 0.5 && lum([bg[0], bg[1], bg[2]]) > 0.7 && lightLeftovers.length < 8) {
          lightLeftovers.push(`${label(el)} bg:${cs.backgroundColor} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }

      // (2) contrast: only elements that directly render text
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 1);
      if (!hasText) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = effBg(el);
      const fgOnBg = fg[3] < 1 ? over(fg, bg) : [fg[0], fg[1], fg[2]];
      const cr = ratio(fgOnBg, bg);
      if (cr < 3.0 && lowContrast.length < 14) {
        const txt = (el.textContent || '').trim().slice(0, 24);
        lowContrast.push(`${label(el)} "${txt}" ${cr.toFixed(2)}:1 fg:${cs.color}`);
      }
    }
    return { lightLeftovers, lowContrast };
  });
}

async function loadDark(page: import('@playwright/test').Page, path: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('userName', t.userName);
  }, FAKE);
  await page.goto(path, { waitUntil: 'networkidle' }).catch(() => page.goto(path, { waitUntil: 'domcontentloaded' }));
  await page.waitForTimeout(800);
}

test.describe('dark mode @ desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const route of ROUTES) {
    const slug = route.path === '/' ? 'landing' : route.path.replace(/^\//, '').replace(/\//g, '-');
    test(`${route.path}`, async ({ page }) => {
      await loadDark(page, route.path);
      if (route.prepare) await route.prepare(page);
      await page.waitForTimeout(300);

      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect.soft(isDark, `${route.path}: <html> should have .dark`).toBe(true);

      const { lightLeftovers, lowContrast } = await scan(page);
      expect.soft(lightLeftovers, `light leftovers on ${route.path}:\n${lightLeftovers.join('\n')}`).toEqual([]);
      expect.soft(lowContrast, `low-contrast text on ${route.path}:\n${lowContrast.join('\n')}`).toEqual([]);

      await page.screenshot({ path: `audit-artifacts/dark/${slug}.png`, fullPage: true });
    });
  }
});
