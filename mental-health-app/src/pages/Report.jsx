import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Brain, ShieldAlert, HeartPulse, FileText, BarChart3, Info, ChevronDown, ChevronUp, Cpu, Download } from 'lucide-react';
import Layout from '../components/Layout';

const Report = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  
  // NEW: State to toggle the Modality Log
  const [isLogOpen, setIsLogOpen] = useState(false);

  if (!state || !state.prediction) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen text-white">
          <Activity className="w-16 h-16 text-gray-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold mb-2">No Report Data Found</h2>
          <p className="text-gray-400 mb-6">Please run the analysis pipeline first.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">
            Go to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const { prediction: backendData, features, transcript } = state;
  const { prediction, clinical_assessment, explainability } = backendData;
  const { recommendation } = clinical_assessment;

  const getRiskColor = (risk) => {
    if (risk === "HighRisk") return "text-red-400 bg-red-400/10 border-red-400/30";
    if (risk === "ModerateRisk") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    if (risk === "LowRisk") return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
  };

  const getRiskBarColor = (score) => {
    if (score >= 0.65) return "bg-gradient-to-r from-red-500 to-rose-400";
    if (score >= 0.40) return "bg-gradient-to-r from-yellow-500 to-orange-400";
    if (score >= 0.15) return "bg-gradient-to-r from-blue-500 to-cyan-400";
    return "bg-gradient-to-r from-emerald-500 to-green-400";
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto min-h-screen pb-20 px-4">
        
        {/* Header Section */}
        <header className="mb-8 flex justify-between items-center border-b border-gray-800 pb-6 pt-6">
          <div>
            <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-bold tracking-widest mb-4 transition-colors">
              <ArrowLeft size={16} /> NEW ANALYSIS
            </button>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">CLINICAL ASSESSMENT</h1>
            <p className="text-gray-400 uppercase text-[10px] tracking-[0.2em]">Trimodal Emotion & Dysregulation Report</p>
          </div>
          <div className={`px-6 py-3 rounded-2xl border ${getRiskColor(recommendation.risk_category)} flex flex-col items-end`}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Overall Risk Level</span>
            <span className="text-2xl font-black tracking-tighter">{recommendation.risk_category.replace('Risk', ' Risk')}</span>
          </div>
        </header>

        {/* Top Highlight Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-3 mb-2 text-gray-400">
              <Brain size={18} className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Primary Emotion</span>
            </div>
            <div className="text-4xl font-black text-white mb-1">{prediction.emotion}</div>
            <div className="text-xs text-gray-500 font-mono">Confidence: {(prediction.confidence * 100).toFixed(1)}%</div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800 p-6 rounded-2xl md:col-span-2 shadow-lg">
            <div className="flex items-center gap-3 mb-2 text-gray-400">
              <HeartPulse size={18} className="text-rose-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Emotional Dysregulation Score (S_dys)</span>
            </div>
            <div className="flex items-end gap-4 mb-3">
              <div className="text-4xl font-black text-white">{clinical_assessment.dysregulation_score.toFixed(3)}</div>
              <div className="text-xs text-gray-500 font-mono mb-1">(Max 1.0)</div>
            </div>
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getRiskBarColor(clinical_assessment.dysregulation_score)} transition-all duration-1000`} 
                style={{ width: `${Math.min((clinical_assessment.dysregulation_score / 0.9) * 100, 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Diagnostics & Data */}
          <div className="lg:col-span-1 space-y-6">
            
            <div className="bg-gray-900/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <BarChart3 size={14} /> SoftMax Probabilities
              </h3>
              <div className="space-y-4">
                {Object.entries(prediction.probability_distribution)
                  .sort(([,a], [,b]) => b - a)
                  .map(([emotion, prob]) => (
                  <div key={emotion}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 font-bold">{emotion}</span>
                      <span className="font-mono text-gray-500">{(prob * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${emotion === prediction.emotion ? 'bg-purple-500' : 'bg-gray-600'}`} 
                        style={{ width: `${prob * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLLAPSIBLE Modality Log */}
            <div className="bg-gray-900/80 border border-gray-800 p-5 rounded-2xl shadow-lg transition-all">
              <button 
                onClick={() => setIsLogOpen(!isLogOpen)}
                className="w-full flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2"><Info size={14} /> Modality Extraction Log</span>
                {isLogOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {isLogOpen && (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-3 font-mono text-[10px] text-gray-400 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between pb-2 border-b border-gray-800/50">
                    <span>HuBERT (Acoustic)</span>
                    <span className={features.acousticDim ? "text-green-400" : "text-gray-600"}>[{features.acousticDim || 0}] dims</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-800/50">
                    <span>MobileViT (Visual)</span>
                    <span className={features.visualDim ? "text-green-400" : "text-gray-600"}>[{features.visualDim || 0}] dims</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-800/50">
                    <span>DistilBERT (Textual)</span>
                    <span className={features.textualDim ? "text-green-400" : "text-gray-600"}>[{features.textualDim || 0}] dims</span>
                  </div>
                  <div className="pt-2">
                    <span className="block text-gray-500 mb-1 flex items-center gap-1"><FileText size={10}/> Analyzed Transcript:</span>
                    <p className="italic text-gray-300 leading-relaxed">"{transcript || 'No transcript provided.'}"</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Interventions & Explainability */}
          <div className="lg:col-span-2 space-y-6">
            
            {recommendation.clinical_flags && recommendation.clinical_flags.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl shadow-lg">
                <h3 className="text-red-400 font-black flex items-center gap-2 mb-3">
                  <ShieldAlert size={18} /> CLINICAL FLAGS DETECTED
                </h3>
                {recommendation.clinical_flags.map((flag, idx) => (
                  <div key={idx} className="mb-2 last:mb-0">
                    <strong className="text-red-300 text-sm">{flag.alert_type}:</strong>
                    <p className="text-red-200 text-sm mt-1">{flag.action}</p>
                    <p className="text-red-400/60 text-xs mt-2 italic">{flag.evidence_basis}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-900/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                Scientifically Backed Interventions
              </h3>
              
              {recommendation.interventions.length === 0 ? (
                <p className="text-gray-500 italic text-sm">No specific interventions required at this time.</p>
              ) : (
                <div className="space-y-4">
                  {recommendation.interventions.map((intervention, idx) => (
                    <div key={idx} className="bg-[#0b101a] border border-gray-800 p-5 rounded-xl hover:border-gray-700 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-[9px] font-black uppercase rounded">
                          {intervention.type}
                        </span>
                        <h4 className="text-blue-400 font-bold text-sm">{intervention.technique}</h4>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {intervention.action}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NEW: Model Explainability (SHAP) Engine UI */}
            <div className="bg-gray-900/80 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Cpu size={14} /> AI Decision Drivers (Feature Importance)
              </h3>
              <p className="text-xs text-gray-400 mb-5">
                Which data stream most heavily influenced the prediction of <strong>{prediction.emotion}</strong>?
              </p>
              
              <div className="space-y-4">
                {Object.entries(explainability?.modality_importance || {})
                  .sort(([,a], [,b]) => b - a)
                  .map(([modality, percentage]) => (
                  <div key={modality}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 font-bold">{modality} Stream</span>
                      <span className="font-mono text-gray-400">{percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          modality === "Acoustic" ? "bg-green-500" : 
                          modality === "Visual" ? "bg-blue-500" : "bg-purple-500"
                        }`} 
                        style={{ width: `${percentage}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Anchor / Action Button */}
            {/* <div className="flex justify-end pt-4 pb-10">
               <button className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs font-bold tracking-widest uppercase rounded-xl transition-all shadow-lg">
                 <Download size={16} /> Download PDF Report
               </button>
            </div> */}

          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Report;