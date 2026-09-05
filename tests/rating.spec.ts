/**
 * The rating, in a real browser.
 *
 * The backend gates prove the rubric and the API. This proves an operator can
 * state what a role screens on, and then read back WHY a candidate scored what
 * they scored — because a number nobody can interrogate is the thing the whole
 * rubric exists to replace.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  apiAs, createVerifiedUser, makeAdmin, sessionArg, sql, uniqueEmail, type TestUser,
} from './helpers/backend';

const JD = `We are hiring a Senior Frontend Engineer to own our React and TypeScript
interface layer end to end. You will lead the design system, hold the performance
budget and decide what ships. Five years of production React and real TypeScript.`;

const STRONG_CV = `SANA RIAZ — Senior Frontend Engineer

Senior Frontend Engineer, Northwind Labs
Jan 2019 – Present
Led the React and TypeScript interface layer. Owned the design system end to end.
Cut checkout latency by 40% and reduced bundle size 35%. Introduced testing and
continuous integration. Mentored 4 engineers.

EDUCATION
BSc Computer Science, 2016`;

const WEAK_CV = `INVOICE 449102
Bill to Acme Traders. Quantity three. Unit price fourteen dollars.
Payment due within thirty days. Registered office London.`;

let admin: TestUser;

test.beforeAll(async () => {
  const email = uniqueEmail('rating-ui-admin');
  admin = await createVerifiedUser('Rating UI Admin', email);
  makeAdmin(email);
});

async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(user));
}

const firstLine = (out: string) => out.trim().split('\n')[0].trim();

async function applicant(campaign: any, name: string, cvText: string) {
  const user = await createVerifiedUser(name, uniqueEmail('cand'));
  sql(
    'insert into resumes ("userId", "originalFileName", "filePath", "fileType", "fileSizeBytes", "isExtracted", "extractedText", "fileData") values (' +
      `'${user.userId}', 'cv.pdf', 'db://resume', 'pdf', 1024, true, $q$${cvText}$q$, ` +
      "decode('255044462d312e340a25','hex'))",
  );
  const res = await apiAs(user, `/campaigns/public/${campaign.slug}/claim`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.body.candidateId as string;
}

test('an operator can state what a role screens on', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns/new', { waitUntil: 'networkidle' });

  await page.getByTestId('field-title').fill('Senior Frontend Engineer');
  await page.getByTestId('field-company').fill('Northwind Labs');
  // Required location is what the form gates submit on.
  await page.getByTestId('field-location').fill('Remote');
  // The description is the only textarea on the create form.
  await page.locator('textarea').first().fill(JD);

  // Required skills, one chip at a time.
  const must = page.getByTestId('must-have-input');
  for (const skill of ['React', 'TypeScript', 'design systems']) {
    await must.fill(skill);
    await must.press('Enter');
  }
  await expect(page.getByTestId('must-have-chip')).toHaveCount(3);

  // Enter adds a chip; it must never submit the campaign.
  await expect(page).toHaveURL(/\/admin\/campaigns\/new/);

  // The same skill twice is one requirement, whatever the casing.
  await must.fill('react');
  await must.press('Enter');
  await expect(page.getByTestId('must-have-chip')).toHaveCount(3);

  await page.getByTestId('field-targetYears').fill('5');
  await page.getByTestId('field-workAuth').check();

  await page.getByTestId('create-submit').click();
  await page.waitForURL(/\/admin\/campaigns\/[0-9a-f-]+$/, { timeout: 20_000 });

  const id = page.url().split('/campaigns/')[1];
  expect(sql(`select "targetYears" from campaigns where id = '${id}'`)).toBe('5');
  expect(sql(`select "requiresWorkAuthorization" from campaigns where id = '${id}'`)).toBe('t');
  const skills = sql(`select "mustHaveSkills" from campaigns where id = '${id}'`);
  expect(skills).toContain('React');
  expect(skills).toContain('design systems');
});

test('choosing permanent-only warns about who it excludes', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns/new', { waitUntil: 'networkidle' });

  await expect(page.getByText(/normal way to have a career/i)).toHaveCount(0);
  await page.getByLabel('Freelance policy').click();
  await page.getByRole('option', { name: /Permanent roles only/ }).click();
  await expect(page.getByText(/normal way to have a career/i)).toBeVisible();
});

test('a reviewer can read why a candidate scored what they did', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Rated Role ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
      mustHaveSkills: ['React', 'TypeScript', 'design systems', 'testing'],
      targetYears: 5,
      seniority: 'senior',
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });

  const strong = await applicant(campaign, 'Sana Riaz', STRONG_CV);
  const weak = await applicant(campaign, 'Wrong File', WEAK_CV);

  const strongScore = Number(sql(`select "matchScore" from campaign_candidates where id='${strong}'`));
  const weakScore = Number(sql(`select "matchScore" from campaign_candidates where id='${weak}'`));
  expect(strongScore, 'a matching CV scores well').toBeGreaterThan(70);
  expect(weakScore, 'an invoice does not').toBeLessThan(35);

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });

  // Best match first, and the reasons are one click away.
  const rows = page.getByTestId('candidate-row');
  await expect(rows.first()).toContainText('Sana Riaz');

  await rows.first().getByTestId('why-score').click();
  const panel = page.getByTestId('fit-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Required skills');
  await expect(panel).toContainText('Relevant experience');
  await expect(panel, 'the years it read out of the CV').toContainText(/years counted/);
  await expect(panel, 'the skills it found').toContainText('React');
  await expect(panel).toContainText(/Evidenced:/);

  // The percentage sorts the list; the points are what a person reads. Two
  // scores out of 100 from roles of different detail are not the same fact.
  await expect(panel, 'raw points, not only a percentage').toContainText(/\d+(\.\d+)? of \d+/);
  await expect(page.getByTestId('fit-specificity')).toContainText(
    /stated \d+ of the \d+ things we can measure/,
  );
});

test('a vague role says its score is a weaker signal', async ({ page }) => {
  // No required skills, no target years, no seniority: the rubric can only
  // engage a fraction of itself, and the number should say so rather than
  // looking exactly as confident as a fully specified role.
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Vague Role ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });
  await applicant(campaign, 'Sana Riaz', STRONG_CV);

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });
  await page.getByTestId('why-score').first().click();

  const note = page.getByTestId('fit-specificity');
  await expect(note).toBeVisible();
  await expect(note, 'and it says what would sharpen it').toContainText(
    /Add required skills, target years or seniority/,
  );
});

test('a candidate who fails a hard requirement is marked, not buried', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Gated Role ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
      mustHaveSkills: ['React', 'TypeScript'],
      requiredCertifications: ['AWS Certified Solutions Architect'],
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });
  await applicant(campaign, 'Sana Riaz', STRONG_CV);

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });

  await expect(page.getByTestId('candidate-row')).toHaveCount(1);
  await expect(page.getByTestId('ineligible-badge')).toBeVisible();

  await page.getByTestId('why-score').click();
  const panel = page.getByTestId('fit-panel');
  await expect(panel).toContainText(/Does not meet a stated requirement/);
  await expect(panel).toContainText(/AWS Certified Solutions Architect/);
  await expect(panel, 'and it is not a rejection').toContainText(/stay on the list/i);
});

test('the campaign says who is still waiting to hear', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Waiting Role ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
      mustHaveSkills: ['React', 'TypeScript', 'design systems'],
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });
  await applicant(campaign, 'Wrong File', WEAK_CV);

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });

  // Silence is the easiest thing in a pipeline to let happen by accident, so
  // the count is on the screen rather than in someone's memory.
  const banner = page.getByTestId('waiting-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/still waiting to hear/);
  await expect(banner, 'and it says what releases the news').toContainText(/close this campaign/i);
});

test('the calibration panel appears once there is enough to measure', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Calibration UI ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
      mustHaveSkills: ['React', 'TypeScript'],
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });

  // Five scored candidates is the floor below which a rate is noise.
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) ids.push(await applicant(campaign, `Strong ${i}`, STRONG_CV));
  for (let i = 0; i < 2; i++) await applicant(campaign, `Weak ${i}`, WEAK_CV);
  await apiAs(admin, `/admin/campaigns/${campaign.id}/shortlist`, {
    method: 'POST',
    body: JSON.stringify({ candidateIds: ids.slice(0, 2) }),
  });

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });

  const panel = page.getByTestId('calibration-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Is the scoring working?');
  await expect(panel, 'the bands are shown, not just a verdict').toContainText('80-100');
  await expect(panel, 'and it never claims to have changed anything').toContainText(
    /never auto-applied/i,
  );
});

test('a link can be read into the job description box', async ({ page }) => {
  const candidate = await createVerifiedUser('Link User', uniqueEmail('linkui'));
  await signIn(page, candidate);
  await page.goto('/upload-resume', { waitUntil: 'networkidle' });

  const url = page.getByTestId('job-url-input');
  await expect(url, 'the link box sits with the description, not on another screen').toBeVisible();

  // A page that is not a job advert must be refused in words, never scored
  // against silently.
  await page.route('**/api/me/readiness/job-from-url', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message:
          'That looks like a list of jobs rather than one job. Open the role itself and use that link. Copy the description text and paste it here instead.',
      }),
    }),
  );
  await url.fill('https://example.com/jobs');
  await page.getByTestId('job-url-fetch').click();

  const note = page.getByTestId('job-url-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText(/list of jobs rather than one job/);
  await expect(page.locator('textarea').first(), 'and nothing is scored against').toHaveValue('');

  // A real posting fills the box, so the person can see what will be compared.
  await page.unroute('**/api/me/readiness/job-from-url');
  await page.route('**/api/me/readiness/job-from-url', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Senior Frontend Engineer',
        company: 'Northwind Labs',
        location: 'Berlin',
        description: 'We are hiring a Senior Frontend Engineer. 5+ years of React required.',
        source: 'structured',
        confidence: 'certain',
        url: 'https://example.com/jobs/1',
      }),
    }),
  );
  await url.fill('https://example.com/jobs/1');
  await page.getByTestId('job-url-fetch').click();

  await expect(page.locator('textarea').first()).toHaveValue(/Senior Frontend Engineer/);
  await expect(note).toContainText('Northwind Labs');
  await expect(note, 'and it says how sure the read was').toContainText(/posting data/i);
});

