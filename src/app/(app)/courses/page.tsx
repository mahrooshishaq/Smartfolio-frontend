'use client';
import FoliLoader from '@/components/foli/FoliLoader';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiBookOpen, FiSearch, FiExternalLink,
  FiChevronLeft, FiChevronRight, FiFilter, FiX, FiLoader, FiClock,
  FiPlayCircle, FiEye, FiCalendar, FiTarget
} from 'react-icons/fi';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Course {
  id: string;
  title: string;
  instructor: string;
  platform: string;
  platform_logo: string;
  category: string;
  level: string;
  duration: string;
  price: string;
  rating: string;
  language: string;
  description: string;
  course_url: string;
  thumbnail: string;
  scraped_at: string;
  source: string;
  // Enriched fields from the pooled/ranked backend
  star_rating: number;
  match_score: number;
  total_videos: number;
  total_duration_minutes: number;
  avg_video_minutes: number;
  view_count: number;
  like_count: number;
  last_updated_at: string;
  video_stats_label: string;
  updated_label: string;
  views_label: string;
  commitment_label: string;
  why_recommended: string;
  saved: boolean;
  completed: boolean;
}

/** 5-star display driven by the backend's 0–5 star_rating (0.5 steps). */
function StarRating({ value }: { value: number }) {
  if (!value || value <= 0) return null;
  return (
    <span className="flex items-center gap-1" title={`${value.toFixed(1)} / 5`}>
      <span className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((i) =>
          value >= i ? <FaStar key={i} size={12} />
          : value >= i - 0.5 ? <FaStarHalfAlt key={i} size={12} />
          : <FaRegStar key={i} size={12} className="text-gray-200" />
        )}
      </span>
      <span className="font-raleway text-xs font-semibold text-gray-500">{value.toFixed(1)}</span>
    </span>
  );
}

interface Filters {
  platforms: string[];
  levels: string[];
  categories: string[];
  prices: string[];
  languages: string[];
  sources: string[];
}

