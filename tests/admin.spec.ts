/**
 * P7 gate - the admin UI, driven in a real browser against the real API.
 *
 * The whole operator loop end to end: create a campaign, open it, run matching,
 * shortlist, invite. Between the steps it checks the DATABASE, because the
 * screen showing a badge is not proof that anything was written.
 *
 * It also proves the gate twice over. The layout's redirect is convenience; the
 * API's RolesGuard is the actual boundary, and a candidate has to be refused by
 * BOTH - a UI that merely hides the buttons is not access control.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  API,
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

let admin: TestUser;
let candidate: TestUser;

test.beforeAll(async () => {
  const adminEmail = uniqueEmail('ui-admin');
  admin = await createVerifiedUser('UI Admin', adminEmail);
  makeAdmin(adminEmail);
  candidate = await createVerifiedUser('UI Candidate', uniqueEmail('ui-candidate'));
});

async function signIn(page: Page, user: TestUser) {
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, sessionArg(user));
}

test('an admin can create a campaign, match, shortlist and invite', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();

  /* -------------------------------------------------------------- create */
  const title = `Backend Engineer ${Date.now().toString(36)}`;
  await page.getByTestId('new-campaign').click();
  // Creation is its own page - a half-written job description must not be one
  // stray click away from being lost.
  await page.waitForURL('**/admin/campaigns/new');
  await expect(page.getByRole('heading', { name: 'New campaign' })).toBeVisible();
  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-company').fill('Klaxon');
  await page.getByTestId('field-location').fill('Remote — worldwide');
  await page.getByTestId('field-jd').fill(JD);
  // A question, to prove the builder round-trips into the campaign.
  await page.getByTestId('add-question').click();
  await page.getByTestId('question-label').fill('Describe a reconciliation bug you have fixed.');

  await page.getByTestId('create-submit').click();

  await expect(page.getByText(/Its apply page will be \/apply\//)).toBeVisible({ timeout: 15_000 });

  const campaignId = sql(
    `select id from campaigns where title = '${title}' order by "createdAt" desc limit 1`,
  );
  expect(campaignId, 'the campaign must exist in the database').toBeTruthy();
  expect(sql(`select status from campaigns where id = '${campaignId}'`)).toBe('draft');
  expect(
    sql(`select jsonb_array_length(questions) from campaigns where id = '${campaignId}'`),
    'the question builder must persist its questions',
  ).toBe('1');

  /* --------------------------------------------------------------- open  */
  await page.goto(`/admin/campaigns/${campaignId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await page.getByTestId('open-applications').click();
  await expect(page.getByText(/Campaign is now collecting/)).toBeVisible({ timeout: 15_000 });
  expect(sql(`select status from campaigns where id = '${campaignId}'`)).toBe('collecting');

  /* --------------------------------------------------------------- match */
  // Seed a profile so matching has somebody to rank - the candidate account is
  // brand new and matching deliberately skips users with no profile rather than
  // scoring them zero.
  await apiAs(candidate, '/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({
      currentRole: 'Backend Engineer',
      targetRole: 'Backend Engineer',
      experienceLevel: 'Mid Level',
      skills: ['Node.js', 'SQL', 'Payments'],
      location: 'Remote',
      openToRemote: true,
    }),
  }).catch(() => undefined);

  await page.getByTestId('run-match').click();
  await expect(page.getByText(/Scored \d+ profiles/)).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: 'networkidle' });
  const rows = page.getByTestId('candidate-row');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const rowCount = await rows.count();
  expect(rowCount, 'matching should have put at least one candidate on the campaign').toBeGreaterThan(0);

  /* ----------------------------------------------------------- shortlist */
  await rows.first().getByRole('checkbox').check();
  await expect(page.getByTestId('bulk-actions')).toBeVisible();
  await page.getByTestId('action-shortlist').click();
  await expect(page.getByText(/→ shortlisted/)).toBeVisible({ timeout: 15_000 });

  const shortlisted = sql(
    `select count(*) from campaign_candidates where "campaignId" = '${campaignId}' and status = 'shortlisted'`,
  );
  expect(Number(shortlisted), 'the status must be written, not just rendered').toBeGreaterThan(0);

  /* -------------------------------------------------------------- invite */
  await page.reload({ waitUntil: 'networkidle' });
  // The interview deadline defaults to two weeks out when the campaign has none,
  // so an invite is issuable straight away.
  await page.getByTestId('candidate-row').first().getByRole('checkbox').check();
  await page.getByTestId('action-invite').click();

  // The confirm dialog is the platform one, never window.confirm.
  await expect(page.getByText(/Send 1 interview invitation/)).toBeVisible();
  await page.getByRole('button', { name: /Send invitations/i }).click();

  await expect(page.getByText(/invitation.? sent|sent,.*failed/i)).toBeVisible({ timeout: 30_000 });

  const hash = sql(
    `select "inviteTokenHash" from campaign_candidates where "campaignId" = '${campaignId}' and "inviteTokenHash" is not null limit 1`,
  );
  expect(hash, 'an invite hash must be stored').toHaveLength(64);
  expect(
    sql(
      `select count(*) from campaign_candidates where "campaignId" = '${campaignId}' and status = 'invited'`,
    ),
  ).not.toBe('0');
});

test('a candidate is refused by the UI and by the API', async ({ page }) => {
  await signIn(page, candidate);
  await page.goto('/admin/campaigns', { waitUntil: 'networkidle' });

  await expect(page.getByText('This area is for administrators')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toHaveCount(0);

  // The screen is convenience. This is the actual boundary.
  const direct = await apiAs(candidate, '/admin/campaigns');
  expect(direct.status, 'the API must refuse a candidate independently').toBe(403);
});

test('the verification screen loads its clusters and list health', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/verification', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible();
  await expect(page.getByText('Shared devices')).toBeVisible();

  // The threat lists must load — an empty one silently disables its rules. They
  // are fetched on boot and not awaited (the API must come up whether or not
  // GitHub and the Tor project are reachable), so poll rather than assert on a
  // single render: catching the app mid-boot is not a regression.
  const health = await expect
    .poll(
      async () => {
        const res = await fetch(`${API}/admin/verification/sessions`, {
          headers: { Authorization: `Bearer ${admin.accessToken}` },
        });
        const body = await res.json();
        return body.lists.torListSize > 0 && body.lists.dcRangeCount > 1000;
      },
      { timeout: 60_000, message: 'threat lists should populate after boot' },
    )
    .toBe(true)
    .then(async () =>
      fetch(`${API}/admin/verification/sessions`, {
        headers: { Authorization: `Bearer ${admin.accessToken}` },
      }).then((r) => r.json()),
    );

  expect(health.lists.torListSize).toBeGreaterThan(0);
  expect(health.lists.dcRangeCount).toBeGreaterThan(1000);

  // And the screen reports what the API holds. Asserted with a retrying
  // matcher, not a one-shot textContent: the label renders immediately while
  // the number arrives from a fetch, so reading once catches the zero state.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('Tor exits loaded').locator('..')).toContainText(/[1-9]/, {
    timeout: 20_000,
  });
});

test('the campaign form does not mangle what you type', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns/new', { waitUntil: 'networkidle' });

  const target = page.getByTestId('field-shortlist-target');

  // Reported: clearing the box showed 0, and typing into that 0 gave "013".
  // Coercing on every keystroke did it — a half-typed number is a string.
  await target.fill('');
  expect(await target.inputValue(), 'an empty box must stay empty while retyping').toBe('');
  await target.fill('13');
  expect(await target.inputValue(), 'no leading zero').toBe('13');

  // It settles only on blur, and only within the range the API accepts.
  await target.fill('');
  await target.blur();
  expect(await target.inputValue()).toBe('25');
  await target.fill('900');
  await target.blur();
  expect(await target.inputValue(), 'clamped to the API maximum').toBe('500');

  // The button states whether it will work, rather than accepting a click and
  // answering with a toast.
  await expect(page.getByTestId('create-submit')).toBeDisabled();
  await expect(page.getByText(/Needs a title, a company, a location/)).toBeVisible();

  await page.getByTestId('field-title').fill('Data Engineer');
  await page.getByTestId('field-company').fill('Loam');
  await page.getByTestId('field-location').fill('Remote — Pakistan and India');
  await page.getByTestId('field-jd').fill(JD);
  await expect(page.getByTestId('create-submit')).toBeEnabled();

  // Deadlines cannot be set in the past: a campaign whose window has already
  // closed is closed the moment it opens.
  const todayValue = new Date().toISOString().slice(0, 10);
  expect(await page.getByTestId('field-app-deadline').getAttribute('min')).toBe(todayValue);
});

test('country targeting is stored and drives matching', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns/new', { waitUntil: 'networkidle' });

  const title = `Country Targeted ${Date.now().toString(36)}`;
  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-company').fill('Ardent Systems');
  await page.getByTestId('field-location').fill('Remote — South Asia');
  await page.getByTestId('field-jd').fill(JD);

  // Free text cannot be matched on; this is the field that can.
  // The aria-label is stable; only the visible placeholder changes once a
  // country is chosen, so address it by the label both times.
  const addCountry = page.getByRole('button', { name: /Add a country this role can hire from/i });
  await addCountry.click();
  await page.getByRole('option', { name: 'Pakistan' }).click();
  await addCountry.click();
  await page.getByRole('option', { name: 'India' }).click();
  await expect(page.getByTestId('country-chip')).toHaveCount(2);

  await page.getByTestId('create-submit').click();
  await expect(page.getByText(/Its apply page will be/)).toBeVisible({ timeout: 15_000 });

  const stored = sql(
    `select "candidateCountries"::text from campaigns where title = '${title}' limit 1`,
  );
  expect(stored, 'the countries must persist').toContain('PK');
  expect(stored).toContain('IN');
});

test('a pick-from-a-list question takes real options', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns/new', { waitUntil: 'networkidle' });

  const title = `Options Test ${Date.now().toString(36)}`;
  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-company').fill('Loam');
  await page.getByTestId('field-location').fill('Remote');
  await page.getByTestId('field-jd').fill(JD);

  await page.getByTestId('add-question').click();
  await page.getByTestId('question-label').fill('Notice period');

  // "Choose one" read as an instruction to the admin rather than the answer
  // type. And the options were one comma-separated box, so there was no way to
  // tell you were meant to enter several.
  await page.getByRole('button', { name: /Answer type for question 1/i }).click();
  await page.getByRole('option', { name: 'Pick from a list' }).click();

  const options = page.getByTestId('question-option');
  await expect(options, 'switching to a list gives rows to fill').toHaveCount(2);
  await options.nth(0).fill('Immediate');
  await options.nth(1).fill('1 month');
  await page.getByTestId('add-option').click();
  await page.getByTestId('question-option').nth(2).fill('3 months');

  await page.getByTestId('create-submit').click();
  await expect(page.getByText(/Its apply page will be/)).toBeVisible({ timeout: 15_000 });

  const stored = sql(
    `select questions->0->>'options' from campaigns where title = '${title}' limit 1`,
  );
  expect(stored).toContain('Immediate');
  expect(stored).toContain('3 months');
  expect(stored, 'blank rows must not reach the applicant').not.toContain('""');
});

test('the country list is alphabetical, searchable, and offers Anywhere', async ({ page }) => {
  await signIn(page, admin);
  await page.goto('/admin/campaigns/new', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Add a country this role can hire from/i }).click();

  // "Anywhere" is an explicit choice, not the absence of one, and it leads.
  const rows = page.getByRole('option');
  await expect(rows.first()).toHaveText('Anywhere in the world');

  // Alphabetical. The old order was market priority, which tells the person
  // scanning for their own country nothing about where to look.
  const names = (await rows.allInnerTexts()).slice(1, 6);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

  // Searchable, because fifty countries is too many to scroll.
  await page.getByRole('textbox', { name: /Filter the list/i }).fill('paki');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toHaveText('Pakistan');
});
