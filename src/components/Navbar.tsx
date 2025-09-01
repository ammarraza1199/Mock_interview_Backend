import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="bg-white shadow sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-blue-600">Mock Interview</Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-gray-700 hover:text-blue-600">Home</Link>
            <Link to="/upload" className="text-gray-700 hover:text-blue-600">Upload</Link>
            <Link to="/interview" className="text-gray-700 hover:text-blue-600">Interview</Link>
            <Link to="/feedback" className="text-gray-700 hover:text-blue-600">Feedback</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
