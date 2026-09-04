/**
 * The campaign flow repairs, in a real browser.
 *
 * The backend gate (scripts/e2e/p12-flow-repairs.mjs) proves the rules hold.
 * This proves an operator and a candidate can actually reach them: a rule the
 * UI never surfaces is a rule people meet as a red toast after the damage.
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

const JD = `We are hiring a Backend Engineer for payments. You will own the ledger,
the reconciliation jobs and the money-movement APIs. Strong SQL, Node or Go, and
the temperament to be careful with other people's money. Remote, worldwide.`;

const OTHER_JD = `We need a Warehouse Operations Manager for our Karachi
distribution centre. Shift rotas, stock accuracy, health and safety. Forklift
certification and five years of logistics experience. On site, six days a week.`;

let admin: TestUser;
let candidate: TestUser;

test.beforeAll(async () => {
  const adminEmail = uniqueEmail('flow-ui-admin');
  admin = await createVerifiedUser('Flow UI Admin', adminEmail);
  makeAdmin(adminEmail);
  candidate = await createVerifiedUser('Priya Raman', uniqueEmail('flow-ui-cand'));
});

async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(user));
}

async function makeCampaignWithApplicant() {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Flow Role ${Date.now().toString(36)}`,
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
  return { campaign, candidateId };
}

test('actions the selection cannot take are disabled, with the reason', async ({ page }) => {
  const { campaign, candidateId } = await makeCampaignWithApplicant();
  // Someone who has already sat the interview.
  sql(
    `update campaign_candidates set status = 'completed', "completedAt" = now() where id = '${candidateId}'`,
  );

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });
  await page.getByTestId('view-completed').click();
  await page.getByTestId('candidate-row').first().getByRole('checkbox').check();

  await expect(page.getByTestId('bulk-actions')).toBeVisible();
  await expect(
    page.getByTestId('action-invite'),
    'inviting somebody who already interviewed mails them a link that dies on arrival',
  ).toBeDisabled();

  // And it says why, naming the person rather than a count.
  const reason = page.getByTestId('action-blocked-reason');
  await expect(reason).toBeVisible();
  await expect(reason).toContainText('Priya Raman');

  // Submitting a completed candidate is the normal next step, so it stays open.
  await expect(page.getByTestId('action-submit')).toBeEnabled();
});

test('submitting a CV does not break that candidate\'s live interview', async ({ page }) => {
  const { campaign, candidateId } = await makeCampaignWithApplicant();
  await apiAs(admin, `/admin/campaigns/${campaign.id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ candidateIds: [candidateId] }),
  });

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });
  await page.getByTestId('view-invited').click();
  await page.getByTestId('candidate-row').first().getByRole('checkbox').check();
  await page.getByTestId('action-submit').click();
  await expect(page.getByText(/→ submitted/)).toBeVisible({ timeout: 15_000 });

  expect(sql(`select status from campaign_candidates where id = '${candidateId}'`)).toBe(
    'submitted',
  );

  // The candidate's own page still offers the interview.
  const fresh = await page.context().newPage();
  await signIn(fresh, candidate);
  await fresh.goto('/interviews', { waitUntil: 'networkidle' });
  // Scoped by title: this candidate is shared across the file and collects an
  // invitation per test.
  const row = fresh.getByTestId('invitation-row').filter({ hasText: campaign.title });
  await expect(row).toHaveAttribute('data-state', 'open');
  await expect(row.getByTestId('open-invitation')).toBeVisible();
  await fresh.close();
});

test('a candidate who lost the email can open the interview themselves', async ({ page }) => {
  const { campaign, candidateId } = await makeCampaignWithApplicant();
  await apiAs(admin, `/admin/campaigns/${campaign.id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ candidateIds: [candidateId] }),
  });
  const originalHash = sql(
    `select "inviteTokenHash" from campaign_candidates where id = '${candidateId}'`,
  );

  await signIn(page, candidate);
  await page.goto('/interviews', { waitUntil: 'networkidle' });

  const row = page.getByTestId('invitation-row').filter({ hasText: campaign.title });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Northwind Labs');

  await row.getByTestId('open-invitation').click();
  await page.waitForURL(/\/interview\/[^/]+$/, { timeout: 20_000 });

  // A genuinely new credential, and the old one is dead.
  const newHash = sql(`select "inviteTokenHash" from campaign_candidates where id = '${candidateId}'`);
  expect(newHash).not.toBe(originalHash);

  // And it lands on the real invite gate for the right role.
  await expect(page.getByText(campaign.title)).toBeVisible({ timeout: 20_000 });
});

test('an expired invitation explains itself instead of vanishing', async ({ page }) => {
  const { campaign, candidateId } = await makeCampaignWithApplicant();
  await apiAs(admin, `/admin/campaigns/${campaign.id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ candidateIds: [candidateId] }),
  });
  sql(
    `update campaign_candidates set "inviteExpiresAt" = now() - interval '1 day' where id = '${candidateId}'`,
  );

  await signIn(page, candidate);
  await page.goto('/interviews', { waitUntil: 'networkidle' });

  const row = page.getByTestId('invitation-row').filter({ hasText: campaign.title });
  await expect(row).toHaveAttribute('data-state', 'expired');
  await expect(row).toContainText(/closed before it was taken/i);
  await expect(row.getByTestId('open-invitation')).toHaveCount(0);
});

test('stale scores can be cleared from the screen that flags them', async ({ page }) => {
  const { campaign, candidateId } = await makeCampaignWithApplicant();

  // A material edit: every existing score is now answering the wrong question.
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ jobDescription: OTHER_JD }),
  });
  expect(sql(`select "scoreStale" from campaign_candidates where id = '${candidateId}'`)).toBe('t');

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-stale="true"]').first()).toBeVisible();
  const rescore = page.getByTestId('rescore-campaign');
  await expect(rescore, 'the button appears only when there is something stale').toBeVisible();

  await rescore.click();
  await expect(page.getByText(/rescored/i)).toBeVisible({ timeout: 20_000 });

  expect(sql(`select "scoreStale" from campaign_candidates where id = '${candidateId}'`)).toBe('f');
  await expect(page.getByTestId('rescore-campaign')).toHaveCount(0);
});

test('an operator is warned when invitation links point at another site', async ({ page }) => {
  const { campaign } = await makeCampaignWithApplicant();
  await signIn(page, admin);

  // The backend stamps http://localhost:3000 into links, which is where this
  // test's browser is — so no warning is correct here.
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('delivery-banner')).toHaveCount(0);

  // Now answer as a backend configured to mail links to a different deployment.
  await page.route('**/api/admin/campaigns/diagnostics', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        inviteLinkExample: 'https://some-other-deployment.vercel.app/interview/EXAMPLE-TOKEN',
        frontendUrl: 'https://some-other-deployment.vercel.app',
        mail: { smtp: 'verified', host: 'smtp.example.com', error: null },
        canDeliverInvitations: true,
      }),
    }),
  );
  await page.reload({ waitUntil: 'networkidle' });

  const banner = page.getByTestId('delivery-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('point at a different site');
  await expect(banner, 'it names both origins, so the fix is obvious').toContainText(
    'some-other-deployment.vercel.app',
  );
  await expect(banner).toContainText('localhost:3000');
});
