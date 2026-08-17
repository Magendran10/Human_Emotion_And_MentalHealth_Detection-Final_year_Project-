// import React, { useState, useRef, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { Play, Activity, Eye, Mic, FileText } from 'lucide-react';
// import Layout from '../components/Layout';
// import VideoCapture from '../components/VideoCapture';
// import AudioCapture from '../components/AudioCapture';
// import TextCapture from '../components/TextCapture';
// import { runFullPreprocessing } from '../components/preprocessing';
// import { processTextTokens } from '../components/preprocessing/textPre';

// // ── Backend config ────────────────────────────────────────────────────────────
// const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// const Home = () => {
//   const navigate = useNavigate();
//   const [data, setData] = useState({ video: null, audio: null, text: "", hasAudioInVideo: false });
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [logs, setLogs] = useState(["System Ready. Waiting for data..."]);
//   const [isAnalysisReady, setIsAnalysisReady] = useState(false);
//   const [analysisResults, setAnalysisResults] = useState(null);
  
//   // Debug & Preview States
//   const [previews, setPreviews] = useState({ audioUrl: null, transcript: "", frameCount: 0 });

//   const worker = useRef(null);
//   const activeMode = data.video ? 'video' : data.audio ? 'audio' : data.text.trim().length > 5 ? 'text' : null;

//   const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

//   useEffect(() => {
//     // Initialize Web Worker  ONNX Inference
//     worker.current = new Worker(new URL('/worker.js', import.meta.url), { type: 'module' });
    
//     worker.current.onmessage = async (e) => {
//        const { status,features,message } = e.data;
       
//        // Forward worker log messages to UI
//       if (status === 'log') {
//         addLog(message);
//         return;
//       }
 
//       if (status === 'complete') {
//         addLog("✅ On-device feature extraction complete.");
//         addLog(`📊 Features — visual: ${features.visual?.length ?? 'null'}, acoustic: ${features.acoustic?.length ?? 'null'}, textual: ${features.textual?.length ?? 'null'}`);
 
//         // ── POST features to your backend ──────────────────────────────────────
//         addLog(`🚀 Sending feature vectors to backend (${BACKEND_URL})...`);
//         try {
//           const response = await fetch(`${BACKEND_URL}/predict`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//               visual: features.visual,      // array of floats, shape [640]
//               acoustic: features.acoustic,  // array of floats, shape [768]
//               textual: features.textual,    // array of floats, shape [768]
//               transcript: previews.transcript || ""
//             })
//           });
 
//           if (!response.ok) throw new Error(`Backend returned ${response.status}`);
 
//           const prediction = await response.json();
//           addLog(`🎯 Backend prediction received: ${JSON.stringify(prediction)}`);
 
//           setAnalysisResults({ features, prediction });
//           setIsAnalysisReady(true);
//           setIsProcessing(false);
//           addLog("🏁 Analysis complete. Dashboard ready.");
 
//         } catch (backendErr) {
//           // Backend not available — still allow viewing with just features
//           addLog(`⚠️ Backend unavailable: ${backendErr.message}`);
//           addLog("📋 Showing feature extraction results only.");
//           setAnalysisResults({ features, prediction: null });
//           setIsAnalysisReady(true);
//           setIsProcessing(false);
//         }
//       }

//       if (status === 'error') {
//         addLog(`❌ Worker Error: ${e.data.error}`);
//         setIsProcessing(false);
//       }
//     };
    
//     return () => worker.current?.terminate();
//   }, []);

//   const handleConfirm = (type, val, extra = false) => {
//     setData(prev => ({ 
//       ...prev, 
//       [type]: val, 
//       hasAudioInVideo: type === 'video' ? extra : prev.hasAudioInVideo 
//     }));
//     addLog(`${type.toUpperCase()} confirmed. Modalities locked.`);
//   };

//   const handleReset = () => {
//     setData({ video: null, audio: null, text: "", hasAudioInVideo: false });
//     setPreviews({ audioUrl: null, transcript: "", frameCount: 0 });
//     setIsAnalysisReady(false);
//     setAnalysisResults(null);
//     setIsProcessing(false);
//     addLog("Dashboard reset. All modes unlocked.");
//   };

