'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export default function PdfPreview({ url, title }: { url: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderTasks = useRef<RenderTask[]>([]);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(800);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let loaded: PDFDocumentProxy | null = null;
    void import('pdfjs-dist/legacy/build/pdf.mjs').then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs?v=5.4.530-legacy';
      const response = await fetch(url);
      if (!response.ok) throw new Error(`PDF request failed with ${response.status}`);
      const data = new Uint8Array(await response.arrayBuffer());
      loaded = await pdfjs.getDocument({ data }).promise;
      if (active) setPdf(loaded);
    }).catch((reason) => {
      console.error('PDF.js preview failed:', reason);
      if (active) setError('The clean preview is unavailable, so the browser preview is shown instead.');
    });
    return () => { active = false; void loaded?.destroy(); };
  }, [url]);

  useEffect(() => {
    if (!hostRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.min(980, Math.max(320, entry.contentRect.width - 32))));
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf) return;
    renderTasks.current.forEach(task => task.cancel());
    renderTasks.current = [];
    let cancelled = false;
    const render = async () => {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / natural.width });
        const canvas = canvasRefs.current[pageNumber - 1];
        if (!canvas) continue;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext('2d');
        if (!context) continue;
        const task = page.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        renderTasks.current.push(task);
        await task.promise.catch(() => undefined);
      }
    };
    void render();
    return () => { cancelled = true; renderTasks.current.forEach(task => task.cancel()); };
  }, [pdf, width]);

  if (error) return <div className="bg-slate-100 p-3"><p className="mb-2 text-center text-xs text-slate-500">{error}</p><iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={title} className="h-[72vh] min-h-[640px] w-full rounded-xl bg-white" /></div>;

  return (
    <div ref={hostRef} aria-label={title} className="max-h-[76vh] min-h-[680px] overflow-auto bg-[#e8ecea] px-3 py-5 md:px-8">
      {!pdf && <div className="flex min-h-[640px] items-center justify-center gap-3 text-sm font-semibold text-slate-500"><Loader2 className="animate-spin" size={20} /> Preparing document preview…</div>}
      {pdf && <div className="mx-auto flex w-fit flex-col gap-5">{Array.from({ length: pdf.numPages }, (_, index) => <canvas key={index} ref={node => { canvasRefs.current[index] = node; }} className="max-w-full rounded-lg bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)]" />)}</div>}
    </div>
  );
}
