'use client';
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { CloudUpload, FileText, X, Loader2, ArrowLeft, FilePlus2, Briefcase, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import BrandMark from '@/components/BrandMark';
import ResumeProfileReview from '@/components/ResumeProfileReview';

import { apiFetch } from '@/lib/api';
import { peekJobHandoff, clearJobHandoff, HANDOFF_PARAM, type JobHandoff } from '@/lib/job-handoff';
import { useFeedback } from '@/components/ui/feedback';
import { fetchRoleFromParam } from '@/lib/role-prefill';

/** The user's stored CV, and whether it can actually be analysed right now. */
interface SavedResume {
  resumeId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  analyzable: boolean;
  originalAvailable?: boolean;
  extractedTextAvailable?: boolean;
}

export default function ResumeUploadPage() {
  return (
    <Suspense fallback={null}>
      <ResumeUploadContent />
    </Suspense>
  );
}

function ResumeUploadContent() {
  const { error: showError } = useFeedback();
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [urlState, setUrlState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [urlNote, setUrlNote] = useState('');

  /*
   * Arriving from "Sharpen your CV" in the confirmation email.
   *
   * The description is filled in from the role they applied to, because they no
   * longer have it: they applied, and the advert is behind them. Only when the
   * box is still empty, so it can never overwrite something typed.
   */
  useEffect(() => {
    let cancelled = false;
    void fetchRoleFromParam(window.location.search).then((role) => {
      if (cancelled || !role) return;
      setJobDescription((current) => current.trim() || role.jobDescription);
      setJobTitle((current) => current.trim() || role.title);
      setUrlState('ok');
      setUrlNote(
        `Filled in from your application to ${role.title}${role.company ? ` at ${role.company}` : ''}.`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Read the advert off a link and put it in the box.
   *
   * It fills the textarea rather than scoring straight from the fetch, on
   * purpose: the person sees exactly what will be compared against their CV and
   * can correct it. A silent fetch that scored against the wrong half of a page
   * would look identical to a good one, which is the failure worth designing
   * against here.
   */
  async function loadFromUrl() {
    const url = jobUrl.trim();
    if (!url) return;
    setUrlState('loading');
    setUrlNote('');
    try {
      const res = await apiFetch('/api/me/readiness/job-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setUrlState('error');
        // The server's refusals already say what to do instead, so they are
        // shown as written rather than replaced with something vaguer.
        setUrlNote(body?.message || 'We could not read that page. Paste the description instead.');
        return;
      }
      setJobDescription(body.description ?? '');
      if (body.title && !jobTitle.trim()) setJobTitle(body.title);
      setUrlState('ok');
      setUrlNote(
        [
          body.confidence === 'certain'
            ? 'Read from the posting data this board publishes.'
            : 'Read from the page text, so check it looks right before analysing.',
          [body.title, body.company, body.location].filter(Boolean).join(' · '),
        ]
          .filter(Boolean)
          .join(' ')
      );
    } catch {
      setUrlState('error');
      setUrlNote('We could not reach that page. Paste the description instead.');
    }
  }
  const [jobTitle, setJobTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  // When set, the profile-review step is shown for this uploaded resume before
  // analysis runs. Cleared once the user confirms or skips.
  const [reviewResumeId, setReviewResumeId] = useState<string | null>(null);

  // Set when the user arrived from "Tailor my CV" on a job card.
  const [handoffJob, setHandoffJob] = useState<JobHandoff | null>(null);
  // The CV already on file. `checking` keeps the upload box from flashing into
  // view before we know whether we can offer the saved one instead.
  const [savedResume, setSavedResume] = useState<SavedResume | null>(null);
  const [checkingSaved, setCheckingSaved] = useState(true);
  // False once the user explicitly chooses to upload a replacement.
  const [useSaved, setUseSaved] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();
  // Applied once per visit. The stash itself is left in place so a remount can
  // re-read it; this only stops the prefill overwriting the user's own edits.
  const handoffApplied = useRef(false);
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  const createBlankResume = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { router.push('/login'); return; }
    setIsUploading(true);
    try {
      const response = await apiFetch(`/resume/create`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || 'Could not create a resume.');
      router.push(`/resume-editor?resumeId=${result.resumeId}&mode=create`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not create a resume.');
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    apiFetch(`/onboarding/context`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(context => setTargetRole(context?.targetRole || ''))
      .catch(() => undefined);
  }, []);

  /**
   * Arrived from a job card: the posting is waiting in sessionStorage.
   *
   * Reading does NOT consume it, and the URL flag stays put. This page reads
   * useSearchParams inside a Suspense boundary, and a remount after hydration
   * used to find an empty stash and a stripped URL — so the description the
   * user had just seen vanished a moment later. Re-reading on every mount makes
   * the prefill idempotent; `handoffApplied` then stops it fighting the user's
   * own edits once they start typing.
   */
  useEffect(() => {
    if (searchParams.get(HANDOFF_PARAM) !== 'resume' || handoffApplied.current) return;

    const job = peekJobHandoff('resume');
    if (!job) return;

    handoffApplied.current = true;
    setHandoffJob(job);
    setJobDescription(job.description);
    // The analysis labels itself with this, and the backend requires it
    // whenever a description is supplied — filling it saves the user typing
    // out a title we already know.
    setJobTitle(job.title);
  }, [searchParams]);

  /** The user is done with the carried job — stop it coming back on a remount. */
  const dismissHandoff = () => {
    clearJobHandoff('resume');
    setHandoffJob(null);
    setJobDescription('');
    setJobTitle('');
  };

  // Look for a CV already on file so the user doesn't re-upload one we hold.
  // `analyzable` is the backend's own verdict, not merely "a row exists":
  // uploaded files live on the container disk, which is wiped on every rebuild,
  // so a saved CV can outlive its file. Trusting a row alone would offer a
  // one-click analysis that then fails.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setCheckingSaved(false); return; }

    let cancelled = false;
    apiFetch(`/resume/latest`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => (response.ok ? response.json() : null))
      .then((saved: SavedResume | null) => { if (!cancelled) setSavedResume(saved ?? null); })
      .catch(() => { if (!cancelled) setSavedResume(null); })
      .finally(() => { if (!cancelled) setCheckingSaved(false); });

    return () => { cancelled = true; };
  }, []);

  // The saved CV is offered only when the backend says it can actually be
  // analysed; otherwise the upload box is the honest thing to show.
  const savedIsUsable = !!savedResume?.analyzable;
  const showSavedCard = savedIsUsable && useSaved && !file;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const lowerName = selectedFile.name.toLowerCase();
      const isSupported = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx');

      if (!isSupported) {
        showError('Only PDF and DOCX files are allowed.');
        setFile(null);
        e.target.value = '';
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        showError('File size must be 5MB or less.');
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
      showError('The target job description must be at least 50 characters.');
      return;
    }
    if (trimmedJobDescription && !jobTitle.trim()) {
      showError('Enter the job title so SmartFolio can label this evaluation correctly.');
      return;
    }
    setIsUploading(true);

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        showError('Please login first');
        router.push('/login');
        return;
      }

      // 1. Upload the Resume
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await apiFetch(`/resume/upload`, {
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
      showError(error instanceof Error ? error.message : 'Something went wrong during upload.');
      setIsUploading(false);
    }
  };

  /**
   * Analyse the CV we already hold. Validates the same rules handleUpload does,
   * because the backend rejects a description under 50 characters and requires
   * a title alongside one — failing here with a clear message beats a 400.
   */
  const analyzeSavedResume = async () => {
    if (!savedResume) return;
    const trimmedJobDescription = jobDescription.trim();
    if (trimmedJobDescription.length > 0 && trimmedJobDescription.length < 50) {
      showError('The target job description must be at least 50 characters.');
      return;
    }
    if (trimmedJobDescription && !jobTitle.trim()) {
      showError('Enter the job title so SmartFolio can label this evaluation correctly.');
      return;
    }
    setIsUploading(true);
    await runAnalysisAndRedirect(savedResume.resumeId);
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
      const analyzeRes = await apiFetch(`/resume/analyze`, {
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
      // The carried job has done its job only after analysis succeeds.
      clearJobHandoff('resume');
      router.push(`/analysis-results?resumeId=${resumeId}`);
    } catch (error: unknown) {
      console.error("Analysis Error:", error);
      showError(error instanceof Error ? error.message : 'Something went wrong during analysis.');
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

        {/* Show the builder whenever there is no active saved-CV shortcut. */}
        {(!savedIsUsable || !useSaved) && (
          <div className="mb-5 w-full max-w-3xl rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 sm:flex sm:items-center sm:justify-between">
            <div><h2 className="font-century text-lg font-black text-slate-800">Don&apos;t have a resume yet?</h2><p className="mt-1 text-sm text-slate-500">Build one step by step with guided sections, examples, and SmartFolio suggestions.</p></div>
            <button onClick={createBlankResume} disabled={isUploading} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 sm:mt-0"><FilePlus2 size={16} /> Build with Folio</button>
          </div>
        )}

        {/* Arrived from a job card: name the posting, so a pre-filled
            description reads as intentional rather than as leftover text. */}
        {handoffJob && (
          <div className="mb-5 w-full max-w-3xl flex items-start gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/70 px-5 py-4">
            <span className="mt-0.5 text-indigo-600"><Briefcase size={16} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                Tailoring for {handoffJob.title}
                {handoffJob.company && <span className="font-normal text-slate-500"> · {handoffJob.company}</span>}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                The job description below came from your jobs. Adjust anything, then start the analysis.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissHandoff}
              aria-label="Clear this job and analyse against your career target instead"
              className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 p-12 border border-gray-50">

          {/* A CV we already hold, offered instead of making the user find the
              file again. Only shown when the backend confirms it is still
              analysable. */}
          {checkingSaved ? (
            <div className="flex items-center justify-center gap-2 rounded-[2rem] border border-slate-100 bg-slate-50/60 p-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Checking for a saved CV…
            </div>
          ) : showSavedCard ? (
            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/60 p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-white p-3 text-emerald-600 shadow-sm">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-century text-lg font-black text-slate-800">Using your saved CV</p>
                  <p className="mt-1 truncate text-sm text-slate-600">{savedResume!.fileName}</p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    {savedResume!.originalAvailable ? 'Ready to analyse - no re-upload needed' : 'Ready to analyse from saved text'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUseSaved(false)}
                disabled={isUploading}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:opacity-50"
              >
                <RefreshCw size={14} /> Use a different CV
              </button>
              {!savedResume!.originalAvailable && (
                <p className="mt-4 rounded-2xl border border-amber-100 bg-white px-4 py-3 text-xs leading-relaxed text-amber-800">
                  The original file itself is not available, so preview/download may use the formatted SmartFolio version. Re-upload this CV to restore the original file.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* The row survived but the file did not: uploads sit on the
                  container disk, which is wiped on every rebuild. Name the file
                  so this reads as "we lost your copy", not "you never uploaded
                  one", and be honest that a re-upload is the only way forward
                  until CVs are stored somewhere durable. */}
              {savedResume && !savedResume.analyzable && (
                <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-800">
                  We have <span className="font-bold">{savedResume.fileName}</span> on record, but the file
                  itself is no longer stored on the server, so it can&apos;t be previewed, downloaded or
                  edited. Please upload it again to run this analysis.
                </div>
              )}
              {savedResume?.analyzable && !savedResume.originalAvailable && (
                <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-800">
                  We can analyze <span className="font-bold">{savedResume.fileName}</span> from saved extracted text,
                  but the original file preview and download need a re-upload.
                </div>
              )}

              {/* Dropzone Area.
                  Confirmation lands HERE, on the zone the user just clicked,
                  rather than only in the file card further down the page. The
                  card sits below the job-description box and is routinely off
                  screen, so picking a file looked like nothing had happened. */}
              <div className={`relative border-2 border-dashed rounded-2rem p-12 flex flex-col items-center justify-center transition-colors group ${file ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 hover:border-blue-200'}`}>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                {file ? (
                  <>
                    <div className="mb-4 rounded-2xl bg-emerald-100 p-4">
                      <CheckCircle2 size={32} className="text-emerald-600" />
                    </div>
                    <h2 className="font-century mb-1 text-center text-2xl text-emerald-800">CV attached</h2>
                    <p className="font-raleway max-w-full truncate px-4 text-sm font-bold text-emerald-700">{file.name}</p>
                    <p className="font-raleway mt-1 text-xs text-emerald-600">
                      {(file.size / 1024).toFixed(0)} KB · ready to analyse
                    </p>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-50 p-4 rounded-2xl mb-4 group-hover:bg-blue-50 transition-colors">
                      <CloudUpload size={32} className="text-gray-500 group-hover:text-blue-500" />
                    </div>
                    <h2 className="font-century text-2xl text-slate-800 mb-1 text-center">Choose a file or drag &amp; drop it here</h2>
                    <p className="font-raleway text-gray-500 text-sm">PDF or DOCX files up to 5MB</p>
                  </>
                )}

                <button className={`font-raleway mt-8 px-12 py-3 rounded-full font-bold text-sm tracking-wide ${file ? 'bg-white text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-gray-500'}`}>
                  {file ? 'Change File' : 'Upload'}
                </button>
              </div>

              {savedIsUsable && !useSaved && (
                <button
                  type="button"
                  onClick={() => { setUseSaved(true); setFile(null); }}
                  className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  ← Go back to my saved CV
                </button>
              )}
            </>
          )}

          {/* Analysis lens */}
          <div className="mt-8 px-4">
            <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
              <p className="font-century text-sm font-black text-slate-800">How SmartFolio will analyze this resume</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Leave this blank to score your resume against your saved career target
                {targetRole ? ` (${targetRole})` : ''}. Paste a job description to switch into a targeted match lens that checks your CV against that role&apos;s requirements.
              </p>
            </div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
              Job description for targeted analysis
            </label>

            {/* One box, either kind of input.
                People do not have the advert text, they have the tab it is open
                in — and asking them to select exactly the right part of a job
                board page is where they give up. Pasting a link fills the box
                below with what the page actually said, so they can see and edit
                what is being scored against rather than trusting a fetch. */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void loadFromUrl();
                  }
                }}
                disabled={isUploading || urlState === 'loading'}
                placeholder="Or paste a link to the job posting"
                className="font-raleway w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-200 focus:bg-white disabled:opacity-50"
                data-testid="job-url-input"
              />
              <button
                type="button"
                onClick={() => void loadFromUrl()}
                disabled={!jobUrl.trim() || isUploading || urlState === 'loading'}
                className="font-raleway shrink-0 rounded-2xl bg-slate-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-40"
                data-testid="job-url-fetch"
              >
                {urlState === 'loading' ? 'Reading…' : 'Read it'}
              </button>
            </div>

            {urlNote && (
              <p
                className={
                  'mb-3 rounded-xl px-3 py-2 text-[13px] leading-relaxed ' +
                  (urlState === 'error'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-emerald-50 text-emerald-900')
                }
                data-testid="job-url-note"
              >
                {urlNote}
              </p>
            )}

            <textarea 
              placeholder={`Paste at least 50 characters for a specific job match. Leave blank to analyze for ${targetRole || 'your career target'}.`}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isUploading}
              className="font-raleway w-full h-32 p-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-100 outline-none transition-all resize-none disabled:opacity-50"
            />
            {jobDescription.trim() && <div className="mt-4"><label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Job title <span className="normal-case tracking-normal">used to label this evaluation</span></label><input value={jobTitle} onChange={event => setJobTitle(event.target.value)} disabled={isUploading} placeholder="e.g. MLOps Engineer" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white" /></div>}
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                    <button onClick={() => setFile(null)} className="text-gray-500 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-raleway text-[10px] font-bold text-gray-500 uppercase">
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

          {/* Action Button. The saved-CV path skips upload entirely and goes
              straight to analysis. That is the whole point of holding a CV.
              It also skips the profile-review step, which exists to enrich the
              profile from a NEWLY uploaded resume and has nothing to add here. */}
          {showSavedCard && !isUploading && (
            <button
              onClick={analyzeSavedResume}
              className="sf-dark-cta font-raleway mt-6 flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
            >
              Start AI Analysis
            </button>
          )}
          {file && !isUploading && (
            <button
              onClick={handleUpload}
              className="sf-dark-cta font-raleway mt-6 flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
            >
              Start AI Analysis
            </button>
          )}
          {isUploading && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 size={16} className="animate-spin text-indigo-500" /> Analyzing with AI…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
