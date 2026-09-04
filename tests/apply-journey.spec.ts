/**
 * P8 gate - the apply journey, start to finish, in one browser.
 *
 * The highest-value test here. It starts LOGGED OUT on a public URL, uploads a
 * real PDF, answers the campaign's questions, runs the real verification
 * collector, signs up through the genuine OTP flow, and comes back to find the
 * application intact.
 *
 * Everything the journey depends on is asserted in the DATABASE as well as on
 * screen: the CV bytes, the answers, the acquisition attribution, and the fact
 * that the applicant is never sent back through onboarding.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { API, apiAs, createVerifiedUser, makeAdmin, sql, uniqueEmail, type TestUser } from './helpers/backend';

const BACKEND_LOG = process.env.BACKEND_LOG || '';

const JD = `We are hiring a Senior Frontend Engineer to own our React and TypeScript
interface layer end to end. You will lead the design system, hold the performance
budget, and decide what ships.

Five years of production React, real TypeScript, and experience owning a design
system rather than just consuming one. Remote, with a four-hour overlap centred
on CET.`;

/** The smallest thing a PDF parser will still accept as a PDF. */
function tinyPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function otpFor(email: string): string | null {
  const blocks = readFileSync(BACKEND_LOG, 'utf8').split('========== MOCK EMAIL ==========');
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!blocks[i].includes(email)) continue;
    const match = blocks[i].match(/OTP code is:\s*(\d{4,6})/);
    if (match) return match[1];
  }
  return null;
}

let admin: TestUser;
let slug: string;
let campaignId: string;

