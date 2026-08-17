import React, { useRef } from 'react';

const FileUpload = ({ type, icon: Icon, color, label, currentFile, isProcessing, onFileSelect }) => {
  const inputRef = useRef(null);

  // Dynamic Tailwind classes based on color prop
  const colorVariants = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500', iconBg: 'bg-blue-500/20', iconText: 'text-blue-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500', iconBg: 'bg-green-500/20', iconText: 'text-green-400' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400' },
  };

  const theme = colorVariants[color] || colorVariants.blue;

  return (
    <div 
        onClick={() => !isProcessing && inputRef.current.click()}
        className={`
            border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all h-64
            ${currentFile ? `${theme.bg} ${theme.border}` : 'border-gray-700 hover:border-blue-500 hover:bg-gray-800'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
    >
        <input 
            ref={inputRef} 
            type="file" 
            hidden 
            accept={type === 'text' ? '.txt' : `${type}/*`} 
            onChange={onFileSelect} 
        />
        
        <div className={`p-4 rounded-full mb-4 ${currentFile ? `${theme.iconBg} ${theme.iconText}` : 'bg-gray-800 text-gray-400'}`}>
            <Icon className="w-8 h-8" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-200">
            {currentFile ? currentFile.name : label}
        </h3>
        
        <p className="text-sm text-gray-500 mt-2">
            {currentFile ? "Ready for analysis" : "Click to browse"}
        </p>
    </div>
  );
};

export default FileUpload;