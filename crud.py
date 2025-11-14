from database import (
    get_user_collection,
    get_upload_collection,
    get_feedback_collection,
    get_analysis_feedback_collection,
    User,
    Upload,
    Feedback,
    AnalysisFeedback
)
from bson import ObjectId
from typing import List

# User CRUD
def create_user(user: User):
    user_collection = get_user_collection()
    print(f"DEBUG: Using user_collection: {user_collection.name}")
    user_dict = user.dict(exclude={'id'})
    print(f"DEBUG: Inserting user_dict: {user_dict}")
    result = user_collection.insert_one(user_dict)
    print(f"DEBUG: Inserted user with id: {result.inserted_id}")
    return str(result.inserted_id)

def get_user_by_username(username: str):
    user_collection = get_user_collection()
    return user_collection.find_one({"username": username})

def get_user_by_email(email: str):
    user_collection = get_user_collection()
    return user_collection.find_one({"email": email})

# Upload CRUD
def create_upload(upload: Upload):
    upload_collection = get_upload_collection()
    print(f"DEBUG: Using upload_collection: {upload_collection.name}")
    upload_dict = upload.dict(exclude={'id'})
    print(f"DEBUG: Inserting upload_dict: {upload_dict}")
    result = upload_collection.insert_one(upload_dict)
    print(f"DEBUG: Inserted upload with id: {result.inserted_id}")
    return str(result.inserted_id)

def get_latest_upload_by_user_id(user_id: str):
    upload_collection = get_upload_collection()
    return upload_collection.find_one({"user_id": user_id}, sort=[("_id", -1)])

def update_upload_questions(upload_id: str, questions: List[str]):
    upload_collection = get_upload_collection()
    upload_collection.update_one({"_id": ObjectId(upload_id)}, {"$set": {"generated_questions": questions}})

# Feedback CRUD
def create_feedback(feedback: Feedback):
    feedback_collection = get_feedback_collection()
    print(f"DEBUG: Using feedback_collection: {feedback_collection.name}")
    feedback_dict = feedback.dict(exclude={'id'})
    print(f"DEBUG: Inserting feedback_dict: {feedback_dict}")
    result = feedback_collection.insert_one(feedback_dict)
    print(f"DEBUG: Inserted feedback with id: {result.inserted_id}")
    return str(result.inserted_id)

# Analysis Feedback CRUD
def create_analysis_feedback(feedback: AnalysisFeedback):
    feedback_collection = get_analysis_feedback_collection()
    feedback_dict = feedback.dict(exclude={'id'})
    result = feedback_collection.insert_one(feedback_dict)
    return str(result.inserted_id)

def get_analysis_feedback_by_user_id(user_id: str):
    feedback_collection = get_analysis_feedback_collection()
    return list(feedback_collection.find({"user_id": user_id}))