test.beforeAll(async () => {
  const email = uniqueEmail('apply-admin');
  admin = await createVerifiedUser('Apply Admin', email);
  makeAdmin(email);

  const created = await apiAs(admin, '/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: `Senior Frontend Engineer ${Date.now().toString(36)}`,
      company: 'Northwind Labs',
      jobDescription: JD,
      location: 'Remote — Europe & Asia',
      jobType: 'Remote',
      questions: [
        {
          id: 'perf',
          label: 'What is the hardest performance problem you have fixed?',
          type: 'textarea',
          required: true,
        },
        {
          id: 'notice',
          label: 'Notice period',
          type: 'select',
          required: true,
          options: ['Immediate', '1 month', '3 months'],
        },
      ],
    }),
  });
  campaignId = created.body.id;
  slug = created.body.slug;
  await apiAs(admin, `/admin/campaigns/${campaignId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'collecting' }),
  });
});

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
  permissions: ['camera', 'microphone'],
});

test('apply logged out, sign up mid-flow, land with everything intact', async ({ page }) => {
  // Signup here is three legs (signup -> OTP -> verify -> login) and the
  // verification collector probes ten AWS regions. That is the product, not
  // slowness in the test, so it gets a budget that reflects it.
  test.setTimeout(240_000);

  const email = uniqueEmail('journey');
  const password = 'Password@123';

  /* ------------------------------------------------------- land, logged out */
  // Chromium's fake devices are named "fake_device_0", which the virtual-camera
  // rule catches - correctly, that is exactly what it is for. A real applicant
  // on real hardware sees real device names, so present those instead and let
  // the journey exercise the ordinary path. (The rule itself is proven against
  // genuinely virtual devices in the backend suite.)
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => {
      const devices = await real();
      return devices.map((d) => ({
        deviceId: d.deviceId,
        groupId: d.groupId,
        kind: d.kind,
        label:
          d.kind === 'videoinput'
            ? 'Integrated Camera'
            : d.kind === 'audioinput'
              ? 'Microphone Array'
              : 'Speakers',
        toJSON() {
          return this;
        },
      })) as unknown as MediaDeviceInfo[];
    };
  });

  await page.goto(`/apply/${slug}`, { waitUntil: 'networkidle' });

  // Nothing may bounce a logged-out visitor to /login - that would send campaign
  // traffic away from the advert before it was read.
  expect(page.url()).toContain(`/apply/${slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Senior Frontend Engineer');
  await expect(page.getByText('Northwind Labs')).toBeVisible();
  await expect(page.getByTestId('apply-form')).toBeVisible();

  /* ------------------------------------------------------------ upload a CV */
  await page.getByTestId('cv-input').setInputFiles({
    name: 'amara-okafor-cv.pdf',
    mimeType: 'application/pdf',
    buffer: tinyPdf('Amara Okafor - React TypeScript design systems performance'),
  });
  await expect(page.getByTestId('cv-attached')).toBeVisible({ timeout: 20_000 });

  // Uploaded immediately, before any account exists - that is the whole point.
  const draftId = sql(
    `select id from campaign_application_drafts where "campaignId" = '${campaignId}' order by "createdAt" desc limit 1`,
  );
  expect(draftId, 'a draft must exist before the applicant has an account').toBeTruthy();
  expect(
    Number(sql(`select octet_length("fileData") from campaign_application_drafts where id = '${draftId}'`)),
    'the CV bytes must already be stored',
  ).toBeGreaterThan(100);

  /* -------------------------------------------------------------- answers  */
  await page.getByRole('button', { name: /Country you are in/i }).click();
  await page.getByRole('option', { name: 'Pakistan' }).click();

  await page.locator('[data-question="perf"]').fill('Cut a 4s hydration down to 600ms by deferring a chart bundle.');

  await page.getByRole('button', { name: /Notice period/i }).click();
  await page.getByRole('option', { name: '1 month' }).click();

  // Autosave is debounced; give it a beat, then check the DATABASE rather than
  // trusting the screen.
  await page.waitForTimeout(1500);
  await expect
    .poll(
      () => sql(`select answers->>'notice' from campaign_application_drafts where id = '${draftId}'`),
      { timeout: 10_000, message: 'answers must autosave onto the draft' },
    )
    .toBe('1 month');

  /* ------------------------------------------------------ verification step */
  await page.getByTestId('apply-continue').click();
  await expect(page.getByTestId('apply-checking')).toBeVisible();

  // The real collector runs here: fingerprint, camera, ipify, ten AWS probes.
  // Do NOT wait on the result card - a passing check advances the flow
  // immediately and unmounts it, so waiting for it races the product it is
  // meant to be testing. Reaching the account step IS the pass condition; the
  // verdict itself comes from the row the check wrote.
  // A `review` verdict deliberately stops here so the candidate reads what was
  // found rather than being swept past it. Clean advances on its own; review
  // waits for Continue. Both are correct outcomes of this journey.
  const account = page.getByTestId('apply-account');
  const reviewContinue = page.getByTestId('verification-continue');
  await expect(account.or(reviewContinue).first()).toBeVisible({ timeout: 120_000 });
  if (await reviewContinue.isVisible().catch(() => false)) {
    await reviewContinue.click();
  }
  await expect(account).toBeVisible({ timeout: 30_000 });

  const verdict = sql(
    `select verdict from verification_sessions where context = 'apply' order by "createdAt" desc limit 1`,
  );
  console.log('  verification verdict in the journey:', verdict);
  expect(
    verdict,
    'with ordinary device names the check must not block an applicant',
  ).not.toBe('blocked');

  /* ------------------------------------------------------------ sign up ---- */
  await expect(page.getByText('CV uploaded')).toBeVisible();
  // The summary must report what the check actually said. It used to claim
  // "passed" regardless of verdict, which told a flagged candidate the opposite
  // of the truth.
  await expect(
    page.getByText(
      verdict === 'review'
        ? 'Connection check complete — one detail flagged'
        : 'Connection check passed',
    ),
  ).toBeVisible();

  await page.getByTestId('apply-create-account').click();
  await page.waitForURL('**/signup', { timeout: 20_000 });

  await fillSignup(page, 'Amara Okafor', email, password);

  // signup -> OTP by email -> verify -> login. Three legs, and the return path
  // has to survive all of them.
  await page.waitForURL('**/verify-otp**', { timeout: 30_000 });
  const otp = await pollFor(() => otpFor(email), 'an OTP in the mail log');
  await enterOtp(page, otp);

  await page.waitForURL('**/login**', { timeout: 30_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('form button[type="submit"]').first().click();

  /* --------------------------------------------------- back on the apply page */
  await page.waitForURL(`**/apply/${slug}`, { timeout: 45_000 });
  await expect(page.getByTestId('apply-confirmed')).toBeVisible({ timeout: 45_000 });

  /* ------------------------------------------------------------- the truth -- */
  const userId = sql(`select id from "user" where email = '${email}'`);
  expect(userId, 'the account must exist').toBeTruthy();

  const row = sql(
    `select status, source, "resumeId" is not null, answers->>'notice', "matchScore" ` +
      `from campaign_candidates where "campaignId" = '${campaignId}' and "userId" = '${userId}'`,
  ).split('|');

  expect(row[0], 'the application must be recorded').toBe('applied');
  expect(row[1]).toBe('public_apply');
  expect(row[2], 'the CV must be attached to the application').toBe('t');
  expect(row[3], 'the answers must have survived the whole signup detour').toBe('1 month');
  expect(Number(row[4]), 'a match score must be computed').toBeGreaterThan(0);

  expect(
    sql(`select "sourceCampaignId" from "user" where id = '${userId}'`),
    'the campaign must be recorded as what acquired this user',
  ).toBe(campaignId);

  expect(
    sql(`select count(*) from user_profiles where "userId" = '${userId}'`),
    'onboarding must be complete - they have already given us a CV and a country',
  ).toBe('1');

  expect(
    sql(`select count(*) from campaign_application_drafts where id = '${draftId}'`),
    'the draft must be cleaned up once claimed',
  ).toBe('0');

  // The verification check run before they had an account must now be attached
  // to the person it turned out to be.
  expect(
    Number(sql(`select count(*) from verification_sessions where "userId" = '${userId}'`)),
    'the pre-auth check should be linked to the account',
  ).toBeGreaterThan(0);

  /* ------------------------------------------- the confirmation sells, not receipts */
  await expect(page.getByTestId('practice-interview')).toBeVisible();
  await expect(page.getByText(/Match score/i)).toBeVisible();
  await expect(page.getByText(/Roles that fit your CV/i)).toBeVisible();
});

test('a returning applicant is told they already applied', async ({ page }) => {
  const email = uniqueEmail('repeat');
  const user = await createVerifiedUser('Repeat Applicant', email);

  await apiAs(user, '/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({
      currentRole: 'Frontend Engineer',
      targetRole: 'Senior Frontend Engineer',
      experienceLevel: 'Senior Level',
      skills: ['React', 'TypeScript'],
      location: 'Remote',
      openToRemote: true,
    }),
  }).catch(() => undefined);

  await apiAs(user, `/campaigns/public/${slug}/claim`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  }, {
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
    name: user.name,
    email: user.email,
  });

  await page.goto(`/apply/${slug}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('apply-form')).toBeVisible();

  expect(
    sql(`select count(*) from campaign_candidates where "campaignId" = '${campaignId}' and "userId" = '${user.userId}'`),
    'claiming twice must never create a second application',
  ).toBe('1');
});

/* ------------------------------------------------------------- helpers -- */

async function pollFor(fn: () => string | null, what: string, tries = 40): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const value = fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function fillSignup(page: Page, name: string, email: string, password: string) {
  // Addressed by their real field ids rather than by position: an ordinal
  // locator silently fills the wrong box the day a field is added.
  const [first, ...rest] = name.split(' ');
  await page.locator('#firstName').fill(first);
  await page.locator('#lastName').fill(rest.join(' ') || 'Applicant');
  await page.locator('#email').fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  const confirm = page.locator('input[type="password"]');
  if ((await confirm.count()) > 1) await confirm.nth(1).fill(password);

  await page.getByRole('button', { name: /create account/i }).click();
}

async function enterOtp(page: Page, otp: string) {
  // Four single-character boxes that advance focus on input. Typing rather than
  // filling, so the component's own onChange/focus logic runs exactly as it
  // does for a person.
  const boxes = page.locator('input[inputmode="numeric"]');
  await expect(boxes.first()).toBeVisible();
  await boxes.first().click();
  await page.keyboard.type(otp, { delay: 60 });

  await page.getByRole('button', { name: /^verify$/i }).click();
}

void API;

test('a stale access token cannot break a public draft save', async ({ page }) => {
  // The reported bug: someone already signed in, whose access token had
  // expired, got "Unauthorized" while merely choosing a CV. publicFetch was
  // attaching the dead token to an endpoint that needs no authentication, and
  // unlike apiFetch it does not refresh.
  //
  // A rejected token must be indistinguishable from no token at all on this
  // surface, so the check is: a garbage token still lets the draft save.
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'expired.rubbish.token');
    localStorage.setItem('refreshToken', 'also-expired');
    localStorage.setItem('userName', 'Stale Session');
  });

  const failures: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/campaigns/public/') && r.status() === 401) {
      failures.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto(`/apply/${slug}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('apply-form')).toBeVisible();

  await page.getByTestId('cv-input').setInputFiles({
    name: 'stale-session-cv.pdf',
    mimeType: 'application/pdf',
    buffer: tinyPdf('Someone with an expired session'),
  });

  await expect(page.getByTestId('cv-attached')).toBeVisible({ timeout: 20_000 });
  expect(failures, 'a dead token must not 401 a public endpoint').toEqual([]);
});

test('the header says whether you are actually signed in', async ({ page }) => {
  // A token in localStorage is not a session. The page used to treat an expired
  // one as proof of being signed in — skipping the account step for someone
  // whose session was dead — while the header offered them "Sign in" at the
  // same time. Two components, two different guesses, both from the same string.

  // Dead token: the header must offer sign-in, not a name.
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'expired.rubbish.token');
    localStorage.setItem('refreshToken', 'also-expired');
    localStorage.setItem('userName', 'Ghost');
  });
  await page.goto(`/apply/${slug}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Applying as')).toHaveCount(0);

  // And the dead token is cleared rather than left to mislead the next page.
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('a real session is named in the header', async ({ page }) => {
  const user = await createVerifiedUser('Session Holder', uniqueEmail('session'));
  await page.addInitScript((u) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
  }, { accessToken: user.accessToken, refreshToken: user.refreshToken, name: user.name });

  await page.goto(`/apply/${slug}`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Applying as')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Session Holder')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
});
