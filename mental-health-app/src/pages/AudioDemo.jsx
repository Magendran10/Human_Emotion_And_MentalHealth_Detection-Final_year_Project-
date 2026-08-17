// src/pages/AudioDemo.jsx
// Standalone Wav2Vec2 acoustic feature extraction demo
// Upload audio/video → extract 16kHz mono → Wav2Vec2 → [768] embedding

import React, { useState, useRef, useCallback } from 'react';

// ── Audio preprocessing (main thread) ────────────────────────────────────────
const extractAudio = async (file) => {
  const audioCtx     = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer  = await file.arrayBuffer();
  const audioBuffer  = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  // Mix all channels to mono by averaging
  const numCh  = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono   = new Float32Array(length);
  for (let ch = 0; ch < numCh; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += chData[i] / numCh;
  }

  // Resample to 16kHz via OfflineAudioContext
  const targetRate   = 16000;
  const targetLength = Math.ceil(length * targetRate / audioBuffer.sampleRate);
  const offCtx       = new OfflineAudioContext(1, targetLength, targetRate);
  const buf          = offCtx.createBuffer(1, length, audioBuffer.sampleRate);
  buf.copyToChannel(mono, 0);
  const src = offCtx.createBufferSource();
  src.buffer = buf;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();

  // Normalize volume
  const raw  = rendered.getChannelData(0);
  let peak   = 0;
  for (let i = 0; i < raw.length; i++) if (Math.abs(raw[i]) > peak) peak = Math.abs(raw[i]);
  const norm = new Float32Array(raw.length);
  if (peak > 0) for (let i = 0; i < raw.length; i++) norm[i] = raw[i] * (0.9 / peak);

  // Generate WAV preview URL
  const wavUrl = float32ToWavUrl(norm, targetRate);

  return { audio: norm, sampleRate: targetRate, duration: norm.length / targetRate, wavUrl };
};

const float32ToWavUrl = (f32, sr) => {
  const buf  = new ArrayBuffer(44 + f32.length * 2);
  const view = new DataView(buf);
  const ws   = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 32 + f32.length * 2, true);
  ws(8, 'WAVE'); ws(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, f32.length * 2, true);
  let off = 44;
  for (let i = 0; i < f32.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
};

