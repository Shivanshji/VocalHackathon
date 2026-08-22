import { ChangeEvent, FormEvent, useState } from 'react';

type Result = { detected_language: string | null; language_probability: number | null; original_text: string;
  english_text: string | null; fact_check_gate: { should_fact_check: boolean | null; statement_type: string; reason: string };
  stt_latency_ms: number; translation_latency_ms: number | null; classification_latency_ms: number | null; total_latency_ms: number };
const languages: Record<string, string> = { en: 'English', hi: 'Hindi', ml: 'Malayalam', ta: 'Tamil', te: 'Telugu' };
const api = import.meta.env.VITE_PERSON2_API_URL ?? 'http://localhost:8000';
const ms = (n: number | null) => n == null ? 'Unavailable' : `${Math.round(n)} ms`;
const title = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function Person2Pipeline() {
  const [file, setFile] = useState<File | null>(null), [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const choose = (e: ChangeEvent<HTMLInputElement>) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!file) return setError('Choose an audio file first.');
    setLoading(true); setError(''); setResult(null); const body = new FormData(); body.append('audio', file);
    try { const response = await fetch(`${api}/api/analyze-audio`, { method: 'POST', body });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail ?? `Request failed (${response.status})`); setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not reach the backend.'); } finally { setLoading(false); }
  };
  const decision = result?.fact_check_gate.should_fact_check == null ? 'UNAVAILABLE' : result.fact_check_gate.should_fact_check ? 'YES' : 'NO';
  return <main className="p2-page"><div className="p2-shell">
    <p className="p2-label">PERSON 2 — PIPELINE TEST</p><h1>Speech Pipeline</h1><p className="p2-muted">Audio → Whisper → IndicTrans2 → Gemini routing</p>
    <form className="p2-upload" onSubmit={submit}><label className="p2-file">Choose File<input type="file" accept=".wav,.mp3,.m4a,.webm,audio/*" onChange={choose}/></label><span>{file?.name ?? 'No audio selected'}</span><button disabled={!file || loading}>{loading ? 'Processing…' : 'Analyze Audio'}</button></form>
    {loading && <p className="p2-status">Status: Processing… First model runs can take longer.</p>}{error && <div className="p2-error" role="alert">{error}</div>}
    {result && <div className="p2-results">
      <section><h2>Detected Language</h2><strong>{languages[result.detected_language ?? ''] ?? result.detected_language ?? 'Unknown'}</strong>{result.language_probability != null && <small>{Math.round(result.language_probability * 100)}% confidence</small>}</section>
      <section><h2>Original Transcript</h2><p>{result.original_text}</p></section><section><h2>English Translation</h2><p>{result.english_text ?? 'Translation unavailable'}</p></section>
      <section className={`p2-gate p2-${decision.toLowerCase()}`}><h2>Fact-Check Routing</h2><strong>Should Fact Check: {decision}</strong><p><b>Type:</b> {title(result.fact_check_gate.statement_type)}</p><p><b>Reason:</b> {result.fact_check_gate.reason}</p></section>
      <section><h2>Performance</h2><div className="p2-timing"><span>STT <b>{ms(result.stt_latency_ms)}</b></span><span>Translation <b>{ms(result.translation_latency_ms)}</b></span><span>Classifier <b>{ms(result.classification_latency_ms)}</b></span><span>Total <b>{ms(result.total_latency_ms)}</b></span></div></section>
    </div>}<a className="p2-landing" href="/">Open the teammate landing page →</a>
  </div></main>;
}
