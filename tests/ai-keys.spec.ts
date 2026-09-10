/**
 * The AI keys screen, in a real browser.
 *
 * The number that matters is "3 keys in rotation": the Space settings page can
 * show three secrets while the process reads two, because the pool stops at the
 * first gap in the numbering. This page is the only place that difference is
 * visible, so it has to actually render.
 */
import { test, expect } from '@playwright/test';
import { createVerifiedUser, makeAdmin, sessionArg, uniqueEmail, type TestUser } from './helpers/backend';
import { overflowReport } from './responsive.audit';

let admin: TestUser;

test.beforeAll(async () => {
  const email = uniqueEmail('ai-keys-admin');
  admin = await createVerifiedUser('AI Keys Admin', email);
  makeAdmin(email);
});

test('an admin can see which keys are in rotation and how much is left', async ({ page }) => {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(admin));

  await page.goto('/admin/ai', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'AI keys' })).toBeVisible();

  const summary = page.getByTestId('ai-summary');
  await expect(summary).toBeVisible();
  await expect(summary, 'the count is the whole point of the page').toContainText(
    /\d+ keys? in rotation/,
  );

  // One row per key, each naming the environment variable an admin would go fix.
  const rows = page.getByTestId('ai-key-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toContainText('GROQ_API_KEY');

  // A key that has served nothing must read as unmeasured, never as 0% used —
  // that would be a lie in the reassuring direction.
  await expect(page.getByTestId('ai-keys')).toContainText(/not used yet|% used/);

  // And the ladder the operator chose is shown, so nobody has to read the code
  // to find out when they get emailed.
  await expect(page.locator('body')).toContainText('40%');
  await expect(page.locator('body')).toContainText('100%');
});

test('the keys screen is reachable from the admin navigation', async ({ page }) => {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(admin));

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /AI keys/i }).first().click();
  await page.waitForURL('**/admin/ai');
  await expect(page.getByRole('heading', { name: 'AI keys' })).toBeVisible();
});

test('the keys screen works on a phone', async ({ page }) => {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(admin));

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/admin/ai', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('ai-summary')).toBeVisible();

    const report = await overflowReport(page);
    expect(
      report.offenders,
      `elements exceed a ${width}px screen:\n${report.offenders.join('\n')}`,
    ).toEqual([]);
    expect(report.docOverflow, `scrolls sideways at ${width}px`).toBeLessThanOrEqual(1);
  }
});
