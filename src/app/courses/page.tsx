'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import BrandMark from '@/components/BrandMark';
import {
  FiLogOut, FiLayout, FiFileText, FiMic,
  FiBookOpen, FiFile, FiBriefcase, FiHelpCircle,
  FiSettings, FiSearch, FiExternalLink, FiStar,
  FiChevronLeft, FiChevronRight, FiFilter, FiX, FiLoader, FiClock
} from 'react-icons/fi';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`font-raleway flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
  >
    <Icon size={20} />
    <span className="text-sm">{label}</span>
  </div>
);

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

  const runScraper = async () => {
    if (!token) return;
    setScraping(true);
    setError('');
    try {
      let res: Response;
      if (search.trim()) {
        // Custom search: scrape for the user's query and ADD to existing courses
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
      await fetchCourses(1);
      await fetchFilters();
    } catch (err: any) {
      setError(err.message || 'Scraper failed');
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

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

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
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-gray-100 p-8 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-12 px-2">
          <BrandMark className="w-7 h-7" />
          <h1 className="font-baloo text-xl ml-2 tracking-wide text-slate-800">SmartFolio - AI</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={FiLayout} label="Dashboard" onClick={() => router.push('/dashboard')} />
          <SidebarItem icon={FiFileText} label="Resume Analysis" onClick={() => router.push('/upload-resume')} />
          <SidebarItem icon={FiMic} label="Mock Interview" onClick={() => router.push('/mock-interview')} />
          <SidebarItem icon={FiBookOpen} label="Courses" active />
          <SidebarItem icon={FiFile} label="Document Generation" onClick={() => router.push('/document-generation')} />
          <SidebarItem icon={FiBriefcase} label="Jobs" onClick={() => router.push('/jobs')} />
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
              <h2 className="font-century text-3xl font-black text-slate-800">Courses For You</h2>
              <p className="font-raleway text-sm text-gray-400 mt-1">Personalized course recommendations based on your profile</p>
            </div>
            <button
              onClick={runScraper}
              disabled={scraping}
              className="font-raleway flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60"
            >
              {scraping ? <><FiLoader className="animate-spin" size={16} /> Finding Courses...</> : <><FiSearch size={16} /> Find New Courses</>}
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
              <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-50">
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
              <FiLoader className="animate-spin text-gray-300" size={32} />
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
                    {course.price && (
                      <div className="absolute top-3 right-3">
                        <span className={`font-raleway text-[11px] font-bold px-3 py-1 rounded-lg ${course.price === 'Free' ? 'bg-emerald-500 text-white' : 'bg-white/90 backdrop-blur-sm text-slate-700'}`}>
                          {course.price}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-century text-base font-bold text-slate-800 line-clamp-2 group-hover:text-[#4F46E5] transition-colors mb-2">{course.title}</h3>
                    {course.instructor && (
                      <p className="font-raleway text-xs text-gray-400 mb-3">{course.instructor}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {course.level && course.level !== 'Not specified' && (
                        <span className={`font-raleway text-[11px] font-bold px-3 py-1 rounded-lg ${getLevelBadgeColor(course.level)}`}>{course.level}</span>
                      )}
                      {course.category && (
                        <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-gray-50 text-gray-500">{course.category}</span>
                      )}
                    </div>

                    {course.description && (
                      <p className="font-raleway text-xs text-gray-400 line-clamp-2 mb-4">{course.description}</p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        {course.rating && course.rating !== '0' && (
                          <span className="font-raleway text-xs text-gray-500 flex items-center gap-1">
                            <FiStar size={12} className="text-yellow-400 fill-yellow-400" /> {course.rating}
                          </span>
                        )}
                        {course.duration && (
                          <span className="font-raleway text-xs text-gray-400 flex items-center gap-1">
                            <FiClock size={12} /> {course.duration}
                          </span>
                        )}
                      </div>
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
      </main>
    </div>
  );
}