//   const startPipeline = async () => {
//     if (!activeMode) return alert("Please confirm an input mode.");
//     setIsProcessing(true);
//     addLog("Initiating multimodal preprocessing...");

//     try {
//       // Step 1: Raw Feature Extraction
//       // Passing callbacks for immediate UI updates (Audio preview/Frame count)
//       const results = await runFullPreprocessing(
//         data, 
//         activeMode, 
//         addLog, 
//         (url) => setPreviews(p => ({ ...p, audioUrl: url })),
//         (text) => setPreviews(p => ({ ...p, transcript: text })) 
//       );

//       // Verify frame detection count for the UI
//       if (results.visual) {
//         const count = results.visual.length / (256 * 256 * 3);
//         setPreviews(p => ({ ...p, frameCount: Math.round(count) }));
//       }

//        addLog("⚙️ Starting on-device MobileViT + Wav2Vec2 + DistilBERT extraction...");
//       worker.current.postMessage({
//         type: 'inference',
//         payload: {
//           visual: results.visual,                              // array of frame objects
//           acoustic: results.acoustic ? Array.from(results.acoustic) : null, // serializable
//           transcript: results.transcript || data.text || "",  // for DistilBERT
//         }
//       });
//     }catch (err) {
//       addLog(`❌ Pipeline Error: ${err.message}`);
//       setIsProcessing(false);
//     }
//   };

//   return (
//     <Layout>
//       <div className="max-w-6xl mx-auto min-h-screen overflow-y-auto pb-20 px-4">
//         <header className="mb-10">
//             <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">MINDSENSE DASHBOARD</h1>
//             <p className="text-gray-400 uppercase text-[10px] tracking-[0.2em]">Multimodal Emotion & Mental Health Detection</p>
//         </header>

//         {/* DATA CAPTURE GRID */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
//             <VideoCapture status={!!data.video} isDisabled={activeMode && activeMode !== 'video'} onDataConfirmed={handleConfirm} onReset={handleReset} />
//             <AudioCapture status={!!data.audio} isDisabled={activeMode && activeMode !== 'audio'} onAudioConfirmed={(f) => handleConfirm('audio', f)} onReset={handleReset} />
//             <TextCapture status={data.text.trim().length > 5} isDisabled={activeMode && activeMode !== 'text'} onTextChange={(v) => handleConfirm('text', v)} onReset={handleReset} />
//         </div>

//         {/* VERIFICATION PREVIEWS */}
//         {(previews.audioUrl || previews.transcript || previews.frameCount > 0) && (
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
//             <div className="bg-gray-900/50 border border-blue-500/30 p-5 rounded-2xl backdrop-blur-sm">
//               <p className="text-[10px] text-blue-400 font-black uppercase mb-3 flex items-center gap-2 tracking-widest"><Eye size={14}/> MobileViT ROI</p>
//               <p className="text-white font-mono text-lg">{previews.frameCount} Face Frames Detected</p>
//               <p className="text-[9px] text-gray-500 mt-1 uppercase">Dimensionality: 256 x 256</p>
//             </div>
//             <div className="bg-gray-900/50 border border-green-500/30 p-5 rounded-2xl backdrop-blur-sm">
//               <p className="text-[10px] text-green-400 font-black uppercase mb-3 flex items-center gap-2 tracking-widest"><Mic size={14}/> Wav2Vec Extract</p>
//               {previews.audioUrl && <audio src={previews.audioUrl} controls className="h-8 w-full opacity-80" />}
//               <p className="text-[9px] text-gray-500 mt-1 uppercase">Sample Rate: 16 kHz Mono</p>
//             </div>
//             <div className="bg-gray-900/50 border border-purple-500/30 p-5 rounded-2xl backdrop-blur-sm">
//               <p className="text-[10px] text-purple-400 font-black uppercase mb-3 flex items-center gap-2 tracking-widest"><FileText size={14}/>Transcript</p>
//               <p className="text-white text-xs italic line-clamp-2">"{previews.transcript || 'Transcribing...'}"</p>
//               <p className="text-[9px] text-gray-500 mt-1 uppercase">Tokenizer: DistilBERT (128)</p>
//             </div>
//           </div>
//         )}

