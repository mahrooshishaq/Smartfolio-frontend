/**
 * The funnel, in a real browser.
 *
 * The backend gate proves the arithmetic. This proves an admin can look at a
 * campaign and see where people stopped, because a funnel nobody can read is
 * the same as no funnel at all.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  API, apiAs, createVerifiedUser, makeAdmin, sessionArg, uniqueEmail, type TestUser,
} from './helpers/backend';

let admin: TestUser;

test.beforeAll(async () => {
  const email = uniqueEmail('funnel-admin');
  admin = await createVerifiedUser('Funnel Admin', email);
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

/** A beacon, exactly as the browser sends it: no token, no cookie. */
async function beacon(slug: string, anonymousId: string, step: string) {
  await fetch(`${API}/telemetry/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonymousId, campaignSlug: slug, steps: [step] }),
  });
}

test('a campaign shows where people stopped', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Funnel ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: 'Senior Frontend Engineer. React and TypeScript.',
      location: 'Remote',
    }),
  });
  const campaign = created.body;
  await apiAs(admin, `/admin/campaigns/${campaign.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });

  // Ten open it, five upload, two answer, one submits. A bad campaign, which
  // is the only kind worth being able to see.
  const who = (i: number) => `ui-${campaign.id.slice(0, 8)}-${i}`;
  for (let i = 0; i < 10; i++) await beacon(campaign.slug, who(i), 'opened');
  for (let i = 0; i < 5; i++) await beacon(campaign.slug, who(i), 'cv_uploaded');
  for (let i = 0; i < 2; i++) await beacon(campaign.slug, who(i), 'details_completed');
  await beacon(campaign.slug, who(0), 'submitted');

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${campaign.id}`, { waitUntil: 'networkidle' });

  const panel = page.getByTestId('funnel-panel');
  await expect(panel).toBeVisible();

  // The headline is the biggest fall, named, because that is the only number
  // that changes what somebody does this week.
  await expect(panel, 'the worst step is named, not left to be found').toContainText(
    'Uploaded a CV',
  );
  await expect(panel).toContainText('5 people');

  await expect(page.getByTestId('funnel-opened')).toContainText('10');
  await expect(page.getByTestId('funnel-cv_uploaded')).toContainText('5');
  await expect(page.getByTestId('funnel-details_completed')).toContainText('2');
  await expect(page.getByTestId('funnel-submitted')).toContainText('1');

  // Each stage says how many left it, which is the actual question.
  await expect(page.getByTestId('funnel-cv_uploaded')).toContainText('5 left here');

  await expect(panel, 'and it says plainly what it is counting').toContainText(
    'Counted per browser',
  );
});

test('a campaign nobody has opened shows nothing rather than zeroes', async ({ page }) => {
  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Quiet ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: 'Senior Frontend Engineer.',
      location: 'Remote',
    }),
  });

  await signIn(page, admin);
  await page.goto(`/admin/campaigns/${created.body.id}`, { waitUntil: 'networkidle' });

  // A funnel of zeroes reads as "nobody applied" rather than "nothing has been
  // recorded yet", and those are very different things to tell somebody.
  await expect(page.getByTestId('funnel-panel')).toHaveCount(0);
});