// ── Waveform visualizer ───────────────────────────────────────────────────────
const WaveformViz = ({ embedding }) => {
  if (!embedding) return null;
  const max  = Math.max(...embedding.map(Math.abs));
  const show = embedding.slice(0, 128);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64, padding: '4px 0 12px 0', overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
      {show.map((val, i) => {
        const norm = val / (max || 1);
        const h    = Math.abs(norm) * 44 + 2;
        const hue  = norm > 0 ? 200 : 30;
        return (
          <div key={i} title={`[${i}]: ${val.toFixed(4)}`} style={{
            width: 4, height: h, borderRadius: 2,
            background: `hsl(${hue}, 80%, ${50 + norm * 15}%)`,
            opacity: 0.85, flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function AudioDemo() {
  const [phase, setPhase]         = useState('idle');
  const [logs, setLogs]           = useState([]);
  const [pct, setPct]             = useState(0);
  const [pctMsg, setPctMsg]       = useState('');
  const [embedding, setEmbedding] = useState(null);
  const [stats, setStats]         = useState(null);
  const [wavUrl, setWavUrl]       = useState(null);
  const [fileName, setFileName]   = useState(null);

  const workerRef = useRef(null);
  const fileRef   = useRef(null);

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPhase('idle'); setLogs([]); setEmbedding(null); setStats(null); setWavUrl(null);
  };

  const runPipeline = async () => {
    const file = fileRef.current?.files[0];
    if (!file) return;

    // ── Step 1: Audio extraction ─────────────────────────────────────────────
    setPhase('extracting'); setPct(0);
    addLog(`📂 Loading: ${file.name}`);
    addLog('🎵 Extracting & preprocessing audio (16kHz mono, normalized)...');
    const t0 = performance.now();

    let audioData;
    try {
      audioData = await extractAudio(file);
    } catch (err) {
      addLog(`❌ Audio extraction failed: ${err.message}`);
      setPhase('error'); return;
    }

    setWavUrl(audioData.wavUrl);
    const extractSec = ((performance.now() - t0) / 1000).toFixed(2);
    addLog(`✅ Audio ready: ${audioData.duration.toFixed(1)}s @ 16kHz mono (${extractSec}s)`);

    // ── Step 2: Wav2Vec2 inference ───────────────────────────────────────────
    setPhase('running'); setPct(0);
    addLog('⚙️ Starting Wav2Vec2 on-device inference...');
    const t1 = performance.now();

    const worker = new Worker('/audioWorker.js', { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'log') {
        addLog(msg.message);
      } else if (msg.type === 'progress') {
        setPct(msg.pct);
        setPctMsg(msg.message);
      } else if (msg.type === 'complete') {
        const inferSec = ((performance.now() - t1) / 1000).toFixed(2);
        const emb = msg.embedding;
        setEmbedding(emb);
        setStats({
          dims:      emb.length,
          duration:  audioData.duration.toFixed(1),
          inferTime: inferSec,
          samples:   audioData.audio.length.toLocaleString(),
          min:       Math.min(...emb).toFixed(5),
          max:       Math.max(...emb).toFixed(5),
          mean:      (emb.reduce((a, b) => a + b, 0) / emb.length).toFixed(5),
        });
        setPct(100);
        setPhase('done');
        addLog(`🏁 Done in ${inferSec}s — acoustic embedding: [${emb.length}]`);
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

    // Send audio as plain array (serializable)
    worker.postMessage({
      type:       'extract',
      audio:      Array.from(audioData.audio),
      sampleRate: audioData.sampleRate,
    });
  };

  const reset = () => {
    workerRef.current?.terminate();
    setPhase('idle'); setLogs([]); setPct(0);
    setEmbedding(null); setStats(null); setWavUrl(null); setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const isRunning = phase === 'extracting' || phase === 'running';

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.badge}>AUDIO PIPELINE DEMO</span>
        <h1 style={S.title}>Wav2Vec2<br />Feature Extraction</h1>
        <p style={S.sub}>On-device · 16kHz mono · 768-dim acoustic embedding</p>
      </div>

      {/* Pipeline steps */}
      <div style={S.steps}>
        {['🎙 Upload', '📉 16kHz Mono', '🧠 Wav2Vec2', `📊 [${stats?.dims ?? '768'}] dims`].map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ ...S.step, ...(phase === 'done' ? S.stepDone : {}) }}>
              <span style={S.stepText}>{s}</span>
            </div>
            {i < 3 && <span style={S.arrow}>›</span>}
          </React.Fragment>
        ))}
      </div>

      <div style={S.grid}>
        {/* LEFT: Input */}
        <div style={S.card}>
          <div style={S.cardHead}>🎙 INPUT</div>

          <label style={S.dropzone}>
            <input ref={fileRef} type="file" accept="audio/*,video/*" onChange={handleFile} style={{ display: 'none' }} />
            {fileName
              ? <div style={S.fileInfo}>
                  <span style={{ fontSize: 32 }}>🎵</span>
                  <span style={S.fileName}>{fileName}</span>
                  <span style={S.fileHint}>Click to change</span>
                </div>
              : <div style={S.dropPrompt}>
                  <span style={{ fontSize: 36 }}>🎙</span>
                  <span style={S.dropText}>Click to upload audio or video</span>
                  <span style={S.dropHint}>MP3, WAV, MP4, WebM, M4A</span>
                </div>
            }
          </label>

          {wavUrl && (
            <div style={{ marginTop: 12 }}>
              <div style={S.label}>Preprocessed audio (16kHz mono)</div>
              <audio src={wavUrl} controls style={{ width: '100%', height: 32, opacity: 0.85 }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={runPipeline}
              disabled={!fileName || isRunning}
              style={{ ...S.btn, flex: 1, ...(!fileName || isRunning ? S.btnOff : S.btnOn) }}
            >
              {phase === 'extracting' ? '⏳ Extracting audio...'
               : phase === 'running'  ? `⚙️ Running Wav2Vec2... ${pct}%`
               : '▶ Run Pipeline'}
            </button>
            <button onClick={reset} style={{ ...S.btn, ...S.btnGhost }}>↺</button>
          </div>

          {isRunning && (
            <div style={{ marginTop: 12 }}>
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
                Upload audio and run the pipeline
              </span>
            </div>
          )}

          {stats && (
            <div style={S.statGrid}>
              {[
                { k: 'Embedding Dims', v: stats.dims,      c: '#60a5fa' },
                { k: 'Audio Duration', v: `${stats.duration}s`, c: '#4ade80' },
                { k: 'Inference Time', v: `${stats.inferTime}s`, c: '#fb923c' },
                { k: 'Audio Samples',  v: stats.samples,   c: '#a78bfa' },
                { k: 'Min',            v: stats.min,        c: '#f87171' },
                { k: 'Max',            v: stats.max,        c: '#4ade80' },
                { k: 'Mean',           v: stats.mean,       c: '#60a5fa' },
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
              <WaveformViz embedding={embedding} />
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
  header:   { marginBottom: 36 },
  badge:    { fontSize: 9, letterSpacing: '0.2em', color: '#60a5fa', border: '1px solid #60a5fa33', padding: '3px 10px', borderRadius: 3, display: 'inline-block', marginBottom: 14 },
  title:    { fontSize: 'clamp(28px, 5vw, 56px)', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.05, letterSpacing: '-0.03em', background: 'linear-gradient(120deg, #e2e8f0 30%, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub:      { color: '#4a5568', fontSize: 12, letterSpacing: '0.08em', margin: 0 },
  steps:    { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, flexWrap: 'wrap' },
  step:     { padding: '8px 14px', background: '#0f1623', border: '1px solid #1a2535', borderRadius: 6, fontSize: 11, color: '#64748b' },
  stepDone: { border: '1px solid #60a5fa55', color: '#60a5fa', background: '#0b1220' },
  arrow:    { color: '#1e2d3d', fontSize: 18 },
  stepText: {},
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  card:     { background: '#0f1623', border: '1px solid #1a2535', borderRadius: 12, padding: 22 },
  cardHead: { fontSize: 9, letterSpacing: '0.18em', color: '#4a5568', fontWeight: 700, marginBottom: 14 },
  dropzone: { display: 'block', border: '1px dashed #1a2535', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', minHeight: 130 },
  dropPrompt: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 28, minHeight: 130 },
  fileInfo: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, minHeight: 130 },
  fileName: { fontSize: 12, color: '#94a3b8', textAlign: 'center', wordBreak: 'break-all' },
  fileHint: { fontSize: 10, color: '#2d3748' },
  dropText: { fontSize: 12, color: '#718096' },
  dropHint: { fontSize: 10, color: '#2d3748' },
  label:    { fontSize: 9, color: '#2d3748', letterSpacing: '0.1em', marginBottom: 5, marginTop: 10 },
  btn:      { padding: '9px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.05em' },
  btnOn:    { background: '#60a5fa', color: '#080b12' },
  btnOff:   { background: '#1a2535', color: '#2d3748', cursor: 'not-allowed' },
  btnGhost: { background: '#1a2535', color: '#718096' },
  track:    { height: 3, background: '#1a2535', borderRadius: 2, overflow: 'hidden' },
  bar:      { height: '100%', background: 'linear-gradient(90deg, #60a5fa, #818cf8)', borderRadius: 2, transition: 'width 0.25s ease' },
  pctLabel: { fontSize: 9, color: '#2d3748', marginTop: 5 },
  empty:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 4 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 },
  statBox:  { background: '#080b12', border: '1px solid #1a2535', borderRadius: 7, padding: '9px 11px' },
  statVal:  { fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' },
  statKey:  { fontSize: 8, color: '#2d3748', letterSpacing: '0.08em', marginTop: 2 },
  code:     { background: '#080b12', border: '1px solid #1a2535', borderRadius: 5, padding: '7px 10px', fontSize: 10, color: '#60a5fa', fontFamily: 'inherit', overflowX: 'auto', whiteSpace: 'nowrap' },
  logs:     { height: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 },
  logLine:  { fontSize: 10, color: '#4a5568', fontFamily: 'inherit', lineHeight: 1.5 },
};
