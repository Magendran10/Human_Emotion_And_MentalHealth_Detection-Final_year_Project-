import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96">
        <h2 className="text-2xl font-bold text-teal-600 mb-2 text-center">MindSense AI</h2>
        <p className="text-gray-500 mb-6 text-center">Final Year Project Login</p>
        
        <div className="space-y-4">
          <input type="email" placeholder="Email" className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          <input type="password" placeholder="Password" className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          
          <button 
            onClick={() => navigate('/home')}
            className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition"
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}