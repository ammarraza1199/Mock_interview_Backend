import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// Define the type for the question status
type QuestionStatus = 'Answered' | 'Marked for Later' | 'Not Answered';

// Define the type for a question object
interface Question {
  text: string;
  status: QuestionStatus;
}

const InterviewPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interviewFeedback, setInterviewFeedback] = useState<{ question: string; feedback: string }[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    // On initial load, fetch questions from the API
    const fetchQuestions = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/questions');
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          const initialQuestions = data.questions.map((q: string) => ({ text: q, status: 'Not Answered' as QuestionStatus }));
          setQuestions(initialQuestions);
        } else {
          setError('No questions were generated. Please go back and upload the required documents.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    };

    if (location.state?.questions) {
        setQuestions(location.state.questions);
    } else {
        fetchQuestions();
    }
  }, [location.state?.questions]);

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

  const handleQuestionClick = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleMarkForLater = () => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].status = 'Marked for Later';
    setQuestions(updatedQuestions);
    handleNext();
  };

  const handleFinishInterview = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/analyze-transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ transcript: interviewFeedback.map(f => `Question: ${f.question}\nAnswer: ${f.feedback}`).join('\n\n') }),
        });

        if (!response.ok) {
            throw new Error(`Analysis failed with status: ${response.status}`);
        }

        const data = await response.json();
        setFeedback(data.feedback);
        setShowFeedbackModal(true);

    } catch (error) {
        console.error('Error sending transcript for analysis:', error);
        alert(`An error occurred while analyzing your transcript. Please try again.`);
    }
  };

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
        
        const updatedQuestions = questions.map((q, index) =>
          index === currentQuestionIndex ? { ...q, status: 'Answered' as QuestionStatus } : q
        );
        setQuestions(updatedQuestions);

      } catch (error) {
        console.error('Error sending answer for analysis:', error);
        alert(`An error occurred while analyzing your answer. Please try again.`);
      }
    }
  };

  const getStatusColor = (status: QuestionStatus) => {
    switch (status) {
      case 'Answered':
        return 'bg-green-100 text-green-800';
      case 'Marked for Later':
        return 'bg-yellow-100 text-yellow-800';
      case 'Not Answered':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return <div className="p-6 bg-red-100 text-red-700 text-center">Error: {error}</div>;
  }

  if (questions.length === 0) {
    return <div className="p-6 bg-yellow-100 text-yellow-700 text-center">Loading questions...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Left Sidebar: Questions List */}
      <div className="w-1/4 bg-white border-r border-gray-200 p-4 flex flex-col">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Questions</h2>
        <ul className="space-y-3 overflow-y-auto">
          {questions.map((question, index) => (
            <li
              key={index}
              onClick={() => handleQuestionClick(index)}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-sm hover:shadow-lg hover:scale-105 ${ index === currentQuestionIndex
                  ? 'bg-blue-600 text-white shadow-xl scale-105'
                  : getStatusColor(question.status)
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-md font-semibold">Question {index + 1}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(question.status)}`}>
                  {question.status}
                </span>
              </div>
              <p className={`mt-2 text-sm ${index === currentQuestionIndex ? 'text-blue-100' : 'text-gray-700'}`}>
                {question.text.substring(0, 50)}...
              </p>
            </li>
          ))}
        </ul>
        {transcript && (
            <div className="mt-6 p-6 bg-gray-100 rounded-xl shadow-inner">
              <h3 className="font-bold text-xl text-gray-800 mb-2">Transcript:</h3>
              <p className="text-gray-700 overflow-y-auto h-40">{transcript}</p>
            </div>
        )}
      </div>

      {/* Right Content: Current Question and Actions */}
      <div className="w-3/4 flex flex-col bg-gray-100 h-screen">
        <div className="flex-grow-[0.75] bg-white p-8 rounded-2xl shadow-2xl m-8 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</h3>
            <p className="text-xl font-normal text-gray-800 mt-2 mb-6">
                {questions[currentQuestionIndex].text}
            </p>
            <div className="relative w-full flex-grow bg-black rounded-xl overflow-hidden shadow-lg">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted />
                {isRecording && (
                <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full">
                    <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    <span>Recording</span>
                </div>
                )}
            </div>
        </div>
        <div className="flex-grow-[0.25] bg-white p-8 rounded-t-2xl shadow-2xl flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-8 py-4 bg-gray-300 text-gray-800 rounded-full shadow-md hover:bg-gray-400 disabled:opacity-50 transition-all duration-300"
            >
              Previous
            </button>

            <div className="flex space-x-6">
                {!isRecording ? (
                    <button
                    onClick={handleStartRecording}
                    className="px-8 py-4 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-110"
                    >
                    Start Recording
                    </button>
                ) : (
                    <button
                    onClick={handleStopRecording}
                    className="px-8 py-4 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all duration-300 transform hover:scale-110"
                    >
                    Stop Recording
                    </button>
                )}
                <button
                    onClick={handleMarkForLater}
                    className="px-8 py-4 bg-yellow-500 text-white rounded-full shadow-md hover:bg-yellow-600 transition-all duration-300"
                >
                    Mark for Later
                </button>
                <button
                    onClick={handleNext}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="px-8 py-4 bg-green-600 text-white rounded-full shadow-md hover:bg-green-700 disabled:opacity-50 transition-all duration-300"
                >
                    Next
                </button>
            </div>

            <button
              onClick={handleFinishInterview}
              className="px-8 py-4 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-all duration-300"
            >
              Finish Interview
            </button>
        </div>
      </div>
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-3xl w-full">
                <h2 className="text-3xl font-bold mb-6 text-center text-blue-600">Interview Feedback</h2>
                <div className="text-gray-700 whitespace-pre-wrap overflow-y-auto max-h-96">{feedback}</div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={() => setShowFeedbackModal(false)}
                        className="px-8 py-4 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-all duration-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default InterviewPage;