from fastapi import APIRouter, HTTPException
import logging
from app.models.schemas import AskTessaRequest, AskTessaResponse
from app.agents.chatbot import ChatbotAgent
from datetime import datetime

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api", tags=["chatbot"])


@router.post("/ask-tessa", response_model=AskTessaResponse)
async def ask_tessa(request: AskTessaRequest):
    """
    API 2: Ask Tessa
    Chatbot endpoint - Tessa is aware of all execution details
    """
    logger.info(f"POST /api/ask-tessa - Execution: {request.execution_id}, Model: {request.ai_model}")
    logger.debug(f"User message: {request.message[:100]}...")  # Log first 100 chars
    try:
        # Initialize chatbot agent with user's selected model
        tessa = ChatbotAgent(
            model_type=request.ai_model,
            execution_id=request.execution_id
        )
        
        # Process the user's message
        response = await tessa.process(
            user_message=request.message
        )
        
        logger.info(f"Tessa response generated for execution: {request.execution_id}")
        return AskTessaResponse(
            response=response,
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        logger.error(f"Error in ask_tessa endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
