import { test, expect, type Page } from '@playwright/test';

/**
 * The two secondary actions on a job card — "Practice this interview" and
 * "Tailor my CV" — must land on their destination with the posting already
 * filled in, leaving only the start button to press.
 *
 * The description travels in sessionStorage rather than the URL, so these run
 * against a real browser: a handoff is exactly the kind of thing that
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

// Long enough for the interview (20) but not the resume analyser (50).
const SHORT_DESCRIPTION = 'Backend engineer wanted.';

async function auth(page: Page) {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'test-token'));
}

async function stash(page: Page, intent: 'interview' | 'resume', job: unknown) {
  await page.addInitScript(
    ([key, value]) => sessionStorage.setItem(key as string, JSON.stringify(value)),
    [`jobHandoff:${intent}`, job] as const,
  );
}

const feedJob = (over: Record<string, unknown> = {}) => ({
  id: 'job-1', title: JOB.title, company: JOB.company, company_logo: '',
  location: 'Remote', country: 'United Kingdom', salary_min: '90000', salary_max: '120000',
  job_type: 'Full Time', experience_level: 'Senior', category: 'Engineering',
  source: 'adzuna', source_logo: '', description: JOB.description,
  geo_restriction: 'Anywhere', match_score: 88,
  apply_url: 'https://example.com/apply/1', scraped_at: '2026-07-24', ...over,
});

async function stubJobsFeed(page: Page, jobs: unknown[]) {
  await page.route('**/jobs/me/filters*', (route) =>
    route.fulfill({ json: { locations: [], countries: [], job_types: [], experience_levels: [], categories: [], sources: [], geo_restrictions: [] } }));
  await page.route('**/jobs/me?*', (route) =>
    route.fulfill({ json: { total: jobs.length, page: 1, limit: 20, totalPages: 1, counts_by_source: {}, counts_by_category: {}, data: jobs } }));
  await page.route('**/scraper/runs*', (route) => route.fulfill({ json: [] }));
}

/** `saved` null means the user has never uploaded a CV. */
async function stubResumeApi(page: Page, saved: unknown) {
  await page.route('**/resume/latest*', (route) => route.fulfill({ json: saved }));
  await page.route('**/onboarding/context*', (route) => route.fulfill({ json: { targetRole: 'Backend Engineer' } }));
}

const SAVED_CV = {
  resumeId: 'resume-1', fileName: 'ibrahim-cv.pdf', fileType: 'pdf',
  uploadedAt: '2026-07-20T10:00:00.000Z', analyzable: true,
};

// ─── Interview handoff ───────────────────────────────────────────────────────

test('a stashed job lands in the interview textarea and names itself', async ({ page }) => {
  await auth(page);
  await stash(page, 'interview', JOB);
  await page.goto('/mock-interview?fromJob=interview');

  const textarea = page.locator('textarea');
  await expect(textarea).toHaveValue(JOB.description);

  const banner = page.locator('div').filter({ hasText: 'Description loaded from your jobs' }).last();
  await expect(banner).toContainText(JOB.title);
  await expect(banner).toContainText(JOB.company);

  // The description must still be there once the page has settled. Consuming
  // the stash and stripping the URL on arrival used to leave nothing to recover
  // from, so any remount after hydration silently emptied the form.
  await page.waitForTimeout(1000);
  await expect(textarea).toHaveValue(JOB.description);
  await expect(page.getByRole('button', { name: /start interview/i })).toBeEnabled();
});

test('the interview prefill survives a reload rather than vanishing', async ({ page }) => {
  await auth(page);
  await stash(page, 'interview', JOB);
  await page.goto('/mock-interview?fromJob=interview');
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  // Idempotent by design: re-reading beats losing the user's description.
  await page.reload();
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
});

test('dismissing the interview prefill stops it coming back', async ({ page }) => {
  await auth(page);
  await stash(page, 'interview', JOB);
  await page.goto('/mock-interview?fromJob=interview');
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  await page.getByRole('button', { name: /clear this job/i }).click();
  await expect(page.locator('textarea')).toHaveValue('');

  await page.reload();
  await expect(page.locator('textarea')).toHaveValue('');
});

// ─── Resume handoff ──────────────────────────────────────────────────────────

