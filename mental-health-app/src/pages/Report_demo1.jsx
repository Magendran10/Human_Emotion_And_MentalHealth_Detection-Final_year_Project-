import React from 'react';
import { useLocation ,useNavigate} from 'react-router-dom';
import { 
  AlertTriangle, ShieldCheck, Brain, Thermometer, 
  Mic, Eye, FileText, ArrowUpRight, ArrowDownRight, Minus 
} from 'lucide-react';
import Layout from '../components/Layout';

// --- COMPONENT: Metric Card with Comparison ---
const MetricCard = ({ title, value, label, color, icon: Icon, trend }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-gray-700 transition-all">
      {Icon && <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity"><Icon className={`w-12 h-12 text-${color}-500`} /></div>}
      
      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</h3>
      
      <div className="flex items-baseline gap-2">
        <p className={`text-3xl font-bold ${color === 'white' ? 'text-white' : `text-${color}-400`}`}>{value}</p>
        {label && <span className={`text-sm font-medium px-2 py-0.5 rounded ${color === 'white' ? 'bg-gray-800 text-gray-300' : `bg-${color}-500/10 text-${color}-400`}`}>{label}</span>}
      </div>

      {/* Comparison Logic */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
        {trend === 'up' && <ArrowUpRight className="w-4 h-4 text-red-400" />}
        {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-green-400" />}
        {trend === 'same' && <Minus className="w-4 h-4 text-gray-400" />}
        <p className="text-xs text-gray-500">
            {trend === 'up' ? 'Higher' : trend === 'down' ? 'Lower' : 'Stable'} vs last scan
        </p>
      </div>
  </div>
);

const Report = () => {
  const navigate = useNavigate();
  const location = useLocation();
//   const reportData = location.state || {};
  
  // Data passed from Home.jsx, with fallbacks
  const currentData = location.state || { 
    emotion: 'Calm', // RAVDESS Class
    confidence: 0.82, 
    dysregulation: 0.35, 
    riskLevel: 'Low' 
  };

  // Mock Previous Data for comparison logic
  const prevData = {
    dysregulation: 0.45, // Was higher before
    confidence: 0.80
  };

  // Helper to determine dysregulation text label
  const getDysregLabel = (score) => {
    if (score < 0.3) return "Healthy";
    if (score < 0.6) return "Moderate";
    return "Severe";
  };

  // SHAP Mock Data (Explainability)
  const shapValues = [
    { feature: 'Vocal Jitter (Audio)', value: 42, desc: 'High pitch fluctuation detected' },
    { feature: 'Brow Furrow (Video)', value: 28, desc: 'Facial muscle tension' },
    { feature: 'Keyword "Tired" (Text)', value: 15, desc: 'Negative semantic marker' },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end">
            <div className="p-8 bg-[#0b0f1a] min-h-screen text-white">
        {/* Navigation Back Button */}
        <button 
          onClick={() => navigate('/')} 
          className="mb-8 flex items-center gap-2 text-gray-500 hover:text-white transition-all uppercase text-[10px] font-bold tracking-widest"
        >
          <ArrowLeft size={14} /> Back to Session Capture
        </button>
                <h1 className="text-3xl font-bold text-white mb-2">Single Session Report</h1>
                <p className="text-gray-400">Comparing current analysis with previous baseline.</p>
            </div>
            <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Detected State (RAVDESS)</p>
                <p className="text-2xl font-bold text-blue-400">{currentData.emotion}</p>
            </div>
        </div>

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Dysregulation (Main Metric) */}
            <MetricCard 
                title="Dysregulation Score" 
                value={currentData.dysregulation.toFixed(2)}
                label={getDysregLabel(currentData.dysregulation)}
                color={currentData.dysregulation > 0.5 ? 'orange' : 'green'} 
                trend={currentData.dysregulation > prevData.dysregulation ? 'up' : 'down'}
            />

            {/* 2. Confidence */}
            <MetricCard 
                title="Model Confidence" 
                value={`${(currentData.confidence * 100).toFixed(0)}%`} 
                color="cyan" 
                icon={ShieldCheck}
                trend={currentData.confidence > prevData.confidence ? 'up' : 'same'}
            />

            {/* 3. Primary Modality */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
                 <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Dominant Modality</h3>
                 <div className="flex items-center gap-3">
                    <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400"><Mic className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xl font-bold text-white">Audio</p>
                        <p className="text-xs text-gray-500">Highest signal contribution</p>
                    </div>
                 </div>
            </div>
        </div>

        {/* Explainability Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-6">Why this result? (SHAP Analysis)</h2>
                <div className="space-y-5">
                    {shapValues.map((item, i) => (
                        <div key={i}>
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-300 text-sm font-medium">{item.desc}</span>
                                <span className="text-gray-500 text-xs">{item.feature}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.value}%` }} />
                                </div>
                                <span className="text-white font-bold text-sm">{item.value}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Thermometer className="text-yellow-500 w-5 h-5" /> Clinical Notes
                </h2>
                <ul className="space-y-4">
                    <li className="text-gray-400 text-sm border-l-2 border-yellow-500 pl-4">
                        Patient shows signs of <b>{currentData.emotion}</b> state.
                    </li>
                    <li className="text-gray-400 text-sm border-l-2 border-green-500 pl-4">
                        Dysregulation has <b>{currentData.dysregulation < prevData.dysregulation ? 'improved' : 'worsened'}</b> since last visit.
                    </li>
                </ul>
            </div>
        </div>
      </div>
    </Layout>
  );
};

export default Report;