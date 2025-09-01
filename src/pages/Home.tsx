import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-center text-blue-600 mb-6">AI-Powered Mock Interview Simulator</h1>
      <Link to="/upload" className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">Start Interview</Link>
    </div>
  );
}

export default Home;
