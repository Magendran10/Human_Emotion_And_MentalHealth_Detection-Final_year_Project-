import React, { useState } from 'react';
import VideoCapture from './components/VideoCapture';
import AudioCapture from './components/AudioCapture';
import TextCapture from './components/TextCapture';

const DataCapture = () => {
  // Centralized State for Tri-modal Data
  const [data, setData] = useState({
    video: null,
    audio: null,
    text: "",
    hasAudioInVideo: false
  });

  // Determines which mode is currently "Locked" for analysis
  const activeMode = data.video ? 'video' : data.audio ? 'audio' : data.text.length > 5 ? 'text' : null;

  // Logic to handle confirmed data from children
  const handleConfirm = (type, file, extra = false) => {
    setData(prev => ({ 
      ...prev, 
      [type]: file, 
      hasAudioInVideo: type === 'video' ? extra : prev.hasAudioInVideo 
    }));
  };

  // Resets the entire dashboard state
  const handleReset = () => {
    setData({ video: null, audio: null, text: "", hasAudioInVideo: false });
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans p-10 overflow-hidden">
      <main className="max-w-7xl mx-auto w-full flex flex-col">
        
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
            MINDSENSE DASHBOARD
          </h1>
          <p className="text-gray-500 mt-2 text-sm font-mono uppercase tracking-widest">
            Multimodal Emotion & Mental Health Detection
          </p>
        </header>

        {/* TRI-MODAL INPUT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          
          <VideoCapture 
            status={!!data.video} 
            isDisabled={activeMode && activeMode !== 'video'}
            onDataConfirmed={(file, hasAudio) => handleConfirm('video', file, hasAudio)} 
            onReset={handleReset}
          />

          <AudioCapture 
            status={!!data.audio} 
            isDisabled={activeMode && activeMode !== 'audio'}
            onAudioConfirmed={(file) => handleConfirm('audio', file)} 
            onReset={handleReset}
          />

          <TextCapture 
            status={data.text.length > 5} 
            isDisabled={activeMode && activeMode !== 'text'}
            onTextChange={(val) => handleConfirm('text', val)} 
            onReset={handleReset}
          />

        </div>

        {/* ANALYSIS GATEWAY */}
        <div className="bg-gray-800/50 rounded-3xl border border-gray-700 p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl backdrop-blur-sm">
          <div className="flex flex-wrap gap-4">
            <StatusBadge label="VIDEO" active={!!data.video} color="green" />
            <StatusBadge label="AUDIO" active={data.hasAudioInVideo || !!data.audio} color="blue" />
            <StatusBadge label="TEXT" active={data.text.length > 5} color="purple" />
          </div>

          <button 
            disabled={!activeMode}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-20 disabled:grayscale px-12 py-5 rounded-2xl font-black text-lg shadow-xl shadow-purple-900/20 transition-all transform hover:scale-105 active:scale-95"
          >
            RUN MULTIMODAL ANALYSIS ▶
          </button>
        </div>
      </main>
    </div>
  );
};

// Reusable Badge for the Status Bar
const StatusBadge = ({ label, active, color }) => (
  <div className={`px-5 py-2 rounded-xl border-2 transition-all duration-500 flex items-center gap-2 ${
    active 
    ? `bg-${color}-500/10 border-${color}-500 text-${color}-400 shadow-lg shadow-${color}-500/10` 
    : 'bg-gray-900/50 border-gray-800 text-gray-600'
  }`}>
    <div className={`w-2 h-2 rounded-full ${active ? `bg-${color}-500 animate-pulse` : 'bg-gray-700'}`}></div>
    <span className="text-[10px] font-black tracking-widest">{label}: {active ? "READY" : "WAITING"}</span>
  </div>
);

export default DataCapture;