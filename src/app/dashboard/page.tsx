'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import { 
  FiLogOut, FiLayout, FiFileText, FiMic, 
  FiBookOpen, FiFile, FiBriefcase, FiHelpCircle, 
  FiSettings, FiChevronRight 
} from 'react-icons/fi';

// --- Sub-components to keep the main page clean ---

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`font-raleway flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
  >
    <Icon size={20} />
    <span className="text-sm">{label}</span>
  </div>
);

const ProgressBar = ({ label, value, colorClass = "bg-emerald-400" }: { label: string, value: number, colorClass?: string }) => (
  <div className="mb-5">
    <div className="font-raleway flex justify-between mb-1.5 text-xs font-bold text-gray-700 uppercase tracking-tight">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('Jane Doe'); // Logic preserved

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      // router.push('/login'); // Keep your auth logic commented as per original
    }
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="font-raleway min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400 font-medium">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* --- SIDEBAR --- */}
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
          <SidebarItem icon={FiLayout} label="Dashboard" active />
          <SidebarItem icon={FiFileText} label="Resume Analysis" onClick={() => router.push('/upload-resume')} />
          <SidebarItem icon={FiMic} label="Mock Interview" />
          <SidebarItem icon={FiBookOpen} label="Courses" />
          <SidebarItem icon={FiFile} label="Document Generation" />
          <SidebarItem icon={FiBriefcase} label="Jobs" />
        </nav>

        <div className="mt-auto pt-8 border-t border-gray-50 space-y-2">
          <p className="font-raleway text-[10px] font-bold text-gray-300 px-4 mb-4 uppercase tracking-[0.15em]">Support</p>
          <SidebarItem icon={FiHelpCircle} label="Get Started" />
          <div onClick={() => router.push('/dashboard/settings')}>
            <SidebarItem icon={FiSettings} label="Settings" />
          </div>
          <button onClick={handleLogout} className="w-full">
            <SidebarItem icon={FiLogOut} label="Logout" />
          </button>
          
          <div className="mt-8 px-4 py-2 bg-slate-50 rounded-2xl">
            <p className="font-century text-sm font-bold text-slate-800">{userName}</p>
            <p className="font-raleway text-[11px] text-gray-400 truncate">user@smartfolio.ai</p>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="relative flex-1 overflow-hidden p-10">
        <AnimatedBackground />
        <div className="relative z-10 h-full overflow-y-auto">
        <header className="flex justify-end mb-10">
          <div className="w-11 h-11 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg shadow-teal-100">
            {userName.charAt(0)}
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8">
          {/* Row 1: Job Applications & Activity */}
          <section className="col-span-12 lg:col-span-5 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
            <h3 className="font-raleway text-gray-400 text-xs font-bold mb-8 uppercase tracking-widest">Job Applications</h3>
            <ProgressBar label="Job Specific Resume" value={95} colorClass="bg-emerald-400" />
            <ProgressBar label="Mock Interviews" value={80} colorClass="bg-emerald-300" />
            <ProgressBar label="Cover Letters" value={35} colorClass="bg-emerald-200" />
          </section>

          <section className="col-span-12 lg:col-span-7 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-raleway text-gray-400 text-xs font-bold uppercase tracking-widest">Activity</h3>
              <span className="font-raleway text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">Month</span>
            </div>
            <div className="h-44 flex items-end justify-between gap-3 px-2">
              {[40, 60, 55, 85, 95, 70, 50, 40, 80, 100, 110, 120].map((h, i) => (
                <div key={i} className="bg-[#4F46E5] rounded-t-lg w-full opacity-90 hover:opacity-100 transition-all cursor-pointer" style={{ height: `${(h / 120) * 100}%` }} />
              ))}
            </div>
            <div className="font-raleway flex justify-between mt-4 px-1 text-[10px] font-bold text-gray-300 uppercase">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => <span key={m}>{m}</span>)}
            </div>
          </section>

          {/* Row 2: Personality, Interviews, Recently Viewed, Resume Score */}
          <div className="col-span-12 md:col-span-3 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
              <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-6 uppercase tracking-widest">Personality Assessment</h3>
              <p className="font-century text-4xl font-black text-slate-800 mb-1">64%</p>
              <p className="font-raleway text-lg font-bold text-slate-700 mb-8">Completed</p>
              <button className="font-raleway w-full bg-slate-100 hover:bg-slate-200 text-slate-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
                Complete <FiChevronRight />
              </button>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
              <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-6 uppercase tracking-widest text-center">UI/UX Course</h3>
              <ProgressBar label="Lectures" value={74} colorClass="bg-orange-400" />
              <ProgressBar label="Quiz" value={52} colorClass="bg-orange-300" />
              <ProgressBar label="Project" value={36} colorClass="bg-orange-200" />
            </div>
          </div>

          <section className="col-span-12 md:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
            <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-10 uppercase tracking-widest">Upcoming Interviews</h3>
            <div className="mt-12">
              <p className="font-century text-sm font-black text-slate-800">Dribbble</p>
              <p className="font-raleway text-gray-400 text-xs mb-2">UI/UX Designer</p>
              <p className="font-raleway text-xs font-bold text-slate-600">14 December, 2025</p>
            </div>
          </section>

          <section className="col-span-12 md:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
            <h3 className="font-raleway text-gray-400 text-[10px] font-bold mb-8 uppercase tracking-widest text-center">Recently Viewed</h3>
            <div className="space-y-5">
              {[
                { t: 'UI/UX Designer', p: '$120k-$150k' },
                { t: 'Interaction Designer', p: '$100k-$120k' },
                { t: 'Python Developer', p: '$150k-$180k' },
                { t: 'Frontend Developer', p: '$120k-$150k' },
              ].map((job, i) => (
                <div key={i} className="group cursor-pointer">
                  <p className="font-century text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{job.t}</p>
                  <p className="font-raleway text-[11px] text-gray-400 font-medium">Full Time | {job.p}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="col-span-12 md:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col items-center">
            <div className="relative w-36 h-36 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r="60" stroke="#F1F5F9" strokeWidth="12" fill="transparent" />
                <circle cx="72" cy="72" r="60" stroke="#F472B6" strokeWidth="12" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * 88) / 100} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-century text-3xl font-black text-slate-800">88/100</span>
                <span className="font-raleway text-[10px] font-bold text-gray-400 tracking-tighter uppercase">25 issues</span>
              </div>
            </div>
            <h4 className="font-century text-sm font-bold text-slate-800 mb-8">Your Resume Score</h4>
            <div className="w-full space-y-4">
              <div className="font-raleway flex justify-between text-[11px] font-bold"><span className="text-slate-500">Tone & Style</span><span className="text-orange-400">55/100</span></div>
              <div className="font-raleway flex justify-between text-[11px] font-bold"><span className="text-slate-500">Content</span><span className="text-red-400">25/100</span></div>
              <div className="font-raleway flex justify-between text-[11px] font-bold"><span className="text-slate-500">Structure</span><span className="text-emerald-400">70/100</span></div>
              <div className="font-raleway flex justify-between text-[11px] font-bold"><span className="text-slate-500">Skills</span><span className="text-red-400">32/100</span></div>
            </div>
          </section>
        </div>
        </div>
      </main>
    </div>
  );
}