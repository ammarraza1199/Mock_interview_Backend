import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import os
import random
import re
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, status
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pypdf
import docx
import google.generativeai as genai

import resend

from cryptography.fernet import Fernet

import assemblyai as aai



import crud



from database import User, Upload, Feedback, AnalysisFeedback



from auth import (



    create_access_token,



    get_current_user,



    get_password_hash,



    verify_password,



    ACCESS_TOKEN_EXPIRE_MINUTES,



    Token,



)



from datetime import timedelta



from fastapi.security import OAuth2PasswordRequestForm











app = FastAPI()







# Configure CORS



origins = [



    "http://localhost:8080",



    "http://localhost:5173",  # I'm adding this as it is a common port for Vite dev server



    "http://localhost:8081",



]







app.add_middleware(



    CORSMiddleware,



    allow_origins=origins,



    allow_credentials=True,



    allow_methods=["*"],



    allow_headers=["*"],



)







# Generate a key for encryption.



# In a production environment, this key should be stored securely, for example, in an environment variable.



# You can generate a key using: from cryptography.fernet import Fernet; Fernet.generate_key()



ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "your-32-byte-long-url-safe-base64-encoded-encryption-key").encode()



cipher_suite = Fernet(ENCRYPTION_KEY)







def encrypt_file(data: bytes) -> bytes:



    return cipher_suite.encrypt(data)







def decrypt_file(data: bytes) -> bytes:



    return cipher_suite.decrypt(data)











@app.get("/")



async def root():



    return {"message": "Backend is running"}







# ===============================



# 👤 User Authentication



# ===============================







@app.post("/register", response_model=User)



def register(form_data: OAuth2PasswordRequestForm = Depends()):



    try:



        db_user = crud.get_user_by_username(form_data.username)



        if db_user:



            raise HTTPException(



                status_code=status.HTTP_400_BAD_REQUEST,



                detail="Username already registered",



            )



        db_user_email = crud.get_user_by_email(form_data.username)



        if db_user_email:



            raise HTTPException(



                status_code=status.HTTP_400_BAD_REQUEST,



                detail="Email already registered",



            )



        hashed_password = get_password_hash(form_data.password)



        user = User(username=form_data.username, email=form_data.username, password=hashed_password)



        user_id = crud.create_user(user)



        return {**user.dict(), "id": user_id}



    except Exception as e:



        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")











@app.post("/login", response_model=Token)



def login(form_data: OAuth2PasswordRequestForm = Depends()):



    user = crud.get_user_by_username(form_data.username)



    if not user or not verify_password(form_data.password, user["password"]):



        raise HTTPException(



            status_code=status.HTTP_401_UNAUTHORIZED,



            detail="Incorrect username or password",



            headers={"WWW-Authenticate": "Bearer"},



        )



    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)



    access_token = create_access_token(



        data={"sub": user["username"]}, expires_delta=access_token_expires



    )



    return {"access_token": access_token, "token_type": "bearer"}











@app.get("/users/me", response_model=User)



def read_users_me(current_user: User = Depends(get_current_user)):



    return current_user







# Helper: Extract text from PDF



def extract_text_from_pdf(file):



    try:



        pdf_reader = pypdf.PdfReader(file)



        text = ""



        for page in pdf_reader.pages:



            text += page.extract_text()



        return text



    except Exception as e:



        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {str(e)}")







# Helper: Extract text from DOCX



def extract_text_from_docx(file):



    try:



        doc = docx.Document(file)



        text = ""



        for para in doc.paragraphs:



            text += para.text + "\n"



        return text



    except Exception as e:



        raise HTTPException(status_code=500, detail=f"Failed to extract text from DOCX: {str(e)}")







# Configure APIs







genai.configure(api_key=os.getenv("GEMINI_API_KEY"))







aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")







# ===============================



# 📂 Upload Job Description & Resume



# ===============================



@app.post("/api/upload")



