import React, { useState, useRef, useEffect } from 'react';

const AudioCapture = ({ onAudioConfirmed, status, isDisabled, onReset }) => {
  const [recordMode, setRecordMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false); // USED: To toggle UI/Animation
  const [tempFile, setTempFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [logs, setLogs] = useState("Waiting for audio selection...");

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFileSelection = (file) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setTempFile(file);
    setLogs("🎤 Audio loaded. Review and confirm.");
  };

  // --- START RECORDING LOGIC ---
  const startRecording = async () => { // USED: In the button onClick below
    setLogs("🎙️ Accessing microphone...");
    chunks.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/wav' });
        handleFileSelection(blob);
        
        // Resource Locking
        streamRef.current.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordMode(false);
        setLogs("✅ Recording captured.");
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setLogs("⏺️ RECORDING MIC...");
    } catch (err) {
      console.error("Mic Error:", err);
      setLogs("❌ Mic Access Denied.");
      setIsRecording(false);
    }
  };

  const handleFinalConfirm = () => {
    if (tempFile) {
      onAudioConfirmed(tempFile);
      setLogs("🚀 Audio confirmed.");
    }
  };

  const clearCapture = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTempFile(null);
    setLogs("Waiting for audio selection...");
    onReset();
  };

  return (
    <div className={`bg-gray-800 border-2 transition-all rounded-2xl p-6 flex flex-col items-center ${status ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-gray-700'} ${isDisabled && !status ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
      
      <div className="flex items-center gap-3 mb-6 w-full">
        <div className={`p-3 rounded-lg ${status ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-900 text-gray-400'}`}>
          <span className="text-2xl">🎤</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black tracking-tight uppercase">Audio Input</h3>
          <p className="text-[10px] text-gray-500 font-mono">{logs}</p>
        </div>
      </div>

      <div className="w-full h-32 bg-gray-900/50 rounded-xl border border-gray-700/50 mb-6 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          <audio src={previewUrl} controls className="w-full px-4" />
        ) : recordMode ? (
          <div className="flex gap-1 items-center">
            {/* isRecording used to toggle animation */}
            {[1.5, 2.1, 1.8, 2.4, 1.6].map((h, i) => (
              <div key={i} className={`w-1 bg-blue-500 rounded-full ${isRecording ? 'animate-bounce' : ''}`} style={{ height: `${h}rem`, animationDelay: `${i * 0.1}s` }}></div>
            ))}
          </div>
        ) : (
          <div className="text-center opacity-20">
             <div className="text-4xl mb-2">🎙️</div>
             <p className="text-[10px]">No Audio Capture</p>
          </div>
        )}
      </div>

      <div className="w-full flex flex-col gap-3">
        {previewUrl && !status ? (
          <div className="flex gap-2">
            <button onClick={handleFinalConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-xs shadow-lg transition-transform active:scale-95">CONFIRM ✅</button>
            <button onClick={clearCapture} className="flex-1 bg-red-900/30 text-red-400 py-3 rounded-xl font-bold text-xs border border-red-500/10">REDO 🔄</button>
          </div>
        ) : recordMode ? (
          /* BOTH startRecording AND isRecording ARE NOW USED HERE */
          <button 
            onClick={isRecording ? () => mediaRecorderRef.current.stop() : startRecording} 
            className={`${isRecording ? 'bg-red-600 animate-pulse' : 'bg-emerald-500 text-gray-900'} py-3 rounded-xl font-black w-full text-xs transition-all`}
          >
            {isRecording ? "STOP RECORDING" : "START RECORDING"}
          </button>
        ) : !status ? (
          <div className="flex flex-col gap-3 w-full">
            <button onClick={() => setRecordMode(true)} className="bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-xs shadow-lg transition-transform active:scale-95">🔴 RECORD MIC</button>
            <input type="file" accept="audio/*" id="a-up" className="hidden" onChange={(e) => handleFileSelection(e.target.files[0])} />
            <label htmlFor="a-up" className="bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-bold cursor-pointer text-center text-xs border border-gray-600">📂 CHOOSE AUDIO</label>
          </div>
        ) : (
          <div className="py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center gap-2">
            <span className="text-blue-500 text-xs font-black tracking-widest animate-pulse">AUDIO READY</span>
            <button onClick={clearCapture} className="text-[10px] text-gray-500 underline ml-2">Change</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioCapture;