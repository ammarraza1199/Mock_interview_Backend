import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// Define the type for a question object
interface Question {
  text: string;
  status: 'Answered' | 'Marked for Later' | 'Not Answered';
}

const VideoInterview: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize state from location, with proper typing and defaults
  const [questions, setQuestions] = useState<Question[]>(location.state?.questions || []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(location.state?.currentQuestionIndex || 0);
  const [isRecording, setIsRecording] = useState(false);
  const [interviewFeedback, setInterviewFeedback] = useState<{ question: string; feedback: string }[]>(location.state?.interviewFeedback || []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        if (err instanceof Error && err.name === 'NotAllowedError') {
          alert('Permission to access camera/microphone was denied. Please allow access in your browser settings and refresh the page. If you are not using HTTPS, some browsers may block access.');
        } else {
          alert('An unknown error occurred while accessing media devices.');
        }
      }
    };
    getMedia();
  }, []);

  const handleStartRecording = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Your browser doesn't support speech recognition. Please try Chrome or another supported browser.");
      return;
    }
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const handleStopRecording = async () => {
    SpeechRecognition.stopListening();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      const currentQuestion = questions[currentQuestionIndex];
      if (!transcript.trim()) {
        alert("No speech detected. Please ensure your microphone is working and you are speaking clearly.");
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/analyze-answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question: currentQuestion.text, answer: transcript }),
        });

        if (!response.ok) {
          throw new Error(`Analysis failed with status: ${response.status}`);
        }

        const data = await response.json();
        setInterviewFeedback((prev) => [...prev, { question: currentQuestion.text, feedback: data.feedback }]);
        
        // Mark the question as answered and update the state
        const updatedQuestions = questions.map((q, index) =>
          index === currentQuestionIndex ? { ...q, status: 'Answered' } : q
        );
        setQuestions(updatedQuestions);

      } catch (error) {
        console.error('Error sending answer for analysis:', error);
        alert(`An error occurred while analyzing your answer. Please try again.`);
      }
    }
  };

  const handleGoBackToInterview = () => {
    navigate('/interview', { state: { questions: questions, interviewFeedback: interviewFeedback } });
  };

  const handleFinishInterview = () => {
    navigate('/feedback', { state: { interviewFeedback: interviewFeedback } });
  };

  // Display a loading message if questions are not yet available
  if (questions.length === 0) {
    return <div className="p-6 bg-yellow-100 text-yellow-700 text-center">Loading question...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center text-blue-600 mb-4">
          Question {currentQuestionIndex + 1} of {questions.length}
        </h2>
        <p className="text-xl text-center mb-6">{questions[currentQuestionIndex]?.text}</p>
        <div className="relative w-full h-96 bg-black rounded-lg mb-6">
          <video ref={videoRef} className="w-full h-full object-cover rounded-lg" autoPlay muted />
        </div>
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              className="px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="px-6 py-3 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors"
            >
              Stop Recording
            </button>
          )}
          <button
            onClick={handleGoBackToInterview}
            disabled={isRecording}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Back to Questions
          </button>
        </div>
        {transcript && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-bold text-lg">Transcript:</h3>
            <p>{transcript}</p>
          </div>
        )}
        {currentQuestionIndex === questions.length - 1 && (
            <div className="flex justify-center mt-6">
                <button
                    onClick={handleFinishInterview}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"
                >
                    Finish Interview
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

export default VideoInterview;