async def upload_files(



    name: str = Form(...),



    experience: str = Form(...),



    yearsOfExperience: Optional[str] = Form(None),



    jobDescription: UploadFile = File(...),



    resume: UploadFile = File(...),



    current_user: User = Depends(get_current_user)



):



    try:



        # Process Job Description



        job_description_content = await jobDescription.read()



        if jobDescription.content_type == "text/plain":



            job_description_text = job_description_content.decode("utf-8")



        elif jobDescription.content_type == "application/pdf":



            job_description_text = extract_text_from_pdf(jobDescription.file)



        elif jobDescription.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":



            job_description_text = extract_text_from_docx(jobDescription.file)



        else:



            job_description_text = ""







        # Process Resume



        resume_content = await resume.read()



        if resume.content_type == "text/plain":



            resume_text = resume_content.decode("utf-8")



        elif resume.content_type == "application/pdf":



            resume_text = extract_text_from_pdf(resume.file)



        elif resume.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":



            resume_text = extract_text_from_docx(resume.file)



        else:



            resume_text = ""







        # Encrypt and save files



        encrypted_resume = encrypt_file(resume_content)



        encrypted_job_description = encrypt_file(job_description_content)







        upload = Upload(



            user_id=str(current_user["_id"]),



            resume=encrypted_resume,



            job_description=encrypted_job_description,



            filename_resume=resume.filename,



            filename_job_description=jobDescription.filename,



            experience=experience,



            yearsOfExperience=yearsOfExperience,



        )



        upload_id = crud.create_upload(upload)







        return {



            "message": "Files uploaded successfully!",



            "upload_id": upload_id



        }







    except Exception as e:



        raise HTTPException(status_code=500, detail=str(e))











# ===============================



# 📄 Get Job Description



# ===============================



@app.get("/api/job-description")



def get_job_description(current_user: User = Depends(get_current_user)):



    upload = crud.get_latest_upload_by_user_id(str(current_user["_id"]))



    if not upload:



        raise HTTPException(status_code=404, detail="No upload found for the user.")



    



    decrypted_job_description = decrypt_file(upload["job_description"])



    



    job_description_text = decrypted_job_description.decode("utf-8", errors="ignore")







    return {



        "message": "Job description retrieved successfully.",



        "jobDescription": job_description_text



    }











# ===============================



# ❓ Get Generated Questions



# ===============================



@app.get("/api/questions")



def get_questions(current_user: User = Depends(get_current_user)):



    upload = crud.get_latest_upload_by_user_id(str(current_user["_id"]))



    if not upload:



        raise HTTPException(status_code=404, detail="No upload found for the user.")







    if upload.get("generated_questions"):



        return {



            "message": "Questions retrieved successfully.",



            "questions": upload["generated_questions"],



            "count": len(upload["generated_questions"])



        }







    decrypted_resume = decrypt_file(upload["resume"])



    decrypted_job_description = decrypt_file(upload["job_description"])







    resume_text = decrypted_resume.decode("utf-8", errors="ignore")



    job_description_text = decrypted_job_description.decode("utf-8", errors="ignore")







    experience_text = (



        f"The candidate is experienced with {upload['yearsOfExperience']} years of experience."



        if upload['experience'].lower() == "experienced"



        else "The candidate is a fresher."



    )







    prompt = f"""



You are an expert technical interviewer. Your task is to generate a list of 20 interview questions



based on the provided job description, candidate resume, and experience.







Instructions:



1. Analyze the Job Description and Resume carefully.



2. Consider that {experience_text}



3. Tailor the difficulty and type of questions accordingly.



4. Generate realistic, high-quality questions without placeholders.







Job Description:



{job_description_text}







Resume:



{resume_text}



"""







    model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-pro-latest"))



    response = model.generate_content(prompt)



    analysis_text = response.text



    print("===== Analysis Text from Gemini =====")



    print(analysis_text)



    print("=====================================")







    question_regex = re.compile(r"^\s*\d+\.\s*(.*)", re.MULTILINE)



    questions = question_regex.findall(analysis_text)



    print("===== Extracted Questions =====")



    print(questions)



    print("=============================")







    generated_questions = list(set(questions))



    random.shuffle(generated_questions)



    generated_questions = generated_questions[:20]







    crud.update_upload_questions(str(upload["_id"]), generated_questions)







    return {



        "message": "Questions generated and retrieved successfully.",



        "questions": generated_questions,



        "count": len(generated_questions)



    }







# ===============================



# 🎙️ Transcribe Audio



# ===============================



@app.post("/api/transcribe")



