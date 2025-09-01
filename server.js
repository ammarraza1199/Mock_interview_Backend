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
    *   **For Skills Listed on the Resume:** Ask specific, experience-based questions. Instead of 