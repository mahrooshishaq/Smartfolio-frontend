/**
 * Browser-side collector for the location and presence check.
 *
 * Ported from location-poc/public/index.html. The bounded-async structure is
 * the important part and is kept whole: every step runs inside its own budget,
 * so one stalled call can never hang the run. Five unbounded calls hung the PoC
 * once - a candidate who never answers the camera prompt, an AWS region that
 * does not resolve, and an ipify lookup on a dead connection are all normal, and
 * none of them may leave the applicant staring at a spinner.
 *
 * Worst case total is the sum of BUDGET, which is why the numbers are stated
 * rather than generous.
 */

export type VerificationContext = 'apply' | 'interview';
export type Verdict = 'clean' | 'review' | 'blocked';

export interface Finding {
  level: 'block' | 'contradiction' | 'note';
  code: string;
  detail: string;
}

export interface VerificationResult {
  id: string;
  verdict: Verdict;
  findings: Finding[];
  nearestRegion: { region: string; rtt: number } | null;
  country: string | null;
  deviceSignature: string | null;
}

export type StepKey = 'env' | 'device' | 'devices' | 'ip' | 'latency' | 'submit';
export type StepState = 'pending' | 'run' | 'done' | 'fail';

export interface StepUpdate {
  key: StepKey;
  state: StepState;
  label: string;
  why?: string;
}

/**
 * AWS regions the round trip is measured against.
 *
 * me-south-1 is deliberately ABSENT. It is an opt-in region: an account that
 * has not enabled it never resolves the endpoint at all, so including it does
 * not add a data point, it adds a guaranteed timeout to every single run. It
 * has been removed once before. Do not add it back.
 */
const REGIONS = [
  'us-east-1', 'eu-west-1', 'eu-central-1', 'me-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'sa-east-1',
  'af-south-1', 'ap-southeast-2',
];

// DynamoDB answers a bare GET with a 200 and no redirect, which makes it a
// clean round-trip target. Most AWS service endpoints redirect or hang instead.
const endpointFor = (region: string) => `https://dynamodb.${region}.amazonaws.com/`;

/** Every step is individually bounded. Worst case total is the sum of these. */
const BUDGET: Record<StepKey, number> = {
  env: 3000,
  device: 6000,
  devices: 20000,
  ip: 9000,
  latency: 14000,
  submit: 15000,
};

const PROBE_TIMEOUT_MS = 3500;

/**
 * Two samples, and the run takes the minimum.
 *
 * The minimum of N strips congestion and jitter without needing statistics: a
 * sample can be slowed by a hundred things, but nothing makes a packet arrive
 * faster than the wire allows, so the fastest sample is the closest to the
 * truth. More samples buy very little and cost the candidate real seconds.
 */
const SAMPLES = 2;

export const STEP_LABELS: Array<[StepKey, string]> = [
  ['env', 'Reading browser and screen information'],
  ['device', 'Building a device signature'],
  ['devices', 'Checking camera and microphone devices'],
  ['ip', 'Checking your connection'],
  ['latency', 'Measuring network distance'],
  ['submit', 'Finishing up'],
];

/* ------------------------------------------------ bounded async primitives */

/** fetch that always settles: aborts itself after ms. */
function timedFetch(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return fetch(url, { signal: ac.signal, cache: 'no-store', ...opts }).finally(() =>
    clearTimeout(timer),
  );
}

/** Wraps any promise so it rejects rather than hanging forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

/* ------------------------------------------------------------- collectors */

interface WebglInfo {
  renderer: string | null;
  vendor: string | null;
  note?: string;
  error?: string;
}

function readWebgl(): WebglInfo {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') ||
      c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { renderer: null, vendor: null, note: 'no webgl' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  } catch (e) {
    return { renderer: null, vendor: null, error: String(e) };
  }
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function canvasHash(): string | null {
  try {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 60;
    const x = c.getContext('2d');
    if (!x) return null;
    x.textBaseline = 'top';
    x.font = '14px "Arial"';
    x.fillStyle = '#f60';
    x.fillRect(10, 5, 80, 30);
    x.fillStyle = '#069';
    x.fillText('Smartfolio \u{1F310} 0123', 12, 12);
    x.strokeStyle = 'rgba(0,80,160,0.7)';
    x.beginPath();
    x.arc(160, 30, 20, 0, Math.PI * 2);
    x.stroke();
    return djb2(c.toDataURL());
  } catch {
    return null;
  }
}

/** Audio stacks differ between real hardware and virtualised or remote ones. */
function audioHash(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const Ctx =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
      if (!Ctx) return resolve(null);
      const ctx = new Ctx(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 10000;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -50;
      comp.knee.value = 40;
      comp.ratio.value = 12;
      comp.attack.value = 0;
      comp.release.value = 0.25;
      osc.connect(comp);
      comp.connect(ctx.destination);
      osc.start(0);
      const guard = setTimeout(() => resolve(null), 3000);
      ctx.oncomplete = (e) => {
        clearTimeout(guard);
        const d = e.renderedBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 4500; i < 5000; i++) sum += Math.abs(d[i]);
        resolve(djb2(sum.toString()));
      };
      void ctx.startRendering();
    } catch {
      resolve(null);
    }
  });
}

