/**
 * The last leg: invitation link → check → interview.
 *
 * This is the part a candidate reaches after being shortlisted, and it was
 * dropping them onto the practice form — job description in an editable box,
 * three interview lengths to choose between, a seniority picker — after an
 * invitation that had promised a fixed three-round interview. The candidate
 * could pick a five-question Quick Screen for a role advertised as a full
 * interview, and the page called the whole thing a "Mock Interview" while it
 * was the thing their application rested on.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  apiAs,
  createVerifiedUser,
  makeAdmin,
  sessionArg,
  sql,
  uniqueEmail,
  type TestUser,
} from './helpers/backend';

const JD = `We are hiring a Senior Frontend Engineer to own our React and TypeScript
interface layer end to end. You will lead the design system, hold the performance
budget and decide what ships. Five years of production React and real TypeScript.`;

let admin: TestUser;
let candidate: TestUser;

test.beforeAll(async () => {
  const adminEmail = uniqueEmail('handoff-admin');
  admin = await createVerifiedUser('Handoff Admin', adminEmail);
  makeAdmin(adminEmail);
  candidate = await createVerifiedUser('Sana Iqbal', uniqueEmail('handoff-cand'));
});

async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(user));
}

async function invitedCandidate() {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Handoff Role ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote',
      interviewDeadline: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });
  await apiAs(candidate, `/campaigns/public/${campaign.slug}/claim`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const candidateId = sql(
    `select id from campaign_candidates where "campaignId" = '${campaign.id}' and "userId" = '${candidate.userId}'`,
  );
  await apiAs(admin, `/admin/campaigns/${campaign.id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ candidateIds: [candidateId] }),
  });
  return { campaign, candidateId };
}

test('the invitation states the length the interview is actually set to', async ({ page }) => {
  const { campaign, candidateId } = await invitedCandidate();
  await signIn(page, candidate);

  await page.goto('/interviews', { waitUntil: 'networkidle' });
  const row = page.getByTestId('invitation-row').filter({ hasText: campaign.title });
  await row.getByTestId('open-invitation').click();
  await page.waitForURL(/\/interview\/[^/]+$/, { timeout: 20_000 });

  // The promise on the gate has to match what the interview will really be.
  // "About 25 minutes" was copy no length tier could deliver — the longest is
  // fifteen questions at roughly fifteen minutes.
  await expect(page.getByText(/about 15 minutes/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/25 minutes/i)).toHaveCount(0);
  expect(candidateId).toBeTruthy();
});

test('an employer interview never shows the practice configuration form', async ({ page }) => {
  const { campaign } = await invitedCandidate();
  await signIn(page, candidate);

  // Straight to the handoff, standing in for the connection check having passed.
  await page.addInitScript(
    (payload) => sessionStorage.setItem('campaignInterview', JSON.stringify(payload)),
    {
      token: 'x'.repeat(30),
      candidateId: 'placeholder',
      campaignId: campaign.id,
      jobDescription: JD,
      role: campaign.title,
      company: 'Northwind Labs',
    },
  );

  await page.goto('/mock-interview?campaign=1', { waitUntil: 'domcontentloaded' });

  // It is named as what it is, not as practice.
  await expect(page.getByTestId('campaign-interview-badge')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('heading', { name: campaign.title })).toBeVisible();
  await expect(page.getByText('Northwind Labs').first()).toBeVisible();

  // And none of the practice controls are reachable.
  await expect(page.getByText('Quick Screen')).toHaveCount(0);
  await expect(page.getByText('Standard', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Full Interview')).toHaveCount(0);
  await expect(page.getByText(/Paste a job description/i)).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Start Over/i })).toHaveCount(0);
});

test('a practice interview keeps every control it had', async ({ page }) => {
  await signIn(page, candidate);
  await page.goto('/mock-interview', { waitUntil: 'networkidle' });

  // The campaign path must not have quietly taken the practice form with it.
  await expect(page.getByText(/Paste a job description/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Quick Screen')).toBeVisible();
  await expect(page.getByText('Full Interview')).toBeVisible();
  await expect(page.locator('textarea').first()).toBeVisible();
  await expect(page.getByTestId('campaign-interview-badge')).toHaveCount(0);
});

test('a campaign flag with no handoff explains itself instead of showing an empty form', async ({
  page,
}) => {
  await signIn(page, candidate);
  // No sessionStorage payload — a bookmarked URL, a cleared session, a new tab.
  await page.goto('/mock-interview?campaign=1', { waitUntil: 'domcontentloaded' });

  await page.waitForURL(/\/interviews/, { timeout: 20_000 });
  await expect(page.getByTestId('resume-notice')).toBeVisible();
  await expect(page.getByText(/Nothing is lost/i)).toBeVisible();
});
