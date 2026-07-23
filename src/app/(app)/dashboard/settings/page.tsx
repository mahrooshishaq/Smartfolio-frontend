'use client';
import FoliLoader from '@/components/foli/FoliLoader';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiArrowLeft, FiSave, FiLoader, FiX, FiPlus, FiCheck,
} from 'react-icons/fi';

import { apiFetch } from '@/lib/api';

// --- Enums (matching backend) ---
const CAREER_STAGES = [
  { value: 'exploring', label: 'Exploring' },
  { value: 'advancing', label: 'Advancing' },
  { value: 'transitioning', label: 'Transitioning' },
  { value: 'pivoting', label: 'Pivoting' },
  { value: 'returning', label: 'Returning' },
];

const EXPERIENCE_LEVELS = [
  { value: 'student', label: 'Student' },
  { value: 'recent_graduate', label: 'Recent Graduate' },
  { value: 'entry_level', label: 'Entry Level' },
  { value: 'mid_level', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
];

const INDUSTRIES = [
  'technology', 'finance', 'healthcare', 'education', 'marketing',
  'engineering', 'design', 'sales', 'consulting', 'manufacturing',
  'retail', 'hospitality', 'legal', 'media', 'real_estate', 'other',
];

// --- Sub-components ---
const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <div>
    <label className="font-raleway text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="font-raleway w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all"
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const TextField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div>
    <label className="font-raleway text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="font-raleway w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all"
    />
  </div>
);

const TagInput = ({ label, tags, onChange, placeholder }: { label: string; tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <label className="font-raleway text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="font-raleway text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center gap-1.5">
            {tag}
            <FiX size={12} className="cursor-pointer hover:text-red-400 transition-colors" onClick={() => removeTag(tag)} />
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="font-raleway flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all"
        />
        <button onClick={addTag} className="shrink-0 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3 py-2.5 rounded-xl transition-all">
          <FiPlus size={16} />
        </button>
      </div>
    </div>
  );
};

const ToggleField = ({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="font-raleway text-sm font-bold text-slate-700">{label}</p>
      {description && <p className="font-raleway text-xs text-gray-400">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-all ${value ? 'bg-[#4F46E5]' : 'bg-gray-200'} relative`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${value ? 'left-6' : 'left-0.5'}`} />
    </button>
  </div>
);

// --- Main Page ---
export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  // Form state
  const [careerStage, setCareerStage] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [currentIndustry, setCurrentIndustry] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [targetLocation, setTargetLocation] = useState('');
  const [openToRemote, setOpenToRemote] = useState(false);
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }

    try {
      const res = await apiFetch(`/onboarding/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();

      setCareerStage(data.careerStage || '');
      setExperienceLevel(data.experienceLevel || '');
      setCurrentRole(data.currentRole || '');
      setTargetRole(data.targetRole || '');
      setSkills(data.skills || []);

      // Fetch full profile for fields not in context
      const profileRes = await apiFetch(`/onboarding/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setCurrentIndustry(profile.currentIndustry || '');
        setTargetIndustry(profile.targetIndustry || '');
        setLocation(profile.location || '');
        setTargetLocation(profile.targetLocation || '');
        setOpenToRemote(profile.openToRemote || false);
        setWillingToRelocate(profile.willingToRelocate || false);
        setInterests(profile.interests || []);
        setBio(profile.bio || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const body: Record<string, any> = {};
      if (careerStage) body.careerStage = careerStage;
      if (experienceLevel) body.experienceLevel = experienceLevel;
      if (currentRole) body.currentRole = currentRole;
      if (targetRole) body.targetRole = targetRole;
      if (currentIndustry) body.currentIndustry = currentIndustry;
      if (targetIndustry) body.targetIndustry = targetIndustry;
      if (location) body.location = location;
      if (targetLocation) body.targetLocation = targetLocation;
      body.openToRemote = openToRemote;
      body.willingToRelocate = willingToRelocate;
      if (skills.length > 0) body.skills = skills;
      if (interests.length > 0) body.interests = interests;
      if (bio) body.bio = bio;

      const res = await apiFetch(`/onboarding/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update profile');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex items-center justify-center">
        <FoliLoader fullScreen={false} moods={['idle','look-r']} messages={['Loading your settings…']} />
      </div>
    );
  }

  return (
    <div>

          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-slate-700 transition-colors min-h-11 min-w-11 flex items-center justify-center -ml-2">
                <FiArrowLeft size={20} />
              </button>
              <div>
                <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">Profile Settings</h2>
                <p className="font-raleway text-sm text-gray-400 mt-1">Update your career profile to improve recommendations</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`font-raleway flex items-center justify-center gap-2 self-start px-6 py-3 rounded-2xl font-semibold text-sm transition-all ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white disabled:opacity-60'
              }`}
            >
              {saving ? <><FiLoader className="animate-spin" size={16} /> Saving...</>
                : saved ? <><FiCheck size={16} /> Saved!</>
                : <><FiSave size={16} /> Save Changes</>}
            </button>
          </div>

          {error && (
            <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm">{error}</div>
          )}

          {/* Form Sections */}
          <div className="space-y-6">

            {/* Career Info */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-8">
              <h3 className="font-century text-lg font-bold text-slate-800 mb-6">Career Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <TextField label="Current Role" value={currentRole} onChange={setCurrentRole} placeholder="e.g. Software Engineer" />
                <TextField label="Target Role" value={targetRole} onChange={setTargetRole} placeholder="e.g. Senior Software Engineer" />
                <SelectField label="Career Stage" value={careerStage} onChange={setCareerStage} options={CAREER_STAGES} />
                <SelectField label="Experience Level" value={experienceLevel} onChange={setExperienceLevel} options={EXPERIENCE_LEVELS} />
                <SelectField
                  label="Current Industry"
                  value={currentIndustry}
                  onChange={setCurrentIndustry}
                  options={INDUSTRIES.map((i) => ({ value: i, label: i.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                />
                <SelectField
                  label="Target Industry"
                  value={targetIndustry}
                  onChange={setTargetIndustry}
                  options={INDUSTRIES.map((i) => ({ value: i, label: i.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                />
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-8">
              <h3 className="font-century text-lg font-bold text-slate-800 mb-6">Location & Preferences</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                <TextField label="Current Location" value={location} onChange={setLocation} placeholder="e.g. Lahore, Pakistan" />
                <TextField label="Target Location" value={targetLocation} onChange={setTargetLocation} placeholder="e.g. Dubai, UAE" />
              </div>
              <div className="border-t border-gray-50 pt-4 space-y-1">
                <ToggleField label="Open to Remote" description="Show remote job opportunities" value={openToRemote} onChange={setOpenToRemote} />
                <ToggleField label="Willing to Relocate" description="Include jobs in other locations" value={willingToRelocate} onChange={setWillingToRelocate} />
              </div>
            </div>

            {/* Skills & Interests */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-8">
              <h3 className="font-century text-lg font-bold text-slate-800 mb-6">Skills & Interests</h3>
              <div className="space-y-6">
                <TagInput label="Skills" tags={skills} onChange={setSkills} placeholder="Type a skill and press Enter" />
                <TagInput label="Interests" tags={interests} onChange={setInterests} placeholder="Type an interest and press Enter" />
              </div>
            </div>

            {/* Bio */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-8">
              <h3 className="font-century text-lg font-bold text-slate-800 mb-6">About You</h3>
              <div>
                <label className="font-raleway text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Professional Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself, your career goals, and what you're looking for..."
                  rows={4}
                  className="font-raleway w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>

          </div>
    </div>
  );
}