/** Which of a fixed list of fonts are installed - varies a lot per machine. */
function fontProbe(): string | null {
  try {
    const base = ['monospace', 'sans-serif', 'serif'];
    const test = [
      'Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New', 'Georgia',
      'Helvetica', 'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
      'Verdana', 'Ubuntu', 'DejaVu Sans', 'Liberation Sans', 'Noto Sans', 'Roboto',
      'Nirmala UI', 'Jameel Noori Nastaleeq',
    ];
    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;left:-9999px;font-size:72px';
    span.textContent = 'mmmmmmmmmmlli';
    document.body.appendChild(span);
    const baseline: Record<string, [number, number]> = {};
    base.forEach((b) => {
      span.style.fontFamily = b;
      baseline[b] = [span.offsetWidth, span.offsetHeight];
    });
    const found = test.filter((f) =>
      base.some((b) => {
        span.style.fontFamily = `"${f}",${b}`;
        return span.offsetWidth !== baseline[b][0] || span.offsetHeight !== baseline[b][1];
      }),
    );
    document.body.removeChild(span);
    return found.length ? djb2(found.join(',')) : null;
  } catch {
    return null;
  }
}

export interface Fingerprint {
  glRenderer: string | null;
  glVendor: string | null;
  screen: string;
  timezone: string;
  languages: string;
  cores: number | null;
  memoryGb: number | null;
  platform: string | null;
  touchPoints: number;
  canvas: string | null;
  audio: string | null;
  fonts: string | null;
  isMobile: boolean;
  weak: boolean;
  weakReason: string | null;
}

/**
 * Device signature inputs. Components are sent raw and hashed server-side, so
 * the hashing can change without shipping a new client, and a human can see WHY
 * two devices matched rather than just that they did.
 *
 * `weak` marks signatures that must never be used to link accounts: phones
 * carry too little entropy to distinguish two owners of the same model, and
 * privacy browsers deliberately return generic values that would collapse
 * unrelated strangers into a single "cluster". Refusing to link is the correct
 * behaviour, not a limitation.
 */
async function collectFingerprint(): Promise<Fingerprint> {
  const gl = readWebgl();
  const nav = navigator as Navigator & { deviceMemory?: number; brave?: unknown };

  const canvas = canvasHash();
  const audio = await audioHash();
  const fonts = fontProbe();
  const touchPoints = navigator.maxTouchPoints || 0;

  const isMobile =
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || touchPoints > 0;
  const privacyBrowser = !!nav.brave || canvas === null || audio === null || !gl.renderer;
  const strong = [gl.renderer, canvas, audio, fonts].filter(Boolean).length;

  return {
    glRenderer: gl.renderer || null,
    glVendor: gl.vendor || null,
    screen: [screen.width, screen.height, screen.colorDepth, window.devicePixelRatio].join('x'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: (navigator.languages || []).join(','),
    cores: navigator.hardwareConcurrency || null,
    memoryGb: nav.deviceMemory || null,
    platform: navigator.platform || null,
    touchPoints,
    canvas,
    audio,
    fonts,
    isMobile,
    weak: privacyBrowser || strong < 3 || isMobile,
    weakReason: privacyBrowser
      ? 'privacy browser or blocked APIs'
      : strong < 3
        ? 'too few distinctive signals'
        : isMobile
          ? 'mobile device - signatures are not distinctive enough to link accounts'
          : null,
  };
}

export interface DeviceList {
  videoinput: string[];
  audioinput: string[];
  audiooutput: string[];
  permission: 'granted' | 'denied' | 'not-granted' | 'unsupported' | 'timeout';
  error?: string;
  enumerateError?: string;
}

/**
 * Device labels need an active permission grant - without one the browser
 * returns empty strings, and a virtual camera would be invisible.
 *
 * If the candidate never answers the prompt, the step budget fires. The stream
 * handle is kept so a late grant can still be stopped, rather than leaving the
 * camera light on after the check has moved past this step.
 */
async function collectDevices(): Promise<DeviceList> {
  const out: DeviceList = {
    videoinput: [],
    audioinput: [],
    audiooutput: [],
    permission: 'not-granted',
  };
  if (!navigator.mediaDevices?.getUserMedia) {
    out.permission = 'unsupported';
    return out;
  }

  let stream: MediaStream | null = null;
  const pending = navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  pending.then((s) => { stream = s; }).catch(() => {});

  try {
    await pending;
    out.permission = 'granted';
  } catch (e) {
    out.permission = 'denied';
    out.error = String((e as Error)?.name || e);
  }

  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    list.forEach((d) => {
      const bucket = out[d.kind as 'videoinput' | 'audioinput' | 'audiooutput'];
      if (bucket) bucket.push(d.label || '(unnamed)');
    });
  } catch (e) {
    out.enumerateError = String(e);
  } finally {
    if (stream) (stream as MediaStream).getTracks().forEach((t) => t.stop());
    pending.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
  }
  return out;
}

