/**
 * Talks to the real backend from browser tests.
 *
 * Accounts are created through the genuine signup -> OTP -> verify flow rather
 * than by inserting rows: the OTP leg is part of what the apply journey has to
 * survive, so a test that skipped it would not be testing the thing that breaks.
 * MAIL_MOCK_MODE prints the code to the dev-server log, which is where this
 * reads it from.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const API = process.env.API_BASE || 'http://localhost:3001';
const PG = process.env.PG_CONTAINER || 'smartfolio-pg';
const BACKEND_LOG = process.env.BACKEND_LOG || '';

export function sql(query: string): string {
  return execFileSync(
    'docker',
    ['exec', PG, 'psql', '-U', 'postgres', '-d', 'smartfolio', '-tA', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}@smartfolio.test`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function otpFromLog(email: string): string | null {
  if (!BACKEND_LOG) throw new Error('BACKEND_LOG is not set — cannot read mock OTPs');
  const blocks = readFileSync(BACKEND_LOG, 'utf8').split('========== MOCK EMAIL ==========');
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!blocks[i].includes(email)) continue;
    const match = blocks[i].match(/OTP code is:\s*(\d{4,6})/);
    if (match) return match[1];
  }
  return null;
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export async function createVerifiedUser(
  name: string,
  email: string,
  password = 'Password@123',
): Promise<TestUser> {
  const signup = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!signup.ok) throw new Error(`signup failed: ${signup.status} ${await signup.text()}`);

  let otp: string | null = null;
  for (let i = 0; i < 24 && !otp; i++) {
    otp = otpFromLog(email);
    if (!otp) await sleep(250);
  }
  if (!otp) throw new Error(`no OTP in the log for ${email}`);

  const verify = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  if (!verify.ok) throw new Error(`verify failed: ${verify.status} ${await verify.text()}`);
  const body = await verify.json();

  return {
    name,
    email,
    password,
    userId: sql(`select id from "user" where email = '${email}'`),
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? '',
  };
}

export function makeAdmin(email: string): void {
  sql(`update "user" set role = 'admin' where email = '${email}'`);
}

/** Puts a session in localStorage exactly as the app does after login. */
export function sessionScript(user: TestUser) {
  return (u: { accessToken: string; refreshToken: string; name: string; email: string }) => {
    localStorage.setItem('accessToken', u.accessToken);
    localStorage.setItem('refreshToken', u.refreshToken);
    localStorage.setItem('userName', u.name);
    localStorage.setItem('userEmail', u.email);
  };
}

export const sessionArg = (user: TestUser) => ({
  accessToken: user.accessToken,
  refreshToken: user.refreshToken,
  name: user.name,
  email: user.email,
});

export async function apiAs(
  user: TestUser,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${user.accessToken}`);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}
