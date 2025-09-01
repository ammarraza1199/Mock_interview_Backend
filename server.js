const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = 5000;

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain' || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only TXT and PDF files are allowed.'), false);
        }
    }
});

// Configure Multer for audio uploads
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'recordings');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const audioUpload = multer({ storage: audioStorage });

// Function to extract text from PDF
async function extractTextFromPdf(buffer) {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF.');
    }
}

// Google Generative AI configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store generated questions in memory
let generatedQuestions = [];
let jobDescriptionText = '';
let resumeText = '';

// Helper function to select random elements
function selectRandom(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Helper function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Helper function to remove duplicate questions
function removeDuplicates(array) {
    const uniqueSet = new Set(array);
    return Array.from(uniqueSet);
}

// POST /api/upload endpoint
app.post('/api/upload', upload.fields([{ name: 'jobDescription', maxCount: 1 }, { name: 'resume', maxCount: 1 }]), async (req, res) => {
    console.log('Received file upload request.');
    try {
        const jobDescriptionFile = req.files['jobDescription'] ? req.files['jobDescription'][0] : null;
        const resumeFile = req.files['resume'] ? req.files['resume'][0] : null;

        if (!jobDescriptionFile || !resumeFile) {
            console.warn('Missing job description or resume file.');
            return res.status(400).json({ error: 'Both job description and resume files are required.' });
        }

        console.log('Processing job description and resume files.');

        // Process Job Description
        if (jobDescriptionFile.mimetype === 'text/plain') {
            jobDescriptionText = jobDescriptionFile.buffer.toString('utf8');
        } else if (jobDescriptionFile.mimetype === 'application/pdf') {
            jobDescriptionText = await extractTextFromPdf(jobDescriptionFile.buffer);
        }

        // Process Resume
        if (resumeFile.mimetype === 'text/plain') {
            resumeText = resumeFile.buffer.toString('utf8');
        } else if (resumeFile.mimetype === 'application/pdf') {
            resumeText = await extractTextFromPdf(resumeFile.buffer);
        }

        console.log('Job description and resume text extracted successfully.');

        // Enhanced prompt to focus on job requirements
        const prompt = `You are an expert technical interviewer. Your task is to generate a list of 20 interview questions based on the provided job description and candidate resume.

**Instructions:**
1.  **Analyze the Job Description and Resume:** Carefully compare the skills and experiences listed in the resume against the requirements in the job description.
2.  **Identify Key Areas:** Determine the most critical skills, technologies, and responsibilities for the role. Note where the candidate's experience is strong and where there are potential gaps.
3.  **Generate High-Quality Questions:** Create questions that directly probe the candidate's fitness for the job.
    *   **For Skills Listed on the Resume:** Ask specific, experience-based questions. Instead of "Do you know Python?", ask "The job requires extensive data processing with Pandas. Can you describe a complex data transformation you've implemented and the challenges you faced?"
    *   **For Gaps in Experience:** Ask questions that test the candidate's ability to learn and adapt. For example, if the job requires 'Terraform' and it's not on the resume, ask "This role involves managing infrastructure as code using Terraform. What is your experience with similar tools, and how would you approach getting up to speed with Terraform in the first few weeks?"
    *   **Behavioral Questions:** Tie behavioral questions directly to the job's context. Instead of a generic "Tell me about a time you worked on a team," ask "This role requires close collaboration with the product team. Can you give an example of a time you had to negotiate project requirements with a non-technical stakeholder?"
4.  **Strict Formatting:**
    *   Each question must be a complete, natural-sounding sentence.
    *   **DO NOT** use placeholders like \`[specific task from JD]\` or \`[key technologies from JD]\`.
    *   Format the output as a numbered list of questions.

**Input:**

**Job Description:**
${jobDescriptionText}

**Resume:**
${resumeText}

**Output (Numbered List of 20 Questions):**`;

        console.log('Generated prompt for AI analysis:', prompt);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const analysisText = await response.text();

        console.log('AI analysis completed:', analysisText);

        // Parse the response to extract questions
        const questionRegex = /^\s*\d+\.\s*(.*)/gm;
        const questions = [];
        let match;
        while ((match = questionRegex.exec(analysisText)) !== null) {
            questions.push(match[1].trim());
        }

        // Use the AI-generated questions directly, filtering out any invalid entries
        generatedQuestions = removeDuplicates(questions).filter(q => q.length > 10 && isNaN(q)).slice(0, 20);

        

        // Final shuffle while keeping first and last questions
        if (generatedQuestions.length > 3) {
            const middleQuestions = generatedQuestions.slice(1, -2);
            generatedQuestions = [
                generatedQuestions[0],
                ...shuffleArray(middleQuestions),
                ...generatedQuestions.slice(-2)
            ];
        }

        res.json({
            message: 'Interview questions generated successfully!',
            interviewQuestions: generatedQuestions,
            jobDescriptionSummary: jobDescriptionText.split('\n').slice(0, 10).join('\n') + '...'
        });

    } catch (error) {
        console.error('Error during file upload or processing:', error);
        res.status(500).json({ error: 'An error occurred during processing.', details: error.message });
    }
});

// POST /api/save-recording endpoint
app.post('/api/save-recording', audioUpload.single('audio'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }

        console.log(`Audio file saved: ${req.file.filename}`);
        res.status(200).json({ message: 'Recording saved successfully.' });
    } catch (error) {
        console.error('Error saving recording:', error);
        res.status(500).json({ error: 'Failed to save recording.' });
    }
});

// GET /api/job-description endpoint
app.get('/api/job-description', (req, res) => {
    if (!jobDescriptionText) {
        return res.status(404).json({ error: 'No job description loaded yet.' });
    }
    res.json({
        message: 'Job description retrieved successfully.',
        jobDescription: jobDescriptionText
    });
});

// GET /api/questions endpoint
app.get('/api/questions', (req, res) => {
    if (generatedQuestions.length === 0) {
        return res.status(404).json({ error: 'No questions generated yet.' });
    }
    res.json({
        message: 'Questions retrieved successfully.',
        questions: generatedQuestions,
        count: generatedQuestions.length
    });
});

// POST /api/analyze-answer endpoint
app.post('/api/analyze-answer', async (req, res) => {
    try {
        const { question, answer } = req.body;

        if (!question || !answer) {
            return res.status(400).json({ error: 'Question and answer are required for analysis.' });
        }

        const prompt = `
            You are an expert technical interviewer and career coach.
            A candidate is participating in a mock interview. You will evaluate their answer to one question based on the transcript of their response, the job description, and their resume.

            Please follow this structure:
            ---
            Job Description:
            ${jobDescriptionText}

            Resume Summary:
            ${resumeText}

            Interview Question:
            ${question}

            Transcript of Candidate's Answer:
            ${answer}
            ---

            Based on this, do the following:
            1. **Score the candidate's answer out of 30 points**, using this rubric:
            - Relevance to the question and job description (10 points)
            - Clarity and structure of the answer (10 points)
            - Communication style and confidence (based on tone inferred from the text) (10 points)
            2. **Give 3 bullet points of detailed feedback**:
            - What was done well
            - What was missing or unclear
            - What could be improved in future answers
            3. **Suggest 1 area the candidate should focus on to improve.**
            4. **Final verdict**: Was the answer strong, average, or weak? (based on the total score and content)

            Be objective, constructive, and supportive. Do not sugarcoat, but encourage growth.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const feedbackText = await response.text();

        res.json({ feedback: feedbackText });

    } catch (error) {
        console.error('Error analyzing answer:', error);
        res.status(500).json({ error: 'Failed to analyze answer.', details: error.message });
    }
});

// POST /api/analyze-answer endpoint for OpenAI
app.post('/api/analyze-answer-openai', async (req, res) => {
  const { job_description, resume_summary, question, transcript } = req.body;

  if (!job_description || !resume_summary || !question || !transcript) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Generate the prompt
  const prompt = `
You are an expert technical interviewer and career coach.

A candidate is participating in a mock interview. You will evaluate their answer to one question based on the transcript of their response, the job description, and their resume.

Please follow this structure:

---
Job Description:
${job_description}

Resume Summary:
${resume_summary}

Interview Question:
${question}

Transcript of Candidate's Answer:
${transcript}

---

Based on this, do the following:

1. **Score the candidate's answer out of 30 points**, using this rubric:
   - Relevance to the question and job description (10 points)
   - Clarity and structure of the answer (10 points)
   - Communication style and confidence (based on tone inferred from the text) (10 points)

2. **Give 3 bullet points of detailed feedback**:
   - What was done well
   - What was missing or unclear
   - What could be improved in future answers

3. **Suggest 1 area the candidate should focus on to improve.**

4. **Final verdict**: Was the answer strong, average, or weak? (based on the total score and content)

Be objective, constructive, and supportive. Do not sugarcoat, but encourage growth.
`;

  try {
    // Send the prompt to OpenAI
    const response = await openai.completions.create({
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 500,
    });

    const evaluation = response.choices[0].text.trim();
    res.json({ evaluation });
  } catch (error) {
    console.error('Error analyzing answer:', error);
    res.status(500).json({ error: 'Failed to analyze answer' });
  }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});