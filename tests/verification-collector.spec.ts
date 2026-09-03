/**
 * P4 gate - the collector, in a real browser, against the real backend.
 *
 * This is the only test that exercises the thing candidates actually run:
 * fingerprinting, camera enumeration, ipify, ten AWS probes and the submit,
 * each inside its own budget. A unit test of the same code would prove nothing
 * - every interesting failure here comes from the browser refusing something
 * or the network not answering.
 *
 * The run happens from this machine, so the verdict depends on the real
 * connection. The assertions are therefore about the mechanism, not the
 * verdict: every step completes, the probes leave the browser, the session is
 * stored, and the signature behaves. The VPN case cannot be automated - it is
 * on the manual list.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PG = process.env.PG_CONTAINER || 'smartfolio-pg';

function sql(query: string): string {
  return execFileSync(
    'docker',
    ['exec', PG, 'psql', '-U', 'postgres', '-d', 'smartfolio', '-tA', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
  permissions: ['camera', 'microphone'],
});

test('a full check runs in the browser and is stored', async ({ page }) => {
  const before = Number(sql('select count(*) from verification_sessions'));

  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  const probeHosts = new Set<string>();
  page.on('request', (r) => {
    const host = new URL(r.url()).host;
    if (host.endsWith('amazonaws.com') || host.endsWith('ipify.org')) probeHosts.add(host);
  });

  // networkidle, not domcontentloaded: React has to hydrate before the
  // picker has a click handler at all. Clicking earlier hits static HTML and
  // silently does nothing, which reads as a broken selector.
  await page.goto('/verify', { waitUntil: 'networkidle' });

  // The country picker is the platform <Select>, not a native one - the whole
  // codebase deliberately avoids native selects, so drive it as a user would.
  await page.getByRole('button', { name: /country/i }).click();
  await page.getByRole('option', { name: 'Germany' }).click();
  await page.getByTestId('verify-begin').click();

  await expect(page.getByTestId('verification-running')).toBeVisible();

  const result = page.getByTestId('verification-result');
  await expect(result).toBeVisible({ timeout: 90_000 });

  const verdict = await result.getAttribute('data-verdict');
  expect(['clean', 'review', 'blocked']).toContain(verdict);
  console.log('  verdict from this machine:', verdict);

  // Probes must actually leave the browser - a CSP block would look like a
  // clean run with an empty latency map.
  expect([...probeHosts].some((h) => h.endsWith('amazonaws.com'))).toBe(true);

  expect(
    consoleErrors.filter((e) => /Content Security Policy|Refused to connect/i.test(e)),
  ).toEqual([]);

  const after = Number(sql('select count(*) from verification_sessions'));
  expect(after, 'the check must be persisted, not just answered').toBe(before + 1);

  const [storedVerdict, regionCount, signature, context] = sql(
    'select verdict, coalesce((select count(*) from jsonb_object_keys(latency)),0), ' +
      "coalesce(\"deviceSignature\",'none'), context " +
      'from verification_sessions order by "createdAt" desc limit 1',
  ).split('|');

  expect(storedVerdict).toBe(verdict);
  expect(context).toBe('apply');
  // Ten regions are probed; a headless machine on a normal connection reaches
  // most of them. Zero means the probes were blocked, which is the failure this
  // guards against.
  expect(Number(regionCount), 'at least one AWS region must have answered').toBeGreaterThan(0);
  console.log('  regions measured:', regionCount, '| signature:', signature);
});

test('every collector step reports a terminal state', async ({ page }) => {
  await page.goto('/verify', { waitUntil: 'networkidle' });

  // Recorded by a MutationObserver in the page rather than polled from the
  // test. The whole run can finish in four seconds, so any poll interval is a
  // race: under load the states are missed and it looks like the steps never
  // ran. The observer sees every transition regardless of timing.
  await page.evaluate(() => {
    (window as any).__stepStates = {};
    const record = () => {
      document.querySelectorAll('[data-step]').forEach((n) => {
        const key = n.getAttribute('data-step')!;
        const state = n.getAttribute('data-state')!;
        const seen = ((window as any).__stepStates[key] ||= []);
        if (seen[seen.length - 1] !== state) seen.push(state);
      });
    };
    new MutationObserver(record).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
    record();
  });

  await page.getByRole('button', { name: /country/i }).click();
  await page.getByRole('option', { name: 'Pakistan' }).click();
  await page.getByTestId('verify-begin').click();

  await expect(page.getByTestId('verification-result')).toBeVisible({ timeout: 90_000 });

  const states = await page.evaluate(
    () => (window as any).__stepStates as Record<string, string[]>,
  );

  // Every step must end done or fail - never sit at pending. That is exactly
  // what the per-step budgets exist to guarantee: a candidate who ignores the
  // camera prompt, an unreachable AWS region and a blocked ipify must each cost
  // one signal, not the whole run.
  for (const key of ['env', 'device', 'devices', 'ip', 'latency']) {
    const seen = states[key] || [];
    const last = seen[seen.length - 1];
    expect(['done', 'fail'], `step ${key} ended at "${last}" (saw ${seen.join(' -> ')})`).toContain(
      last,
    );
  }
  console.log('  step transitions:', JSON.stringify(states));
});

test('me-south-1 is absent from the region list', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync('src/lib/verification/collector.ts', 'utf8');
  // Comments are stripped first: the file DOCUMENTS why me-south-1 is excluded,
  // and a naive substring search fails on its own explanation.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  // An opt-in AWS region that never resolves for an account without it enabled.
  // It hung the PoC probe once; this is the cheapest guard against a helpful
  // future edit adding it back.
  expect(code).not.toContain('me-south-1');
});
