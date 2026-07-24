from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")


class ExecutionDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    execution_id: str
    app_name: str
    app_description: Optional[str] = None
    app_platform: str
    ai_model: str
    custom_prompt: Optional[str] = None
    image_paths: List[str]
    script_paths: List[str] = []
    test_scenarios: List[Dict[str, Any]] = []
    execution_results: List[Dict[str, Any]] = []
    summary: Optional[str] = None
    overall_result: Optional[str] = None
    observation: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"  # pending, running, completed, failed
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        populate_by_name = True


class ChatMessage(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    execution_id: str
    role: str  # user, assistant
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        populate_by_name = True
