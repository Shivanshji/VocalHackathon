import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, FileAudio, Film, Mic, Upload, X } from 'lucide-react';

type Gate = { should_fact_check: boolean | null; statement_type: string; reason: string };
type Evidence = { title: string; url: string; source_quality: number; stance: string; text: string; relevance_score: number };
type FactCheckResult = { verdict: string; confidence: number; canonical_claim: string; explanation: string; evidence: Evidence[]; status: string };
type ProcessedSegment = { segment_id: string; start: number; end: number; original_text: string; english_text: string | null; fact_check_gate: Gate; fact_check_result?: FactCheckResult; fact_check_error?: string };
type AnalysisResult = {
  detected_language: string | null; language_probability: number | null; original_text: string;
  english_text: string | null; fact_check_gate: Gate; processed_segments: ProcessedSegment[];
  stt_latency_ms: number; translation_latency_ms: number | null;
  classification_latency_ms: number | null; total_latency_ms: number;
};

const API_URL = import.meta.env.VITE_PERSON2_API_URL ?? 'http://localhost:8000';
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi', ml: 'Malayalam', ta: 'Tamil', te: 'Telugu' };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export const TryItSection: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [claims, setClaims] = useState<ProcessedSegment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [processedChunks, setProcessedChunks] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [transcribedChunks, setTranscribedChunks] = useState(0);
  const [waitingForBuffer, setWaitingForBuffer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const processedThrough = processedChunks * 5;
  const playbackReady = processedChunks >= 3 || (!loading && processedChunks > 0);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !waitingForBuffer) return;
    if (!loading || processedThrough - media.currentTime >= 10) {
      setWaitingForBuffer(false);
      void media.play().catch(() => undefined);
    }
  }, [processedThrough, waitingForBuffer, loading]);

  useEffect(() => {
    if (!file) { setMediaUrl(''); return; }
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (selected?: File) => {
    if (!selected) return;
    setFile(selected); setResult(null); setClaims([]); setCurrentTime(0); setError('');
  };
  const removeFile = () => {
    setFile(null); setResult(null); setClaims([]); setError('');
    if (inputRef.current) inputRef.current.value = '';
  };
  const analyze = async () => {
    if (!file || loading) return;
    setLoading(true); setError(''); setClaims([]); setProgress('Uploading…'); setProcessedChunks(0); setTranscribedChunks(0); setChunkCount(0); setWaitingForBuffer(false);
    setResult({ detected_language: null, language_probability: null, original_text: '', english_text: null,
      fact_check_gate: { should_fact_check: null, statement_type: 'unknown', reason: 'Routing pending.' },
      processed_segments: [], stt_latency_ms: 0, translation_latency_ms: null,
      classification_latency_ms: null, total_latency_ms: 0 });
    const started = performance.now();
    const body = new FormData(); body.append('audio', file);
    try {
      mediaRef.current?.pause();
      if (mediaRef.current) mediaRef.current.currentTime = 0;
      const response = await fetch(`${API_URL}/api/analyze-audio-stream`, { method: 'POST', body });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.detail ?? `Analysis failed (${response.status})`); }
      if (!response.body) throw new Error('This browser cannot read streaming responses.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'error') throw new Error(event.detail);
          if (event.type === 'started') { setChunkCount(event.chunk_count); setProgress(`0/${event.chunk_count} chunks · ${event.chunk_seconds}s each`); }
          if (event.type === 'transcription_progress') setTranscribedChunks(event.transcribed_chunks);
          if (event.type === 'progress') { setProcessedChunks(event.completed_chunks); setProgress(`${event.completed_chunks}/${event.chunk_count} chunks processed`); }
          if (event.type === 'segment') setResult(current => current && ({ ...current,
            detected_language: current.detected_language ?? event.detected_language,
            language_probability: current.language_probability ?? event.language_probability,
            original_text: [current.original_text, event.segment.original_text].filter(Boolean).join(' '),
            english_text: [current.english_text, event.segment.english_text].filter(Boolean).join(' ') || null,
            processed_segments: [...current.processed_segments, event.segment], total_latency_ms: performance.now() - started }));
          if (event.type === 'claim') setClaims(current => current.some(segment => segment.segment_id === event.segment.segment_id) ? current : [...current, event.segment]);
          if (event.type === 'fact_check') setClaims(current => current.map(segment => segment.segment_id === event.result.segment_id
            ? { ...segment, fact_check_result: event.result } : segment));
          if (event.type === 'fact_check_error') setClaims(current => current.map(segment => segment.segment_id === event.segment_id
            ? { ...segment, fact_check_error: event.detail } : segment));
          if (event.type === 'gate') setResult(current => current && ({ ...current,
            processed_segments: current.processed_segments.map(segment => segment.segment_id === event.segment_id
              ? { ...segment, fact_check_gate: event.fact_check_gate } : segment) }));
          if (event.type === 'complete') setProgress(`Complete · ${event.segment_count} segments`);
        }
        if (done) break;
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the speech backend.');
    } finally { setLoading(false); }
  };
  const syncTranscript = () => {
    const time = mediaRef.current?.currentTime ?? 0;
    setCurrentTime(time);
    if (loading && time >= Math.max(0, processedThrough - 1)) {
      mediaRef.current?.pause(); setWaitingForBuffer(true);
    }
  };
  const guardPlayback = () => {
    if (!playbackReady) { mediaRef.current?.pause(); setWaitingForBuffer(true); return; }
    if (loading && (mediaRef.current?.currentTime ?? 0) >= Math.max(0, processedThrough - 1)) {
      mediaRef.current?.pause(); setWaitingForBuffer(true);
    }
  };
  const seek = (segment: ProcessedSegment) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = segment.start;
    void mediaRef.current.play();
  };
  const isVideo = file?.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file?.name ?? '');
  const activeTranslations = result?.processed_segments.filter(segment => currentTime >= segment.start && currentTime < segment.end) ?? [];
  const visibleClaims = [...claims]
    .filter(segment => segment.start <= currentTime).reverse().slice(0, 6);

  return <section id="tryit" className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-black">
    <div className="max-w-7xl mx-auto px-6 sm:px-8">
      <div className="text-center mb-14 space-y-4"><div className="text-xs font-mono uppercase tracking-widest text-zinc-500">// TRY IT LIVE</div><h2 className="font-heading text-3xl sm:text-5xl font-bold text-white">Upload. Translate. Route.</h2><p className="text-zinc-400 max-w-2xl mx-auto">Upload spoken audio or video, then play it alongside sentence-level transcription, translation, and routing.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-1.5">{['English','Hindi','Tamil','Telugu','Malayalam'].map(language => <span key={language} className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-zinc-900 border border-white/[0.06] text-zinc-400">{language}</span>)}</div>
          <div id="tryit-upload-dropzone" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]); }} onClick={() => !file && inputRef.current?.click()} className={`min-h-[230px] rounded-2xl border-2 border-dashed flex items-center justify-center p-8 ${dragging ? 'border-white/40 bg-white/[0.04]' : file ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : 'border-white/10 bg-[#080808] cursor-pointer'}`}>
            <input ref={inputRef} type="file" className="hidden" accept=".mp4,.mp3,.wav,.m4a,.webm,.mov,audio/*,video/*" onChange={event => selectFile(event.target.files?.[0])}/>
            {file ? <div className="text-center space-y-4">{isVideo ? <Film className="w-8 h-8 text-indigo-400 mx-auto"/> : <FileAudio className="w-8 h-8 text-emerald-400 mx-auto"/>}<p className="text-sm text-zinc-100 break-all">{file.name}</p><button onClick={event => { event.stopPropagation(); removeFile(); }} className="px-3 py-1.5 rounded-full text-xs text-zinc-400 bg-zinc-900 border border-white/10"><X className="inline w-3 h-3 mr-1"/>Remove</button></div> : <div className="text-center"><Upload className="w-8 h-8 text-zinc-500 mx-auto mb-4"/><p className="text-sm text-zinc-200">Drop audio or video here</p><p className="text-xs text-zinc-600 mt-2">MP4 · MP3 · WAV · M4A · WebM · MOV · 50 MB max</p></div>}
          </div>
          {file && mediaUrl && (isVideo ? <video ref={element => { mediaRef.current = element; }} src={mediaUrl} controls onPlay={guardPlayback} onTimeUpdate={syncTranscript} className="w-full max-h-72 rounded-xl bg-zinc-950"/> : <audio ref={element => { mediaRef.current = element; }} src={mediaUrl} controls onPlay={guardPlayback} onTimeUpdate={syncTranscript} className="w-full"/>)}
          {file && loading && <div className={`rounded-xl border px-4 py-3 text-xs font-mono ${playbackReady && !waitingForBuffer ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-300'}`}>{waitingForBuffer ? `BUFFERING — ${transcribedChunks}/${chunkCount} transcribed · ${processedChunks}/${chunkCount} translated` : playbackReady ? `PLAYBACK READY · ${transcribedChunks}/${chunkCount} transcribed · playable through ${formatTime(processedThrough)}` : `BUFFERING · ${transcribedChunks}/${chunkCount} transcribed · ${processedChunks}/3 READY TO PLAY`}</div>}
          <button disabled title="Live microphone chunking is the next phase" className="w-full py-3 rounded-xl bg-zinc-950 border border-white/[0.08] text-zinc-600 text-sm font-mono cursor-not-allowed"><Mic className="inline w-4 h-4 mr-2"/>Live microphone — coming next</button>
          <button id="tryit-analyse-btn" disabled={!file || loading} onClick={analyze} className="w-full py-4 rounded-xl font-semibold text-sm bg-white text-black disabled:bg-zinc-900 disabled:text-zinc-600">{loading ? `Streaming · ${progress}` : 'Analyse with SachMein?'}<ArrowUpRight className="inline w-4 h-4 ml-2"/></button>
          {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        </div>
        <div className="flex flex-col gap-6">
          <div><div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">// LIVE TRANSCRIPTION + TRANSLATION</div><p className="text-sm text-zinc-500">Only the line matching the current playback position is revealed</p></div>
          <div id="tryit-results-panel" className="min-h-[220px] rounded-2xl border border-indigo-500/20 bg-[#08080d] p-5">
            {result ? <div className="space-y-3">
              <div className="flex justify-between text-xs text-zinc-500"><span>{LANGUAGE_NAMES[result.detected_language ?? ''] ?? result.detected_language ?? 'Detecting language…'}</span><span>{formatTime(currentTime)}</span></div>
              {activeTranslations.map(segment => <div key={segment.segment_id} className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-4">
                <p className="text-sm leading-6 text-zinc-300">{segment.original_text}</p>
                {segment.english_text && <p className="mt-3 text-base leading-6 text-white">{segment.english_text}</p>}
                <p className="mt-2 text-[10px] font-mono text-zinc-500">{formatTime(segment.start)}–{formatTime(segment.end)}</p>
              </div>)}
              {activeTranslations.length === 0 && <div className="py-12 text-center text-xs font-mono text-zinc-600">{loading && result.processed_segments.length === 0 ? 'PREPARING TRANSLATION BUFFER…' : 'NO SPOKEN LINE AT THIS POSITION'}</div>}
            </div> : <div className="py-16 text-center text-xs text-zinc-700">Upload spoken audio to begin.</div>}
          </div>

          <div><div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">// LIVE FACT CHECKS</div><p className="text-sm text-zinc-500">Only factual statements routed by Person 2 appear here</p></div>
          <div className="min-h-[280px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#060606] p-5 space-y-3">
            {visibleClaims.map(segment => { const check = segment.fact_check_result; const verdict = check?.verdict; return <button key={segment.segment_id} onClick={() => seek(segment)} className="w-full text-left rounded-xl border border-white/[0.06] bg-zinc-950 p-4 hover:border-white/20">
              <div className="flex justify-between mb-2"><span className="text-[10px] font-mono text-zinc-500">{formatTime(segment.start)}–{formatTime(segment.end)}</span><span className={`text-[10px] font-mono ${verdict === 'SUPPORTED' ? 'text-emerald-400' : verdict === 'CONTRADICTED' ? 'text-red-400' : verdict === 'MISLEADING' ? 'text-amber-400' : 'text-zinc-500'}`}>{segment.fact_check_error ? 'CHECK UNAVAILABLE' : verdict ?? 'CHECKING LIVE…'}</span></div>
              <p className="text-sm leading-6 text-white">{segment.english_text}</p>
              {check ? <><p className="mt-2 text-xs leading-5 text-zinc-400">{check.explanation}</p><p className="mt-2 text-[10px] font-mono text-zinc-500">CONFIDENCE {Math.round(check.confidence * 100)}% · {check.evidence.length} SOURCES</p>{check.evidence.slice(0, 3).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="mt-2 block text-xs text-indigo-400 hover:underline">{source.title}</a>)}</> : <p className="mt-2 text-[11px] text-zinc-600">{segment.fact_check_gate.statement_type.replaceAll('_',' ')} · {segment.fact_check_gate.reason}</p>}
            </button>; })}
            {visibleClaims.length === 0 && <div className="py-16 text-center text-xs font-mono text-zinc-600">NO FACTUAL CLAIM REACHED YET</div>}
            <p className="text-center text-[10px] font-mono text-zinc-700">FUTURE CLAIMS STAY HIDDEN UNTIL PLAYBACK REACHES THEM</p>
          </div>
        </div>
      </div>
    </div>
  </section>;
};
