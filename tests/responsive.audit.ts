import type { Page } from '@playwright/test';

export type Viewport = { name: string; width: number; height: number };

export const VIEWPORTS: Viewport[] = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

export type RouteSpec = {
  path: string;
  auth: boolean;
  /** Optional interaction before the audit (e.g. open a filters panel). */
  prepare?: (page: Page) => Promise<void>;
};

const openFilters = async (page: Page) => {
  await page
    .getByRole('button', { name: /filters/i })
    .first()
    .click({ timeout: 3000 })
    .catch(() => {});
};

export const ROUTES: RouteSpec[] = [
  { path: '/', auth: false },
  { path: '/login', auth: false },
  { path: '/signup', auth: false },
  { path: '/forgot-password', auth: false },
  { path: '/verify-otp', auth: false },
  { path: '/reset-password', auth: false },
  { path: '/this-page-does-not-exist', auth: false },
  { path: '/dashboard', auth: true },
  { path: '/dashboard/settings', auth: true },
  { path: '/jobs', auth: true, prepare: openFilters },
  { path: '/courses', auth: true, prepare: openFilters },
  { path: '/document-generation', auth: true },
  { path: '/mock-interview', auth: true },
  { path: '/upload-resume', auth: true },
  { path: '/onboarding', auth: true },
  { path: '/analysis-results', auth: true },
];

export type OverflowReport = {
  vw: number;
  docOverflow: number;
  offenders: string[];
};

/** Scan for horizontal overflow and name the offending elements. */
export async function overflowReport(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docOverflow = document.documentElement.scrollWidth - vw;
    const offenders = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(
        ({ el, r }) =>
          (r.right > vw + 1 || r.left < -1) &&
          r.width > 0 &&
          getComputedStyle(el).position !== 'fixed' &&
          !el.closest('[data-audit-ignore]')
      )
      .slice(0, 8)
      .map(
        ({ el, r }) =>
          `${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0, 4).join('.')} → left:${Math.round(r.left)} right:${Math.round(r.right)} (vw:${vw})`
      );
    return { vw, docOverflow, offenders };
  });
}
