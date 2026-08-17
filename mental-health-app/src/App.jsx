import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GlobalProvider } from './context/GlobalContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Report from './pages/Report';
import Dashboard from './pages/Dashboard'; // Import Dashboard
import History from './pages/History';
import VideoDemo from './pages/VideoDemo';
import AudioDemo from './pages/AudioDemo';
import TextDemo from './pages/TextDemo';


function App() {
  return (
    <GlobalProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/report" element={<Report />} />
          <Route path="/dashboard" element={<Dashboard />} /> {/* New Route */}
          <Route path="/history" element={<History />} />
          <Route path="/video-demo" element={<VideoDemo />} />
        <Route path="/audio-demo" element={<AudioDemo />} />
        <Route path="/text-demo" element={<TextDemo />} />
        </Routes>
      </Router>
    </GlobalProvider>
  );
}

export default App;