from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class StartExecutionRequest(BaseModel):
    image_paths: List[str]  # Now contains base64 encoded image data
    custom_prompt: Optional[str] = None
    app_description: Optional[str] = None
    app_name: str
    app_platform: str = "web"
    ai_model: str  # gemini, gpt, etc.


class StartExecutionResponse(BaseModel):
    execution_id: str
    status: str
    message: str


class AskTessaRequest(BaseModel):
    execution_id: str
    message: str
    ai_model: str


class AskTessaResponse(BaseModel):
    response: str
    timestamp: datetime


class ExecutionHistoryItem(BaseModel):
    id: str
    execution_id: str
    app_name: str
    app_description: Optional[str] = None
    app_platform: str
    ai_model: str
    custom_prompt: Optional[str] = None
    image_paths: List[str] = []
    script_paths: List[str] = []
    summary: Optional[str] = None
    overall_result: Optional[str] = None
    observation: Optional[str] = None
    created_at: str
    status: str = "pending"
    test_scenarios: List[Dict[str, Any]] = []
    execution_results: List[Dict[str, Any]] = []
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class ExecutionHistoryResponse(BaseModel):
    executions: List[ExecutionHistoryItem]
    total: int


class RerunExecutionRequest(BaseModel):
    execution_id: str
    image_paths: Optional[List[str]] = None
    custom_prompt: Optional[str] = None
    app_description: Optional[str] = None
    ai_model: Optional[str] = None


class RerunExecutionResponse(BaseModel):
    execution_id: str
    status: str
    message: str


class WebSocketMessage(BaseModel):
    type: str  # status, log, error, progress, result
    execution_id: str
    data: Dict[str, Any]
    timestamp: datetime = datetime.utcnow()


class ExecuteScenariosRequest(BaseModel):
    execution_id: str
    scenario_ids: List[str]


class ExecuteScenariosResponse(BaseModel):
    execution_id: str
    status: str
    message: str
    scenarios_count: int
