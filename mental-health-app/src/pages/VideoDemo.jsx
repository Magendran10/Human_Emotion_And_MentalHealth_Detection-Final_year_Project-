// src/pages/VideoDemo.jsx
import React, { useState, useRef, useCallback } from 'react';

// ── Frame extractor ───────────────────────────────────────────────────────────
const extractFrames = (videoFile, fps = 5) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src   = URL.createObjectURL(videoFile);
    video.muted = true;

    video.onerror = () => reject(new Error('Failed to load video'));

    video.onloadedmetadata = async () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const totalFrames   = Math.floor(video.duration * fps);
      const frameInterval = 1 / fps;
      const frames        = [];

      for (let i = 0; i < totalFrames; i++) {
        video.currentTime = i * frameInterval;
        await new Promise(res => { video.onseeked = res; });
        ctx.drawImage(video, 0, 0, 256, 256);
        const imageData = ctx.getImageData(0, 0, 256, 256);
        frames.push({
          width:  256,
          height: 256,
          data:   Array.from(imageData.data), // plain array for postMessage
        });
      }

      URL.revokeObjectURL(video.src);
      resolve({ frames, duration: video.duration });
    };
  });
};

// ── Embedding bar visualizer ──────────────────────────────────────────────────
const EmbeddingViz = ({ embedding }) => {
  const max  = Math.max(...embedding.map(Math.abs));
  const show = embedding.slice(0, 128);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '10px 0' }}>
      {show.map((val, i) => {
        const norm = val / (max || 1);
        const h    = Math.abs(norm) * 30 + 2;
        const hue  = norm > 0 ? 145 : 340;
        return (
          <div key={i} title={`[${i}]: ${val.toFixed(4)}`} style={{
            width: 4, height: h, borderRadius: 2,
            background: `hsl(${hue}, 75%, ${48 + norm * 18}%)`,
            opacity: 0.9,
          }} />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function VideoDemo() {
  const [phase, setPhase]           = useState('idle');
  const [logs, setLogs]             = useState([]);
  const [pct, setPct]               = useState(0);
  const [pctMsg, setPctMsg]         = useState('');
  const [embedding, setEmbedding]   = useState(null);
  const [stats, setStats]           = useState(null);
  const [videoUrl, setVideoUrl]     = useState(null);
  const [framePreview, setFramePreview] = useState(null);

  const workerRef = useRef(null);
  const fileRef   = useRef(null);

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoUrl(URL.createObjectURL(file));
    setPhase('idle'); setLogs([]); setEmbedding(null); setStats(null); setFramePreview(null);
  };

  const runPipeline = async () => {
    const file = fileRef.current?.files[0];
    if (!file) return;

    // ── Step 1: Extract frames in main thread ────────────────────────────────
    setPhase('extracting'); setPct(0);
    addLog('🎬 Extracting frames at 5 FPS...');
    const t0 = performance.now();

    let frames, duration;
    try {
      ({ frames, duration } = await extractFrames(file, 5));
    } catch (err) {
      addLog(`❌ Frame extraction failed: ${err.message}`);
      setPhase('error'); return;
    }

    // Show first frame
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    c.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(frames[0].data), 256, 256), 0, 0
    );
    setFramePreview(c.toDataURL());

    const extractSec = ((performance.now() - t0) / 1000).toFixed(2);
    addLog(`✅ ${frames.length} frames from ${duration.toFixed(1)}s video (${extractSec}s)`);

    // ── Step 2: MobileViT in worker ──────────────────────────────────────────
    setPhase('running'); setPct(0);
    addLog('⚙️ Starting MobileViT on-device inference...');
    const t1 = performance.now();

    // ✅ Use real file from /public/ — blob workers cannot use ES module imports
    const worker = new Worker('/videoWorker.js', { type: 'module' });
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
          frames:    msg.frameCount,
          duration:  duration.toFixed(1),
          inferTime: inferSec,
          min:       Math.min(...emb).toFixed(5),
          max:       Math.max(...emb).toFixed(5),
          mean:      (emb.reduce((a, b) => a + b, 0) / emb.length).toFixed(5),
        });

        setPct(100);
        setPhase('done');
        addLog(`🏁 Done in ${inferSec}s — embedding: [${emb.length}]`);
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

    worker.postMessage({ type: 'extract', frames });
  };

  const reset = () => {
    workerRef.current?.terminate();
    setPhase('idle'); setLogs([]); setPct(0);
    setEmbedding(null); setStats(null);
    setVideoUrl(null); setFramePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const isRunning = phase === 'extracting' || phase === 'running';

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <span style={S.badge}>VIDEO PIPELINE DEMO</span>
        <h1 style={S.title}>MobileViT<br />Feature Extraction</h1>
        <p style={S.sub}>On-device · No server · Runs in your browser</p>
      </div>

      {/* PIPELINE STEPS */}
      <div style={S.steps}>
        {['🎥 Upload', '🖼 Extract 5fps', '🧠 MobileViT', `📊 [${stats?.dims ?? '640'}] dims`].map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ ...S.step, ...(phase === 'done' ? S.stepDone : {}) }}>
              <span style={S.stepText}>{s}</span>
            </div>
            {i < 3 && <span style={S.arrow}>›</span>}
          </React.Fragment>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={S.grid}>

        {/* LEFT: Input */}
        <div style={S.card}>
          <div style={S.cardHead}>📂 INPUT</div>

          <label style={S.dropzone}>
            <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} style={{ display: 'none' }} />
            {videoUrl
              ? <video src={videoUrl} controls muted style={S.vidPreview} />
              : <div style={S.dropPrompt}>
                  <span style={{ fontSize: 36 }}>🎥</span>
                  <span style={S.dropText}>Click to upload video</span>
                  <span style={S.dropHint}>MP4, WebM, MOV</span>
                </div>
            }
          </label>

          {framePreview && (
            <div style={{ marginTop: 12 }}>
              <div style={S.label}>First frame (256×256)</div>
              <img src={framePreview} style={S.thumb} alt="first frame" />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={runPipeline}
              disabled={!videoUrl || isRunning}
              style={{ ...S.btn, flex: 1, ...(!videoUrl || isRunning ? S.btnOff : S.btnOn) }}
            >
              {phase === 'extracting' ? '⏳ Extracting frames...'
               : phase === 'running'  ? `⚙️ Running... ${pct}%`
               : '▶ Run Pipeline'}
            </button>
            <button onClick={reset} style={{ ...S.btn, ...S.btnGhost }}>↺</button>
          </div>

          {isRunning && (
            <div style={{ marginTop: 12 }}>
              <div style={S.track}><div style={{ ...S.bar, width: `${pct}%` }} /></div>
              <div style={S.pctLabel}>
                {phase === 'extracting' ? 'Extracting frames...' : pctMsg} {pct}%
              </div>
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
                Upload a video and run the pipeline
              </span>
            </div>
          )}

          {stats && (
            <div style={S.statGrid}>
              {[
                { k: 'Embedding Dims', v: stats.dims,      c: '#4ade80' },
                { k: 'Frames',         v: stats.frames,    c: '#60a5fa' },
                { k: 'Duration',       v: `${stats.duration}s`, c: '#a78bfa' },
                { k: 'Inference',      v: `${stats.inferTime}s`, c: '#fb923c' },
                { k: 'Min',            v: stats.min,       c: '#f87171' },
                { k: 'Max',            v: stats.max,       c: '#4ade80' },
                { k: 'Mean',           v: stats.mean,      c: '#60a5fa' },
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

      {/* LOGS */}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#080b12', color: '#cbd5e0', fontFamily: '"IBM Plex Mono", "Courier New", monospace', padding: '36px 48px 80px', width: '100%' },
  header:   { marginBottom: 36 },
  badge:    { fontSize: 9, letterSpacing: '0.2em', color: '#4ade80', border: '1px solid #4ade8033', padding: '3px 10px', borderRadius: 3, display: 'inline-block', marginBottom: 14 },
  title:    { fontSize: 'clamp(28px, 5vw, 56px)', fontWeight: 900, margin: '0 0 10px', lineHeight: 1.05, letterSpacing: '-0.03em', background: 'linear-gradient(120deg, #e2e8f0 30%, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub:      { color: '#4a5568', fontSize: 12, letterSpacing: '0.08em', margin: 0 },
  steps:    { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, flexWrap: 'wrap' },
  step:     { padding: '8px 14px', background: '#0f1623', border: '1px solid #1a2535', borderRadius: 6, fontSize: 11, color: '#64748b' },
  stepDone: { border: '1px solid #4ade8055', color: '#4ade80', background: '#0b1a10' },
  arrow:    { color: '#1e2d3d', fontSize: 18 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  card:     { background: '#0f1623', border: '1px solid #1a2535', borderRadius: 12, padding: 22 },
  cardHead: { fontSize: 9, letterSpacing: '0.18em', color: '#4a5568', fontWeight: 700, marginBottom: 14 },
  dropzone: { display: 'block', border: '1px dashed #1a2535', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', minHeight: 150 },
  dropPrompt: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 28, minHeight: 150 },
  dropText: { fontSize: 12, color: '#718096' },
  dropHint: { fontSize: 10, color: '#2d3748' },
  vidPreview: { width: '100%', maxHeight: 350, objectFit: 'contain', background: '#000', borderRadius: 8, display: 'block' },
  thumb:    { width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid #1a2535', display: 'block' },
  label:    { fontSize: 9, color: '#2d3748', letterSpacing: '0.1em', marginBottom: 5, marginTop: 10 },
  btn:      { padding: '9px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.05em' },
  btnOn:    { background: '#4ade80', color: '#080b12' },
  btnOff:   { background: '#1a2535', color: '#2d3748', cursor: 'not-allowed' },
  btnGhost: { background: '#1a2535', color: '#718096' },
  track:    { height: 3, background: '#1a2535', borderRadius: 2, overflow: 'hidden' },
  bar:      { height: '100%', background: 'linear-gradient(90deg, #4ade80, #22d3ee)', borderRadius: 2, transition: 'width 0.25s ease' },
  pctLabel: { fontSize: 9, color: '#2d3748', marginTop: 5, letterSpacing: '0.05em' },
  empty:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 4 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 },
  statBox:  { background: '#080b12', border: '1px solid #1a2535', borderRadius: 7, padding: '9px 11px' },
  statVal:  { fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' },
  statKey:  { fontSize: 8, color: '#2d3748', letterSpacing: '0.08em', marginTop: 2 },
  code:     { background: '#080b12', border: '1px solid #1a2535', borderRadius: 5, padding: '7px 10px', fontSize: 10, color: '#4ade80', fontFamily: 'inherit', overflowX: 'auto', whiteSpace: 'nowrap' },
  logs:     { height: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 },
  logLine:  { fontSize: 10, color: '#4a5568', fontFamily: 'inherit', lineHeight: 1.5 },
};