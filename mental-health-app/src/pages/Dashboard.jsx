import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, Users, TrendingUp } from 'lucide-react';
import Layout from '../components/Layout';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const COLORS = { 'Sad': '#3b82f6', 'Calm': '#10b981', 'Happy': '#f59e0b', 'Fearful': '#ef4444', 'Angry': '#f97316', 'Disgust': '#84cc16', 'Surprised': '#06b6d4', 'Neutral': '#a8a29e' };

const Dashboard = () => {
  const [historyData, setHistoryData] = useState([]);
  const [emotionStats, setEmotionStats] = useState([]);
  const [avgDysregulation, setAvgDysregulation] = useState(0);
  const [dominantState, setDominantState] = useState("None");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/history`);
        const data = await res.json();
        
        // 1. Format for AreaChart (Chronological)
        const formattedHistory = data.map(scan => ({
            date: new Date(scan.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            dysregulation: scan.dysregulation_score,
            emotion: scan.emotion
        }));
        setHistoryData(formattedHistory);

        // 2. Compute Average Dysregulation
        if (data.length > 0) {
            const avg = data.reduce((acc, curr) => acc + curr.dysregulation_score, 0) / data.length;
            setAvgDysregulation(avg.toFixed(2));
        }

        // 3. Compute Emotion Frequencies for BarChart
        const frequencies = {};
        data.forEach(scan => {
            frequencies[scan.emotion] = (frequencies[scan.emotion] || 0) + 1;
        });

        const statsArray = Object.keys(frequencies).map(key => ({
            name: key,
            value: frequencies[key],
            color: COLORS[key] || '#8884d8'
        })).sort((a, b) => b.value - a.value); // Sort highest first

        setEmotionStats(statsArray);
        if (statsArray.length > 0) setDominantState(statsArray[0].name);

      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      }
    };
    fetchHistory();
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Overall Dashboard</h1>
            <p className="text-gray-400">Aggregate analysis of all patient history and long-term trends directly from PostgreSQL.</p>
        </div>

        {/* 1. Summary Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Activity /></div>
                <div>
                    <p className="text-gray-500 text-xs uppercase font-bold">Total Scans</p>
                    <p className="text-2xl font-bold text-white">{historyData.length}</p>
                </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500"><TrendingUp /></div>
                <div>
                    <p className="text-gray-500 text-xs uppercase font-bold">Avg Dysregulation</p>
                    <p className="text-2xl font-bold text-white">{avgDysregulation}</p>
                </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><Users /></div>
                <div>
                    <p className="text-gray-500 text-xs uppercase font-bold">Dominant State</p>
                    <p className="text-2xl font-bold text-white">{dominantState}</p>
                </div>
            </div>
        </div>

        {/* 2. Main Charts Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                <h3 className="text-lg font-bold text-white mb-6">Mental Health Progress (Dysregulation)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                            <defs>
                                <linearGradient id="colorDys" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', color: '#fff'}} itemStyle={{color: '#fff'}} />
                            <Area type="monotone" dataKey="dysregulation" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDys)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                <h3 className="text-lg font-bold text-white mb-6">Emotional State Distribution</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={emotionStats} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                            <XAxis type="number" stroke="#9ca3af" fontSize={12} hide />
                            <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={14} width={80} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#111827', borderColor: '#374151'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {emotionStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;