interface CoursesResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts_by_platform: Record<string, number>;
  counts_by_level: Record<string, number>;
  counts_by_category: Record<string, number>;
  data: Course[];
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
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
  const [platform, setPlatform] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchCourses = useCallback(async (p = 1) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (search) params.set('search', search);
      if (platform) params.set('platform', platform);
      if (level) params.set('level', level);
      if (category) params.set('category', category);
      if (price) params.set('price', price);

      const res = await fetch(`${API}/courses/me?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Failed to fetch courses');
      const data: CoursesResponse = await res.json();
      setCourses(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token, search, platform, level, category, price, router]);

  const fetchFilters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/courses/me/filters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFilters(data);
      }
    } catch {}
  }, [token]);

  /** Poll scrape-run history until a run newer than `startedAt` completes —
   *  used for the profile scrape (POST /scraper/run outlives proxy timeouts). */
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

  /** Poll the async custom-search job (POST /scraper/search returns a jobId
   *  immediately; the scrape runs in the background). */
  const waitForCustomSearch = async (jobId: string): Promise<boolean> => {
    const deadline = Date.now() + 7 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 6000));
      try {
        const res = await fetch(`${API}/scraper/search/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const job = await res.json();
        if (job.status === 'done') return true;
        if (job.status === 'failed' || job.status === 'not_found') return false;
      } catch { /* transient — keep polling */ }
    }
    return false;
  };

  const runScraper = async () => {
    if (!token) return;
    setScraping(true);
    setError('');
    const startedAt = Date.now() - 5000;
    try {
      let completed = false;
      if (search.trim()) {
        // Custom search is async: kick it off, get a jobId, then poll it.
        let jobId = '';
        try {
          const res = await fetch(`${API}/scraper/search`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: search.trim(), type: 'both' }),
          });
          if (res.status === 401) { router.push('/login'); return; }
          if (res.ok) jobId = (await res.json()).jobId;
        } catch { /* proxy cut the trigger — fall back to run-history polling */ }

        completed = jobId
          ? await waitForCustomSearch(jobId)
          : await waitForScrapeRun(startedAt);
      } else {
        // Profile-based scrape (synchronous but long; may outlive the proxy).
        let res: Response | null = null;
        try {
          res = await fetch(`${API}/scraper/run`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch { res = null; }
        if (res?.status === 401) { router.push('/login'); return; }
        completed = res?.ok ? true : await waitForScrapeRun(startedAt);
      }

      await fetchCourses(1);
      await fetchFilters();
      if (!completed) {
        setError('The course search is taking longer than usual. Results will keep arriving — refresh in a couple of minutes.');
      }
    } catch (err: any) {
      setError(err?.message === 'Failed to fetch'
        ? 'Can’t reach the server right now. Check your connection and try again.'
        : err?.message || 'Course search failed. Please try again.');
    } finally {
      setScraping(false);
    }
  };

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchCourses(1);
    fetchFilters();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchCourses(1); }, 400);
    return () => clearTimeout(timer);
  }, [search, platform, level, category, price]);

  const clearFilters = () => {
    setSearch(''); setPlatform(''); setLevel(''); setCategory(''); setPrice('');
  };

  const hasActiveFilters = platform || level || category || price;

  const getLevelBadgeColor = (lvl: string) => {
    const colors: Record<string, string> = {
      'Beginner': 'bg-emerald-50 text-emerald-600',
      'Intermediate': 'bg-blue-50 text-blue-600',
      'Advanced': 'bg-purple-50 text-purple-600',
      'All Levels': 'bg-gray-100 text-gray-600',
    };
    return colors[lvl] || 'bg-gray-100 text-gray-600';
  };

  const getPlatformColor = (p: string) => {
    const colors: Record<string, string> = {
      'edX': 'text-red-500',
      'YouTube': 'text-red-600',
      'Coursera': 'text-blue-600',
      'Udemy': 'text-purple-600',
    };
    return colors[p] || 'text-gray-500';
  };

  return (
    <div>
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">Courses For You</h2>
              <p className="font-raleway text-sm text-gray-400 mt-1">Personalized course recommendations based on your profile</p>
            </div>
            <button
              onClick={runScraper}
              disabled={scraping}
              className="font-raleway flex items-center justify-center gap-2 self-start bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60"
            >
              {scraping ? <><FiLoader className="animate-spin" size={16} /> Finding Courses...</> : <><FiSearch size={16} /> Find New Courses</>}
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
                  placeholder="Search courses by title, instructor, or category..."
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-5 pt-5 border-t border-gray-50">
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Platforms</option>
                  {filters.platforms.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={level} onChange={(e) => setLevel(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Levels</option>
                  {filters.levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Categories</option>
                  {filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={price} onChange={(e) => setPrice(e.target.value)} className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value="">All Prices</option>
                  {filters.prices.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm">{error}</div>
          )}

          {/* Results count */}
          <div className="font-raleway flex items-center justify-between mb-6">
            <p className="text-sm text-gray-400">{total} courses found</p>
          </div>

          {/* Course Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <FoliLoader fullScreen={false} moods={['typing','happy','look-r']} messages={['Loading courses…','Finding skills to level up…']} />
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-16 text-center">
              <FiBookOpen className="mx-auto text-gray-200 mb-4" size={48} />
              <h3 className="font-century text-xl font-bold text-slate-700 mb-2">No Courses Found</h3>
              <p className="font-raleway text-sm text-gray-400 mb-6">Click &quot;Find New Courses&quot; to discover personalized courses based on your profile.</p>
              <button onClick={runScraper} disabled={scraping} className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60">
                {scraping ? 'Finding Courses...' : 'Find Courses Now'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {courses.map((course) => (
                <div key={course.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                  {/* Thumbnail */}
                  <div className="h-40 bg-gray-100 relative overflow-hidden">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className={`font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-white/90 backdrop-blur-sm ${getPlatformColor(course.platform)}`}>
                        {course.platform}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {course.match_score > 0 && (
                        <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-[#4F46E5] text-white shadow-sm">
                          {course.match_score}% match
                        </span>
                      )}
                      {course.price && (
                        <span className={`font-raleway text-[11px] font-bold px-3 py-1 rounded-lg ${course.price === 'Free' ? 'bg-emerald-500 text-white' : 'bg-white/90 backdrop-blur-sm text-slate-700'}`}>
                          {course.price}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <StarRating value={course.star_rating} />
                      {course.updated_label && (
                        <span className="font-raleway text-[11px] text-gray-400 flex items-center gap-1">
                          <FiCalendar size={11} /> {course.updated_label.replace('Updated ', '')}
                        </span>
                      )}
                    </div>

                    <h3 className="font-century text-base font-bold text-slate-800 line-clamp-2 group-hover:text-[#4F46E5] transition-colors mb-1">{course.title}</h3>
                    {course.instructor && course.instructor !== 'Not specified' && (
                      <p className="font-raleway text-xs text-gray-400 mb-2">{course.instructor}</p>
                    )}

                    {course.why_recommended && (
                      <p className="font-raleway text-[11px] text-[#4F46E5] flex items-start gap-1 mb-3">
                        <FiTarget size={12} className="mt-0.5 flex-shrink-0" /> <span className="line-clamp-1">{course.why_recommended}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {course.level && course.level !== 'Not specified' && (
                        <span className={`font-raleway text-[11px] font-bold px-3 py-1 rounded-lg ${getLevelBadgeColor(course.level)}`}>{course.level}</span>
                      )}
                      {course.category && (
                        <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-gray-50 text-gray-500">{course.category}</span>
                      )}
                    </div>

                    {/* Video / duration / reach stats */}
                    {(course.video_stats_label || course.views_label) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                        {course.video_stats_label && (
                          <span className="font-raleway text-[11px] text-gray-500 flex items-center gap-1">
                            <FiPlayCircle size={12} /> {course.video_stats_label}
                          </span>
                        )}
                        {course.views_label && (
                          <span className="font-raleway text-[11px] text-gray-400 flex items-center gap-1">
                            <FiEye size={12} /> {course.views_label}
                          </span>
                        )}
                      </div>
                    )}

                    {course.description && course.description !== 'Not specified' && (
                      <p className="font-raleway text-xs text-gray-400 line-clamp-2 mb-4">{course.description}</p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
                      <span className="font-raleway text-xs text-gray-400 flex items-center gap-1 min-w-0">
                        <FiClock size={12} className="flex-shrink-0" />
                        <span className="truncate">
                          {course.commitment_label || (course.duration !== 'Not specified' ? course.duration : 'Self-paced')}
                        </span>
                      </span>
                      <a
                        href={course.course_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        Enroll <FiExternalLink size={12} />
                      </a>
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
                onClick={() => fetchCourses(page - 1)}
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
                      onClick={() => fetchCourses(p)}
                      className={`font-raleway w-10 h-10 rounded-xl text-sm font-semibold transition-all ${p === page ? 'bg-[#4F46E5] text-white' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => fetchCourses(page + 1)}
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
