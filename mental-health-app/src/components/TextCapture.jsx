import React, { useState } from 'react';

const TextCapture = ({ onTextChange, status, isDisabled, onReset }) => {
  const [localText, setLocalText] = useState("");

  const handleConfirm = () => {
    if (localText.trim().length > 5) {
      onTextChange(localText); // Finalizes text in parent state
    }
  };

  const handleRedo = () => {
    setLocalText("");
    onReset(); // Unlocks the mutual exclusion
  };

  return (
    <div className={`bg-gray-800 border-2 transition-all rounded-2xl p-6 flex flex-col h-full ${
      status ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-gray-700'
    } ${isDisabled && !status ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 w-full">
        <div className={`p-3 rounded-lg ${status ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-900 text-gray-400'}`}>
          <span className="text-2xl">📄</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black tracking-tight uppercase">Transcript</h3>
          <p className="text-[10px] text-gray-500 font-mono">
            {status ? "✅ Content Confirmed" : "Waiting for text input..."}
          </p>
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-1 mb-6">
        {status ? (
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 h-32 overflow-y-auto text-xs text-gray-400 italic">
            "{localText}"
          </div>
        ) : (
          <textarea 
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            disabled={isDisabled}
            className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm focus:border-purple-500 outline-none transition-all resize-none text-white placeholder-gray-600"
            placeholder="Paste patient transcript here..."
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full">
        {!status ? (
          <button 
            onClick={handleConfirm}
            disabled={isDisabled || localText.trim().length <= 5}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 py-3 rounded-xl font-black text-xs tracking-widest shadow-lg transition-all active:scale-95"
          >
            CONFIRM TRANSCRIPT ✅
          </button>
        ) : (
          <button 
            onClick={handleRedo}
            className="w-full bg-red-900/30 text-red-400 hover:bg-red-900/50 py-3 rounded-xl font-bold text-xs border border-red-500/10 transition-all"
          >
            REDO TRANSCRIPT 🔄
          </button>
        )}
      </div>
    </div>
  );
};

export default TextCapture;