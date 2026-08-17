import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LayoutDashboard, History, LogOut, Brain } from 'lucide-react';

const Sidebar = () => {
  const linkClass = ({ isActive }) => 
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
      isActive 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  return (
    <div className="w-64 bg-gray-900 h-screen fixed left-0 top-0 border-r border-gray-800 flex flex-col p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">MindSense</h1>
          <p className="text-xs text-gray-500">AI Detector</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        <NavLink to="/home" className={linkClass}>
          <Home className="w-5 h-5" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/dashboard" className={linkClass}>
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          <History className="w-5 h-5" />
          <span>History</span>
        </NavLink>
      </nav>

      {/* Footer / Logout */}
      <div className="pt-6 border-t border-gray-800">
        <button className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl w-full transition-colors">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;