async def transcribe_audio(



    audio_file: UploadFile = File(...),



    current_user: User = Depends(get_current_user)



):



    try:



        transcriber = aai.Transcriber()



        transcript = transcriber.transcribe(audio_file.file)







        if transcript.status == aai.TranscriptStatus.error:



            raise HTTPException(status_code=500, detail=transcript.error)







        return {"transcript": transcript.text}



    except Exception as e:



        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")







# ===============================



# 💬 Analyze Candidate Answer (Gemini)



# ===============================



class AnalyzeAnswerPayload(BaseModel):



    question: str



    answer: str







@app.post("/api/analyze-answer")



def analyze_answer(payload: AnalyzeAnswerPayload, current_user: User = Depends(get_current_user)):



    upload = crud.get_latest_upload_by_user_id(str(current_user["_id"]))



    if not upload:



        raise HTTPException(status_code=404, detail="No upload found for the user.")







    decrypted_resume = decrypt_file(upload["resume"])



    decrypted_job_description = decrypt_file(upload["job_description"])







    resume_text = decrypted_resume.decode("utf-8", errors="ignore")



    job_description_text = decrypted_job_description.decode("utf-8", errors="ignore")



    



    try:



        question = payload.question



        answer = payload.answer







        if not question or not answer:



            raise HTTPException(status_code=400, detail="Question and answer are required.")







        prompt = f"""



You are an expert technical interviewer and career coach.



Evaluate the following candidate answer based on the job description and resume.







---







Job Description:



{job_description_text}







Resume Summary:



{resume_text}







Interview Question:



{question}







Transcript of Candidate's Answer:



{answer}



---







Do the following:



1. Score the candidate's answer out of 30 points:



   - Relevance to question and job description (10 pts)



   - Clarity and structure (10 pts)



   - Communication style & confidence (10 pts)



2. Give 3 bullet points of feedback:



   - What was done well



   - What was missing or unclear



   - What could be improved



3. Suggest 1 key improvement area.



4. Final verdict: strong / average / weak.



"""







        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-pro-latest"))



        response = model.generate_content(prompt)



        feedback_text = response.text







        # Store the analysis feedback



        analysis_feedback = AnalysisFeedback(



            user_id=str(current_user["_id"]),



            question=question,



            answer=answer,



            feedback=feedback_text,



        )



        crud.create_analysis_feedback(analysis_feedback)







        return {"feedback": feedback_text}







    except Exception as e:



        raise HTTPException(status_code=500, detail=f"Failed to analyze answer: {str(e)}")























@app.get("/api/feedback")











def get_feedback(current_user: User = Depends(get_current_user)):











    feedback = crud.get_analysis_feedback_by_user_id(str(current_user["_id"]))











    return feedback























# ===============================











# ✉️ Send Feedback via Email











# ===============================



class SendFeedbackPayload(BaseModel):



    email: str







@app.post("/api/send-feedback")



def send_feedback(payload: SendFeedbackPayload, current_user: User = Depends(get_current_user)):



    try:



        email = payload.email



        if not email:



            raise HTTPException(status_code=400, detail="Email is required.")







        feedback = crud.get_analysis_feedback_by_user_id(str(current_user["_id"]))



        if not feedback:



            raise HTTPException(status_code=404, detail="No feedback found for the user.")







        resend.api_key = os.getenv("RESEND_API_KEY")







        html_content = "<h1>Interview Feedback</h1>"



        for item in feedback:



            html_content += f"<h3>Question: {item['question']}</h3>"



            html_content += f"<h4>Answer: {item['answer']}</h4>"



            html_content += f"<div>{item['feedback']}</div>"







        params = {



            "from": "onboarding@resend.dev",



            "to": email,



            "subject": "Interview Feedback",



            "html": html_content,



        }







        resend.Emails.send(params)



        return {"message": "Feedback sent successfully."}







    except Exception as e:



        raise HTTPException(status_code=500, detail=f"Failed to send feedback: {str(e)}")











# ===============================











# 📝 User Feedback











# ===============================



class FeedbackPayload(BaseModel):



    feedback: str







@app.post("/api/feedback")



def submit_feedback(payload: FeedbackPayload, current_user: User = Depends(get_current_user)):



    try:



        feedback = Feedback(



            user_id=str(current_user["_id"]),



            feedback=payload.feedback,



        )



        crud.create_feedback(feedback)



        return {"message": "Feedback submitted successfully."}



    except Exception as e:



        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")