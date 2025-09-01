import React from 'react';
import { useLocation } from 'react-router-dom';

const FeedbackPage: React.FC = () => {
  const location = useLocation();
  const interviewFeedback = location.state?.interviewFeedback || [];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow rounded-lg mt-10">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-600">Interview Feedback</h2>
      {interviewFeedback.length > 0 ? (
        <div className="space-y-6">
          {interviewFeedback.map((item: { question: string; feedback: string }, index: number) => (
            <div key={index} className="bg-gray-50 p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Question: {item.question}</h3>
              <div className="text-gray-700 whitespace-pre-wrap">{item.feedback}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">No feedback available.</p>
      )}
    </div>
  );
};

export default FeedbackPage;