async function collectIps(): Promise<{ ipv4: string | null; ipv6: string | null }> {
  const out: { ipv4: string | null; ipv6: string | null } = { ipv4: null, ipv6: null };
  const results = await Promise.allSettled([
    timedFetch('https://api.ipify.org?format=json', {}, 4000).then((r) => r.json()),
    timedFetch('https://api64.ipify.org?format=json', {}, 4000).then((r) => r.json()),
  ]);
  const v4 = results[0].status === 'fulfilled' ? results[0].value : null;
  const v64 = results[1].status === 'fulfilled' ? results[1].value : null;
  if (v4?.ip) out.ipv4 = v4.ip;
  // api64 returns v4 for a v4-only connection, so only keep a genuine v6.
  if (v64?.ip && String(v64.ip).includes(':')) out.ipv6 = v64.ip;
  return out;
}

/** Minimum of several samples - strips out congestion and jitter. */
async function measure(region: string): Promise<number | null> {
  const url = endpointFor(region);
  let best = Infinity;
  // Warmup pays the DNS + TLS cost once so it does not skew the samples.
  try {
    await timedFetch(url + '?w=' + Math.random(), { mode: 'no-cors' }, PROBE_TIMEOUT_MS);
  } catch {
    return null; // unreachable region: give up, do not burn the budget
  }
  for (let i = 0; i < SAMPLES; i++) {
    const t = performance.now();
    try {
      await timedFetch(url + '?t=' + Math.random(), { mode: 'no-cors' }, PROBE_TIMEOUT_MS);
      best = Math.min(best, performance.now() - t);
    } catch {
      // one bad sample is fine, keep the others
    }
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

async function measureAll(): Promise<Record<string, number>> {
  const settled = await Promise.allSettled(
    REGIONS.map((r) => measure(r).then((v) => [r, v] as const)),
  );
  const out: Record<string, number> = {};
  settled.forEach((s) => {
    if (s.status === 'fulfilled' && s.value[1] !== null) out[s.value[0]] = s.value[1] as number;
  });
  if (!Object.keys(out).length) throw new Error('no region responded');
  return out;
}

/* -------------------------------------------------------------- the run -- */

export interface RunOptions {
  context: VerificationContext;
  declaredCountry?: string;
  campaignCandidateId?: string;
  /** Recorded on the check so applicants the check blocked stay countable. */
  campaignId?: string;
  /** Called as each step starts, finishes or fails - drives the progress UI. */
  onStep?: (update: StepUpdate) => void;
}

async function step<T>(
  key: StepKey,
  label: string,
  fn: () => T | Promise<T>,
  onStep?: (u: StepUpdate) => void,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  onStep?.({ key, state: 'run', label });
  try {
    const value = await withTimeout(Promise.resolve().then(fn), BUDGET[key], key);
    onStep?.({ key, state: 'done', label });
    return { ok: true, value };
  } catch (err) {
    const why = String((err as Error)?.message || err);
    onStep?.({ key, state: 'fail', label, why });
    return { ok: false, error: why };
  }
}

/**
 * Run the full check and submit it.
 *
 * Every step degrades rather than aborting: a denied camera, a blocked ipify or
 * an unreachable region each remove one signal, and the server evaluates what
 * it did receive. Only a failed submit is fatal, because there is then nothing
 * to evaluate.
 */
export async function runVerification(options: RunOptions): Promise<VerificationResult> {
  const { context, declaredCountry, campaignCandidateId, campaignId, onStep } = options;
  const labels = Object.fromEntries(STEP_LABELS) as Record<StepKey, string>;
  const startedAt = Date.now();

  const payload: Record<string, unknown> = {
    context,
    declaredCountry: declaredCountry || undefined,
    campaignCandidateId: campaignCandidateId || undefined,
    campaignId: campaignId || undefined,
  };
  const stepErrors: Record<string, string> = {};

  const env = await step('env', labels.env, () => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
      },
      webgl: readWebgl(),
      automation: {
        webdriver: navigator.webdriver === true,
        hasCdp: Object.keys(window).some(
          (k) => k.startsWith('cdc_') || k.includes('__driver'),
        ),
        headlessHint: /headless/i.test(navigator.userAgent),
      },
      environment: {
        userAgent: navigator.userAgent,
        languages: navigator.languages || [navigator.language],
        timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
        cores: navigator.hardwareConcurrency || null,
        memoryGb: nav.deviceMemory || null,
        platform: navigator.platform,
        touchPoints: navigator.maxTouchPoints,
      },
    };
  }, onStep);
  if (env.ok) Object.assign(payload, env.value);
  else stepErrors.env = env.error;

  const fingerprint = await step('device', labels.device, collectFingerprint, onStep);
  payload.fingerprint = fingerprint.ok
    ? fingerprint.value
    : { weak: true, weakReason: fingerprint.error };
  if (!fingerprint.ok) stepErrors.device = fingerprint.error;

  const devices = await step('devices', labels.devices, collectDevices, onStep);
  payload.devices = devices.ok
    ? devices.value
    : { videoinput: [], audioinput: [], audiooutput: [], permission: 'timeout' };
  if (!devices.ok) stepErrors.devices = devices.error;

  const ips = await step('ip', labels.ip, collectIps, onStep);
  if (ips.ok && ips.value.ipv6) payload.ipv6 = ips.value.ipv6;
  if (!ips.ok) stepErrors.ip = ips.error;

  const latency = await step('latency', labels.latency, measureAll, onStep);
  payload.latency = latency.ok ? latency.value : {};
  if (!latency.ok) stepErrors.latency = latency.error;

  (payload.environment as Record<string, unknown>) = {
    ...(payload.environment as Record<string, unknown>),
    stepErrors,
    durationMs: Date.now() - startedAt,
  };

  const submitted = await step('submit', labels.submit, () => submitCheck(payload), onStep);
  if (!submitted.ok) throw new Error(submitted.error);
  return submitted.value;
}

