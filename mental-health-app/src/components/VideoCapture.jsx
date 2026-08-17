import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';

const VideoCapture = ({ onDataConfirmed, status, isDisabled, onReset }) => {
  const [recordMode, setRecordMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [tempFile, setTempFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [logs, setLogs] = useState("Waiting for selection..."); // Restored Logs

  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleCapture = (file, hasAudio) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setTempFile({ file, hasAudio });
    setLogs("📂 Video loaded. Please confirm to proceed."); // Restored feedback
  };

  const startRecording = () => {
    const stream = webcamRef.current?.video?.srcObject;
    if (!stream || stream.getTracks().length === 0) {
    setLogs("⚠️ Camera stream not ready yet...");
    return;
  }
    setLogs("🔴 Initializing MediaRecorder...");
    chunks.current = [];
    try {
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      handleCapture(blob, true);
      stream.getTracks().forEach(track => track.stop()); 
      setRecordMode(false); 
      setIsRecording(false);
      setLogs("✅ Recording Captured.");
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setLogs("⏺ RECORDING LIVE...");
  } catch (err) {
    setLogs(`❌ Recording Error: ${err.message}`);
  }
  };

  const handleFinalConfirm = () => {
    if (tempFile) {
      onDataConfirmed('video',tempFile.file, tempFile.hasAudio); 
      setLogs("🚀 Data confirmed for analysis.");
    }
  };

  const clearCapture = () => {
    setPreviewUrl(null);
    setTempFile(null);
    setLogs("Waiting for selection...");
    onReset();
  };

  return (
    <div className={`bg-gray-800 border-2 transition-all rounded-2xl p-6 flex flex-col items-center ${status ? 'border-green-500 shadow-lg shadow-green-500/10' : 'border-gray-700'} ${isDisabled && !status ? 'opacity-30 pointer-events-none' : ''}`}>
      
      {/* HEADER SECTION */}
      <div className="flex items-center gap-3 mb-6 w-full">
        <div className={`p-3 rounded-lg ${status ? 'bg-green-500/20 text-green-400' : 'bg-gray-900 text-gray-400'}`}>
          <span className="text-2xl">📹</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black tracking-tight uppercase">Video Input</h3>
          <p className="text-[10px] text-gray-500 font-mono">{logs}</p> {/* Restored Status Logs */}
        </div>
      </div>

      <div className="w-full min-h-[220px] bg-gray-900/50 rounded-xl border border-gray-700/50 mb-6 flex items-center justify-center overflow-hidden relative">
        {previewUrl ? (
          <video src={previewUrl} controls className="w-full h-full rounded-lg" />
        ) : recordMode ? (
          <div className="relative w-full h-full">
            <Webcam ref={webcamRef} audio={true} mirrored={true} className="w-full h-full object-cover" />
            {isRecording && (
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div> {/* Restored REC dot */}
                <span className="text-[10px] font-bold text-red-500">REC</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 opacity-20">
             <div className="text-5xl mb-2">🎥</div>
             <p className="text-xs">No Input Detected</p>
          </div>
        )}
      </div>

      <div className="w-full flex flex-col gap-3">
        {previewUrl && !status ? (
          <div className="flex gap-2">
            <button onClick={handleFinalConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-xs shadow-lg">CONFIRM ✅</button>
            <button onClick={clearCapture} className="flex-1 bg-red-900/30 text-red-400 py-3 rounded-xl font-bold text-xs border border-red-500/10">REDO 🔄</button>
          </div>
        ) : recordMode ? (
          <button onClick={isRecording ? () => mediaRecorderRef.current.stop() : startRecording} 
            className={`${isRecording ? 'bg-red-600 animate-pulse' : 'bg-emerald-500 text-gray-900'} py-3 rounded-xl font-black w-full`}>
            {isRecording ? "STOP RECORDING" : "START RECORDING"}
          </button>
        ) : !status ? (
          <div className="flex flex-col gap-3 w-full">
            <button onClick={() => setRecordMode(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-xl font-black text-sm">🔴 RECORD LIVE</button>
            <input type="file" accept="video/*" id="v-up" className="hidden" onChange={(e) => handleCapture(e.target.files[0], false)} />
            <label htmlFor="v-up" className="bg-gray-700 py-3 rounded-xl font-bold cursor-pointer text-center text-xs border border-gray-600">📂 CHOOSE FILE</label>
          </div>
        ) : (
          <div className="py-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-center gap-2">
            <span className="text-green-500 text-xs font-black tracking-widest animate-pulse">READY FOR ANALYSIS</span>
            <button onClick={clearCapture} className="text-[10px] text-gray-500 underline ml-2">Change</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCapture;