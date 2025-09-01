import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Upload() {
  const [resume, setResume] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!resume || !jobDescription) {
      alert('Please upload your resume and provide the job description.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', resume);
    formData.append('jobDescription', new Blob([jobDescription], { type: 'text/plain' }), 'jobDescription.txt');

    try {
      // Upload files
      const uploadResponse = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        console.error('Upload failed with status:', uploadResponse.status);
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      const uploadData = await uploadResponse.json();

      console.log('Upload response:', uploadData);

      // Display summary to the user
      const { summary } = uploadData;
      if (summary) {
        alert(`Summary:\n- Total Questions Generated: ${summary.totalQuestionsGenerated}\n- Unique Questions: ${summary.uniqueQuestions}\n- Repeated Questions: ${summary.repeatedQuestions}\n- Suggestions: ${summary.improvementSuggestions}`);
      }

      // Get questions
      const questionsResponse = await fetch('http://localhost:5000/api/questions');
      if (!questionsResponse.ok) {
        if (questionsResponse.status === 404) {
          console.warn('No questions generated yet.');
          alert('No questions have been generated yet. Please try again after uploading your files.');
          return;
        }
        console.error('Failed to fetch questions with status:', questionsResponse.status);
        throw new Error(`Failed to fetch questions: ${questionsResponse.statusText}`);
      }
      const data = await questionsResponse.json();

      console.log('Questions response:', data);

      navigate('/interview');

    } catch (error) {
      console.error('Error generating questions:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert(`Error: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded-lg mt-10">
      <h2 className="text-2xl font-bold mb-4">Upload Files</h2>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Resume (PDF or DOCX):</label>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => handleFileChange(e, setResume)}
          className="block w-full text-gray-700 border rounded-lg p-2"
          title="Upload your resume in PDF or DOCX format"
        />
        {resume && <p className="text-sm text-gray-500 mt-2">Selected: {resume.name}</p>}
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Job Description:</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="block w-full text-gray-700 border rounded-lg p-2"
          rows={6}
          placeholder="Paste the job description here..."
        />
      </div>
      <button
        onClick={handleGenerateQuestions}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
      >
        Generate Questions
      </button>
    </div>
  );
}

export default Upload;