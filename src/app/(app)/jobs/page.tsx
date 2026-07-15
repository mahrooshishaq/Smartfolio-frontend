'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiBriefcase, FiSearch, FiMapPin, FiExternalLink,
  FiChevronLeft, FiChevronRight, FiFilter, FiX, FiLoader,
  FiBookmark, FiCheck, FiTrendingUp, FiClock
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
  const [userName, setUserName] = useState('User');

  // Filter state
  const [search, setSearch] = useState('');
  const [jobType, setJobType] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [source, setSource] = useState('');
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
    } catch (err: any) {
      setError(err?.message === 'Failed to fetch'
        ? 'Can’t reach the server right now. Check your connection and try again.'
        : err?.message || 'Something went wrong loading jobs.');
    } finally {
      setLoading(false);
    }
  }, [token, search, jobType, country, category, experienceLevel, source, sort, router]);

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

  const runScraper = async () => {
    if (!token) return;
    setScraping(true);
    setError('');
    const startedAt = Date.now() - 5000; // small clock-skew allowance
    let completed = false;
    try {
      let res: Response | null = null;
      try {
        if (search.trim()) {
          // Custom search: scrape for the user's query and ADD to existing jobs
          res = await fetch(`${API}/scraper/search`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: search.trim(), type: 'both' }),
          });
        } else {
          // Profile-based scrape
          res = await fetch(`${API}/scraper/run`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        // Proxy/connection cut the request — the backend is still scraping.
        res = null;
      }
      if (res?.status === 401) { router.push('/login'); return; }

      if (res?.ok) {
        completed = true; // backend finished within the request
      } else {
        // Request died or errored — wait for the run to appear in history instead
        completed = await waitForScrapeRun(startedAt);
      }

      await fetchJobs(1);
      await fetchFilters();
      if (!completed) {
        setError('The job search is taking longer than usual. Results will keep arriving — refresh in a couple of minutes.');
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
  }, [search, jobType, country, category, experienceLevel, source, sort]);

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
    setSearch(''); setJobType(''); setCountry(''); setCategory(''); setExperienceLevel(''); setSource('');
  };

  const hasActiveFilters = jobType || country || category || experienceLevel || source;

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
              {scraping ? <><FiLoader className="animate-spin" size={16} /> Finding Jobs...</> : <><FiSearch size={16} /> Find New Jobs</>}
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
                  placeholder="Search jobs by title, company, or category..."
                  className="font-raleway w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200"
                />
              </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mt-5 pt-5 border-t border-gray-50">
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
              <h3 className="font-century text-xl font-bold text-slate-700 mb-2">No Jobs Found</h3>
              <p className="font-raleway text-sm text-gray-400 mb-6">Click &quot;Find New Jobs&quot; to scrape personalized job listings based on your profile.</p>
              <button onClick={runScraper} disabled={scraping} className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60">
                {scraping ? 'Finding Jobs...' : 'Find Jobs Now'}
              </button>
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
