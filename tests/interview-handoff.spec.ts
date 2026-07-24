import { test, expect } from '@playwright/test';

/**
 * "Practice this interview" on a job card must land on the interview form with
 * the posting already in the textarea, leaving only Start to press.
 *
 * The description travels in sessionStorage rather than the URL, so this asserts
 * against a real browser: the handoff is exactly the kind of thing that
 * typechecks perfectly and still does nothing.
 */

const JOB = {
  description:
    'We are hiring a Senior Backend Engineer to design and operate our payments ' +
    'platform. You will work in TypeScript and Go against PostgreSQL, own services ' +
    'end to end, and mentor engineers across the team.',
  title: 'Senior Backend Engineer',
  company: 'Northwind Payments',
};

// The page bounces to /login without a token; the value is never verified
// client-side, and every backend call on this screen already swallows failure.
async function seed(page: import('@playwright/test').Page, stash: unknown) {
  await page.addInitScript(
    ([job]) => {
      localStorage.setItem('accessToken', 'test-token');
      if (job !== null) sessionStorage.setItem('interviewPrefill', JSON.stringify(job));
    },
    [stash] as const,
  );
}

test('a stashed job lands in the textarea and names itself', async ({ page }) => {
  await seed(page, JOB);
  await page.goto('/mock-interview?prefill=job');

  const textarea = page.locator('textarea');
  await expect(textarea).toHaveValue(JOB.description);

  // Assert again once the URL has been rewritten and the page has settled.
  // Stripping the flag used to remount the component and silently wipe the
  // description — every assertion above still passed, because they ran first.
  await expect(page).toHaveURL(/\/mock-interview$/);
  await page.waitForTimeout(750);
  await expect(textarea).toHaveValue(JOB.description);

  // The banner is what stops a pre-filled box reading as stale text from a
  // previous session. Scoped to the banner because the title also appears
  // inside the description itself.
  const banner = page
    .locator('div')
    .filter({ hasText: 'Description loaded from your jobs' })
    .last();
  await expect(banner).toContainText(JOB.title);
  await expect(banner).toContainText(JOB.company);

  // Start must be reachable immediately — the whole point of the handoff.
  await expect(page.getByRole('button', { name: /start interview/i })).toBeEnabled();
});

test('the prefill flag is stripped so a refresh is a clean form', async ({ page }) => {
  await seed(page, JOB);
  await page.goto('/mock-interview?prefill=job');
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  await expect(page).toHaveURL(/\/mock-interview$/);
  await page.waitForTimeout(750);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  // Reloading now re-runs the page with no stash and no flag.
  await page.reload();
  await expect(page.locator('textarea')).toHaveValue('');
  await expect(page.getByText(JOB.title)).toHaveCount(0);
});

test('clearing the prefill empties the description', async ({ page }) => {
  await seed(page, JOB);
  await page.goto('/mock-interview?prefill=job');
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  await page.getByRole('button', { name: /clear this job/i }).click();

  await expect(page.locator('textarea')).toHaveValue('');
  await expect(page.getByText(JOB.title)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /start interview/i })).toBeDisabled();
});

test('the flag without a stash degrades to a normal empty form', async ({ page }) => {
  await seed(page, null);
  await page.goto('/mock-interview?prefill=job');

  await expect(page.locator('textarea')).toHaveValue('');
  await expect(page.getByRole('button', { name: /start interview/i })).toBeDisabled();
});

// ─── The whole journey, as the user actually walks it ────────────────────────

const feedJob = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  title: JOB.title,
  company: JOB.company,
  company_logo: '',
  location: 'Remote',
  country: 'United Kingdom',
  salary_min: '90000',
  salary_max: '120000',
  job_type: 'Full Time',
  experience_level: 'Senior',
  category: 'Engineering',
  source: 'adzuna',
  source_logo: '',
  description: JOB.description,
  geo_restriction: 'Anywhere',
  match_score: 88,
  apply_url: 'https://example.com/apply/1',
  scraped_at: '2026-07-24',
  ...over,
});

async function stubJobsFeed(page: import('@playwright/test').Page, jobs: unknown[]) {
  await page.route('**/jobs/me/filters*', (route) =>
    route.fulfill({ json: { locations: [], countries: [], job_types: [], experience_levels: [], categories: [], sources: [], geo_restrictions: [] } }),
  );
  await page.route('**/jobs/me?*', (route) =>
    route.fulfill({ json: { total: jobs.length, page: 1, limit: 20, totalPages: 1, counts_by_source: {}, counts_by_category: {}, data: jobs } }),
  );
  await page.route('**/scraper/runs*', (route) => route.fulfill({ json: [] }));
}

test('clicking Practice on a job card carries the posting into the interview', async ({ page }) => {
  await seed(page, null);
  await stubJobsFeed(page, [feedJob()]);

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: JOB.title })).toBeVisible();

  await page.getByRole('button', { name: /practice this interview/i }).click();

  await expect(page).toHaveURL(/\/mock-interview/);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
  await expect(page.getByRole('button', { name: /start interview/i })).toBeEnabled();

  // And it survives the URL cleanup, which is where this broke the first time.
  await page.waitForTimeout(750);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
});

test('a posting too thin to interview on offers no Practice button', async ({ page }) => {
  await seed(page, null);
  await stubJobsFeed(page, [feedJob({ description: 'Apply now.' })]);

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: JOB.title })).toBeVisible();

  // Better no button than one that leads to a form that refuses to start.
  await expect(page.getByRole('button', { name: /practice this interview/i })).toHaveCount(0);
});
