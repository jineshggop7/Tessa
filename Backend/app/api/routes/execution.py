from fastapi import APIRouter, HTTPException
import logging
from app.models.schemas import (
    StartExecutionRequest,
    StartExecutionResponse,
    ExecutionHistoryResponse,
    ExecutionHistoryItem,
    RerunExecutionRequest,
    RerunExecutionResponse,
    ExecuteScenariosRequest,
    ExecuteScenariosResponse
)
from app.services.execution_service import ExecutionService

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api", tags=["execution"])
execution_service = ExecutionService()


@router.post("/start-execution", response_model=StartExecutionResponse)
async def start_execution(request: StartExecutionRequest):
    """
    API 1: Start Execution
    Accepts images, custom prompt, app details and starts test execution
    """
    logger.info(f"POST /api/start-execution - App: {request.app_name}, Model: {request.ai_model}")
    logger.debug(f"Request data: images={len(request.image_paths)}, platform={request.app_platform}")
    try:
        execution_id = await execution_service.start_execution(
            image_paths=request.image_paths,
            app_name=request.app_name,
            app_platform=request.app_platform,
            ai_model=request.ai_model,
            custom_prompt=request.custom_prompt,
            app_description=request.app_description
        )
        
        logger.info(f"Execution started successfully: {execution_id}")
        return StartExecutionResponse(
            execution_id=execution_id,
            status="started",
            message="Execution started successfully. Connect to WebSocket for live updates."
        )
    except Exception as e:
        logger.error(f"Error in start_execution endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/execution-history", response_model=ExecutionHistoryResponse)
async def get_execution_history(limit: int = 50, skip: int = 0):
    """
    API 3: Execution History
    Returns list of all executions with summary, result, and observation
    """
    logger.info(f"GET /api/execution-history - limit={limit}, skip={skip}")
    try:
        result = await execution_service.get_execution_history(limit=limit, skip=skip)
        
        # Transform to response model
        executions = [
            ExecutionHistoryItem(**execution)
            for execution in result["executions"]
        ]
        
        logger.info(f"Returning {len(executions)} executions out of {result['total']} total")
        return ExecutionHistoryResponse(
            executions=executions,
            total=result["total"]
        )
    except Exception as e:
        logger.error(f"Error in get_execution_history endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rerun-execution", response_model=RerunExecutionResponse)
async def rerun_execution(request: RerunExecutionRequest):
    """
    API 4: Rerun Execution
    Reruns an execution with existing or updated data
    """
    logger.info(f"POST /api/rerun-execution - Original ID: {request.execution_id}")
    try:
        new_execution_id = await execution_service.rerun_execution(
            execution_id=request.execution_id,
            image_paths=request.image_paths,
            custom_prompt=request.custom_prompt,
            app_description=request.app_description,
            ai_model=request.ai_model
        )
        
        logger.info(f"Rerun execution started: {new_execution_id}")
        return RerunExecutionResponse(
            execution_id=new_execution_id,
            status="started",
            message="Execution rerun started successfully"
        )
    except ValueError as e:
        logger.warning(f"Rerun execution not found: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in rerun_execution endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-scenarios", response_model=ExecuteScenariosResponse)
async def execute_scenarios(request: ExecuteScenariosRequest):
    """
    API 5: Execute Selected Scenarios
    Executes specific test scenarios by their IDs
    """
    logger.info(f"POST /api/execute-scenarios - Execution: {request.execution_id}")
    logger.info(f"Scenarios to execute: {request.scenario_ids}")
    try:
        # Start async execution
        import asyncio
        asyncio.create_task(
            execution_service.execute_scenarios(
                execution_id=request.execution_id,
                scenario_ids=request.scenario_ids
            )
        )
        
        logger.info(f"Scenario execution started for {len(request.scenario_ids)} scenarios")
        return ExecuteScenariosResponse(
            execution_id=request.execution_id,
            status="executing",
            message=f"Started execution of {len(request.scenario_ids)} scenarios",
            scenarios_count=len(request.scenario_ids)
        )
    except ValueError as e:
        logger.warning(f"Execute scenarios error: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in execute_scenarios endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
