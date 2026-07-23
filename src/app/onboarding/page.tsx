'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import { FiArrowRight, FiArrowLeft, FiCheck, FiMapPin, FiLoader } from 'react-icons/fi';

import { apiFetch } from '@/lib/api';

// --- Enums matching backend ---
const GOALS = [
  { value: 'job_matching', label: 'Find Jobs', desc: 'Get personalized job recommendations' },
  { value: 'course_recommendation', label: 'Find Courses', desc: 'Discover relevant learning paths' },
  { value: 'resume_improvement', label: 'Improve Resume', desc: 'Get AI-powered resume feedback' },
  { value: 'interview_preparation', label: 'Prepare for Interviews', desc: 'Practice with mock interviews' },
  { value: 'skill_development', label: 'Develop Skills', desc: 'Bridge your skill gaps' },
  { value: 'career_guidance', label: 'Career Guidance', desc: 'Get direction for your career' },
  { value: 'career_transition', label: 'Switch Careers', desc: 'Transition to a new field' },
  { value: 'university_search', label: 'Find Universities', desc: 'Explore higher education options' },
];

const CAREER_STAGES = [
  { value: 'exploring', label: 'Exploring', desc: 'Still figuring out my options' },
  { value: 'advancing', label: 'Advancing', desc: 'Moving up in my current field' },
  { value: 'transitioning', label: 'Transitioning', desc: 'Actively switching careers' },
  { value: 'pivoting', label: 'Pivoting', desc: 'Shifting within my industry' },
  { value: 'returning', label: 'Returning', desc: 'Coming back after a break' },
];

const EXPERIENCE_LEVELS = [
  { value: 'student', label: 'Student' },
  { value: 'recent_graduate', label: 'Recent Graduate' },
  { value: 'entry_level', label: 'Entry Level (0-2 yrs)' },
  { value: 'mid_level', label: 'Mid Level (3-5 yrs)' },
  { value: 'senior', label: 'Senior (6-10 yrs)' },
  { value: 'lead', label: 'Lead (10+ yrs)' },
  { value: 'executive', label: 'Executive' },
];

const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School' },
  { value: 'associate', label: 'Associate Degree' },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'phd', label: 'PhD' },
  { value: 'professional_cert', label: 'Professional Certificate' },
  { value: 'bootcamp', label: 'Bootcamp' },
];

const INDUSTRIES = [
  'technology', 'finance', 'healthcare', 'education', 'marketing',
  'engineering', 'design', 'sales', 'consulting', 'manufacturing',
  'retail', 'hospitality', 'legal', 'media', 'real_estate', 'other',
];

