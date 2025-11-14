import os
from pymongo import MongoClient
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional, List
from dotenv import load_dotenv

from pymongo.errors import ConnectionFailure
from pymongo import uri_parser

# It is recommended to use environment variables for sensitive data like database credentials.
# Replace the following with your MongoDB connection string.
# The connection string should be in the format: mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable not set. Please create a .env file and add your MongoDB connection string.")

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # The ismaster command is cheap and does not require auth.
    client.admin.command('ismaster')
    print("MongoDB connected successfully!")
    db_name = uri_parser.parse_uri(MONGO_URI)['database']
    db = client[db_name]
except ConnectionFailure:
    raise ConnectionFailure("Could not connect to MongoDB. Please check your MONGO_URI.")

# Helper to convert ObjectId to string
def PyObjectId(v: any) -> ObjectId:
    if isinstance(v, str):
        return ObjectId(v)
    return v

class User(BaseModel):
    id: Optional[str] = Field(alias='_id', default=None)
    username: str
    email: str
    password: str

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Upload(BaseModel):
    id: Optional[str] = Field(alias='_id', default=None)
    user_id: str
    resume: bytes
    job_description: bytes
    filename_resume: str
    filename_job_description: str
    experience: str
    yearsOfExperience: Optional[str] = None
    generated_questions: Optional[List[str]] = None

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Feedback(BaseModel):
    id: Optional[str] = Field(alias='_id', default=None)
    user_id: str
    feedback: str

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class AnalysisFeedback(BaseModel):
    id: Optional[str] = Field(alias='_id', default=None)
    user_id: str
    question: str
    answer: str
    feedback: str

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

def get_user_collection():
    return db.get_collection("users")

def get_upload_collection():
    return db.get_collection("uploads")

def get_feedback_collection():
    return db.get_collection("feedback")

def get_analysis_feedback_collection():
    return db.get_collection("analysis_feedback")