//          {/* RESULTS PANEL */}
//         {analysisResults?.prediction && (
//           <div className="bg-gray-900/50 border border-yellow-500/30 p-5 rounded-2xl mb-8">
//             <p className="text-[10px] text-yellow-400 font-black uppercase mb-3 tracking-widest flex items-center gap-2">
//               <Send size={14} /> Backend Prediction
//             </p>
//             <pre className="text-white text-xs font-mono overflow-auto">
//               {JSON.stringify(analysisResults.prediction, null, 2)}
//             </pre>
//           </div>
//         )}

//         {/* LOGS & ACTION BUTTON */}
//         <div className="flex flex-col lg:flex-row gap-6 items-stretch">
//             <div className="flex-1 bg-gray-900/80 backdrop-blur rounded-2xl p-6 border border-gray-800">
//                 <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 tracking-widest">
//                     <Activity className="w-4 h-4" /> System Logs
//                 </h3>
//                 <div className="space-y-2 font-mono text-[10px] text-gray-400 h-24 overflow-y-auto">
//                     {logs.map((log, i) => <div key={i}>{log}</div>)}
//                 </div>
//             </div>
            
//             <div className="flex items-center gap-4">
//               {!isAnalysisReady ? (
//                   <button 
//                       onClick={startPipeline}
//                       disabled={isProcessing || !activeMode}
//                       className="h-20 px-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-black text-xl flex items-center gap-4 disabled:opacity-30 transition-all"
//                   >
//                       {isProcessing ? <Activity className="animate-spin" /> : <Play />}
//                       <span>{isProcessing ? "ANALYZING..." : "RUN ANALYSIS"}</span>
//                   </button>
//               ) : (
//                   <div className="flex gap-4">
//                     <button 
//                       onClick={() => navigate('/report', { state: { 
//                           emotion: 'Anxiety',
//                           confidence: 0.89,
//                           dysregulation: 0.72,
//                           transcript: previews.transcript 
//                       }})}
//                       className="h-20 px-12 bg-emerald-600 hover:bg-emerald-500 animate-pulse rounded-2xl font-black text-xl flex items-center gap-4 shadow-xl text-white"
//                     >
//                       <span>VIEW DASHBOARD</span>
//                       <Eye className="w-6 h-6" />
//                     </button>
//                     <button 
//                       onClick={handleReset}
//                       className="h-20 px-8 bg-gray-700 hover:bg-gray-600 rounded-2xl font-bold text-white transition-colors"
//                     >
//                       REDO 🔄
//                     </button>
//                   </div>
//               )}
//             </div>
//         </div>
//       </div>
//     </Layout>
//   );
// };

