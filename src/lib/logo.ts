/**
 * Repairs logo URLs that were stored before logo.clearbit.com stopped
 * resolving.
 *
 * The host is dead (ERR_NAME_NOT_RESOLVED), and rows written earlier still hold
 * those URLs — thousands of them per user — so every jobs page load fires a
 * batch of failed image requests and shows a broken mark. The backend no longer
 * generates them, but existing rows only age out with the 14-day job expiry, so
 * the fix has to happen at render time too.
 */

const DEAD_LOGO_HOST = 'logo.clearbit.com';

/** Initials on a tinted square — always renders, never 404s. */
function initialsAvatar(name: string, size = 48): string {
  const label = (name || '?').trim() || '?';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=E0E7FF&color=4F46E5&size=${size}`;
}

/**
 * A company mark. Any stored clearbit URL is replaced with generated initials —
 * the old code guessed a domain from the company name, which was wrong more
 * often than right ("Hire Feed" is not hirefeed.com), so there is nothing worth
 * salvaging from it.
 */
export function companyLogo(stored: string | null | undefined, company: string): string {
  if (!stored || stored.includes(DEAD_LOGO_HOST)) return initialsAvatar(company);
  return stored;
}

/**
 * A job-board mark. The board is a known entity, so a dead URL can be rebuilt
 * as a favicon lookup rather than falling back to initials.
 */
const BOARD_DOMAINS: Record<string, string> = {
  adzuna: 'adzuna.com',
  'rozee.pk': 'rozee.pk',
  rozee: 'rozee.pk',
  jsearch: 'indeed.com',
  indeed: 'indeed.com',
  linkedin: 'linkedin.com',
  glassdoor: 'glassdoor.com',
  bayt: 'bayt.com',
  naukri: 'naukri.com',
  monster: 'monster.com',
  ziprecruiter: 'ziprecruiter.com',
  jooble: 'jooble.org',
};

export function sourceLogo(stored: string | null | undefined, source: string): string {
  if (stored && !stored.includes(DEAD_LOGO_HOST)) return stored;

  const domain = BOARD_DOMAINS[(source || '').toLowerCase()];
  if (domain) return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  return initialsAvatar(source, 32);
}
