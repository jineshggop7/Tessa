import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.database.mongodb import get_database
from app.agents.testcase_generator import TestcaseGeneratorAgent
from app.agents.code_generator import CodeGeneratorAgent
from app.agents.executor import ExecutorAgent
from app.agents.chatbot import ChatbotAgent
from app.services.storage_service import StorageService
from app.utils.websocket_manager import WebSocketManager
import logging

logger = logging.getLogger(__name__)


class ExecutionService:
    """Service for managing test execution workflow"""
    
    def __init__(self):
        self.storage = StorageService()
        self.ws_manager = WebSocketManager()
    
    async def start_execution(
        self,
        image_paths: List[str],
        app_name: str,
        app_platform: str,
        ai_model: str,
        custom_prompt: Optional[str] = None,
        app_description: Optional[str] = None
    ) -> str:
        """Start a new execution workflow"""
        
        # Generate execution ID
        execution_id = str(uuid.uuid4())
        logger.info(f"[{execution_id}] Starting new execution")
        logger.info(f"[{execution_id}] App: {app_name}, Platform: {app_platform}, Model: {ai_model}")
        logger.info(f"[{execution_id}] Images count: {len(image_paths)}")
        
        try:
            # Copy images to storage
            logger.debug(f"[{execution_id}] Copying images to storage")
            stored_image_paths = self.storage.copy_images(image_paths, execution_id)
            logger.info(f"[{execution_id}] Images stored: {len(stored_image_paths)}")
        
            # Create initial database entry
            logger.debug(f"[{execution_id}] Creating database entry")
            db = get_database()
            execution_doc = {
                "execution_id": execution_id,
                "app_name": app_name,
                "app_description": app_description,
                "app_platform": app_platform,
                "ai_model": ai_model,
                "custom_prompt": custom_prompt,
                "image_paths": stored_image_paths,
                "script_paths": [],
                "test_scenarios": [],
                "execution_results": [],
                "status": "running",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.executions.insert_one(execution_doc)
            logger.info(f"[{execution_id}] Database entry created")
        
            # Send initial WebSocket message
            await self.ws_manager.send_message(execution_id, {
                "type": "status",
                "data": {
                    "status": "started",
                    "message": "Execution started successfully",
                    "execution_id": execution_id
                }
            })
            
            # Run the execution workflow in the background
            logger.info(f"[{execution_id}] Starting background execution workflow")
            import asyncio
            asyncio.create_task(
                self._run_execution_workflow(
                    execution_id=execution_id,
                    image_paths=stored_image_paths,
                    app_name=app_name,
                    app_description=app_description,
                    app_platform=app_platform,
                    ai_model=ai_model,
                    custom_prompt=custom_prompt
                )
            )
            
            return execution_id
        except Exception as e:
            logger.error(f"[{execution_id}] Error in start_execution: {str(e)}")
            raise
    
    async def _run_execution_workflow(
        self,
        execution_id: str,
        image_paths: List[str],
        app_name: str,
        app_platform: str,
        ai_model: str,
        app_description: Optional[str],
        custom_prompt: Optional[str]
    ):
        """Run test scenario generation workflow (Phase 1)"""
        
        logger.info(f"[{execution_id}] === TESTCASE GENERATION WORKFLOW STARTED ===")
        db = get_database()
        
        try:
            # Agent 1: Generate test scenarios
            await self.ws_manager.send_message(execution_id, {
                "type": "progress",
                "data": {
                    "stage": "testcase_generation",
                    "message": "Generating test scenarios..."
                }
            })
            
            agent1 = TestcaseGeneratorAgent(ai_model, execution_id)
            test_scenarios = await agent1.process(
                image_paths=image_paths,
                app_name=app_name,
                app_description=app_description or "",
                app_platform=app_platform,
                custom_prompt=custom_prompt
            )
            
            # Update database with scenarios and set status to scenarios_ready
            await db.executions.update_one(
                {"execution_id": execution_id},
                {"$set": {
                    "test_scenarios": test_scenarios,
                    "status": "scenarios_ready",
                    "updated_at": datetime.utcnow()
                }}
            )
            
            logger.info(f"[{execution_id}] Test scenarios generated successfully. Waiting for user selection.")
            
            await self.ws_manager.send_message(execution_id, {
                "type": "scenarios_ready",
                "data": {
                    "stage": "testcase_generation",
                    "message": f"Generated {len(test_scenarios)} test scenarios. Please select scenarios to execute.",
                    "scenarios": test_scenarios,
                    "status": "scenarios_ready"
                }
            })
            
        except Exception as e:
            logger.error(f"[{execution_id}] Error in testcase generation: {str(e)}")
            # Update error status
            await db.executions.update_one(
                {"execution_id": execution_id},
                {"$set": {
                    "status": "failed",
                    "summary": f"Test scenario generation failed: {str(e)}",
                    "updated_at": datetime.utcnow()
                }}
            )
            
            await self.ws_manager.send_message(execution_id, {
                "type": "error",
                "data": {
                    "status": "failed",
                    "message": f"Test scenario generation failed: {str(e)}"
                }
            })
    
    async def execute_scenarios(
        self,
        execution_id: str,
        scenario_ids: List[str]
    ):
        """Execute selected test scenarios (Phase 2)"""
        
        logger.info(f"[{execution_id}] === SCENARIO EXECUTION STARTED ===")
        logger.info(f"[{execution_id}] Executing scenarios: {scenario_ids}")
        
        db = get_database()
        
        try:
            # Get execution details
            execution = await db.executions.find_one({"execution_id": execution_id})
            if not execution:
                raise ValueError(f"Execution {execution_id} not found")
            
            test_scenarios = execution.get("test_scenarios", [])
            app_platform = execution.get("app_platform", "web")
            ai_model = execution.get("ai_model", "gemini")
            
            # Filter selected scenarios
            selected_scenarios = [
                scenario for scenario in test_scenarios
                if scenario.get("scenario_id") in scenario_ids
            ]
            
            if not selected_scenarios:
                raise ValueError("No valid scenarios found to execute")
            
            logger.info(f"[{execution_id}] Found {len(selected_scenarios)} scenarios to execute")
            
            # Update status to executing
            await db.executions.update_one(
                {"execution_id": execution_id},
                {"$set": {
                    "status": "executing",
                    "updated_at": datetime.utcnow()
                }}
            )
            
            await self.ws_manager.send_message(execution_id, {
                "type": "status",
                "data": {
                    "status": "executing",
                    "message": f"Starting execution of {len(selected_scenarios)} scenarios"
                }
            })
            
            # Get existing script paths and results
            existing_scripts = execution.get("script_paths", [])
            existing_results = execution.get("execution_results", [])
            
            # Create dictionaries for quick lookup
            script_path_map = {}
            result_map = {r.get("scenario_id"): r for r in existing_results}
            
            for idx, scenario in enumerate(selected_scenarios, 1):
                scenario_id = scenario.get("scenario_id", f"TC{idx:03d}")
                scenario_name = scenario.get("scenario_name", f"Test Scenario {idx}")
                
                logger.info(f"[{execution_id}] Processing scenario {idx}/{len(selected_scenarios)}: {scenario_id}")
                
                # Agent 2: Generate code
                await self.ws_manager.send_message(execution_id, {
                    "type": "scenario_progress",
                    "data": {
                        "stage": "code_generation",
                        "message": f"Generating code for {scenario_name}",
                        "scenario_id": scenario_id,
                        "progress": f"{idx}/{len(selected_scenarios)}"
                    }
                })
                
                agent2 = CodeGeneratorAgent(ai_model, execution_id)
                code = await agent2.process(
                    test_scenario=scenario,
                    app_platform=app_platform
                )
                
                # Save script
                script_path = self.storage.save_script(code, execution_id, scenario_id)
                script_path_map[scenario_id] = script_path
                
                await self.ws_manager.send_message(execution_id, {
                    "type": "scenario_log",
                    "data": {
                        "stage": "code_generation",
                        "message": f"✓ Code generated for {scenario_id}",
                        "scenario_id": scenario_id,
                        "script_path": script_path
                    }
                })
                
                # Agent 3: Execute code
                await self.ws_manager.send_message(execution_id, {
                    "type": "scenario_progress",
                    "data": {
                        "stage": "execution",
                        "message": f"Executing {scenario_name}...",
                        "scenario_id": scenario_id,
                        "progress": f"{idx}/{len(selected_scenarios)}"
                    }
                })
                
                # Send live execution start
                await self.ws_manager.send_message(execution_id, {
                    "type": "scenario_log",
                    "data": {
                        "stage": "execution",
                        "message": f"► Starting execution for {scenario_id}",
                        "scenario_id": scenario_id,
                        "log_type": "execution_start"
                    }
                })
                
                agent3 = ExecutorAgent(ai_model, execution_id)
                result = await agent3.process(
                    script_path=script_path,
                    scenario=scenario,
                    ws_manager=self.ws_manager,
                    execution_id=execution_id
                )
                
                result["scenario_id"] = scenario_id
                result["scenario_name"] = scenario_name
                result_map[scenario_id] = result
                
                # Send execution complete with result
                result_status = result.get("result", "UNKNOWN")
                result_icon = "✓" if result_status == "PASSED" else "✗"
                
                await self.ws_manager.send_message(execution_id, {
                    "type": "scenario_result",
                    "data": {
                        "stage": "execution",
                        "message": f"{result_icon} Scenario {scenario_id} {result_status}",
                        "scenario_id": scenario_id,
                        "result": result,
                        "status": result_status
                    }
                })
            
            # Generate overall summary
            all_results = list(result_map.values())
            passed = sum(1 for r in all_results if r.get("result") == "PASSED")
            failed = len(all_results) - passed
            overall_result = "PASSED" if failed == 0 else "FAILED"
            overall_summary = f"Execution completed: {passed} passed, {failed} failed out of {len(all_results)} scenarios"
            
            # Merge all script paths
            all_script_paths = list(set(existing_scripts + list(script_path_map.values())))
            
            # Update final status
            await db.executions.update_one(
                {"execution_id": execution_id},
                {"$set": {
                    "script_paths": all_script_paths,
                    "execution_results": all_results,
                    "summary": overall_summary,
                    "overall_result": overall_result,
                    "status": "completed",
                    "updated_at": datetime.utcnow()
                }}
            )
            
            logger.info(f"[{execution_id}] Execution completed: {overall_summary}")
            
            await self.ws_manager.send_message(execution_id, {
                "type": "status",
                "data": {
                    "status": "completed",
                    "message": "Execution completed successfully",
                    "summary": overall_summary,
                    "overall_result": overall_result
                }
            })
            
        except Exception as e:
            logger.error(f"[{execution_id}] Error in scenario execution: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Update error status
            await db.executions.update_one(
                {"execution_id": execution_id},
                {"$set": {
                    "status": "failed",
                    "summary": f"Execution failed: {str(e)}",
                    "updated_at": datetime.utcnow()
                }}
            )
            
            await self.ws_manager.send_message(execution_id, {
                "type": "error",
                "data": {
                    "status": "failed",
                    "message": f"Execution failed: {str(e)}"
                }
            })
    
    async def get_execution_history(
        self,
        limit: int = 50,
        skip: int = 0
    ) -> Dict[str, Any]:
        """Get execution history from database"""
        
        logger.info(f"Fetching execution history (limit: {limit}, skip: {skip})")
        try:
            db = get_database()
            
            cursor = db.executions.find().sort("created_at", -1).skip(skip).limit(limit)
            executions = await cursor.to_list(length=limit)
            
            total = await db.executions.count_documents({})
            logger.info(f"Retrieved {len(executions)} executions, total: {total}")
            
            # Convert ObjectId and datetime to string
            for execution in executions:
                if "_id" in execution:
                    execution["id"] = str(execution["_id"])
                    del execution["_id"]
                # Convert datetime objects to ISO format strings
                if "created_at" in execution and execution["created_at"]:
                    execution["created_at"] = execution["created_at"].isoformat()
                if "updated_at" in execution and execution["updated_at"]:
                    execution["updated_at"] = execution["updated_at"].isoformat()
            
            return {
                "executions": executions,
                "total": total
            }
        except Exception as e:
            print(f"Error in get_execution_history: {str(e)}")
            return {
                "executions": [],
                "total": 0
            }
    
    async def rerun_execution(
        self,
        execution_id: str,
        image_paths: Optional[List[str]] = None,
        custom_prompt: Optional[str] = None,
        app_description: Optional[str] = None,
        ai_model: Optional[str] = None
    ) -> str:
        """Rerun an execution with optional updates"""
        
        logger.info(f"Rerunning execution: {execution_id}")
        db = get_database()
        
        # Get original execution
        original = await db.executions.find_one({"execution_id": execution_id})
        
        if not original:
            logger.error(f"Execution {execution_id} not found")
            raise ValueError(f"Execution {execution_id} not found")
        
        logger.info(f"Original execution found: {original.get('app_name')}")
        
        # Use original values if not provided
        new_image_paths = image_paths if image_paths else original.get("image_paths", [])
        new_custom_prompt = custom_prompt if custom_prompt is not None else original.get("custom_prompt")
        new_app_description = app_description if app_description is not None else original.get("app_description")
        new_ai_model = ai_model if ai_model else original.get("ai_model")
        
        # Start new execution
        new_execution_id = await self.start_execution(
            image_paths=new_image_paths,
            app_name=original.get("app_name"),
            app_platform=original.get("app_platform"),
            ai_model=new_ai_model,
            custom_prompt=new_custom_prompt,
            app_description=new_app_description
        )
        
        return new_execution_id
