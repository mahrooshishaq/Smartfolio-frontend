'use client';

import FoliLoader from '@/components/foli/FoliLoader';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Cloud, Download, GripVertical, Loader2, Plus, Save, Sparkles, Trash2, WandSparkles, X } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Improvement {
  category: string;
  severity: 'critical' | 'important' | 'polish';
  title: string;
  currentText: string;
  suggestedText: string;
  explanation: string;
  impact: string;
}

interface Analysis {
  analysisId: string;
  targetRole?: string;
  remarks: {
    improvements: Improvement[];
    positiveHighlights: { text: string; reason: string }[];
  };
}

interface ResumeDocument {
  personal: { name: string; email: string; phone: string; location: string; linkedin: string; github: string; website: string };
  summary: string;
  skills: string[];
  experience: { title: string; company: string; location: string; startDate: string; endDate: string; bullets: string[] }[];
  education: { degree: string; institution: string; location: string; startDate: string; endDate: string; details: string[] }[];
  projects: { name: string; role: string; link: string; technologies: string[]; bullets: string[] }[];
  certifications: { name: string; issuer: string; date: string }[];
  languages: string[];
  sectionOrder: SectionKey[];
}

type SectionKey = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'languages';
const DEFAULT_SECTION_ORDER: SectionKey[] = ['summary', 'skills', 'experience', 'education', 'projects', 'certifications', 'languages'];
const SECTION_LABELS: Record<SectionKey, string> = { summary: 'Professional summary', skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects', certifications: 'Certifications', languages: 'Languages' };

type Annotation = { kind: 'improvement' | 'positive'; index: number } | null;

export default function ResumeEditorPage() {
  return <Suspense fallback={<LoadingState />}><EditorContent /></Suspense>;
}

function EditorContent() {
  const router = useRouter();
  const params = useSearchParams();
  const resumeId = params.get('resumeId');
  const analysisId = params.get('analysisId');
  const [fileName, setFileName] = useState('resume');
  const [document, setDocument] = useState<ResumeDocument | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedImprovement, setSelectedImprovement] = useState<number | null>(null);
  const [selectedPositive, setSelectedPositive] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionKey | null>(null);
  const loadedRef = useRef(false);
  const latestDocumentRef = useRef<ResumeDocument | null>(null);

  useEffect(() => { latestDocumentRef.current = document; }, [document]);

  useEffect(() => {
    const load = async () => {
      if (!resumeId) { setError('Missing resume ID.'); setLoading(false); return; }
      const token = localStorage.getItem('accessToken');
      if (!token) { router.push('/login'); return; }
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [contentRes, documentRes, analysesRes] = await Promise.all([
          fetch(`${API}/resume/${resumeId}/content`, { headers }),
          fetch(`${API}/resume/${resumeId}/document`, { headers }),
          fetch(`${API}/resume/${resumeId}/analyses`, { headers }),
        ]);
        if (!contentRes.ok || !documentRes.ok || !analysesRes.ok) throw new Error('The structured resume editor could not be loaded.');
        const content = await contentRes.json();
        const structured = await documentRes.json();
        const analyses = await analysesRes.json() as Analysis[];
        const selected = analyses.find(item => item.analysisId === analysisId) || analyses[0] || { analysisId: 'new', remarks: { improvements: [], positiveHighlights: [] } };
        setFileName(content.fileName || 'resume');
        setDocument({ ...structured.document, sectionOrder: structured.document.sectionOrder?.length ? structured.document.sectionOrder : DEFAULT_SECTION_ORDER });
        setAnalysis(selected);
        loadedRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the editor.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [analysisId, resumeId, router]);

  const findAnnotation = (value: string): Annotation => {
    if (!analysis || !value.trim()) return null;
    const normalized = value.toLowerCase();
    const appliedImprovement = analysis.remarks.improvements.findIndex((item, index) => applied.has(index) && item.suggestedText.length >= 6 && (normalized.includes(item.suggestedText.toLowerCase()) || item.suggestedText.toLowerCase().includes(normalized.trim())));
    if (appliedImprovement >= 0) return { kind: 'improvement', index: appliedImprovement };
    const improvement = analysis.remarks.improvements.findIndex((item) => item.currentText.length >= 6 && (normalized.includes(item.currentText.toLowerCase()) || item.currentText.toLowerCase().includes(normalized.trim())));
    if (improvement >= 0) return { kind: 'improvement', index: improvement };
    const positive = analysis.remarks.positiveHighlights.findIndex(item => item.text.length >= 6 && (normalized.includes(item.text.toLowerCase()) || item.text.toLowerCase().includes(normalized.trim())));
    return positive >= 0 ? { kind: 'positive', index: positive } : null;
  };

  const selectAnnotation = (annotation: Annotation) => {
    if (!annotation) return;
    if (annotation.kind === 'improvement') { setSelectedImprovement(annotation.index); setSelectedPositive(null); }
    else { setSelectedPositive(annotation.index); setSelectedImprovement(null); }
  };

  const fieldProps = (value: string) => {
    const annotation = findAnnotation(value);
    const severity = annotation?.kind === 'improvement' ? analysis?.remarks.improvements[annotation.index].severity : null;
    const wasApplied = annotation?.kind === 'improvement' && applied.has(annotation.index);
    const tone = wasApplied ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : annotation?.kind === 'positive' ? 'border-emerald-300 bg-emerald-50' : severity === 'critical' ? 'border-red-300 bg-red-50' : severity === 'important' ? 'border-amber-300 bg-amber-50' : severity === 'polish' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50';
    return { tone, onFocus: () => selectAnnotation(annotation) };
  };

  const markChanged = () => { setDirty(true); setStatus('Saving changes…'); };
  const updatePersonal = (key: keyof ResumeDocument['personal'], value: string) => { setDocument(current => current ? { ...current, personal: { ...current.personal, [key]: value } } : current); markChanged(); };
  const updateCollection = <K extends 'experience' | 'education' | 'projects' | 'certifications'>(key: K, index: number, value: ResumeDocument[K][number]) => { setDocument(current => current ? { ...current, [key]: current[key].map((item, itemIndex) => itemIndex === index ? value : item) } : current); markChanged(); };
  const addCollectionItem = (key: 'experience' | 'education' | 'projects' | 'certifications') => {
    const empty = key === 'experience' ? { title: '', company: '', location: '', startDate: '', endDate: '', bullets: [] } : key === 'education' ? { degree: '', institution: '', location: '', startDate: '', endDate: '', details: [] } : key === 'projects' ? { name: '', role: '', link: '', technologies: [], bullets: [] } : { name: '', issuer: '', date: '' };
    setDocument(current => current ? { ...current, [key]: [...current[key], empty] } as ResumeDocument : current);
    markChanged();
  };
  const removeCollectionItem = (key: 'experience' | 'education' | 'projects' | 'certifications', index: number) => { setDocument(current => current ? { ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) } : current); markChanged(); };
  const moveSection = (key: SectionKey, offset: number) => {
    setDocument(current => {
      if (!current) return current;
      const order = [...(current.sectionOrder || DEFAULT_SECTION_ORDER)];
      const from = order.indexOf(key); const to = from + offset;
      if (from < 0 || to < 0 || to >= order.length) return current;
      [order[from], order[to]] = [order[to], order[from]];
      return { ...current, sectionOrder: order };
    });
    markChanged();
  };
  const dropSection = (dragged: SectionKey, target: SectionKey) => {
    setDocument(current => {
      if (!current || dragged === target) return current;
      const order = [...(current.sectionOrder || DEFAULT_SECTION_ORDER)].filter(key => key !== dragged);
      order.splice(order.indexOf(target), 0, dragged);
      return { ...current, sectionOrder: order };
    });
    markChanged();
  };

  const saveDocument = useCallback(async (quiet = false, snapshot: ResumeDocument | null = document) => {
    if (!resumeId || !snapshot) return false;
    const token = localStorage.getItem('accessToken');
    if (!token) return false;
    setSaving(true);
    if (!quiet) setStatus('Saving…');
    try {
      const response = await fetch(`${API}/resume/${resumeId}/document`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ document: snapshot }) });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(Array.isArray(result?.message) ? result.message.join(' ') : result?.message || 'Resume could not be saved.');
      }
      const isLatest = JSON.stringify(latestDocumentRef.current) === JSON.stringify(snapshot);
      if (isLatest) { setDirty(false); setStatus('All changes saved'); }
      else setStatus('Saving newer changes…');
      return true;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Resume could not be saved.');
      return false;
    } finally { setSaving(false); }
  }, [document, resumeId]);

  useEffect(() => {
    if (!loadedRef.current || !dirty || !document) return;
    const timer = window.setTimeout(() => { void saveDocument(true, document); }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, document, saveDocument]);

  const exportDocument = async (format: 'pdf' | 'docx' | 'tex') => {
    if (!resumeId || !document) return;
    if (!await saveDocument(true, document)) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setExporting(format);
    setStatus(`Generating ${format.toUpperCase()}…`);
    try {
      const response = await fetch(`${API}/resume/${resumeId}/export/${format}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const result = await response.json(); throw new Error(result?.message || 'Export failed.'); }
      const blob = await response.blob();
      downloadBlob(blob, `${fileName.replace(/\.(pdf|docx)$/i, '') || 'resume'}-smartfolio.${format}`);
      setStatus(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      if (format === 'pdf') {
        try { await downloadLocalPdfV2(document, `${fileName.replace(/\.(pdf|docx)$/i, '') || 'resume'}-smartfolio.pdf`); setStatus('PDF downloaded'); }
        catch { setStatus(err instanceof Error ? err.message : 'PDF export failed.'); }
      } else if (format === 'docx') {
        try { await downloadLocalDocx(document, `${fileName.replace(/\.(pdf|docx)$/i, '') || 'resume'}-smartfolio.docx`); setStatus('Word document downloaded'); }
        catch { setStatus(err instanceof Error ? err.message : 'Word export failed.'); }
      } else setStatus(err instanceof Error ? err.message : 'Export failed.');
    }
    finally { setExporting(null); }
  };

  const applySuggestion = (index: number) => {
    if (!analysis || !document) return;
    const item = analysis.remarks.improvements[index];
    if (!item?.suggestedText) return;
    let replacementMade = false;
    const category = `${item.category} ${item.title}`.toLowerCase();
    let next = document;
    if (category.includes('skill')) {
      next = { ...document, skills: mergeTags(document.skills, parseSuggestedTags(item.suggestedText)) };
      replacementMade = true;
    } else if (category.includes('course') || category.includes('education')) {
      const tags = parseSuggestedTags(item.suggestedText);
      if (document.education.length && tags.length) {
        next = { ...document, education: document.education.map((entry, entryIndex) => entryIndex === 0 ? { ...entry, details: mergeTags(flattenTags(entry.details), tags) } : entry) };
        replacementMade = true;
      }
    } else if (category.includes('technolog') || category.includes('project tool')) {
      const tags = parseSuggestedTags(item.suggestedText);
      if (document.projects.length && tags.length) {
        next = { ...document, projects: document.projects.map((entry, entryIndex) => entryIndex === 0 ? { ...entry, technologies: mergeTags(entry.technologies, tags) } : entry) };
        replacementMade = true;
      }
    }
    const replaceDeep = (value: unknown): unknown => {
      if (typeof value === 'string' && item.currentText) {
        const position = value.toLowerCase().indexOf(item.currentText.toLowerCase());
        if (position >= 0) { replacementMade = true; return `${value.slice(0, position)}${item.suggestedText}${value.slice(position + item.currentText.length)}`; }
      }
      if (Array.isArray(value)) return value.map(replaceDeep);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceDeep(child)]));
      return value;
    };
    if (!replacementMade) next = replaceDeep(document) as ResumeDocument;
    if (!replacementMade && item.currentText) {
      const closest = findClosestText(document, item.currentText);
      if (closest && closest.score >= 0.3) {
        next = replaceStringValue(document, closest.value, item.suggestedText) as ResumeDocument;
        replacementMade = true;
      }
    }
    if (!replacementMade) {
      if (category.includes('summary')) next = { ...next, summary: item.suggestedText };
      else if (category.includes('experience') || category.includes('achievement')) {
        if (!next.experience.length) return;
        next = { ...next, experience: next.experience.map((entry, entryIndex) => entryIndex === 0 ? { ...entry, bullets: entry.bullets.some(bullet => bullet.trim().toLowerCase() === item.suggestedText.trim().toLowerCase()) ? entry.bullets : [...entry.bullets, item.suggestedText] } : entry) };
      } else {
        setStatus('Select the matching field before applying this Magic Edit.');
        return;
      }
    }
    setDocument(next); setApplied(current => new Set(current).add(index)); setDirty(true); setStatus('Suggestion applied · saving automatically…');
  };

  if (loading) return <LoadingState />;
  if (error || !document || !analysis) return <ErrorState message={error || 'Editor unavailable.'} onBack={() => router.back()} />;
  const currentImprovement = selectedImprovement != null ? analysis.remarks.improvements[selectedImprovement] : null;
  const currentPositive = selectedPositive != null ? analysis.remarks.positiveHighlights[selectedPositive] : null;
  const applicableImprovements = analysis.remarks.improvements.map((item, index) => ({ item, index })).filter(({ item }) => canApplySuggestion(item, document));

  return (
    <div className="min-h-screen bg-[#EFF6F2] p-4 font-raleway md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3"><button onClick={() => router.back()} className="rounded-full bg-slate-100 p-2.5"><ArrowLeft size={18} /></button><div><h1 className="font-century text-xl font-black text-slate-800">SmartFolio Resume Editor</h1><p className="text-xs text-slate-400">Edit your resume, apply targeted recommendations, and download the finished version for {analysis.targetRole || 'your career goal'}.</p></div></div>
          <div className="flex flex-wrap items-center gap-2">{status && <span className={`mr-2 inline-flex items-center gap-1.5 text-xs font-semibold ${dirty ? 'text-amber-700' : 'text-emerald-700'}`}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}{status}</span>}<button onClick={() => saveDocument()} disabled={saving} className="export-button border border-slate-200 bg-white text-slate-700">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save now</button><button onClick={() => exportDocument('pdf')} disabled={!!exporting} className="export-button bg-slate-800 text-white"><Download size={14} /> Download PDF</button><button onClick={() => exportDocument('docx')} disabled={!!exporting} className="export-button bg-[#486a78] text-white"><Download size={14} /> Download Word</button></div>
        </header>
        <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Legend color="bg-red-100 border-red-300" label="Critical" /><Legend color="bg-amber-100 border-amber-300" label="Important" /><Legend color="bg-blue-100 border-blue-300" label="Polish" /><Legend color="bg-emerald-100 border-emerald-300" label="Strong — retain" /></div>

        <div className="grid items-start gap-6 xl:grid-cols-12">
          <main className="space-y-5 xl:col-span-8">
            <section className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm md:p-7"><div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-century text-lg font-black text-slate-800">Section order</h2><p className="mt-1 text-xs text-slate-400">Top to bottom here is top to bottom in your exported resume.</p></div><span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Drag to reorder</span></div><div className="mx-auto max-w-2xl space-y-2">{document.sectionOrder.map((key, index) => <div key={key} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); setDraggedSection(key); }} onDragEnter={() => setDragOverSection(key)} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDragEnd={() => { setDraggedSection(null); setDragOverSection(null); }} onDrop={event => { event.preventDefault(); dropSection(event.dataTransfer.getData('text/plain') as SectionKey, key); setDraggedSection(null); setDragOverSection(null); }} className={`group flex cursor-grab items-center gap-3 rounded-2xl border px-4 py-3 transition-all active:cursor-grabbing ${draggedSection === key ? 'scale-[0.98] border-indigo-300 bg-indigo-50 opacity-50' : dragOverSection === key && draggedSection !== key ? 'translate-y-1 border-indigo-400 bg-indigo-50 shadow-md ring-2 ring-indigo-100' : 'border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-white hover:shadow-sm'}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[11px] font-black text-indigo-600 shadow-sm ring-1 ring-slate-100">{index + 1}</span><GripVertical size={17} className="shrink-0 text-slate-300 transition group-hover:text-indigo-400" /><span className="flex-1 text-sm font-bold text-slate-700">{SECTION_LABELS[key]}</span><div className="flex items-center gap-1 border-l border-slate-200 pl-2"><button onClick={() => moveSection(key, -1)} disabled={index === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20" aria-label={`Move ${SECTION_LABELS[key]} up`}><ArrowUp size={15} /></button><button onClick={() => moveSection(key, 1)} disabled={index === document.sectionOrder.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20" aria-label={`Move ${SECTION_LABELS[key]} down`}><ArrowDown size={15} /></button></div></div>)}</div></section>
            {analysis.analysisId === 'new' && <section className="rounded-3xl border border-violet-100 bg-violet-50 p-5 text-sm text-slate-600"><h2 className="font-century text-lg font-black text-slate-800">Build your resume step by step</h2><p className="mt-2 leading-6">Start with contact details and a 2–3 sentence summary. Add your most recent experience first, use action-and-result bullets, group related skills, and leave any section blank if it does not strengthen your story. Everything saves automatically.</p></section>}
            <EditorSection title="Contact details"><div className="grid gap-3 sm:grid-cols-2">{(Object.keys(document.personal) as (keyof ResumeDocument['personal'])[]).map(key => <EditableField key={key} label={labelFor(key)} value={document.personal[key]} onChange={value => updatePersonal(key, value)} {...fieldProps(document.personal[key])} />)}</div></EditorSection>
            <EditorSection title="Professional summary"><EditableField label="Summary" value={document.summary} multiline onChange={value => { setDocument({ ...document, summary: value }); markChanged(); }} {...fieldProps(document.summary)} /></EditorSection>
            <EditorSection title="Skills"><TagEditor label="Skills" values={mergeTags(document.skills, [])} placeholder="Add a skill and press Enter" onChange={skills => { setDocument({ ...document, skills }); markChanged(); }} /></EditorSection>

            <EditorSection title="Experience" onAdd={() => addCollectionItem('experience')}>
              {document.experience.map((entry, index) => <EntryCard key={index} onRemove={() => removeCollectionItem('experience', index)}>
                <div className="grid gap-3 sm:grid-cols-2"><EditableField label="Role" value={entry.title} onChange={value => updateCollection('experience', index, { ...entry, title: value })} {...fieldProps(entry.title)} /><EditableField label="Company" value={entry.company} onChange={value => updateCollection('experience', index, { ...entry, company: value })} {...fieldProps(entry.company)} /><EditableField label="Location" value={entry.location} onChange={value => updateCollection('experience', index, { ...entry, location: value })} {...fieldProps(entry.location)} /><EditableField label="Dates" value={[entry.startDate, entry.endDate].filter(Boolean).join(' – ')} onChange={value => { const [startDate = '', endDate = ''] = value.split(/\s+[–-]\s+/); updateCollection('experience', index, { ...entry, startDate, endDate }); }} {...fieldProps(`${entry.startDate} ${entry.endDate}`)} /></div>
                <BulletEditor label="Achievement bullets" values={entry.bullets} onChange={bullets => updateCollection('experience', index, { ...entry, bullets })} fieldProps={fieldProps} />
              </EntryCard>)}
            </EditorSection>

            <EditorSection title="Education" onAdd={() => addCollectionItem('education')}>{document.education.map((entry, index) => <EntryCard key={index} onRemove={() => removeCollectionItem('education', index)}><div className="grid gap-3 sm:grid-cols-2"><EditableField label="Degree" value={entry.degree} onChange={value => updateCollection('education', index, { ...entry, degree: value })} {...fieldProps(entry.degree)} /><EditableField label="Institution" value={entry.institution} onChange={value => updateCollection('education', index, { ...entry, institution: value })} {...fieldProps(entry.institution)} /><EditableField label="Location" value={entry.location} onChange={value => updateCollection('education', index, { ...entry, location: value })} {...fieldProps(entry.location)} /><EditableField label="Dates" value={[entry.startDate, entry.endDate].filter(Boolean).join(' – ')} onChange={value => { const [startDate = '', endDate = ''] = value.split(/\s+[–-]\s+/); updateCollection('education', index, { ...entry, startDate, endDate }); }} {...fieldProps(`${entry.startDate} ${entry.endDate}`)} /></div><TagEditor label="Coursework and highlights" values={flattenTags(entry.details)} placeholder="Add a course or highlight" onChange={details => updateCollection('education', index, { ...entry, details })} /></EntryCard>)}</EditorSection>

            <EditorSection title="Projects" onAdd={() => addCollectionItem('projects')}>{document.projects.map((entry, index) => <EntryCard key={index} onRemove={() => removeCollectionItem('projects', index)}><div className="grid gap-3 sm:grid-cols-2"><EditableField label="Project" value={entry.name} onChange={value => updateCollection('projects', index, { ...entry, name: value })} {...fieldProps(entry.name)} /><EditableField label="Role" value={entry.role} onChange={value => updateCollection('projects', index, { ...entry, role: value })} {...fieldProps(entry.role)} /><EditableField label="Link" value={entry.link} onChange={value => updateCollection('projects', index, { ...entry, link: value })} {...fieldProps(entry.link)} /></div><TagEditor label="Technologies" values={mergeTags(entry.technologies, [])} placeholder="Add a technology" onChange={technologies => updateCollection('projects', index, { ...entry, technologies })} /><BulletEditor label="Project bullets" values={entry.bullets} onChange={bullets => updateCollection('projects', index, { ...entry, bullets })} fieldProps={fieldProps} /></EntryCard>)}</EditorSection>

            <EditorSection title="Certifications" onAdd={() => addCollectionItem('certifications')}><div className="space-y-3">{document.certifications.map((entry, index) => <EntryCard key={index} onRemove={() => removeCollectionItem('certifications', index)}><div className="grid gap-3 sm:grid-cols-3"><EditableField label="Certification" value={entry.name} onChange={value => updateCollection('certifications', index, { ...entry, name: value })} {...fieldProps(entry.name)} /><EditableField label="Issuer" value={entry.issuer} onChange={value => updateCollection('certifications', index, { ...entry, issuer: value })} {...fieldProps(entry.issuer)} /><EditableField label="Date" value={entry.date} onChange={value => updateCollection('certifications', index, { ...entry, date: value })} {...fieldProps(entry.date)} /></div></EntryCard>)}</div></EditorSection>
            <EditorSection title="Languages"><TagEditor label="Languages" values={mergeTags(document.languages, [])} placeholder="Add a language" onChange={languages => { setDocument({ ...document, languages }); markChanged(); }} /></EditorSection>
          </main>

          <aside className="sticky top-6 space-y-5 xl:col-span-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{currentImprovement ? <><div className="mb-3 flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${severityBadge(currentImprovement.severity)}`}>{currentImprovement.severity}</span><span className="text-[10px] font-bold uppercase text-slate-400">{currentImprovement.category}</span></div><h2 className="text-lg font-black text-slate-800">{currentImprovement.title}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{currentImprovement.explanation}</p>{currentImprovement.impact && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><strong>Career impact:</strong> {currentImprovement.impact}</p>}<div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="mb-2 text-[9px] font-black uppercase text-slate-500">Proposed Magic Edit</p><p className="text-sm font-semibold text-slate-700">{currentImprovement.suggestedText}</p><button onClick={() => applySuggestion(selectedImprovement!)} disabled={applied.has(selectedImprovement!)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-xs font-bold text-white disabled:bg-emerald-600">{applied.has(selectedImprovement!) ? <><Check size={15} /> Magic Edit applied</> : <><WandSparkles size={15} /> Apply Magic Edit</>}</button></div></> : currentPositive ? <><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">Strong — retain</span><h2 className="mt-4 text-lg font-black text-slate-800">This content is working</h2><p className="mt-3 text-sm text-slate-600">{currentPositive.reason}</p></> : <div className="py-8 text-center"><Sparkles className="mx-auto mb-3 text-slate-500" size={30} /><h2 className="font-bold text-slate-800">Choose a Magic Edit</h2><p className="mt-2 text-xs text-slate-400">Review the exact change before applying it to the mapped resume field.</p></div>}</section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-xs font-black uppercase text-slate-600">Magic Edits</h3><p className="mb-4 mt-1 text-xs leading-5 text-slate-400">Only one-click changes that map to a visible resume field are shown.</p><div className="space-y-2">{applicableImprovements.map(({ item, index }) => <button key={`${item.title}-${index}`} onClick={() => { setSelectedImprovement(index); setSelectedPositive(null); }} className="flex w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100"><span className={`h-2.5 w-2.5 rounded-full ${severityDot(item.severity)}`} /><span className="flex-1 text-xs font-bold text-slate-700">{item.title}</span>{applied.has(index) && <Check size={14} className="text-emerald-500" />}</button>)}{!applicableImprovements.length && <p className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-400">No safe one-click edits are available. Use the guidance in each section to edit manually.</p>}</div></section>
          </aside>
        </div>
      </div>
      <style jsx global>{`.export-button{display:inline-flex;align-items:center;gap:.5rem;border-radius:.75rem;padding:.65rem 1rem;font-size:.75rem;font-weight:700}.export-button:disabled{opacity:.55}`}</style>
    </div>
  );
}

function EditorSection({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) { return <section className="rounded-3xl bg-white p-5 shadow-sm md:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-century text-lg font-black text-slate-800">{title}</h2>{onAdd && <button onClick={onAdd} className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-600"><Plus size={13} /> Add</button>}</div><div className="space-y-4">{children}</div></section>; }
function EntryCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) { return <div className="relative rounded-2xl border border-slate-100 p-4"><button onClick={onRemove} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button><div className="space-y-3 pr-8">{children}</div></div>; }
function EditableField({ label, value, onChange, multiline = false, tone, onFocus }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; tone: string; onFocus: () => void }) { const common = `w-full rounded-xl border px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white ${tone}`; const rows = Math.min(12, Math.max(4, Math.ceil(value.length / 78) + (value.match(/\n/g)?.length || 0))); return <label className="block w-full min-w-0"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>{multiline ? <textarea value={value} rows={rows} onFocus={onFocus} onChange={event => onChange(event.target.value)} className={`${common} min-h-[7rem] resize-y overflow-auto`} /> : <input value={value} onFocus={onFocus} onChange={event => onChange(event.target.value)} className={common} />}</label>; }
function TagEditor({ label, values, placeholder, onChange }: { label: string; values: string[]; placeholder: string; onChange: (values: string[]) => void }) { const [draft, setDraft] = useState(''); const add = (raw: string) => { const incoming = parseSuggestedTags(raw); if (!incoming.length) return; onChange(mergeTags(values, incoming)); setDraft(''); }; return <div><span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span><div className="flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 focus-within:border-indigo-300 focus-within:bg-white">{values.map(value => <button key={value.toLowerCase()} type="button" onClick={() => onChange(values.filter(item => item !== value))} title={`Remove ${value}`} className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50">{value}<X size={12} className="text-slate-300 group-hover:text-red-500" /></button>)}<input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(draft); } else if (event.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1)); }} onBlur={() => draft.trim() && add(draft)} placeholder={values.length ? 'Add another…' : placeholder} className="min-w-40 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400" /></div><p className="mt-2 text-[10px] text-slate-400">Press Enter or comma to add. Click a bubble to remove it.</p></div>; }
function BulletEditor({ label, values, onChange, fieldProps }: { label: string; values: string[]; onChange: (values: string[]) => void; fieldProps: (value: string) => { tone: string; onFocus: () => void } }) { return <div><div className="mb-3 flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span><button onClick={() => onChange([...values, ''])} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-600">+ Add bullet</button></div><div className="space-y-3">{values.map((value, index) => <div key={index} className="flex w-full items-start gap-2 rounded-2xl bg-slate-50/70 p-2"><div className="min-w-0 flex-1"><EditableField label={`Bullet ${index + 1}`} value={value} multiline onChange={next => onChange(values.map((item, itemIndex) => itemIndex === index ? next : item))} {...fieldProps(value)} /></div><button onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} className="mt-6 shrink-0 rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label={`Remove bullet ${index + 1}`}><Trash2 size={15} /></button></div>)}</div></div>; }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = name; anchor.style.display = 'none'; window.document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function textSimilarity(left: string, right: string) { const words = (value: string) => new Set(value.toLowerCase().replace(/[^a-z0-9+#.]/g, ' ').split(/\s+/).filter(word => word.length > 2)); const a = words(left); const b = words(right); if (!a.size || !b.size) return 0; const shared = [...a].filter(word => b.has(word)).length; return shared / Math.max(a.size, b.size); }
function canApplySuggestion(item: Improvement, document: ResumeDocument) { const category = `${item.category} ${item.title}`.toLowerCase(); if (item.currentText && (JSON.stringify(document).toLowerCase().includes(item.currentText.toLowerCase()) || (findClosestText(document, item.currentText)?.score || 0) >= 0.3)) return true; if (category.includes('summary')) return true; if (category.includes('skill')) return parseSuggestedTags(item.suggestedText).length > 0; if ((category.includes('experience') || category.includes('achievement')) && document.experience.length > 0) return true; if ((category.includes('education') || category.includes('course')) && document.education.length > 0) return parseSuggestedTags(item.suggestedText).length > 0; if ((category.includes('project') || category.includes('technolog')) && document.projects.length > 0) return parseSuggestedTags(item.suggestedText).length > 0; return false; }
function findClosestText(value: unknown, target: string): { value: string; score: number } | null { let best: { value: string; score: number } | null = null; const visit = (node: unknown) => { if (typeof node === 'string' && node.trim()) { const score = textSimilarity(node, target); if (!best || score > best.score) best = { value: node, score }; } else if (Array.isArray(node)) node.forEach(visit); else if (node && typeof node === 'object') Object.values(node).forEach(visit); }; visit(value); return best; }
function replaceStringValue(value: unknown, target: string, replacement: string): unknown { if (typeof value === 'string') return value === target ? replacement : value; if (Array.isArray(value)) return value.map(item => replaceStringValue(item, target, replacement)); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceStringValue(child, target, replacement)])); return value; }
function cleanTag(value: string) { return value.trim().replace(/^[•·\-]+\s*/, '').replace(/^(?:skills?|technologies|tools|relevant coursework|coursework|courses|languages|ai and llm)\s*:\s*/i, '').trim(); }
function parseSuggestedTags(value: string) { const withoutPrefix = value.replace(/^[^:]{2,45}:\s*/, ''); return withoutPrefix.split(/[,;|•·\n]+/).map(cleanTag).filter(tag => tag.length > 0 && tag.length <= 100); }
function flattenTags(values: string[]) { return values.flatMap(value => { const prefix = value.match(/^([^:]{2,35}):\s*(.+)$/); const source = prefix ? prefix[2] : value; return source.split(/[,;|•·]+/).map(cleanTag); }).filter(Boolean); }
function mergeTags(current: string[], incoming: string[]) { const seen = new Set<string>(); return [...flattenTags(current), ...incoming.map(cleanTag)].filter(tag => { const key = tag.toLowerCase().replace(/[^a-z0-9+#.]/g, ''); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function downloadLocalPdf(document: ResumeDocument, name: string) { const { jsPDF } = await import('jspdf'); const pdf = new jsPDF({ unit: 'pt', format: 'a4' }); const margin = 48; const width = 595 - margin * 2; let y = 54; const write = (text: string, size = 10, bold = false, gap = 5) => { pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); const lines = pdf.splitTextToSize(text || '', width); const needed = lines.length * (size + 3); if (y + needed > 790) { pdf.addPage(); y = 54; } pdf.text(lines, margin, y); y += needed + gap; }; const section = (title: string) => { y += 5; write(title.toUpperCase(), 11, true, 4); pdf.setDrawColor(100, 116, 139); pdf.line(margin, y - 3, 595 - margin, y - 3); }; write(document.personal.name || 'Resume', 20, true, 6); write([document.personal.email, document.personal.phone, document.personal.location, document.personal.linkedin, document.personal.github, document.personal.website].filter(Boolean).join('  |  '), 9, false, 10); if (document.summary) { section('Professional Summary'); write(document.summary); } if (document.skills.length) { section('Skills'); write(document.skills.join(' • ')); } if (document.experience.length) { section('Experience'); document.experience.forEach(item => { write(`${item.title} — ${item.company}  ${[item.startDate, item.endDate].filter(Boolean).join(' – ')}`, 10, true, 2); item.bullets.forEach(bullet => write(`• ${bullet}`, 9, false, 2)); y += 4; }); } if (document.education.length) { section('Education'); document.education.forEach(item => { write(`${item.degree} — ${item.institution}  ${[item.startDate, item.endDate].filter(Boolean).join(' – ')}`, 10, true, 2); item.details.forEach(detail => write(`• ${detail}`, 9, false, 2)); }); } if (document.projects.length) { section('Projects'); document.projects.forEach(item => { write(`${item.name}${item.technologies.length ? ` — ${item.technologies.join(', ')}` : ''}`, 10, true, 2); item.bullets.forEach(bullet => write(`• ${bullet}`, 9, false, 2)); }); } if (document.certifications.length) { section('Certifications'); document.certifications.forEach(item => write(`${item.name}${item.issuer ? ` — ${item.issuer}` : ''}${item.date ? ` (${item.date})` : ''}`)); } if (document.languages.length) { section('Languages'); write(document.languages.join(', ')); } pdf.save(name); }
function labelFor(value: string) { return value === 'linkedin' ? 'LinkedIn' : value === 'github' ? 'GitHub' : value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()); }
function severityBadge(value: Improvement['severity']) { return value === 'critical' ? 'bg-red-100 text-red-700' : value === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'; }
function severityDot(value: Improvement['severity']) { return value === 'critical' ? 'bg-red-500' : value === 'important' ? 'bg-amber-500' : 'bg-blue-500'; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-2"><span className={`h-3 w-3 rounded border ${color}`} />{label}</span>; }
function LoadingState() { return <FoliLoader title="Opening your resume" moods={['typing', 'look-r', 'typing']} messages={['Loading the editor…', 'Almost ready…']} />; }
function ErrorState({ message, onBack }: { message: string; onBack: () => void }) { return <div className="min-h-screen bg-[#EFF6F2] flex flex-col items-center justify-center gap-4 p-6 font-raleway"><p className="font-bold text-slate-700">{message}</p><button onClick={onBack} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white">Go back</button></div>; }

async function downloadLocalPdfV2(document: ResumeDocument, name: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 46;
  const contentWidth = pageWidth - margin * 2;
  let y = 48;
  const ensure = (height: number) => { if (y + height > pageHeight - 44) { pdf.addPage(); y = 48; } };
  const text = (value: string, options: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; gap?: number; indent?: number } = {}) => {
    if (!value?.trim()) return;
    const size = options.size ?? 9.5;
    const indent = options.indent ?? 0;
    pdf.setFont('helvetica', options.bold ? 'bold' : options.italic ? 'italic' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [31, 41, 55]));
    const lines = pdf.splitTextToSize(value, contentWidth - indent);
    const lineHeight = size * 1.35;
    ensure(lines.length * lineHeight + (options.gap ?? 4));
    pdf.text(lines, margin + indent, y);
    y += lines.length * lineHeight + (options.gap ?? 4);
  };
  const section = (title: string) => {
    ensure(36); y += 9;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(15, 23, 42); pdf.text(title.toUpperCase(), margin, y);
    y += 7; pdf.setDrawColor(148, 163, 184); pdf.setLineWidth(0.6); pdf.line(margin, y, pageWidth - margin, y); y += 13;
  };
  text(document.personal.name || 'Resume', { size: 21, bold: true, gap: 9 });
  text([document.personal.email, document.personal.phone, document.personal.location].filter(Boolean).join('  |  '), { size: 9, color: [71, 85, 105], gap: 3 });
  text([document.personal.linkedin, document.personal.github, document.personal.website].filter(Boolean).join('  |  '), { size: 8.5, color: [37, 99, 135], gap: 9 });
  if (document.summary) { section('Professional Summary'); text(document.summary); }
  if (document.skills.length) { section('Skills'); text(mergeTags(document.skills, []).join('  •  '), { size: 9 }); }
  if (document.experience.length) { section('Experience'); document.experience.forEach(item => { ensure(44); text([item.title, item.company].filter(Boolean).join(' — '), { size: 10.5, bold: true, gap: 2 }); text([[item.startDate, item.endDate].filter(Boolean).join(' – '), item.location].filter(Boolean).join('  |  '), { size: 8.5, italic: true, color: [71, 85, 105], gap: 4 }); item.bullets.forEach(bullet => text(`•  ${bullet}`, { size: 9, indent: 8, gap: 2 })); y += 5; }); }
  if (document.education.length) { section('Education'); document.education.forEach(item => { text([item.degree, item.institution].filter(Boolean).join(' — '), { size: 10.5, bold: true, gap: 2 }); text([[item.startDate, item.endDate].filter(Boolean).join(' – '), item.location].filter(Boolean).join('  |  '), { size: 8.5, italic: true, color: [71, 85, 105], gap: 3 }); if (item.details.length) text(flattenTags(item.details).join('  •  '), { size: 9, gap: 5 }); }); }
  if (document.projects.length) { section('Projects'); document.projects.forEach(item => { text([item.name, item.role].filter(Boolean).join(' — '), { size: 10.5, bold: true, gap: 2 }); if (item.link) text(item.link, { size: 8.5, color: [37, 99, 135], gap: 2 }); if (item.technologies.length) text(`Technologies: ${mergeTags(item.technologies, []).join(', ')}`, { size: 8.5, italic: true, color: [71, 85, 105], gap: 3 }); item.bullets.forEach(bullet => text(`•  ${bullet}`, { size: 9, indent: 8, gap: 2 })); y += 4; }); }
  if (document.certifications.length) { section('Certifications'); document.certifications.forEach(item => text(`${item.name}${item.issuer ? ` — ${item.issuer}` : ''}${item.date ? ` (${item.date})` : ''}`, { size: 9.5 })); }
  if (document.languages.length) { section('Languages'); text(mergeTags(document.languages, []).join('  •  ')); }
  pdf.save(name);
}

async function downloadLocalDocx(document: ResumeDocument, name: string) {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const children: InstanceType<typeof Paragraph>[] = [];
  const paragraph = (text: string, options: { bold?: boolean; italic?: boolean; center?: boolean; size?: number; bullet?: boolean } = {}) => children.push(new Paragraph({ alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: options.bullet ? 60 : 100 }, bullet: options.bullet ? { level: 0 } : undefined, children: [new TextRun({ text, bold: options.bold, italics: options.italic, size: options.size ?? 20, color: options.italic ? '475569' : '1F2937' })] }));
  const heading = (text: string) => children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 180, after: 80 }, border: { bottom: { color: '94A3B8', size: 4, space: 4, style: 'single' as const } } }));
  paragraph(document.personal.name || 'Resume', { bold: true, center: true, size: 36 });
  paragraph([document.personal.email, document.personal.phone, document.personal.location].filter(Boolean).join(' | '), { center: true, size: 18 });
  paragraph([document.personal.linkedin, document.personal.github, document.personal.website].filter(Boolean).join(' | '), { center: true, size: 17 });
  if (document.summary) { heading('Professional Summary'); paragraph(document.summary); }
  if (document.skills.length) { heading('Skills'); paragraph(mergeTags(document.skills, []).join(' • ')); }
  if (document.experience.length) { heading('Experience'); document.experience.forEach(item => { paragraph([item.title, item.company].filter(Boolean).join(' — '), { bold: true }); paragraph([[item.startDate, item.endDate].filter(Boolean).join(' – '), item.location].filter(Boolean).join(' | '), { italic: true, size: 18 }); item.bullets.forEach(value => paragraph(value, { bullet: true })); }); }
  if (document.education.length) { heading('Education'); document.education.forEach(item => { paragraph([item.degree, item.institution].filter(Boolean).join(' — '), { bold: true }); paragraph([[item.startDate, item.endDate].filter(Boolean).join(' – '), item.location].filter(Boolean).join(' | '), { italic: true, size: 18 }); if (item.details.length) paragraph(flattenTags(item.details).join(' • ')); }); }
  if (document.projects.length) { heading('Projects'); document.projects.forEach(item => { paragraph([item.name, item.role].filter(Boolean).join(' — '), { bold: true }); if (item.link) paragraph(item.link, { italic: true, size: 18 }); if (item.technologies.length) paragraph(`Technologies: ${mergeTags(item.technologies, []).join(', ')}`, { italic: true, size: 18 }); item.bullets.forEach(value => paragraph(value, { bullet: true })); }); }
  if (document.certifications.length) { heading('Certifications'); document.certifications.forEach(item => paragraph(`${item.name}${item.issuer ? ` — ${item.issuer}` : ''}${item.date ? ` (${item.date})` : ''}`)); }
  if (document.languages.length) { heading('Languages'); paragraph(mergeTags(document.languages, []).join(' • ')); }
  const output = new Document({ styles: { default: { document: { run: { font: 'Aptos', size: 20 }, paragraph: { spacing: { line: 250 } } } } }, sections: [{ properties: { page: { margin: { top: 600, right: 650, bottom: 600, left: 650 } } }, children }] });
  downloadBlob(await Packer.toBlob(output), name);
}