test('the email links open ready for the role you applied to', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Prefill Role ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });

  const candidate = await createVerifiedUser('Prefill User', uniqueEmail('prefill'));
  await signIn(page, candidate);

  // "Practise this interview" — the description is filled in, and it is clearly
  // practice rather than the employer's own interview.
  await page.goto(`/mock-interview?role=${campaign.slug}`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Practice', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: campaign.title })).toBeVisible();
  await expect(page.getByText(/not the employer/i)).toBeVisible();
  await expect(page.locator('textarea').first()).toHaveValue(/own our React and TypeScript/);

  // And it stays a practice run: every control is still there.
  await expect(page.getByText('Quick Screen')).toBeVisible();
  await expect(page.getByText('Full Interview')).toBeVisible();

  // "Sharpen your CV" — same role, the analysis box filled in.
  await page.goto(`/upload-resume?role=${campaign.slug}`, { waitUntil: 'networkidle' });
  await expect(page.locator('textarea').first()).toHaveValue(/own our React and TypeScript/, {
    timeout: 20_000,
  });
  await expect(page.getByTestId('arrived-for-role')).toContainText(campaign.title);
});

test('arriving from the email with a CV on file is one press', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `One Press ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });

  // Somebody who applied has a CV on file — that is what "applied" means.
  const candidate = await createVerifiedUser('Has A CV', uniqueEmail('hascv'));
  sql(
    'insert into resumes ("userId", "originalFileName", "filePath", "fileType", "fileSizeBytes", "isExtracted", "extractedText", "fileData") values (' +
      `'${candidate.userId}', 'MyCV.pdf', 'db://resume', 'pdf', 1024, true, ` +
      "$q$React TypeScript design systems testing accessibility$q$, " +
      "decode('255044462d312e340a25','hex'))",
  );

  await signIn(page, candidate);
  await page.goto(`/upload-resume?role=${campaign.slug}`, { waitUntil: 'networkidle' });

  const note = page.getByTestId('arrived-for-role');
  await expect(note).toBeVisible({ timeout: 20_000 });
  await expect(note, 'both halves are ready and it says so').toContainText(/one press/i);
  await expect(page.getByText('Using your saved CV')).toBeVisible();
  await expect(page.locator('textarea').first()).toHaveValue(/own our React and TypeScript/);
});

test('an unknown role in the link is ignored, not an error', async ({ page }) => {
  const candidate = await createVerifiedUser('Bad Link', uniqueEmail('badlink'));
  await signIn(page, candidate);

  // An old email, a closed campaign, a mistyped link. Carrying on with an empty
  // box loses nothing that was not already missing.
  await page.goto('/mock-interview?role=does-not-exist-at-all', { waitUntil: 'networkidle' });
  await expect(page.getByText(/Paste a job description/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('textarea').first()).toHaveValue('');
});
