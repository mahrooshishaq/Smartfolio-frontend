'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiBriefcase, FiSearch, FiMapPin, FiExternalLink,
  FiChevronLeft, FiChevronRight, FiFilter, FiX, FiLoader,
  FiBookmark, FiCheck, FiTrendingUp, FiClock, FiGlobe
} from 'react-icons/fi';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Job {
  id: string;
  title: string;
  company: string;
  company_logo: string;
  location: string;
  country: string;
  salary_min: string;
  salary_max: string;
  job_type: string;
  experience_level: string;
  category: string;
  source: string;
  source_logo: string;
  description: string;
  geo_restriction: string;
  match_score: number;
  apply_url: string;
  scraped_at: string;
}

interface Filters {
  locations: string[];
  countries: string[];
  job_types: string[];
  experience_levels: string[];
  categories: string[];
  sources: string[];
  geo_restrictions?: string[];
}

interface JobsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts_by_source: Record<string, number>;
  counts_by_category: Record<string, number>;
  data: Job[];
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState('');
  const [scrapeStatus, setScrapeStatus] = useState('');
  const [hiddenByFilters, setHiddenByFilters] = useState(0);
  const [userName, setUserName] = useState('User');

  // Filter state
  const [search, setSearch] = useState('');
  const [jobType, setJobType] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [source, setSource] = useState('');
  const [geoRestriction, setGeoRestriction] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<'match' | 'newest'>('match');
  const [savedJobs, setSavedJobs] = useState<Record<string, boolean>>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchJobs = useCallback(async (p = 1) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (sort === 'newest') params.set('sort', 'newest');
      if (search) params.set('search', search);
      if (jobType) params.set('job_type', jobType);
      if (country) params.set('country', country);
      if (category) params.set('category', category);
      if (experienceLevel) params.set('experience_level', experienceLevel);
      if (source) params.set('source', source);
      if (geoRestriction) params.set('geo_restriction', geoRestriction);

      const res = await fetch(`${API}/jobs/me?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error(`Couldn’t load jobs (server said ${res.status}). Please try again.`);
      const data: JobsResponse = await res.json();
      setJobs(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
      return data.total;
    } catch (err: any) {
      setError(err?.message === 'Failed to fetch'
        ? 'Can’t reach the server right now. Check your connection and try again.'
        : err?.message || 'Something went wrong loading jobs.');
    } finally {
      setLoading(false);
    }
  }, [token, search, jobType, country, category, experienceLevel, source, geoRestriction, sort, router]);

  const fetchFilters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/jobs/me/filters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFilters(data);
      }
    } catch {}
  }, [token]);

  /** Poll the scrape-run history until a run newer than `startedAt` completes.
   *  The scrape takes 1–5 minutes and outlives proxy timeouts, so the initial
   *  POST is only a trigger — completion is detected from /scraper/runs. */
  const waitForScrapeRun = async (startedAt: number): Promise<boolean> => {
    const deadline = Date.now() + 7 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 8000));
      try {
        const res = await fetch(`${API}/scraper/runs?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const runs = await res.json();
        const latest = Array.isArray(runs) ? runs[0] : null;
        if (latest && new Date(latest.createdAt).getTime() >= startedAt) return true;
      } catch { /* transient — keep polling */ }
    }
    return false;
  };

  /** The on-screen filters the job boards can actually act on. `source` and
   *  `geo_restriction` are display-only — they describe results we already have,
   *  so they stay out of the scrape request. */
  const scrapeFilters = useCallback(() => {
    const f: Record<string, string> = {};
    if (country)         f.country          = country;
    if (jobType)         f.job_type         = jobType;
    if (experienceLevel) f.experience_level = experienceLevel;
    if (category)        f.category         = category;
    return f;
  }, [country, jobType, experienceLevel, category]);

  /** Poll a custom search to completion. POST /scraper/search returns a jobId
   *  immediately — it has NOT scraped anything yet — so treating the 201 as
   *  "done" is what made searches appear to do nothing. */
  const pollCustomSearch = async (
    jobId: string,
  ): Promise<{ outcome: 'done' | 'failed' | 'timeout'; jobsFound: number }> => {
    const deadline = Date.now() + 7 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const res = await fetch(`${API}/scraper/search/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const job = await res.json();
        // jobs_found is what actually landed in the account — the only honest
        // measure. The visible list is filtered and can stay at zero even when
        // the search worked.
        if (job.status === 'done')   return { outcome: 'done', jobsFound: job.result?.jobs_found ?? 0 };
        if (job.status === 'failed') return { outcome: 'failed', jobsFound: 0 };
        // 'running' or 'not_found' (server restarted) — keep waiting.
      } catch { /* transient — keep polling */ }
    }
    return { outcome: 'timeout', jobsFound: 0 };
  };

  /** Scrape the boards for what's on screen: the typed query plus the active
   *  filters, which get pushed into the board APIs rather than applied after. */
  const runWebSearch = async () => {
    if (!token) return;
    setScraping(true);
    setError('');
    setScrapeStatus('Searching job boards…');
    setHiddenByFilters(0);
    const startedAt = Date.now() - 5000; // small clock-skew allowance
    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${API}/scraper/search`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Empty is fine — the backend falls back to the category filter and
            // then the profile's role. Sending a placeholder like "jobs" matched
            // 189k unrelated postings on Adzuna.
            query: search.trim(),
            type: 'jobs',
            filters: scrapeFilters(),
          }),
        });
      } catch {
        res = null; // proxy cut the request — the backend may still be working
      }
      if (res?.status === 401) { router.push('/login'); return; }

      let outcome: 'done' | 'failed' | 'timeout';
      let jobsFound = 0;
      if (res?.ok) {
        const { jobId } = await res.json();
        if (jobId) ({ outcome, jobsFound } = await pollCustomSearch(jobId));
        else outcome = 'timeout';
      } else if (res) {
        throw new Error('Couldn’t start the search. Please try again.');
      } else {
        outcome = (await waitForScrapeRun(startedAt)) ? 'done' : 'timeout';
      }

      // `total` in this closure is the pre-search value; the fresh count has to
      // come back from fetchJobs itself.
      const before = total;
      const after = await fetchJobs(1);
      await fetchFilters();

      if (outcome === 'failed') {
        setError('That search failed. Please try again in a moment.');
      } else if (outcome === 'timeout') {
        setError('The search is taking longer than usual. Results will keep arriving — refresh in a couple of minutes.');
      } else if (jobsFound === 0) {
        setScrapeStatus('Search complete — the job boards had nothing new for this. Try a different role or widen your filters.');
      } else if (typeof after === 'number' && after <= before) {
        // The scrape worked, but the on-screen filters hide everything it found.
        // Reporting "no new jobs" here (the old behaviour) was simply untrue.
        setHiddenByFilters(jobsFound);
        setScrapeStatus('');
      } else {
        setScrapeStatus(`Search complete — ${jobsFound} new job${jobsFound === 1 ? '' : 's'} added.`);
      }
    } catch (err: any) {
      setError(err?.message === 'Failed to fetch'
        ? 'Can’t reach the server right now. Check your connection and try again.'
        : err?.message || 'Job search failed. Please try again.');
    } finally {
      setScraping(false);
    }
  };

  /** Profile-based scrape — ignores the search box entirely. */
  const runScraper = async () => {
    if (!token) return;
    setScraping(true);
    setError('');
    setScrapeStatus('Finding jobs that match your profile…');
    const startedAt = Date.now() - 5000;
    let completed = false;
    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${API}/scraper/run`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        res = null;
      }
      if (res?.status === 401) { router.push('/login'); return; }

      completed = res?.ok ? true : await waitForScrapeRun(startedAt);

      await fetchJobs(1);
      await fetchFilters();
      if (!completed) {
        setError('The job search is taking longer than usual. Results will keep arriving — refresh in a couple of minutes.');
      } else {
        setScrapeStatus('');
      }
    } catch (err: any) {
      setError(err?.message === 'Failed to fetch'
        ? 'Can’t reach the server right now. Check your connection and try again.'
        : err?.message || 'Job search failed. Please try again.');
    } finally {
      setScraping(false);
    }
  };

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchJobs(1);
    fetchFilters();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchJobs(1); }, 400);
    return () => clearTimeout(timer);
  }, [search, jobType, country, category, experienceLevel, source, geoRestriction, sort]);

  const saveJob = async (jobId: string) => {
    if (!token || savedJobs[jobId]) return;
    try {
      const res = await fetch(`${API}/applications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok || res.status === 400) {
        // 400 = already tracked — treat as saved either way
        setSavedJobs(prev => ({ ...prev, [jobId]: true }));
      } else {
        throw new Error(`Couldn’t save this job (server said ${res.status}). Please try again.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg === 'Failed to fetch'
        ? 'Can’t reach the server right now. Check your connection and try again.'
        : msg || 'Couldn’t save this job. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearch(''); setJobType(''); setCountry(''); setCategory(''); setExperienceLevel(''); setSource(''); setGeoRestriction('');
  };

  const hasActiveFilters = jobType || country || category || experienceLevel || source || geoRestriction;

  /** "Work from anywhere" is only ever assigned to remote jobs with no country
   *  attached, so pairing it with a country filter matches nothing by
   *  construction. Worth calling out rather than letting it look like a failure. */
  const contradictoryGeoFilter = geoRestriction === 'Anywhere' && !!country;

  /** Plain-English echo of what the user asked for, so the empty state names it
   *  back to them instead of just saying "no results". */
  const searchSummary = [search && `“${search}”`, experienceLevel, jobType, category, country]
    .filter(Boolean)
    .join(' · ');

  const sourceLabel = (s: string) =>
    s === 'jsearch' ? 'JSearch (mixed boards)' : s.charAt(0).toUpperCase() + s.slice(1);

  const formatSalary = (min: string, max: string) => {
    if (!min && !max) return null;
    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    return `Up to $${max}`;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Full Time': 'bg-emerald-50 text-emerald-600',
      'Part Time': 'bg-blue-50 text-blue-600',
      'Remote': 'bg-purple-50 text-purple-600',
      'Hybrid': 'bg-orange-50 text-orange-600',
      'Contract': 'bg-yellow-50 text-yellow-700',
      'Internship': 'bg-pink-50 text-pink-600',
      'Onsite': 'bg-gray-100 text-gray-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div>
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">Jobs For You</h2>
              <p className="font-raleway text-sm text-gray-400 mt-1">Personalized job recommendations based on your profile</p>
            </div>
            <button
              onClick={runScraper}
              disabled={scraping}
              className="font-raleway flex items-center justify-center gap-2 self-start bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60"
            >
              {scraping ? <><FiLoader className="animate-spin" size={16} /> Finding Jobs...</> : <><FiSearch size={16} /> Find Jobs For Me</>}
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-4 md:p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your jobs by title, company, or category..."
                  className="font-raleway w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200"
                />
              </div>
              <button
                onClick={runWebSearch}
                disabled={scraping}
                title="Scrape the job boards using your search text and active filters"
                className="font-raleway flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-all disabled:opacity-60"
              >
                <FiGlobe size={16} /> Search the web
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`font-raleway flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${showFilters ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                <FiFilter size={16} /> Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="font-raleway flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <FiX size={14} /> Clear
                </button>
              )}
            </div>

            {showFilters && filters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-5 pt-5 border-t border-gray-50">
                <select value={jobType} onChange={(e) => setJobType(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Job Types</option>
                  {filters.job_types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Countries</option>
                  {filters.countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Categories</option>
                  {filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Levels</option>
                  {filters.experience_levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Platforms</option>
                  {filters.sources.map(s => <option key={s} value={s}>{sourceLabel(s)}</option>)}
                </select>
                <select value={geoRestriction} onChange={(e) => setGeoRestriction(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">Any Eligibility</option>
                  <option value="Anywhere">🌍 Work from anywhere</option>
                  <option value="Country-restricted">📍 In-country only</option>
                  <option value="Citizenship/visa required">🛂 Citizenship/visa required</option>
                  <option value="Not specified">Eligibility not stated</option>
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm flex items-center justify-between gap-4">
              <span>{error}</span>
              <button onClick={() => setError('')} className="flex-shrink-0 text-red-400 hover:text-red-600" aria-label="Dismiss">
                <FiX size={16} />
              </button>
            </div>
          )}

          {/* The scrape succeeded but the active filters hide every result. Say
              so plainly and offer the way out, rather than reporting "no jobs". */}
          {hiddenByFilters > 0 && (
            <div className="font-raleway bg-amber-50 text-amber-800 px-6 py-4 rounded-2xl mb-6 text-sm flex items-start gap-3">
              <FiFilter className="flex-shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <p className="font-semibold">
                  Found {hiddenByFilters} job{hiddenByFilters === 1 ? '' : 's'} — but your filters are hiding {hiddenByFilters === 1 ? 'it' : 'them'}.
                </p>
                {contradictoryGeoFilter && (
                  <p className="mt-1 text-amber-700">
                    “Work from anywhere” and a specific country rarely overlap — a job tied to {country || 'a country'} isn’t location-independent.
                  </p>
                )}
                <button
                  onClick={() => { setGeoRestriction(''); setHiddenByFilters(0); }}
                  className="mt-2 font-semibold underline hover:no-underline"
                >
                  {contradictoryGeoFilter ? 'Clear the eligibility filter' : 'Clear filters'}
                </button>
              </div>
              <button onClick={() => setHiddenByFilters(0)} className="flex-shrink-0 text-amber-400 hover:text-amber-600" aria-label="Dismiss">
                <FiX size={16} />
              </button>
            </div>
          )}

          {/* Scrapes take 1–5 min; without this the page looks idle and users
              assume the search silently failed. */}
          {(scraping || scrapeStatus) && (
            <div className="font-raleway bg-blue-50 text-blue-700 px-6 py-4 rounded-2xl mb-6 text-sm flex items-center gap-3">
              {scraping && <FiLoader className="animate-spin flex-shrink-0" size={16} />}
              <span>
                {scrapeStatus}
                {scraping && <span className="text-blue-400"> — this usually takes 1–2 minutes. You can keep browsing.</span>}
              </span>
              {!scraping && (
                <button onClick={() => setScrapeStatus('')} className="ml-auto flex-shrink-0 text-blue-400 hover:text-blue-600" aria-label="Dismiss">
                  <FiX size={16} />
                </button>
              )}
            </div>
          )}

          {/* Results count + sort toggle */}
          <div className="font-raleway flex items-center justify-between mb-6">
            <p className="text-sm text-gray-400">{total} jobs found</p>
            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1">
              <button
                onClick={() => setSort('match')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${sort === 'match' ? 'bg-[#4F46E5] text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <FiTrendingUp size={12} /> Best Match
              </button>
              <button
                onClick={() => setSort('newest')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${sort === 'newest' ? 'bg-[#4F46E5] text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <FiClock size={12} /> Newest
              </button>
            </div>
          </div>

          {/* Job Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <FiLoader className="animate-spin text-gray-300" size={32} />
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-16 text-center">
              <FiBriefcase className="mx-auto text-gray-200 mb-4" size={48} />
              {hasActiveFilters || search ? (
                <>
                  {/* The filters describe jobs we haven't collected yet — offer to
                      go get them instead of dead-ending on "no results". */}
                  <h3 className="font-century text-xl font-bold text-slate-700 mb-2">No saved jobs match</h3>
                  <p className="font-raleway text-sm text-gray-400 mb-2">
                    Nothing in your jobs matches {searchSummary || 'these filters'}.
                  </p>
                  {contradictoryGeoFilter ? (
                    <p className="font-raleway text-sm text-amber-700 mb-6 max-w-md mx-auto">
                      “Work from anywhere” combined with {country} will stay empty — a job tied to a
                      country isn’t location-independent.{' '}
                      <button onClick={() => setGeoRestriction('')} className="font-semibold underline hover:no-underline">
                        Clear the eligibility filter
                      </button>
                    </p>
                  ) : (
                    <p className="font-raleway text-sm text-gray-400 mb-6">Search the job boards for it?</p>
                  )}
                  <button onClick={runWebSearch} disabled={scraping} className="font-raleway inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60">
                    {scraping ? <><FiLoader className="animate-spin" size={16} /> Searching…</> : <><FiGlobe size={16} /> Search the web for this</>}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-century text-xl font-bold text-slate-700 mb-2">No Jobs Yet</h3>
                  <p className="font-raleway text-sm text-gray-400 mb-6">Find job listings matched to your profile.</p>
                  <button onClick={runScraper} disabled={scraping} className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60">
                    {scraping ? 'Finding Jobs...' : 'Find Jobs Now'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7 hover:shadow-md transition-shadow group">
                  <div className="flex items-start gap-4">
                    <img
                      src={job.company_logo}
                      alt={job.company}
                      className="w-12 h-12 rounded-xl object-contain bg-gray-50 p-1.5"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=E0E7FF&color=4F46E5&size=48`; }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-century text-base font-bold text-slate-800 truncate group-hover:text-[#4F46E5] transition-colors">{job.title}</h3>
                      <p className="font-raleway text-sm text-gray-400 mt-0.5">{job.company}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => saveJob(job.id)}
                        title={savedJobs[job.id] ? 'Saved to Job Tracker' : 'Save to Job Tracker'}
                        className={`p-2.5 rounded-xl text-xs font-bold flex items-center transition-all ${savedJobs[job.id] ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-[#4F46E5]'}`}
                      >
                        {savedJobs[job.id] ? <FiCheck size={14} /> : <FiBookmark size={14} />}
                      </button>
                      <a
                        href={job.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        Apply <FiExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {job.description && (
                    <p className="font-raleway text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed">{job.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {job.match_score > 0 && (
                      <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-indigo-50 text-[#4F46E5] flex items-center gap-1">
                        <FiTrendingUp size={10} /> {Math.round(job.match_score)}% match
                      </span>
                    )}
                    {job.job_type && (
                      <span className={`font-raleway text-[11px] font-bold px-3 py-1 rounded-lg ${getTypeBadgeColor(job.job_type)}`}>{job.job_type}</span>
                    )}
                    {job.geo_restriction === 'Citizenship/visa required' && (
                      <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-red-50 text-red-500">🛂 Citizenship/visa required</span>
                    )}
                    {job.geo_restriction?.startsWith('Country-restricted') && (
                      <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-amber-50 text-amber-600">
                        📍 {job.geo_restriction.includes('likely') ? 'Likely in-country only' : 'In-country only'}
                      </span>
                    )}
                    {job.geo_restriction === 'Anywhere' && (
                      <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600">🌍 Anywhere</span>
                    )}
                    {job.experience_level && (
                      <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-gray-50 text-gray-500">{job.experience_level}</span>
                    )}
                    {job.location && (
                      <span className="font-raleway text-[11px] text-gray-400 flex items-center gap-1"><FiMapPin size={10} />{job.location}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                    {formatSalary(job.salary_min, job.salary_max) ? (
                      <span className="font-century text-sm font-bold text-slate-700">{formatSalary(job.salary_min, job.salary_max)}</span>
                    ) : (
                      <span className="font-raleway text-xs text-gray-300">Salary not disclosed</span>
                    )}
                    <div className="flex items-center gap-2">
                      <img src={job.source_logo} alt={job.source} className="w-4 h-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="font-raleway text-[10px] text-gray-300 uppercase tracking-wider">{job.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => fetchJobs(page - 1)}
                disabled={page <= 1}
                className="font-raleway flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-100 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <FiChevronLeft size={16} /> Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => fetchJobs(p)}
                      className={`font-raleway w-10 h-10 rounded-xl text-sm font-semibold transition-all ${p === page ? 'bg-[#4F46E5] text-white' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => fetchJobs(page + 1)}
                disabled={page >= totalPages}
                className="font-raleway flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-100 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next <FiChevronRight size={16} />
              </button>
            </div>
          )}
    </div>
  );
}
