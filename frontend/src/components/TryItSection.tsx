import React, { useState, useRef } from 'react';
import { Upload, Mic, Film, FileAudio, X, ArrowUpRight } from 'lucide-react';

export const TryItSection: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SUPPORTED_LANGUAGES = [
    'Hindi', 'Tamil', 'Telugu', 'Bengali',
    'Marathi', 'Kannada', 'Malayalam', 'Punjabi',
    'Odia', 'Gujarati', 'Urdu', 'Assamese',
  ];

  const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isVideo = uploadedFile?.type.startsWith('video/');

  return (
    <section
      id="tryit"
      className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-black overflow-hidden"
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-emerald-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/[0.04] rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">

        {/* Section Header */}
        <div className="text-center mb-14 space-y-4">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-500">// TRY IT LIVE</div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Upload. Translate. Verify.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto font-sans leading-relaxed">
            Drop your audio or video file and SachMein? will translate the speech and fact-check every claim in real time.
          </p>
        </div>

        {/* Main split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT: Upload Panel ───────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Supported languages */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-2">
                Supported Languages
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <span
                    key={lang}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 border border-white/[0.06] text-zinc-400"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            {/* Drop Zone */}
            <div
              id="tryit-upload-dropzone"
              className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[260px] flex items-center justify-center
                ${isDragging
                  ? 'border-white/40 bg-white/[0.04] scale-[1.01]'
                  : uploadedFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                    : 'border-white/[0.10] bg-[#080808] hover:border-white/25 hover:bg-white/[0.02]'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="tryit-file-input"
                accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp4,.mp3,.wav,.m4a,.webm,.mov"
                className="hidden"
                onChange={handleFileChange}
              />

              {uploadedFile ? (
                /* File selected state */
                <div className="flex flex-col items-center gap-4 px-8 py-6 text-center w-full">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                    isVideo
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    {isVideo
                      ? <Film className="w-6 h-6 text-indigo-400" />
                      : <FileAudio className="w-6 h-6 text-emerald-400" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100 mb-1 break-all">
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs font-mono text-zinc-500">
                      {formatFileSize(uploadedFile.size)} · {uploadedFile.type}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                    id="tryit-remove-file-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 hover:border-white/30 transition-all"
                  >
                    <X className="w-3 h-3" />
                    Remove File
                  </button>
                </div>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center gap-5 px-8 py-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center transition-all duration-200 group-hover:border-white/25">
                    <Upload className="w-7 h-7 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200 mb-1">
                      Drop your video or audio here
                    </p>
                    <p className="text-xs text-zinc-500 font-sans leading-relaxed">
                      MP4 · MP3 · WAV · M4A · WebM · MOV
                      <br />
                      Max file size: 500 MB
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full max-w-[200px]">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[10px] font-mono text-zinc-600 uppercase">or</span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    id="tryit-browse-btn"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-white/10 hover:border-white/30 text-xs font-mono text-zinc-300 hover:text-white transition-all duration-200"
                  >
                    Browse Files
                  </button>
                </div>
              )}
            </div>

            {/* Live mic option */}
            <button
              type="button"
              id="tryit-live-mic-btn"
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-zinc-950 border border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-zinc-200 text-sm font-mono transition-all duration-200 group"
            >
              <Mic className="w-4 h-4 group-hover:text-white transition-colors" />
              Record Live Audio Instead
            </button>

            {/* Analyse button */}
            <button
              type="button"
              id="tryit-analyse-btn"
              disabled={!uploadedFile}
              className={`w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm transition-all duration-200
                ${uploadedFile
                  ? 'bg-white text-black hover:bg-zinc-200 cursor-pointer shadow-lg'
                  : 'bg-zinc-900 text-zinc-600 border border-white/[0.06] cursor-not-allowed'
                }`}
            >
              Analyse with SachMein?
              <ArrowUpRight className="w-4 h-4" />
            </button>

          </div>

          {/* ── RIGHT: Results Panel (empty — backend to populate) ────────── */}
          <div className="flex flex-col gap-4">

            {/* Panel header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">
                  // LIVE TRANSCRIPT + FACT-CHECK
                </div>
                <div className="text-sm font-semibold text-zinc-500">
                  Results will appear here after analysis
                </div>
              </div>
              {/* Color legend */}
              <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
                {[
                  { dot: 'bg-emerald-500', label: 'Verified' },
                  { dot: 'bg-yellow-500', label: 'Misleading' },
                  { dot: 'bg-red-500', label: 'False' },
                  { dot: 'bg-zinc-600', label: 'Checking' },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    <span className="text-[9px] font-mono text-zinc-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty results area */}
            <div
              id="tryit-results-panel"
              className="flex-1 min-h-[420px] rounded-2xl border border-white/[0.06] bg-[#060606] flex flex-col items-center justify-center gap-6 px-8 text-center"
            >
              {/* Placeholder grid — skeleton of what the transcript will look like */}
              <div className="w-full space-y-3 opacity-20 pointer-events-none select-none">
                {[
                  { w: 'w-full', status: 'bg-emerald-500' },
                  { w: 'w-5/6', status: 'bg-red-500' },
                  { w: 'w-full', status: 'bg-yellow-500' },
                  { w: 'w-4/5', status: 'bg-zinc-600' },
                  { w: 'w-full', status: 'bg-emerald-500' },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1.5">
                      <div className={`w-0.5 h-8 rounded-full ${row.status}`} />
                    </div>
                    <div className={`${row.w} space-y-1.5`}>
                      <div className="h-2 bg-zinc-800 rounded-full w-1/3" />
                      <div className="h-2 bg-zinc-800 rounded-full w-full" />
                      <div className="h-2 bg-zinc-800 rounded-full w-2/3" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Waiting message */}
              <div className="space-y-2">
                <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest">
                  Awaiting upload
                </p>
                <p className="text-xs text-zinc-700 font-sans leading-relaxed max-w-xs">
                  Upload a video or audio file on the left to see real-time translation and color-coded fact-checking results here.
                </p>
              </div>

              {/* Colour code legend for mobile */}
              <div className="flex sm:hidden items-center gap-3 flex-wrap justify-center">
                {[
                  { dot: 'bg-emerald-500', label: 'Verified', color: 'text-emerald-600' },
                  { dot: 'bg-yellow-500', label: 'Misleading', color: 'text-yellow-600' },
                  { dot: 'bg-red-500', label: 'False', color: 'text-red-600' },
                  { dot: 'bg-zinc-600', label: 'Checking', color: 'text-zinc-600' },
                ].map(({ dot, label, color }) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    <span className={`text-[9px] font-mono ${color}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Backend integration hint */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-white/[0.06]">
              <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0 animate-pulse" />
              <p className="text-[11px] font-sans text-zinc-600 leading-relaxed">
                Translation + fact-check results from the SachMein? backend will stream into this panel per sentence, color-coded by claim verdict.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
