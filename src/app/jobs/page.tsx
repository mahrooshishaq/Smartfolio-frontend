'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import {
  FiLogOut, FiLayout, FiFileText, FiMic,
  FiBookOpen, FiFile, FiBriefcase, FiHelpCircle,
  FiSettings, FiSearch, FiMapPin, FiExternalLink,
  FiChevronLeft, FiChevronRight, FiFilter, FiX, FiLoader
} from 'react-icons/fi';

const API = 'http://localhost:3000';

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`font-raleway flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
  >
    <Icon size={20} />
    <span className="text-sm">{label}</span>
  </div>
);

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
  const [showFilters, setShowFilters] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchJobs = useCallback(async (p = 1) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (search) params.set('search', search);
      if (jobType) params.set('job_type', jobType);
      if (country) params.set('country', country);
      if (category) params.set('category', category);
      if (experienceLevel) params.set('experience_level', experienceLevel);

      const res = await fetch(`${API}/jobs/me?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data: JobsResponse = await res.json();
      setJobs(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token, search, jobType, country, category, experienceLevel, router]);

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

  const runScraper = async () => {
    if (!token) return;
    setScraping(true);
    setError('');
    try {
      let res: Response;
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
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Scraper failed');
      await fetchJobs(1);
      await fetchFilters();
    } catch (err: any) {
      setError(err.message || 'Scraper failed');
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
  }, [search, jobType, country, category, experienceLevel]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  const clearFilters = () => {
    setSearch(''); setJobType(''); setCountry(''); setCategory(''); setExperienceLevel('');
  };

  const hasActiveFilters = jobType || country || category || experienceLevel;

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
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-gray-100 p-8 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-12 px-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <h1 className="font-baloo text-xl ml-2 tracking-wide text-slate-800">SmartFolio - AI</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={FiLayout} label="Dashboard" onClick={() => router.push('/dashboard')} />
          <SidebarItem icon={FiFileText} label="Resume Analysis" onClick={() => router.push('/upload-resume')} />
          <SidebarItem icon={FiMic} label="Mock Interview" onClick={() => router.push('/mock-interview')} />
          <SidebarItem icon={FiBookOpen} label="Courses" onClick={() => router.push('/courses')} />
          <SidebarItem icon={FiFile} label="Document Generation" onClick={() => router.push('/document-generation')} />
          <SidebarItem icon={FiBriefcase} label="Jobs" active />
        </nav>
        <div className="mt-auto pt-8 border-t border-gray-50 space-y-2">
          <p className="font-raleway text-[10px] font-bold text-gray-300 px-4 mb-4 uppercase tracking-[0.15em]">Support</p>
          <SidebarItem icon={FiHelpCircle} label="Get Started" />
          <SidebarItem icon={FiSettings} label="Settings" onClick={() => router.push('/dashboard/settings')} />
          <button onClick={handleLogout} className="w-full"><SidebarItem icon={FiLogOut} label="Logout" /></button>
          <div className="mt-8 px-4 py-2 bg-slate-50 rounded-2xl">
            <p className="font-century text-sm font-bold text-slate-800">{userName}</p>
            <p className="font-raleway text-[11px] text-gray-400 truncate">user@smartfolio.ai</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="relative flex-1 overflow-hidden p-10">
        <AnimatedBackground />
        <div className="relative z-10 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-century text-3xl font-black text-slate-800">Jobs For You</h2>
              <p className="font-raleway text-sm text-gray-400 mt-1">Personalized job recommendations based on your profile</p>
            </div>
            <button
              onClick={runScraper}
              disabled={scraping}
              className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60"
            >
              {scraping ? <><FiLoader className="animate-spin" size={16} /> Finding Jobs...</> : <><FiSearch size={16} /> Find New Jobs</>}
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-6 mb-8">
            <div className="flex items-center gap-4">
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
              <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-50">
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
              </div>
            )}
          </div>

          {error && (
            <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm">{error}</div>
          )}

          {/* Results count */}
          <div className="font-raleway flex items-center justify-between mb-6">
            <p className="text-sm text-gray-400">{total} jobs found</p>
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
                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      Apply <FiExternalLink size={12} />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
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
      </main>
    </div>
  );
}
