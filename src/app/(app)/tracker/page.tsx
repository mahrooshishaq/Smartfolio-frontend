'use client';
import FoliLoader from '@/components/foli/FoliLoader';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiClipboard, FiExternalLink, FiLoader, FiMapPin, FiTrash2,
  FiEdit3, FiCheck, FiX, FiPlus, FiWifiOff, FiRefreshCw,
} from 'react-icons/fi';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'accepted'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLES: Record<Status, string> = {
  saved:        'bg-gray-100 text-gray-600',
  applied:      'bg-blue-50 text-blue-600',
  interviewing: 'bg-orange-50 text-orange-600',
  offer:        'bg-purple-50 text-purple-600',
  rejected:     'bg-red-50 text-red-500',
  accepted:     'bg-emerald-50 text-emerald-600',
};

const STATUS_LABELS: Record<Status, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  accepted: 'Accepted',
};

interface Application {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  salaryMin: string;
  salaryMax: string;
  jobType: string;
  source: string;
  description: string;
  applyUrl: string;
  status: Status;
  notes: string;
  appliedAt: string | null;
  statusUpdatedAt: string | null;
  createdAt: string;
}

interface ApplicationsResponse {
  total: number;
  counts_by_status: Record<string, number>;
  data: Application[];
}

/** Turn raw fetch/HTTP failures into messages a person can act on. */
function friendlyError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return 'Can’t reach the server right now. Check your connection and try again.';
  }
  return msg || fallback;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');       // action errors (update/delete/add) — dismissible banner
  const [loadFailed, setLoadFailed] = useState(''); // list fetch failed — full retry card, not fake "empty"
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const fetchApps = useCallback(async (status = statusFilter) => {
    if (!token) return;
    setLoading(true);
    setLoadFailed('');
    try {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`${API}/applications${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error(`Couldn’t load your tracker (server said ${res.status}). Please try again.`);
      const data: ApplicationsResponse = await res.json();
      setApps(data.data);
      setCounts(data.counts_by_status);
    } catch (err) {
      setLoadFailed(friendlyError(err, 'Couldn’t load your tracker.'));
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, router]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateStatus = async (id: string, status: Status) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/applications/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Couldn’t update the status. Please try again.');
      await fetchApps();
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t update the status.'));
    }
  };

  const saveNotes = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/applications/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteDraft }),
      });
      if (!res.ok) throw new Error('Couldn’t save your notes. Please try again.');
      setEditingNotes(null);
      await fetchApps();
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t save your notes.'));
    }
  };

  const deleteApp = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Remove this job from your tracker?')) return;
    try {
      const res = await fetch(`${API}/applications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Couldn’t remove this job. Please try again.');
      await fetchApps();
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t remove this job.'));
    }
  };

  const addManual = async () => {
    if (!token || !manualTitle.trim() || !manualUrl.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/applications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle.trim(),
          company: manualCompany.trim() || undefined,
          apply_url: manualUrl.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg || 'Couldn’t add this job. Please check the details and try again.');
      }
      setManualTitle(''); setManualCompany(''); setManualUrl('');
      setShowManualForm(false);
      await fetchApps();
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t add this job.'));
    } finally {
      setSaving(false);
    }
  };

  const totalTracked = Object.values(counts).reduce((a, b) => a + b, 0);
  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="font-century text-2xl md:text-3xl font-black text-slate-800">Job Tracker</h2>
          <p className="font-raleway text-sm text-gray-400 mt-1">Track every application from saved to accepted — no more spreadsheets</p>
        </div>
        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="font-raleway flex items-center justify-center gap-2 self-start bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3 rounded-2xl font-semibold text-sm transition-all"
        >
          <FiPlus size={16} /> Add Job Manually
        </button>
      </div>

      {/* Manual add form */}
      {showManualForm && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-6 mb-8">
          <h3 className="font-century text-base font-bold text-slate-800 mb-4">Track a job found elsewhere</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Job title *"
              className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200"
            />
            <input
              type="text" value={manualCompany} onChange={(e) => setManualCompany(e.target.value)}
              placeholder="Company"
              className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200"
            />
            <input
              type="url" value={manualUrl} onChange={(e) => setManualUrl(e.target.value)}
              placeholder="Job link (https://...) *"
              className="font-raleway text-sm bg-gray-50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={addManual}
              disabled={saving || !manualTitle.trim() || !manualUrl.trim()}
              className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add to Tracker'}
            </button>
            <button
              onClick={() => setShowManualForm(false)}
              className="font-raleway text-sm text-gray-400 hover:text-gray-600 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status filter chips — hidden while the list can't load (counts would be misleading) */}
      {!loadFailed && (
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <button
          onClick={() => setStatusFilter('')}
          className={`font-raleway text-xs font-bold px-4 py-2 rounded-xl transition-all ${!statusFilter ? 'bg-[#4F46E5] text-white' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}
        >
          All ({totalTracked})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`font-raleway text-xs font-bold px-4 py-2 rounded-xl transition-all ${statusFilter === s ? 'bg-[#4F46E5] text-white' : `${STATUS_STYLES[s]} hover:opacity-80`}`}
          >
            {STATUS_LABELS[s]} ({counts[s] || 0})
          </button>
        ))}
      </div>
      )}

      {error && (
        <div className="font-raleway bg-red-50 text-red-600 px-6 py-4 rounded-2xl mb-6 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={() => setError('')} className="flex-shrink-0 text-red-400 hover:text-red-600" aria-label="Dismiss">
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Applications list */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <FoliLoader fullScreen={false} moods={['look-l','look-r','idle']} messages={['Loading your applications…','Sorting your pipeline…']} />
        </div>
      ) : loadFailed ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-16 text-center">
          <FiWifiOff className="mx-auto text-gray-200 mb-4" size={48} />
          <h3 className="font-century text-xl font-bold text-slate-700 mb-2">Couldn&apos;t load your tracker</h3>
          <p className="font-raleway text-sm text-gray-400 mb-6 max-w-md mx-auto">{loadFailed}</p>
          <button
            onClick={() => fetchApps()}
            className="font-raleway inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all"
          >
            <FiRefreshCw size={14} /> Try Again
          </button>
        </div>
      ) : apps.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-16 text-center">
          <FiClipboard className="mx-auto text-gray-200 mb-4" size={48} />
          <h3 className="font-century text-xl font-bold text-slate-700 mb-2">
            {statusFilter ? `No ${STATUS_LABELS[statusFilter as Status]?.toLowerCase()} jobs` : 'Nothing tracked yet'}
          </h3>
          <p className="font-raleway text-sm text-gray-400 mb-6">
            Save jobs from the Jobs page, or add one manually to start tracking your applications.
          </p>
          <button
            onClick={() => router.push('/jobs')}
            className="font-raleway bg-[#4F46E5] hover:bg-[#4338CA] text-white px-8 py-3 rounded-2xl font-semibold text-sm transition-all"
          >
            Browse Jobs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {apps.map((app) => (
            <div key={app.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 p-7 hover:shadow-md transition-shadow group">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-century text-base font-bold text-slate-800 truncate group-hover:text-[#4F46E5] transition-colors">{app.title}</h3>
                  <p className="font-raleway text-sm text-gray-400 mt-0.5">{app.company}</p>
                </div>
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value as Status)}
                  className={`font-raleway text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer focus:outline-none ${STATUS_STYLES[app.status]}`}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {app.jobType && app.jobType !== 'Not specified' && (
                  <span className="font-raleway text-[11px] font-bold px-3 py-1 rounded-lg bg-gray-50 text-gray-500">{app.jobType}</span>
                )}
                {app.location && app.location !== 'Not specified' && (
                  <span className="font-raleway text-[11px] text-gray-400 flex items-center gap-1"><FiMapPin size={10} />{app.location}</span>
                )}
                {app.appliedAt && (
                  <span className="font-raleway text-[11px] text-gray-400">Applied {formatDate(app.appliedAt)}</span>
                )}
              </div>

              {/* Notes */}
              <div className="mt-4 pt-4 border-t border-gray-50">
                {editingNotes === app.id ? (
                  <div>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      placeholder="Notes: contacts, interview dates, follow-ups..."
                      className="font-raleway w-full text-sm bg-gray-50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 border border-transparent focus:border-blue-200 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => saveNotes(app.id)} className="font-raleway flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                        <FiCheck size={13} /> Save
                      </button>
                      <button onClick={() => setEditingNotes(null)} className="font-raleway flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                        <FiX size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingNotes(app.id); setNoteDraft(app.notes); }}
                    className="font-raleway w-full text-left text-xs text-gray-400 hover:text-gray-600 flex items-start gap-1.5"
                  >
                    <FiEdit3 size={12} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{app.notes || 'Add notes...'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                <a
                  href={app.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-raleway flex items-center gap-1.5 text-xs font-bold text-[#4F46E5] hover:text-[#4338CA]"
                >
                  View Posting <FiExternalLink size={12} />
                </a>
                <button
                  onClick={() => deleteApp(app.id)}
                  className="font-raleway flex items-center gap-1 text-xs text-gray-300 hover:text-red-500 transition-colors"
                >
                  <FiTrash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
