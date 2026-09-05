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
