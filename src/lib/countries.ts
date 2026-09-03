/**
 * Countries the location check can actually reason about.
 *
 * Deliberately not every ISO country: the distance rule compares a declared
 * country against the AWS regions it could legitimately route through, and a
 * country with no entry in that map cannot be distance-checked at all. Offering
 * one would take an answer we then quietly ignore.
 *
 * Kept in sync with REGIONS_BY_COUNTRY in the backend's verification rules.
 */
export const APPLY_COUNTRIES: Array<[string, string]> = [
  ['PK', 'Pakistan'], ['IN', 'India'], ['BD', 'Bangladesh'], ['LK', 'Sri Lanka'], ['NP', 'Nepal'],
  ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['QA', 'Qatar'], ['KW', 'Kuwait'],
  ['BH', 'Bahrain'], ['OM', 'Oman'], ['JO', 'Jordan'], ['EG', 'Egypt'], ['TR', 'Turkey'],
  ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['DE', 'Germany'], ['FR', 'France'],
  ['NL', 'Netherlands'], ['BE', 'Belgium'], ['CH', 'Switzerland'], ['AT', 'Austria'],
  ['ES', 'Spain'], ['PT', 'Portugal'], ['IT', 'Italy'], ['PL', 'Poland'], ['CZ', 'Czechia'],
  ['SE', 'Sweden'], ['NO', 'Norway'], ['DK', 'Denmark'],
  ['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'],
  ['BR', 'Brazil'], ['AR', 'Argentina'], ['CL', 'Chile'], ['CO', 'Colombia'],
  ['NG', 'Nigeria'], ['KE', 'Kenya'], ['ZA', 'South Africa'],
  ['SG', 'Singapore'], ['MY', 'Malaysia'], ['ID', 'Indonesia'], ['PH', 'Philippines'],
  ['TH', 'Thailand'], ['VN', 'Vietnam'], ['JP', 'Japan'], ['KR', 'South Korea'],
  ['TW', 'Taiwan'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
];