/**
 * Where the check is submitted.
 *
 * This MUST reach the backend directly, not through the Next.js rewrite proxy.
 * A rewrite is a server-side fetch: the backend would then observe the
 * FRONTEND's address, not the candidate's - and since that address belongs to a
 * hosting provider, every single candidate would come back `blocked` with
 * `hosting_asn`. The check would appear to work perfectly while measuring
 * nothing but our own deployment.
 *
 * So: when NEXT_PUBLIC_API_URL is configured (production), talk to the backend
 * origin directly - CORS already allows the frontend origin, and the CSP
 * already lists it in connect-src. Without it, fall back to same-origin, which
 * is correct in local development where the proxy and the browser share a host.
 *
 * NEXT_PUBLIC_API_URL is inlined at build time, so this is decided when the
 * frontend is built, not at runtime.
 */
function verificationEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (base) return `${base.replace(/\/$/, '')}/verification/session`;

  // Falling back to the proxy is correct on localhost, where the frontend and
  // backend share a host and the distinction does not exist. Anywhere else it
  // means NEXT_PUBLIC_API_URL was not set at build time, and every check from
  // here will be judged on the proxy's datacenter address rather than the
  // candidate's — blocking everyone, silently, with well-formed verdicts.
  //
  // Say so loudly. This is the one failure in the whole check that produces no
  // error of its own.
  if (typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
    console.error(
      '[verification] NEXT_PUBLIC_API_URL is not set. The check is being proxied, ' +
        "so the backend will see this deployment's IP instead of the candidate's " +
        'and block everyone. Set it to the backend origin and redeploy.',
    );
  }
  return '/api/verification/session';
}

async function submitCheck(payload: Record<string, unknown>): Promise<VerificationResult> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  // Attach the token when there is one so the check is attributed to the
  // account, but never require one: the first place this runs is a public apply
  // page where the candidate has no account yet.
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await timedFetch(
    verificationEndpoint(),
    { method: 'POST', headers, body: JSON.stringify(payload), credentials: 'include' },
    BUDGET.submit,
  );

  if (res.status === 429) {
    throw new Error('Too many checks from this connection. Please wait a minute and try again.');
  }
  if (!res.ok) {
    throw new Error(`Verification failed (${res.status})`);
  }
  return (await res.json()) as VerificationResult;
}

/** Findings a candidate can act on, in the order they should read them. */
export function actionableFindings(findings: Finding[]): Finding[] {
  const order = { block: 0, contradiction: 1, note: 2 };
  return [...findings].sort((a, b) => order[a.level] - order[b.level]);
}
