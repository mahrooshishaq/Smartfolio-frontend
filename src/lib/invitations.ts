/**
 * The candidate's own interview invitations.
 *
 * This exists because an invite token is hashed the moment it is issued, so the
 * emailed link is the only copy in the world. Deleted, spam-filtered, or sent to
 * an address someone no longer reads, and the interview was simply gone: the
 * reminder could not resend it either, and there was no page anywhere in the app
 * that admitted the invitation existed.
 *
 * Listing an invitation hands out no token. Opening one is a separate call, and
 * mints a fresh link against the signed-in account — which is why losing the
 * email is now recoverable without weakening the hashing at all.
 */
import { apiFetch } from './api';

export type InvitationState = 'open' | 'expired' | 'completed';

export interface Invitation {
  candidateId: string;
  role: string;
  company: string;
  jobDescription: string;
  sentAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  state: InvitationState;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const invitationsApi = {
  list: () => json<Invitation[]>('/api/campaigns/me/invitations'),

  /** Mint a fresh link for one invitation. Returns the path to open. */
  open: (candidateId: string) =>
    json<{ path: string; expiresAt: string | null }>(
      `/api/campaigns/me/invitations/${candidateId}/link`,
      { method: 'POST' },
    ),
};

/** Days left, or null when there is no deadline or it has passed. */
export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}
