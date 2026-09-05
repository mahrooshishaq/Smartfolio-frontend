/**
 * "Practise this interview" and "Sharpen your CV", arriving from an email.
 *
 * The confirmation email links back into the product with `?role=<slug>`. The
 * candidate has just applied to that job, which means they no longer have its
 * description anywhere — landing them on an empty box and asking them to paste
 * the advert they submitted an hour ago is asking them to go and find it again.
 *
 * The slug is fetched publicly, so this works whether or not the link is opened
 * in the browser they applied from.
 */
import { publicFetch } from './api';

export const ROLE_PARAM = 'role';

export interface RolePrefill {
  slug: string;
  title: string;
  company: string;
  jobDescription: string;
}

/**
 * Look up the role named in the URL.
 *
 * Returns null for anything that does not resolve — a campaign that has since
 * closed, a mistyped link, an old email. A page that silently carries on with
 * an empty box is the correct fallback: nothing is lost that was not already
 * missing.
 */
export async function fetchRoleFromParam(search: string): Promise<RolePrefill | null> {
  const slug = new URLSearchParams(search).get(ROLE_PARAM);
  if (!slug) return null;
  try {
    const res = await publicFetch(`/api/campaigns/public/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.jobDescription) return null;
    return {
      slug,
      title: body.title ?? '',
      company: body.company ?? '',
      jobDescription: body.jobDescription,
    };
  } catch {
    return null;
  }
}
