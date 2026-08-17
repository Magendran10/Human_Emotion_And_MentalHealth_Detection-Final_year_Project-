import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Search } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const History = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/history`);
        const data = await res.json();
        // Reverse so newest is on top
        setHistoryData(data.reverse());
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Scan History</h1>
            {/* <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search logs..." className="bg-transparent outline-none text-gray-300 text-sm" />
            </div> */}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden min-h-[400px]">
            <table className="w-full text-left text-gray-400">
                <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase">
                    <tr>
                        <th className="p-4">Date & Time</th>
                        <th className="p-4">Detected Emotion</th>
                        <th className="p-4">Risk Level</th>
                        <th className="p-4">Data Source</th>
                        <th className="p-4">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {loading ? (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading database records...</td></tr>
                    ) : historyData.length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-500">No scans recorded yet.</td></tr>
                    ) : (
                        historyData.map(item => (
                            <tr 
                                key={item.id} 
                                className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                                onClick={() => navigate('/report', { 
                                    state: { 
                                        // Report.jsx does: const { prediction: backendData } = state
                                        // then: const { prediction, clinical_assessment, explainability } = backendData
                                        // So state.prediction must be the FULL backend response object
                                        prediction: item.full_report,
                                        features: { visualDim: 1280, acousticDim: 1536, textualDim: 768 },
                                        transcript: "[Archived Scan] — Raw transcript not stored for patient privacy."
                                    }
                                })}
                            >
                                <td className="p-4">{new Date(item.timestamp).toLocaleString()}</td>
                                <td className="p-4 text-white font-medium">{item.emotion}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        item.risk_category === 'HighRisk' ? 'bg-red-500/10 text-red-500' : 
                                        item.risk_category === 'ModerateRisk' ? 'bg-orange-500/10 text-orange-500' : 
                                        'bg-green-500/10 text-green-500'
                                    }`}>
                                        {item.risk_category.replace('Risk', ' Risk')}
                                    </span>
                                </td>
                                <td className="p-4">{item.data_source}</td>
                                <td className="p-4 text-blue-400 text-xs font-bold">View Full Report →</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </Layout>
  );
};

export default History;