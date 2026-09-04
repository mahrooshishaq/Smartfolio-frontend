/**
 * Countries the location check can actually reason about.
 *
 * Deliberately not every ISO country: the distance rule compares a declared
 * country against the AWS regions it could legitimately route through, and a
 * country with no entry in that map cannot be distance-checked at all. Offering
 * one would take an answer we then quietly ignore.
 *
 * Kept in sync with REGIONS_BY_COUNTRY in the backend's verification rules.
 *
 * Alphabetical by name. Any other order — including 'our biggest markets
 * first' — is invisible to the person scanning for their own country, who
 * only knows where the alphabet would put it.
 */
export const APPLY_COUNTRIES: Array<[string, string]> = [
  ['AR', 'Argentina'], ['AU', 'Australia'], ['AT', 'Austria'],
  ['BH', 'Bahrain'], ['BD', 'Bangladesh'], ['BE', 'Belgium'],
  ['BR', 'Brazil'], ['CA', 'Canada'], ['CL', 'Chile'],
  ['CO', 'Colombia'], ['CZ', 'Czechia'], ['DK', 'Denmark'],
  ['EG', 'Egypt'], ['FR', 'France'], ['DE', 'Germany'],
  ['IN', 'India'], ['ID', 'Indonesia'], ['IE', 'Ireland'],
  ['IT', 'Italy'], ['JP', 'Japan'], ['JO', 'Jordan'],
  ['KE', 'Kenya'], ['KW', 'Kuwait'], ['MY', 'Malaysia'],
  ['MX', 'Mexico'], ['NP', 'Nepal'], ['NL', 'Netherlands'],
  ['NZ', 'New Zealand'], ['NG', 'Nigeria'], ['NO', 'Norway'],
  ['OM', 'Oman'], ['PK', 'Pakistan'], ['PH', 'Philippines'],
  ['PL', 'Poland'], ['PT', 'Portugal'], ['QA', 'Qatar'],
  ['SA', 'Saudi Arabia'], ['SG', 'Singapore'], ['ZA', 'South Africa'],
  ['KR', 'South Korea'], ['ES', 'Spain'], ['LK', 'Sri Lanka'],
  ['SE', 'Sweden'], ['CH', 'Switzerland'], ['TW', 'Taiwan'],
  ['TH', 'Thailand'], ['TR', 'Turkey'], ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom'], ['US', 'United States'], ['VN', 'Vietnam'],
];
