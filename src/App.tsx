import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Interview from './pages/Interview';
import Feedback from './pages/Feedback';
import VideoInterview from './pages/VideoInterview';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/interview" element={<Interview />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/video-interview" element={<VideoInterview />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;