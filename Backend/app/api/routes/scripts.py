import ast
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.agents.code_generator import CodeGeneratorAgent
from app.agents.executor import ExecutorAgent
from app.database.mongodb import get_database
from app.services.storage_service import StorageService

router = APIRouter(prefix="/api", tags=["scripts"])
storage = StorageService()
SCENARIO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


class SaveScriptRequest(BaseModel):
    code: str = Field(min_length=1, max_length=500_000)


class EditScriptRequest(BaseModel):
    code: str = Field(min_length=1, max_length=500_000)
    instruction: str = Field(min_length=1, max_length=8_000)


class ScriptAssistantRequest(BaseModel):
    code: str = Field(min_length=1, max_length=500_000)
    message: str = Field(min_length=1, max_length=8_000)


def validate_ids(execution_id: str, scenario_id: Optional[str] = None) -> None:
    try:
        uuid.UUID(execution_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid execution ID")
    if scenario_id is not None and not SCENARIO_ID_PATTERN.fullmatch(scenario_id):
        raise HTTPException(status_code=400, detail="Invalid scenario ID")


async def get_execution(execution_id: str) -> Dict[str, Any]:
    validate_ids(execution_id)
    execution = await get_database().executions.find_one({"execution_id": execution_id})
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution


def get_scenario(execution: Dict[str, Any], scenario_id: str) -> Dict[str, Any]:
    validate_ids(execution["execution_id"], scenario_id)
    scenario = next(
        (item for item in execution.get("test_scenarios", []) if item.get("scenario_id") == scenario_id),
        None,
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found in this execution")
    return scenario


def read_script(execution_id: str, scenario_id: str) -> str:
    path = storage.get_script_path(execution_id, scenario_id)
    root = os.path.abspath(storage.scripts_path)
    if os.path.commonpath([root, os.path.abspath(path)]) != root:
        raise HTTPException(status_code=400, detail="Invalid script path")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Generated script not found")
    with open(path, "r", encoding="utf-8") as script_file:
        return script_file.read()


@router.get("/executions/{execution_id}/scripts")
async def list_scripts(execution_id: str):
    execution = await get_execution(execution_id)
    scripts = []
    for scenario in execution.get("test_scenarios", []):
        scenario_id = scenario.get("scenario_id", "")
        if SCENARIO_ID_PATTERN.fullmatch(scenario_id):
            path = storage.get_script_path(execution_id, scenario_id)
            if os.path.isfile(path):
                scripts.append({
                    "scenario_id": scenario_id,
                    "scenario_name": scenario.get("scenario_name", scenario_id),
                    "code": read_script(execution_id, scenario_id),
                })
    return {
        "execution_id": execution_id,
        "app_name": execution.get("app_name", "Execution"),
        "ai_model": execution.get("ai_model", "gemini"),
        "scripts": scripts,
    }


@router.put("/executions/{execution_id}/scripts/{scenario_id}")
async def save_script(execution_id: str, scenario_id: str, request: SaveScriptRequest):
    execution = await get_execution(execution_id)
    get_scenario(execution, scenario_id)
    try:
        ast.parse(request.code)
    except SyntaxError as error:
        raise HTTPException(status_code=422, detail=f"Python syntax error on line {error.lineno}: {error.msg}")
    path = storage.save_script(request.code, execution_id, scenario_id)
    await get_database().executions.update_one(
        {"execution_id": execution_id},
        {"$addToSet": {"script_paths": path}, "$set": {"updated_at": datetime.utcnow()}},
    )
    return {"message": "Script saved"}


@router.post("/executions/{execution_id}/scripts/{scenario_id}/ai-edit")
async def ai_edit_script(execution_id: str, scenario_id: str, request: EditScriptRequest):
    execution = await get_execution(execution_id)
    scenario = get_scenario(execution, scenario_id)
    agent = CodeGeneratorAgent(execution.get("ai_model", "gemini"), execution_id)
    try:
        code = await agent.edit_script(request.code, request.instruction.strip(), scenario)
    except SyntaxError as error:
        raise HTTPException(status_code=422, detail=f"AI returned invalid Python: {error.msg}")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"AI code edit failed: {error}")
    return {"code": code}


@router.post("/executions/{execution_id}/scripts/{scenario_id}/assistant")
async def assist_with_script(execution_id: str, scenario_id: str, request: ScriptAssistantRequest):
    execution = await get_execution(execution_id)
    scenario = get_scenario(execution, scenario_id)
    agent = CodeGeneratorAgent(execution.get("ai_model", "gemini"), execution_id)
    try:
        message = request.message.strip()
        intent = await agent.classify_script_message(message)
        if intent == "question":
            answer = await agent.answer_script_question(request.code, message, scenario)
            return {"intent": "answer", "message": answer}

        code = await agent.edit_script(request.code, message, scenario)
        summary = await agent.summarize_script_edit(message, request.code, code)
        return {"intent": "edit", "message": summary, "code": code}
    except SyntaxError as error:
        raise HTTPException(status_code=422, detail=f"AI returned invalid Python: {error.msg}")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Tessa could not process the script request: {error}")


@router.post("/executions/{execution_id}/scripts/{scenario_id}/execute")
async def execute_script(execution_id: str, scenario_id: str):
    execution = await get_execution(execution_id)
    scenario = get_scenario(execution, scenario_id)
    path = storage.get_script_path(execution_id, scenario_id)
    try:
        ast.parse(read_script(execution_id, scenario_id))
    except SyntaxError as error:
        raise HTTPException(status_code=422, detail=f"Python syntax error on line {error.lineno}: {error.msg}")

    screenshot_directory = storage.prepare_scenario_screenshots(execution_id, scenario_id)
    result = await ExecutorAgent(execution.get("ai_model", "gemini"), execution_id).process(
        script_path=path,
        scenario=scenario,
        execution_id=execution_id,
        screenshot_directory=screenshot_directory,
    )
    result.update({"scenario_id": scenario_id, "scenario_name": scenario.get("scenario_name", scenario_id)})
    db = get_database()
    latest = await db.executions.find_one({"execution_id": execution_id})
    results = [item for item in (latest or {}).get("execution_results", []) if item.get("scenario_id") != scenario_id]
    results.append(result)
    overall_result = "PASSED" if all(item.get("result") == "PASSED" for item in results) else "FAILED"
    await db.executions.update_one(
        {"execution_id": execution_id},
        {"$set": {
            "execution_results": results,
            "overall_result": overall_result,
            "status": "completed",
            "updated_at": datetime.utcnow(),
        }},
    )
    return {"result": result, "overall_result": overall_result}


@router.get("/executions/{execution_id}/scenarios/{scenario_id}/screenshots")
async def list_scenario_screenshots(execution_id: str, scenario_id: str):
    execution = await get_execution(execution_id)
    get_scenario(execution, scenario_id)
    screenshot_dir = storage.get_scenario_screenshots_path(execution_id, scenario_id)
    if not os.path.isdir(screenshot_dir):
        return {"screenshots": []}
    filenames = sorted(
        name for name in os.listdir(screenshot_dir)
        if re.fullmatch(r"action_\d{3,}_(?:navigate|click|type|clear|submit)\.png", name)
        and os.path.isfile(os.path.join(screenshot_dir, name))
    )
    return {
        "screenshots": [
            {
                "filename": name,
                "label": name[:-4].replace("_", " ").replace("action ", "Action ").title(),
            }
            for name in filenames
        ]
    }


@router.get("/executions/{execution_id}/scenarios/{scenario_id}/screenshots/{filename}")
async def get_scenario_screenshot(execution_id: str, scenario_id: str, filename: str):
    execution = await get_execution(execution_id)
    get_scenario(execution, scenario_id)
    if not re.fullmatch(r"action_\d{3,}_(?:navigate|click|type|clear|submit)\.png", filename):
        raise HTTPException(status_code=400, detail="Invalid screenshot filename")
    screenshot_dir = os.path.abspath(storage.get_scenario_screenshots_path(execution_id, scenario_id))
    screenshot_path = os.path.abspath(os.path.join(screenshot_dir, filename))
    if os.path.commonpath([screenshot_dir, screenshot_path]) != screenshot_dir or not os.path.isfile(screenshot_path):
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return FileResponse(screenshot_path, media_type="image/png")