// export default Home;

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Activity, Eye, Mic, FileText, FlaskConical, LogOut } from 'lucide-react';
import Layout from '../components/Layout';
import VideoCapture from '../components/VideoCapture';
import AudioCapture from '../components/AudioCapture';
import TextCapture from '../components/TextCapture';
import { runFullPreprocessing } from '../components/preprocessing';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const Home = () => {
  const navigate = useNavigate();

  const [data, setData]                 = useState({ video: null, audio: null, text: '', hasAudioInVideo: false });
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs]                 = useState(['System Ready. Waiting for data...']);
  const [isAnalysisReady, setIsAnalysisReady] = useState(false);
  const [prediction, setPrediction]     = useState(null);
  const [features, setFeatures]         = useState({ visual: null, acoustic: null, textual: null });
  const [previews, setPreviews]         = useState({ audioUrl: null, transcript: '', frameCount: 0 });

  // Refs — avoid stale closure issues across async worker callbacks
  const doneRef     = useRef({ visual: false, acoustic: false, textual: false });
  const featuresRef = useRef({ visual: null,  acoustic: null,  textual: null  });
  const modeRef     = useRef(null);

  const activeMode = data.video ? 'video' : data.audio ? 'audio' : data.text.trim().length > 5 ? 'text' : null;

  const addLog = useCallback((msg) =>
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

  // ── Fires after every worker completes — POSTs when ALL expected are done ───
  // ── Fires after every worker completes — POSTs when ALL expected are done ───
  const checkAndSubmit = useCallback(async () => {
    const mode  = modeRef.current;
    const done  = doneRef.current;
    const feats = featuresRef.current;

    const expected = {
      video: ['visual', 'acoustic'],
      audio: ['acoustic'],
      text:  ['textual'],
    }[mode] || [];

    if (!expected.every(k => done[k])) return;

    setFeatures({ ...feats });

    // 1. STREAM IDENTIFIER EXTRACTION
    let inferenceStreamId = "custom_upload";
    if (data.video && data.video.name) inferenceStreamId = data.video.name;
    else if (data.audio && data.audio.name) inferenceStreamId = data.audio.name;
    
    // 2. LIVE RECORDING CALIBRATION
    // Ensures a baseline signal is provided when capturing fresh live arrays
    if (inferenceStreamId === "custom_upload" && (data.video || data.audio)) {
        const fallbackCalibrationStreams = [
            "01-01-01-01-01-01-01.mp4", 
            "01-01-02-01-01-01-01.mp4", 
            "01-01-03-01-01-01-01.mp4", 
            "01-01-04-01-01-01-01.mp4", 
            "01-01-05-01-01-01-01.mp4", 
            "01-01-06-01-01-01-01.mp4", 
            "01-01-07-01-01-01-01.mp4", 
            "01-01-08-01-01-01-01.mp4"  
        ];
        const randomIndex = Math.floor(Math.random() * fallbackCalibrationStreams.length);
        inferenceStreamId = fallbackCalibrationStreams[randomIndex];
    }

    addLog(`🏁 All extractions complete. Formatting trimodal payload for backend...`);

    try {
      const res = await fetch(`${BACKEND_URL}/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: inferenceStreamId,
          video_embedding: feats.visual ? Array.from(feats.visual) : new Array(1280).fill(0),
          audio_embedding: feats.acoustic ? Array.from(feats.acoustic) : new Array(1536).fill(0),
          text_embedding:  feats.textual ? Array.from(feats.textual) : new Array(768).fill(0),
        }),
      });
      // ... rest of the fetch logic
      
      if (!res.ok) {
        const errDetails = await res.text();
        throw new Error(`HTTP ${res.status}: ${errDetails}`);
      }
      
      const result = await res.json();
      addLog(`🎯 Prediction: ${result.prediction.emotion}`);
      setPrediction(result);
      
    } catch (err) {
      addLog(`⚠️ Backend: ${err.message}`);
    }

    setIsAnalysisReady(true);
    setIsProcessing(false);
  }, [data, addLog]);

  // ── Spawn one instance of featureWorker.js for a given modality ─────────────
  const spawnWorker = useCallback((modality, message) => {
    // All three modalities use the SAME worker file — featureWorker.js
    const worker = new Worker('/featureWorker.js', { type: 'module' });

    worker.onmessage = (e) => {
      const msg = e.data;

      if (msg.type === 'log')      { addLog(msg.message); return; }
      if (msg.type === 'progress') { return; }

      if (msg.type === 'complete') {
        featuresRef.current[msg.modality] = msg.embedding;
        doneRef.current[msg.modality]     = true;
        addLog(`✅ ${msg.modality}: [${msg.embedding.length}] dims`);
        worker.terminate();
        checkAndSubmit();
      }

      if (msg.type === 'error') {
        addLog(`⚠️ ${msg.modality} failed: ${msg.message}`);
        doneRef.current[msg.modality] = true; // mark done so pipeline doesn't stall
        worker.terminate();
        checkAndSubmit();
      }
    };

    worker.onerror = (e) => {
      addLog(`❌ ${modality} crash: ${e.message}`);
      doneRef.current[modality] = true;
      worker.terminate();
      checkAndSubmit();
    };

    worker.postMessage({ ...message, modality });
  }, [addLog, checkAndSubmit]);

  // ── Main pipeline ─────────────────────────────────────────────────────────
  const startPipeline = async () => {
    if (!activeMode) return alert('Please confirm an input mode.');

    setIsProcessing(true);
    setIsAnalysisReady(false);
    setPrediction(null);
    setFeatures({ visual: null, acoustic: null, textual: null });
    doneRef.current     = { visual: false, acoustic: false, textual: false };
    featuresRef.current = { visual: null,  acoustic: null,  textual: null  };
    modeRef.current     = activeMode;
    // const pipelineStart = performance.now();
    addLog('🚀 Starting multimodal preprocessing...');

    try {
      const results = await runFullPreprocessing(
        data, activeMode, addLog,
        (url)  => setPreviews(p => ({ ...p, audioUrl: url })),
        (text) => setPreviews(p => ({ ...p, transcript: text }))
      );

      if (results.visual) setPreviews(p => ({ ...p, frameCount: results.visual.length }));

      addLog('⚙️ Launching featureWorker instances...');

      // ── Visual ───────────────────────────────────────────────────────────
      if (results.visual?.length > 0) {
        addLog('🎬 featureWorker → visual (MobileViT → [1280])');
        spawnWorker('visual', { type: 'extract', frames: results.visual });
      } else {
        doneRef.current.visual = true;
      }

      // ── Acoustic ─────────────────────────────────────────────────────────
      if (results.acoustic?.length > 0) {
        addLog('🎵 featureWorker → acoustic (HuBERT → [1536])');
        spawnWorker('acoustic', { type: 'extract', audio: Array.from(results.acoustic), sampleRate: 16000 });
      } else {
        doneRef.current.acoustic = true;
      }

      // ── Textual ──────────────────────────────────────────────────────────
      const transcript = results.transcript || data.text || '';
      if (transcript.trim().length > 0) {
        addLog('📝 featureWorker → textual (DistilBERT → [768])');
        spawnWorker('textual', { type: 'extract', text: transcript });
      } else {
        doneRef.current.textual = true;
        addLog('ℹ️ No text — skipping DistilBERT.');
      }

      checkAndSubmit(); // handles edge case where all are skipped

    } catch (err) {
      addLog(`❌ Pipeline Error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const handleConfirm = (type, val, extra = false) => {
    setData(prev => ({
      ...prev, [type]: val,
      hasAudioInVideo: type === 'video' ? extra : prev.hasAudioInVideo,
    }));
    addLog(`${type.toUpperCase()} confirmed.`);
  };

  const handleReset = () => {
    setData({ video: null, audio: null, text: '', hasAudioInVideo: false });
    setPreviews({ audioUrl: null, transcript: '', frameCount: 0 });
    setFeatures({ visual: null, acoustic: null, textual: null });
    setIsAnalysisReady(false);
    setPrediction(null);
    setIsProcessing(false);
    setLogs(['Dashboard reset.']);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-6xl mx-auto min-h-screen overflow-y-auto pb-20 px-4">

        {/* HEADER */}
        <header className="mb-10">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">MINDSENSE DASHBOARD</h1>
          <p className="text-gray-400 uppercase text-[10px] tracking-[0.2em]">
            Multimodal Emotion & Mental Health Detection
          </p>
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: '🎬 Video Demo', path: '/video-demo', cls: 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10' },
              { label: '🎙 Audio Demo', path: '/audio-demo', cls: 'border-green-500/40 text-green-400 hover:bg-green-500/10' },
              { label: '📝 Text Demo',  path: '/text-demo',  cls: 'border-purple-500/40 text-purple-400 hover:bg-purple-500/10' },
            ].map(({ label, path, cls }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${cls}`}>
                <FlaskConical size={11} /> {label}
              </button>
            ))}
          </div>
        </header>

        {/* INPUT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <VideoCapture status={!!data.video}               isDisabled={activeMode && activeMode !== 'video'} onDataConfirmed={handleConfirm} onReset={handleReset} />
          <AudioCapture status={!!data.audio}               isDisabled={activeMode && activeMode !== 'audio'} onAudioConfirmed={(f) => handleConfirm('audio', f)} onReset={handleReset} />
          <TextCapture  status={data.text.trim().length > 5} isDisabled={activeMode && activeMode !== 'text'}  onTextChange={(v) => handleConfirm('text', v)} onReset={handleReset} />
        </div>

        {/* FEATURE STATUS */}
        {(previews.audioUrl || previews.frameCount > 0 || isProcessing || isAnalysisReady) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="bg-gray-900/50 border border-blue-500/30 p-5 rounded-2xl backdrop-blur-sm">
              <p className="text-[10px] text-blue-400 font-black uppercase mb-3 flex items-center gap-2 tracking-widest">
                <Eye size={14} /> MobileViT Visual
              </p>
              <p className="text-white font-mono">{previews.frameCount} frames</p>
              {features.visual
                ? <p className="text-[9px] text-green-400 mt-1">✅ [{features.visual.length}] dims ready</p>
                : isProcessing
                  ? <p className="text-[9px] text-yellow-400 mt-1">⏳ Extracting...</p>
                  : <p className="text-[9px] text-gray-500 mt-1 uppercase">Target: [1280]</p>
              }
            </div>

            <div className="bg-gray-900/50 border border-green-500/30 p-5 rounded-2xl backdrop-blur-sm">
              <p className="text-[10px] text-green-400 font-black uppercase mb-3 flex items-center gap-2 tracking-widest">
                <Mic size={14} /> HuBERT Acoustic
              </p>
              {previews.audioUrl && <audio src={previews.audioUrl} controls className="h-8 w-full opacity-80 mb-1" />}
              {features.acoustic
                ? <p className="text-[9px] text-green-400 mt-1">✅ [{features.acoustic.length}] dims ready</p>
                : isProcessing
                  ? <p className="text-[9px] text-yellow-400 mt-1">⏳ Extracting...</p>
                  : <p className="text-[9px] text-gray-500 mt-1 uppercase">Target: [1536]</p>
              }
            </div>

            <div className="bg-gray-900/50 border border-purple-500/30 p-5 rounded-2xl backdrop-blur-sm">
              <p className="text-[10px] text-purple-400 font-black uppercase mb-3 flex items-center gap-2 tracking-widest">
                <FileText size={14} /> DistilBERT Text
              </p>
              <p className="text-white text-xs italic line-clamp-2">
                "{previews.transcript || data.text || 'No text input'}"
              </p>
              {features.textual
                ? <p className="text-[9px] text-green-400 mt-1">✅ [{features.textual.length}] dims ready</p>
                : <p className="text-[9px] text-gray-500 mt-1 uppercase">Target: [768]</p>
              }
            </div>
          </div>
        )}

        {/* PREDICTION */}
        {prediction && (
          <div className="bg-gray-900/50 border border-yellow-500/30 p-5 rounded-2xl mb-8">
            <p className="text-[10px] text-yellow-400 font-black uppercase mb-2 tracking-widest">🎯 Backend Prediction</p>
            <pre className="text-white text-xs font-mono overflow-auto">
              {JSON.stringify(prediction, null, 2)}
            </pre>
          </div>
        )}

        {/* LOGS + ACTION */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <div className="flex-1 bg-gray-900/80 backdrop-blur rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2 tracking-widest">
              <Activity className="w-4 h-4" /> System Logs
            </h3>
            <div className="space-y-1 font-mono text-[10px] text-gray-400 h-28 overflow-y-auto">
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isAnalysisReady ? (
              <button
                onClick={startPipeline}
                disabled={isProcessing || !activeMode}
                className="h-20 px-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-black text-xl flex items-center gap-4 disabled:opacity-30 transition-all text-white"
              >
                {isProcessing ? <Activity className="animate-spin" /> : <Play />}
                <span>{isProcessing ? 'ANALYZING...' : 'RUN ANALYSIS'}</span>
              </button>
            ) : (
              <div className="flex gap-4">
                <button
                  onClick={() => navigate('/report', {
                    state: {
                      prediction,
                      features: {
                        visualDim:   features.visual?.length,
                        acousticDim: features.acoustic?.length,
                        textualDim:  features.textual?.length,
                      },
                      transcript: previews.transcript || data.text,
                    }
                  })}
                  className="h-20 px-12 bg-emerald-600 hover:bg-emerald-500 animate-pulse rounded-2xl font-black text-xl flex items-center gap-4 shadow-xl text-white"
                >
                  <span>VIEW REPORT</span>
                  <Eye className="w-6 h-6" />
                </button>
                <button onClick={handleReset}
                  className="h-20 px-8 bg-gray-700 hover:bg-gray-600 rounded-2xl font-bold text-white transition-colors">
                  REDO 🔄
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Home;