test('a stashed job prefills the analyser and auto-selects the saved CV', async ({ page }) => {
  await auth(page);
  await stash(page, 'resume', JOB);
  await stubResumeApi(page, SAVED_CV);
  await page.goto('/upload-resume?fromJob=resume');

  // Job description and title both arrive — the backend rejects a description
  // without a title, so a missing title would strand the user on an alert.
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
  await expect(page.getByPlaceholder(/MLOps Engineer/i)).toHaveValue(JOB.title);

  await expect(page.getByText('Using your saved CV')).toBeVisible();
  await expect(page.getByText(SAVED_CV.fileName)).toBeVisible();
  await expect(page.getByRole('button', { name: /start ai analysis/i })).toBeVisible();

  // The reported bug: the description appeared, then a remount wiped it a
  // moment later. It has to still be here after the page settles, and after a
  // reload.
  await page.waitForTimeout(1000);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  await page.reload();
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
  await expect(page.getByPlaceholder(/MLOps Engineer/i)).toHaveValue(JOB.title);
});

test('dismissing the tailoring banner stops the job coming back', async ({ page }) => {
  await auth(page);
  await stash(page, 'resume', JOB);
  await stubResumeApi(page, SAVED_CV);
  await page.goto('/upload-resume?fromJob=resume');
  await expect(page.locator('textarea')).toHaveValue(JOB.description);

  await page.getByRole('button', { name: /clear this job/i }).click();
  await expect(page.locator('textarea')).toHaveValue('');

  await page.reload();
  await expect(page.locator('textarea')).toHaveValue('');
});

test('a saved CV whose file is gone asks for a re-upload instead', async ({ page }) => {
  await auth(page);
  await stash(page, 'resume', JOB);
  await stubResumeApi(page, { ...SAVED_CV, analyzable: false });
  await page.goto('/upload-resume?fromJob=resume');

  // Container disks are wiped on rebuild, so a row can outlive its file. Say so
  // rather than offering a one-click analysis that would fail.
  await expect(page.getByText(/no longer readable/i)).toBeVisible();
  await expect(page.getByText('Using your saved CV')).toHaveCount(0);
  await expect(page.getByText(/choose a file or drag/i)).toBeVisible();
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
});

test('no saved CV at all falls back to the upload box', async ({ page }) => {
  await auth(page);
  await stash(page, 'resume', JOB);
  await stubResumeApi(page, null);
  await page.goto('/upload-resume?fromJob=resume');

  await expect(page.getByText(/choose a file or drag/i)).toBeVisible();
  await expect(page.getByText('Using your saved CV')).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
});

test('the saved CV can be swapped for a different upload and back', async ({ page }) => {
  await auth(page);
  await stubResumeApi(page, SAVED_CV);
  await page.goto('/upload-resume');

  await expect(page.getByText('Using your saved CV')).toBeVisible();
  await page.getByRole('button', { name: /use a different cv/i }).click();
  await expect(page.getByText(/choose a file or drag/i)).toBeVisible();

  await page.getByRole('button', { name: /go back to my saved cv/i }).click();
  await expect(page.getByText('Using your saved CV')).toBeVisible();
});

// ─── The journey, as the user actually walks it ──────────────────────────────

test('both buttons appear on a substantial posting and carry it across', async ({ page }) => {
  await auth(page);
  await stubJobsFeed(page, [feedJob()]);
  await stubResumeApi(page, SAVED_CV);

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: JOB.title })).toBeVisible();
  await expect(page.getByRole('button', { name: /practice this interview/i })).toBeVisible();

  await page.getByRole('button', { name: /tailor my cv/i }).click();

  await expect(page).toHaveURL(/\/upload-resume/);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
  await expect(page.getByText('Using your saved CV')).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page.locator('textarea')).toHaveValue(JOB.description);
});

test('a short posting offers the interview but not the CV tailor', async ({ page }) => {
  await auth(page);
  await stubJobsFeed(page, [feedJob({ description: SHORT_DESCRIPTION })]);

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: JOB.title })).toBeVisible();

  // 24 characters clears the interview's 20 but not the analyser's 50, and the
  // backend would reject the shorter one outright.
  await expect(page.getByRole('button', { name: /practice this interview/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /tailor my cv/i })).toHaveCount(0);
});

test('a posting too thin for either offers no secondary action', async ({ page }) => {
  await auth(page);
  await stubJobsFeed(page, [feedJob({ description: 'Apply now.' })]);

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: JOB.title })).toBeVisible();
  await expect(page.getByRole('button', { name: /practice this interview/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /tailor my cv/i })).toHaveCount(0);
});
