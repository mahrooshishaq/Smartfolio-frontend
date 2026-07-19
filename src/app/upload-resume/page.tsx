'use client';
import React, { useEffect, useState } from 'react';
import { CloudUpload, FileText, X, Loader2, ArrowLeft, FilePlus2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import BrandMark from '@/components/BrandMark';
import ResumeProfileReview from '@/components/ResumeProfileReview';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ResumeUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  // When set, the profile-review step is shown for this uploaded resume before
  // analysis runs. Cleared once the user confirms or skips.
  const [reviewResumeId, setReviewResumeId] = useState<string | null>(null);
  const router = useRouter();
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  const createBlankResume = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { router.push('/login'); return; }
    setIsUploading(true);
    try {
      const response = await fetch(`${API}/resume/create`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || 'Could not create a resume.');
      router.push(`/resume-editor?resumeId=${result.resumeId}&mode=create`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not create a resume.');
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch(`${API}/onboarding/context`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(context => setTargetRole(context?.targetRole || ''))
      .catch(() => undefined);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const lowerName = selectedFile.name.toLowerCase();
      const isSupported = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx');

      if (!isSupported) {
        alert('Only PDF and DOCX files are allowed.');
        setFile(null);
        e.target.value = '';
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        alert('File size must be 5MB or less.');
        setFile(null);
        e.target.value = '';
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const trimmedJobDescription = jobDescription.trim();
    if (trimmedJobDescription.length > 0 && trimmedJobDescription.length < 50) {
      alert('The target job description must be at least 50 characters.');
      return;
    }
    if (trimmedJobDescription && !jobTitle.trim()) {
      alert('Enter the job title so SmartFolio can label this evaluation correctly.');
      return;
    }
    setIsUploading(true);

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        alert("Please login first");
        router.push('/login');
        return;
      }

      // 1. Upload the Resume
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(`${API}/resume/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || 'Upload failed');

      // Normalize ID (checks for both common backend return keys)
      const actualResumeId = uploadData.resumeId || uploadData.id;

      if (!actualResumeId) {
        throw new Error("No Resume ID received from server.");
      }

      // 2. Profile-enrichment review step. We pause here and let the user
      //    confirm details we pulled from their resume (this improves job/course
      //    matching). Analysis runs afterwards, from the review component.
      setReviewResumeId(actualResumeId);

    } catch (error: unknown) {
      console.error("Upload Error:", error);
      alert(error instanceof Error ? error.message : 'Something went wrong during upload.');
      setIsUploading(false);
    }
  };

  // Runs the resume analysis (Lens A/B) and navigates to the results page.
  // Called by the review step once the user has confirmed or skipped profile enrichment.
  const runAnalysisAndRedirect = async (resumeId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        router.push('/login');
        return;
      }
      const trimmedJobDescription = jobDescription.trim();
      const analyzeRes = await fetch(`${API}/resume/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          resumeId,
          jobDescription: trimmedJobDescription || undefined,
          jobTitle: trimmedJobDescription ? jobTitle.trim() || undefined : undefined,
        }),
      });
      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json();
        throw new Error(errorData.message || 'Analysis failed');
      }
      router.push(`/analysis-results?resumeId=${resumeId}`);
    } catch (error: unknown) {
      console.error("Analysis Error:", error);
      alert(error instanceof Error ? error.message : 'Something went wrong during analysis.');
      setIsUploading(false);
      setReviewResumeId(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden p-8 flex flex-col items-center font-raleway">
      <AnimatedBackground />

      {reviewResumeId && (
        <ResumeProfileReview
          resumeId={reviewResumeId}
          onDone={() => runAnalysisAndRedirect(reviewResumeId)}
        />
      )}

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Header */}
        <div className="w-full max-w-4xl flex items-center mb-12">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <BrandMark className="w-7 h-7 ml-4" />
          <h1 className="font-baloo text-xl ml-4 tracking-wide text-slate-800">SmartFolio - AI</h1>
        </div>

        <div className="mb-5 w-full max-w-3xl rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 sm:flex sm:items-center sm:justify-between">
          <div><h2 className="font-century text-lg font-black text-slate-800">Don't have a resume yet?</h2><p className="mt-1 text-sm text-slate-500">Build one step by step with guided sections, examples, and SmartFolio suggestions.</p></div>
          <button onClick={createBlankResume} disabled={isUploading} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 sm:mt-0"><FilePlus2 size={16} /> Build with Folio</button>
        </div>

        <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 p-12 border border-gray-50">
          
          {/* Dropzone Area */}
          <div className="relative border-2 border-dashed border-gray-200 rounded-2rem p-12 flex flex-col items-center justify-center transition-colors hover:border-blue-200 group">
            <input 
              type="file" 
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="bg-slate-50 p-4 rounded-2xl mb-4 group-hover:bg-blue-50 transition-colors">
              <CloudUpload size={32} className="text-gray-400 group-hover:text-blue-500" />
            </div>
            <h2 className="font-century text-2xl text-slate-800 mb-1 text-center">Choose a file or drag & drop it here</h2>
            <p className="font-raleway text-gray-400 text-sm">PDF or DOCX files up to 5MB</p>
            
            <button className="font-raleway mt-8 bg-slate-200 text-gray-500 px-12 py-3 rounded-full font-bold text-sm tracking-wide">
              {file ? 'Change File' : 'Upload'}
            </button>
          </div>

          {/* Optional Job Description Input */}
          <div className="mt-8 px-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Target Job Description <span className="normal-case tracking-normal">— optional</span>
            </label>
            <textarea 
              placeholder={`Paste at least 50 characters for a specific job match. Leave blank to analyze for ${targetRole || 'your career target'}.`}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isUploading}
              className="font-raleway w-full h-32 p-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-100 outline-none transition-all resize-none disabled:opacity-50"
            />
            {jobDescription.trim() && <div className="mt-4"><label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Job title <span className="normal-case tracking-normal">— used to label this evaluation</span></label><input value={jobTitle} onChange={event => setJobTitle(event.target.value)} disabled={isUploading} placeholder="e.g. MLOps Engineer" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white" /></div>}
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>{jobDescription.trim() ? `Evaluating against: ${jobTitle.trim() || 'supplied job description'}` : targetRole ? `Career target: ${targetRole}` : 'General readiness analysis'}</span>
              <span className={jobDescription.trim().length > 0 && jobDescription.trim().length < 50 ? 'text-orange-500' : ''}>
                {jobDescription.trim().length}/10,000
              </span>
            </div>
          </div>

          {/* Selected File Progress / Preview */}
          {file && (
            <div className="mt-8 bg-slate-100 rounded-3xl p-6 flex items-center gap-4 relative animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-red-500 p-3 rounded-xl text-white">
                <FileText size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="font-raleway font-bold text-slate-700 text-sm truncate max-w-[250px]">{file.name}</span>
                  {!isUploading && (
                    <button onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-raleway text-[10px] font-bold text-gray-400 uppercase">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    {isUploading ? (
                      <Loader2 size={12} className="animate-spin text-blue-500" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                    <span className="font-raleway text-[10px] font-bold uppercase tracking-tighter">
                      {isUploading ? 'Analyzing with AI...' : 'Ready to Analyze'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          {file && !isUploading && (
            <button 
              onClick={handleUpload}
              className="font-raleway w-full mt-6 bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
            >
              Start AI Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
