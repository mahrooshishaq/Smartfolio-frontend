'use client';
import React, { useState } from 'react';
import { CloudUpload, FileText, X, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function ResumeUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        alert('Only PDF files are allowed.');
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

      const uploadRes = await fetch('http://localhost:3001/resume/upload', {
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

      // 2. Trigger Analysis
      // Lens A if jobDescription exists, Lens B if not.
      const analyzeRes = await fetch('http://localhost:3001/resume/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          resumeId: actualResumeId,
          jobDescription: jobDescription || undefined,
          // Fallback title to ensure Lens A doesn't fail due to missing field
          jobTitle: jobDescription ? "Target Role" : undefined, 
        }),
      });

      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json();
        throw new Error(errorData.message || 'Analysis failed');
      }

      // 3. Success Redirect
      // Match the key 'resumeId' used in your Results page useEffect
      router.push(`/analysis-results?resumeId=${actualResumeId}`);

    } catch (error: any) {
      console.error("Analysis Error:", error);
      alert(error.message || 'Something went wrong during analysis.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden p-8 flex flex-col items-center font-raleway">
      <AnimatedBackground />

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Header */}
        <div className="w-full max-w-4xl flex items-center mb-12">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex gap-1.5 ml-4">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <h1 className="font-baloo text-xl ml-4 tracking-wide text-slate-800">SmartFolio - AI</h1>
        </div>

        <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 p-12 border border-gray-50">
          
          {/* Dropzone Area */}
          <div className="relative border-2 border-dashed border-gray-200 rounded-2rem p-12 flex flex-col items-center justify-center transition-colors hover:border-blue-200 group">
            <input 
              type="file" 
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="bg-slate-50 p-4 rounded-2xl mb-4 group-hover:bg-blue-50 transition-colors">
              <CloudUpload size={32} className="text-gray-400 group-hover:text-blue-500" />
            </div>
            <h2 className="font-century text-2xl text-slate-800 mb-1 text-center">Choose a file or drag & drop it here</h2>
            <p className="font-raleway text-gray-400 text-sm">PDF and DOCX formats up to 5MB</p>
            
            <button className="font-raleway mt-8 bg-slate-200 text-gray-500 px-12 py-3 rounded-full font-bold text-sm tracking-wide">
              {file ? 'Change File' : 'Upload'}
            </button>
          </div>

          {/* Optional Job Description Input */}
          <div className="mt-8 px-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Target Job Description (Optional)
            </label>
            <textarea 
              placeholder="Paste the job description here to get a tailored score..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isUploading}
              className="font-raleway w-full h-32 p-4 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-100 outline-none transition-all resize-none disabled:opacity-50"
            />
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