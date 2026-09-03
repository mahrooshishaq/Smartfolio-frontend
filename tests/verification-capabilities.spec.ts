/**
 * Browser-capability gate for the verification check (build plan P1/P4).
 *
 * These assertions cannot be made anywhere but a real browser: response headers
 * look correct while the behaviour they govern is still broken. `camera=()` in
 * Permissions-Policy does not fail a header check — it makes getUserMedia
 * reject and enumerateDevices return blank labels, so the check would report
 * "no virtual camera found" on a machine running OBS.
 *
 * Chromium is launched with fake media devices so this runs without hardware.
 * The fake devices still go through the real permission path, so a blocking
 * Permissions-Policy still fails the test — which is the point.
 */
import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
  permissions: ['camera', 'microphone'],
});

test('camera is reachable and device labels are readable', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      stream.getTracks().forEach((t) => t.stop());
      return {
        ok: true,
        error: null as string | null,
        videoLabels: devices.filter((d) => d.kind === 'videoinput').map((d) => d.label),
        audioLabels: devices.filter((d) => d.kind === 'audioinput').map((d) => d.label),
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        videoLabels: [] as string[],
        audioLabels: [] as string[],
      };
    }
  });

  expect(result.error, 'getUserMedia must not be blocked by Permissions-Policy').toBeNull();
  expect(result.ok).toBe(true);
  // Labels are what the virtual-camera rule matches on. An empty label list is
  // the exact failure mode camera=() produced.
  expect(result.videoLabels.length).toBeGreaterThan(0);
  expect(result.videoLabels.every((l) => l.length > 0)).toBe(true);
});

test('AWS latency probes and ipify are not CSP-blocked', async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as any).__cspViolations = (window as any).__cspViolations || [];
      (window as any).__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });

  const requested: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('amazonaws.com') || u.includes('ipify.org')) requested.push(u);
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const probe = await page.evaluate(async () => {
    const results: Record<string, string> = {};
    const targets = [
      'https://dynamodb.eu-central-1.amazonaws.com/',
      'https://dynamodb.ap-south-1.amazonaws.com/',
      'https://api.ipify.org?format=json',
    ];
    for (const url of targets) {
      try {
        // no-cors matches how the real probe measures: we only need the round
        // trip to complete, never the body.
        await fetch(url + (url.includes('?') ? '&' : '?') + 'w=' + Math.random(), {
          mode: 'no-cors',
        });
        results[url] = 'reached';
      } catch (e) {
        results[url] = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      }
    }
    return results;
  });

  const cspViolations = await page.evaluate(
    () => ((window as any).__cspViolations as string[]) || [],
  );
  violations.push(...cspViolations);

  for (const [url, outcome] of Object.entries(probe)) {
    expect(outcome, `${url} must not be blocked`).toBe('reached');
  }
  expect(
    violations.filter((v) => v.includes('amazonaws') || v.includes('ipify')),
    'no CSP violation for the probe hosts',
  ).toEqual([]);
  expect(requested.length, 'probes must leave the browser as real requests').toBeGreaterThan(0);
});

// The me-south-1 guard lives in verification-collector.spec.ts, where it can
// strip comments before searching - this file's naive substring version failed
// on the collector's own explanation of why the region is excluded.
