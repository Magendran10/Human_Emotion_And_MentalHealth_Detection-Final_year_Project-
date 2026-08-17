// src/pages/TextDemo.jsx
// Standalone DistilBERT text feature extraction demo
// Type text → tokenize → DistilBERT → [768] CLS embedding

import React, { useState, useRef, useCallback } from 'react';

// ── Token count estimator (rough, for UI only) ───────────────────────────────
const estimateTokens = (text) => Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);

// ── Embedding bar visualizer ──────────────────────────────────────────────────
const EmbeddingViz = ({ embedding }) => {
  const max  = Math.max(...embedding.map(Math.abs));
  const show = embedding.slice(0, 128);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 68, padding: '4px 0 12px 0', overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
      {show.map((val, i) => {
        const norm = val / (max || 1);
        const h    = Math.abs(norm) * 46 + 2;
        const hue  = norm > 0 ? 270 : 60; // purple positive, yellow negative
        return (
          <div key={i} title={`[${i}]: ${val.toFixed(4)}`} style={{
            width: 4, height: h, borderRadius: 2,
            background: `hsl(${hue}, 75%, ${52 + norm * 15}%)`,
            opacity: 0.85, flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
};

// ── Sample texts ──────────────────────────────────────────────────────────────
const SAMPLES = [
  "I feel really anxious and overwhelmed today. Everything seems too much to handle.",
  "I'm doing great! Had a wonderful day with friends and family.",
  "I don't know how to describe it, but I feel completely empty inside.",
  "The presentation went well and I feel confident about my work.",
  "I've been struggling to sleep and keep having negative thoughts.",
];

// ─────────────────────────────────────────────────────────────────────────────
export default function TextDemo() {
  const [phase, setPhase]         = useState('idle');
  const [logs, setLogs]           = useState([]);
  const [pct, setPct]             = useState(0);
  const [pctMsg, setPctMsg]       = useState('');
  const [embedding, setEmbedding] = useState(null);
  const [stats, setStats]         = useState(null);
  const [text, setText]           = useState('');

  const workerRef = useRef(null);
  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const runPipeline = async () => {
    if (!text.trim()) return;

    setPhase('running'); setPct(0);
    setEmbedding(null); setStats(null);
    setLogs([]);
    addLog(`📝 Input text (${text.length} chars, ~${estimateTokens(text)} tokens)`);

    const t0     = performance.now();
    const worker = new Worker('/textWorker.js', { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'log') {
        addLog(msg.message);
      } else if (msg.type === 'progress') {
        setPct(msg.pct);
        setPctMsg(msg.message);
      } else if (msg.type === 'complete') {
        const inferSec = ((performance.now() - t0) / 1000).toFixed(2);
        const emb = msg.embedding;
        setEmbedding(emb);
        setStats({
          dims:       emb.length,
          tokens:     msg.tokenCount,
          chars:      msg.textLength,
          inferTime:  inferSec,
          min:        Math.min(...emb).toFixed(5),
          max:        Math.max(...emb).toFixed(5),
          mean:       (emb.reduce((a, b) => a + b, 0) / emb.length).toFixed(5),
        });
        setPct(100);
        setPhase('done');
        addLog(`🏁 Done in ${inferSec}s — text embedding: [${emb.length}]`);
        worker.terminate();
      } else if (msg.type === 'error') {
        addLog(`❌ Worker: ${msg.message}`);
        setPhase('error');
        worker.terminate();
      }
    };

    worker.onerror = (e) => {
      addLog(`❌ Worker error: ${e.message}`);
      setPhase('error');
    };

    worker.postMessage({ type: 'extract', text: text.trim() });
  };

  const reset = () => {
    workerRef.current?.terminate();
    setPhase('idle'); setLogs([]); setPct(0);
    setEmbedding(null); setStats(null);
  };

  const isRunning = phase === 'running';
  const tokenEst  = estimateTokens(text);
  const overLimit = tokenEst > 128;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.badge}>TEXT PIPELINE DEMO</span>
        <h1 style={S.title}>DistilBERT<br />Feature Extraction</h1>
        <p style={S.sub}>On-device · 128 tokens max · 768-dim CLS embedding</p>
      </div>

      {/* Pipeline steps */}
      <div style={S.steps}>
        {['📝 Text Input', '🔢 Tokenize', '🧠 DistilBERT', `📊 [${stats?.dims ?? '768'}] dims`].map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ ...S.step, ...(phase === 'done' ? S.stepDone : {}) }}>
              <span>{s}</span>
            </div>
            {i < 3 && <span style={S.arrow}>›</span>}
          </React.Fragment>
        ))}
      </div>

      <div style={S.grid}>
        {/* LEFT: Input */}
        <div style={S.card}>
          <div style={S.cardHead}>📝 TEXT INPUT</div>

          {/* Sample text buttons */}
          <div style={S.samplesLabel}>Quick samples:</div>
          <div style={S.samples}>
            {SAMPLES.map((s, i) => (
              <button key={i} onClick={() => { setText(s); setPhase('idle'); }}
                style={S.sampleBtn}>
                {s.slice(0, 40)}...
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setPhase('idle'); }}
            placeholder="Type or paste text here... (max 128 tokens)"
            style={{
              ...S.textarea,
              borderColor: overLimit ? '#f87171' : '#1a2535',
            }}
          />

          <div style={S.tokenBar}>
            <div style={S.tokenCount}>
              <span style={{ color: overLimit ? '#f87171' : '#4a5568' }}>
                ~{tokenEst} tokens
              </span>
              <span style={{ color: '#2d3748' }}> / 128 max</span>
            </div>
            <div style={S.tokenTrack}>
              <div style={{
                ...S.tokenFill,
                width: `${Math.min(100, (tokenEst / 128) * 100)}%`,
                background: overLimit ? '#f87171' : '#a78bfa',
              }} />
            </div>
          </div>

          {overLimit && (
            <div style={S.warning}>
              ⚠️ Text will be truncated to 128 tokens
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={runPipeline}
              disabled={!text.trim() || isRunning}
              style={{ ...S.btn, flex: 1, ...(!text.trim() || isRunning ? S.btnOff : S.btnOn) }}
            >
              {isRunning ? `⚙️ Running... ${pct}%` : '▶ Run Pipeline'}
            </button>
            <button onClick={reset} style={{ ...S.btn, ...S.btnGhost }}>↺</button>
          </div>

          {isRunning && (
            <div style={{ marginTop: 10 }}>
              <div style={S.track}><div style={{ ...S.bar, width: `${pct}%` }} /></div>
              <div style={S.pctLabel}>{pctMsg} {pct}%</div>
            </div>
          )}
        </div>

        {/* RIGHT: Output */}
        <div style={S.card}>
          <div style={S.cardHead}>📊 RESULTS</div>

          {!embedding && (
            <div style={S.empty}>
              <span style={{ fontSize: 44, opacity: 0.2 }}>🧠</span>
              <span style={{ color: '#4a5568', fontSize: 12, marginTop: 8 }}>
                Type text and run the pipeline
              </span>
            </div>
          )}

          {stats && (
            <div style={S.statGrid}>
              {[
                { k: 'Embedding Dims', v: stats.dims,      c: '#a78bfa' },
                { k: 'Tokens Used',    v: stats.tokens,    c: '#60a5fa' },
                { k: 'Chars Input',    v: stats.chars,     c: '#4ade80' },
                { k: 'Inference Time', v: `${stats.inferTime}s`, c: '#fb923c' },
                { k: 'Min',            v: stats.min,        c: '#f87171' },
                { k: 'Max',            v: stats.max,        c: '#4ade80' },
                { k: 'Mean',           v: stats.mean,       c: '#a78bfa' },
              ].map(s => (
                <div key={s.k} style={S.statBox}>
                  <div style={{ ...S.statVal, color: s.c }}>{s.v}</div>
                  <div style={S.statKey}>{s.k}</div>
                </div>
              ))}
            </div>
          )}

          {embedding && (
            <>
              <div style={S.label}>Embedding (first 128 of {embedding.length} dims)</div>
              <EmbeddingViz embedding={embedding} />
              <div style={S.label}>Vector preview</div>
              <div style={S.code}>
                [{embedding.slice(0, 6).map(v => v.toFixed(5)).join(', ')}, ...]
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logs */}
      <div style={{ ...S.card, marginTop: 20 }}>
        <div style={S.cardHead}>⚡ LOGS</div>
        <div style={S.logs}>
          {logs.length === 0
            ? <span style={{ color: '#2d3748', fontStyle: 'italic' }}>Waiting...</span>
            : logs.map((l, i) => <div key={i} style={S.logLine}>{l}</div>)
          }
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#080b12', color: '#cbd5e0', fontFamily: '"IBM Plex Mono", "Courier New", monospace', padding: '36px 48px 80px', width: '100%' },
  header:     { marginBottom: 36 },
  badge:      { fontSize: 9, letterSpacing: '0.2em', color: '#a78bfa', border: '1px solid #a78bfa33', padding: '3px 10px', borderRadius: 3, display: 'inline-block', marginBottom: 14 },
  title:      { fontSize: 'clamp(28px, 5vw, 56px)', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.05, letterSpacing: '-0.03em', background: 'linear-gradient(120deg, #e2e8f0 30%, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub:        { color: '#4a5568', fontSize: 12, letterSpacing: '0.08em', margin: 0 },
  steps:      { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, flexWrap: 'wrap' },
  step:       { padding: '8px 14px', background: '#0f1623', border: '1px solid #1a2535', borderRadius: 6, fontSize: 11, color: '#64748b' },
  stepDone:   { border: '1px solid #a78bfa55', color: '#a78bfa', background: '#130e1f' },
  arrow:      { color: '#1e2d3d', fontSize: 18 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  card:       { background: '#0f1623', border: '1px solid #1a2535', borderRadius: 12, padding: 22 },
  cardHead:   { fontSize: 9, letterSpacing: '0.18em', color: '#4a5568', fontWeight: 700, marginBottom: 14 },
  samplesLabel: { fontSize: 9, color: '#2d3748', letterSpacing: '0.1em', marginBottom: 6 },
  samples:    { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  sampleBtn:  { background: '#0d1520', border: '1px solid #1a2535', borderRadius: 5, color: '#4a5568', fontSize: 9, padding: '5px 8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'border-color 0.15s', ':hover': { borderColor: '#a78bfa' } },
  textarea:   { width: '100%', minHeight: 100, background: '#080b12', border: '1px solid #1a2535', borderRadius: 7, color: '#cbd5e0', fontSize: 12, fontFamily: 'inherit', padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 },
  tokenBar:   { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  tokenCount: { fontSize: 9, whiteSpace: 'nowrap', minWidth: 100 },
  tokenTrack: { flex: 1, height: 3, background: '#1a2535', borderRadius: 2, overflow: 'hidden' },
  tokenFill:  { height: '100%', borderRadius: 2, transition: 'width 0.2s ease' },
  warning:    { fontSize: 9, color: '#f87171', marginTop: 4, letterSpacing: '0.05em' },
  label:      { fontSize: 9, color: '#2d3748', letterSpacing: '0.1em', marginBottom: 5, marginTop: 10 },
  btn:        { padding: '9px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.05em' },
  btnOn:      { background: '#a78bfa', color: '#080b12' },
  btnOff:     { background: '#1a2535', color: '#2d3748', cursor: 'not-allowed' },
  btnGhost:   { background: '#1a2535', color: '#718096' },
  track:      { height: 3, background: '#1a2535', borderRadius: 2, overflow: 'hidden' },
  bar:        { height: '100%', background: 'linear-gradient(90deg, #a78bfa, #818cf8)', borderRadius: 2, transition: 'width 0.25s ease' },
  pctLabel:   { fontSize: 9, color: '#2d3748', marginTop: 5 },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 4 },
  statGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 },
  statBox:    { background: '#080b12', border: '1px solid #1a2535', borderRadius: 7, padding: '9px 11px' },
  statVal:    { fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' },
  statKey:    { fontSize: 8, color: '#2d3748', letterSpacing: '0.08em', marginTop: 2 },
  code:       { background: '#080b12', border: '1px solid #1a2535', borderRadius: 5, padding: '7px 10px', fontSize: 10, color: '#a78bfa', fontFamily: 'inherit', overflowX: 'auto', whiteSpace: 'nowrap' },
  logs:       { height: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 },
  logLine:    { fontSize: 10, color: '#4a5568', fontFamily: 'inherit', lineHeight: 1.5 },
};