const formatIndustry = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const STEP_TITLES = [
  "What are your goals?",
  "Where are you in your career?",
  "Tell us about your background",
  "What roles interest you?",
  "Your skills & interests",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Goals
  const [goals, setGoals] = useState<string[]>([]);

  // Step 2: Career stage + experience
  const [careerStage, setCareerStage] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [educationLevel, setEducationLevel] = useState('');

  // Step 3: Industry & location
  const [currentIndustry, setCurrentIndustry] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [openToRemote, setOpenToRemote] = useState(false);
  const [willingToRelocate, setWillingToRelocate] = useState(false);

  // Step 4: Roles
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');

  // Step 5: Skills & interests
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  const toggleGoal = (g: string) => {
    setGoals(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 5 ? [...prev, g] : prev
    );
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && skills.length < 10 && !skills.includes(s)) {
      setSkills([...skills, s]);
      setSkillInput('');
    }
  };

  const addInterest = () => {
    const s = interestInput.trim();
    if (s && interests.length < 10 && !interests.includes(s)) {
      setInterests([...interests, s]);
      setInterestInput('');
    }
  };

  const canNext = () => {
    switch (step) {
      case 0: return goals.length >= 1;
      case 1: return careerStage && experienceLevel && educationLevel;
      case 2: return currentIndustry;
      case 3: return true; // roles are optional
      case 4: return true; // skills/interests optional
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }

    const body: any = {
      goals,
      careerStage,
      experienceLevel,
      educationLevel,
      currentIndustry,
    };
    if (targetIndustry) body.targetIndustry = targetIndustry;
    if (currentRole) body.currentRole = currentRole;
    if (targetRole) body.targetRole = targetRole;
    if (location) body.location = location;
    if (openToRemote) body.openToRemote = true;
    if (willingToRelocate) body.willingToRelocate = true;
    if (skills.length > 0) body.skills = skills;
    if (interests.length > 0) body.interests = interests;

    // Show welcome screen immediately
    setShowWelcome(true);

    try {
      const res = await apiFetch(`/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save profile');
      }
      // Wait a moment on welcome screen then go to dashboard
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setShowWelcome(false);
      setError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (showWelcome) {
    const displayName = localStorage.getItem('userName')?.split(' ')[0] || 'there';
    return (
      <div className="relative min-h-screen bg-[#F8FAFC] overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
          <div className="text-center animate-fade-in">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl">🎉</span>
              </div>
              <h1 className="font-century text-4xl font-black text-slate-800 mb-3">
                Welcome aboard, {displayName}!
              </h1>
              <p className="font-raleway text-gray-400 text-lg mb-2">
                Your profile is being set up
              </p>
              <p className="font-raleway text-gray-300 text-sm">
                We&apos;re finding personalized jobs and courses for you...
              </p>
            </div>
            <div className="flex gap-1.5 justify-center mt-8">
              <div className="w-2 h-2 rounded-full bg-[#4F46E5] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-[#4F46E5] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-[#4F46E5] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-8 px-2">
            {STEP_TITLES.map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: i < step ? '100%' : i === step ? '50%' : '0%',
                    background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-[2.5rem] shadow-xl p-5 sm:p-10 border border-gray-50">

            {/* Step title */}
            <div className="mb-2 text-xs font-semibold text-indigo-500 uppercase tracking-wider font-raleway">
              Step {step + 1} of {STEP_TITLES.length}
            </div>
            <h2 className="font-raleway text-2xl font-bold text-slate-800 mb-6">
              {STEP_TITLES[step]}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-raleway">{error}</div>
            )}

            {/* === STEP 0: Goals === */}
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 font-raleway mb-4">Select 1-5 goals that matter most to you.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GOALS.map(g => {
                    const selected = goals.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        onClick={() => toggleGoal(g.value)}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-raleway text-sm font-semibold ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {g.label}
                          </span>
                          {selected && <FiCheck className="text-indigo-500" size={16} />}
                        </div>
                        <span className="font-raleway text-xs text-gray-400 mt-1 block">{g.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === STEP 1: Career Stage === */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Career Stage */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-3">Career Stage</label>
                  <div className="grid grid-cols-1 gap-2">
                    {CAREER_STAGES.map(cs => (
                      <button
                        key={cs.value}
                        onClick={() => setCareerStage(cs.value)}
                        className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                          careerStage === cs.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <span className={`font-raleway text-sm font-semibold ${careerStage === cs.value ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {cs.label}
                        </span>
                        <span className="font-raleway text-xs text-gray-400 ml-2">{cs.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience Level */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-3">Experience Level</label>
                  <div className="flex flex-wrap gap-2">
                    {EXPERIENCE_LEVELS.map(el => (
                      <button
                        key={el.value}
                        onClick={() => setExperienceLevel(el.value)}
                        className={`px-4 py-2 rounded-full text-sm font-raleway font-medium transition-all border-2 ${
                          experienceLevel === el.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        {el.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Education Level */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-3">Education Level</label>
                  <div className="flex flex-wrap gap-2">
                    {EDUCATION_LEVELS.map(ed => (
                      <button
                        key={ed.value}
                        onClick={() => setEducationLevel(ed.value)}
                        className={`px-4 py-2 rounded-full text-sm font-raleway font-medium transition-all border-2 ${
                          educationLevel === ed.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        {ed.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === STEP 2: Industry & Location === */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Current Industry */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-3">Current Industry *</label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.map(ind => (
                      <button
                        key={ind}
                        onClick={() => setCurrentIndustry(ind)}
                        className={`px-3 py-1.5 rounded-full text-xs font-raleway font-medium transition-all border-2 ${
                          currentIndustry === ind
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        {formatIndustry(ind)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Industry */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-3">Target Industry (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.map(ind => (
                      <button
                        key={ind}
                        onClick={() => setTargetIndustry(targetIndustry === ind ? '' : ind)}
                        className={`px-3 py-1.5 rounded-full text-xs font-raleway font-medium transition-all border-2 ${
                          targetIndustry === ind
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-100 hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        {formatIndustry(ind)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-2">Your Location</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="e.g. Lahore, Pakistan"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="font-raleway w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setOpenToRemote(!openToRemote)}
                      className={`w-10 h-6 rounded-full transition-all relative ${openToRemote ? 'bg-indigo-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${openToRemote ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                    <span className="font-raleway text-sm text-gray-700">Open to remote</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setWillingToRelocate(!willingToRelocate)}
                      className={`w-10 h-6 rounded-full transition-all relative ${willingToRelocate ? 'bg-indigo-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${willingToRelocate ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                    <span className="font-raleway text-sm text-gray-700">Willing to relocate</span>
                  </label>
                </div>
              </div>
            )}

            {/* === STEP 3: Roles === */}
            {step === 3 && (
              <div className="space-y-6">
                <p className="text-sm text-gray-500 font-raleway">Leave blank if you&apos;re still exploring.</p>
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-2">Current Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Frontend Developer"
                    value={currentRole}
                    onChange={e => setCurrentRole(e.target.value)}
                    className="font-raleway w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-2">Target Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Full Stack Engineer"
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value)}
                    className="font-raleway w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>
            )}

            {/* === STEP 4: Skills & Interests === */}
            {step === 4 && (
              <div className="space-y-6">
                {/* Skills */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-2">
                    Skills <span className="font-normal text-gray-400">(up to 10)</span>
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g. JavaScript, Python, Figma"
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      className="font-raleway flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                    />
                    <button
                      onClick={addSkill}
                      disabled={!skillInput.trim() || skills.length >= 10}
                      className="px-4 py-3 bg-indigo-500 text-white rounded-xl text-sm font-semibold font-raleway hover:bg-indigo-600 transition-colors disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skills.map(s => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium font-raleway"
                      >
                        {s}
                        <button onClick={() => setSkills(skills.filter(x => x !== s))} className="hover:text-indigo-900">&times;</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interests */}
                <div>
                  <label className="font-raleway text-sm font-semibold text-slate-700 block mb-2">
                    Interests <span className="font-normal text-gray-400">(up to 10)</span>
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g. AI/ML, Web Development, Cloud"
                      value={interestInput}
                      onChange={e => setInterestInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                      className="font-raleway flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                    />
                    <button
                      onClick={addInterest}
                      disabled={!interestInput.trim() || interests.length >= 10}
                      className="px-4 py-3 bg-purple-500 text-white rounded-xl text-sm font-semibold font-raleway hover:bg-purple-600 transition-colors disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interests.map(s => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium font-raleway"
                      >
                        {s}
                        <button onClick={() => setInterests(interests.filter(x => x !== s))} className="hover:text-purple-900">&times;</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              {step > 0 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="font-raleway flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <FiArrowLeft size={16} /> Back
                </button>
              ) : (
                <div />
              )}

              {step < STEP_TITLES.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canNext()}
                  className="font-raleway flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue <FiArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="font-raleway flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-60"
                >
                  {submitting ? (
                    <><FiLoader className="animate-spin" size={16} /> Saving...</>
                  ) : (
                    <><FiCheck size={16} /> Complete Setup</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
