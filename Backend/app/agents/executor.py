from app.agents.base_agent import BaseAgent
from typing import Dict, Any
import subprocess
import sys
import traceback
import os
import logging
import asyncio

logger = logging.getLogger(__name__)


class ExecutorAgent(BaseAgent):
    """Agent 3: Executes test scripts and generates AI summary"""
    
    def __init__(self, model_type: str, execution_id: str):
        super().__init__(model_type, execution_id)
        
    async def process(
        self,
        script_path: str,
        scenario: Dict[str, Any],
        ws_manager = None,
        execution_id: str = None
    ) -> Dict[str, Any]:
        """
        Execute test script and generate AI summary
        Returns: Dict with summary, result, and observation
        """
        
        scenario_name = scenario.get("scenario_name", "Test Scenario")
        scenario_id = scenario.get("scenario_id", "TC001")
        
        logger.info(f"[{self.execution_id}] ExecutorAgent executing scenario: {scenario_id}")
        logger.info(f"[{self.execution_id}] Script path: {script_path}")
        
        # Execute the script with real-time logging
        execution_output = await self._execute_script_with_streaming(
            script_path, 
            scenario_id, 
            ws_manager, 
            execution_id or self.execution_id
        )
        
        # Generate AI summary
        summary_result = await self._generate_summary(
            scenario_name=scenario_name,
            scenario_id=scenario_id,
            execution_output=execution_output
        )
        
        return summary_result
    
    async def _execute_script_with_streaming(
        self, 
        script_path: str, 
        scenario_id: str,
        ws_manager,
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute script and stream output in real-time"""
        try:
            logger.info(f"[{execution_id}] Starting async script execution with streaming: {script_path}")
            
            # Use asyncio subprocess for non-blocking execution
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout_lines = []
            stderr_lines = []
            
            async def read_stream(stream, lines_list, stream_name):
                """Read stream line by line and send to WebSocket"""
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    
                    decoded_line = line.decode('utf-8', errors='replace').rstrip()
                    lines_list.append(decoded_line)
                    
                    # Send to WebSocket if available
                    if ws_manager and decoded_line.strip():
                        try:
                            await ws_manager.send_message(execution_id, {
                                "type": "scenario_log",
                                "data": {
                                    "scenario_id": scenario_id,
                                    "message": decoded_line,
                                    "stream": stream_name
                                }
                            })
                        except Exception as e:
                            logger.debug(f"Could not send WS message: {e}")
            
            # Read both streams concurrently
            await asyncio.gather(
                read_stream(process.stdout, stdout_lines, "stdout"),
                read_stream(process.stderr, stderr_lines, "stderr")
            )
            
            # Wait for process to complete
            returncode = await process.wait()
            
            stdout = '\n'.join(stdout_lines)
            stderr = '\n'.join(stderr_lines)
            
            logger.info(f"[{execution_id}] Script execution completed with return code: {returncode}")
            
            return {
                "success": returncode == 0,
                "stdout": stdout,
                "stderr": stderr,
                "returncode": returncode
            }
            
        except Exception as e:
            logger.error(f"[{execution_id}] Script execution error: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Execution error: {str(e)}\n{traceback.format_exc()}",
                "returncode": -1
            }
    
    async def _execute_script(self, script_path: str) -> Dict[str, Any]:
        """Execute the Python script asynchronously and capture output"""
        try:
            logger.info(f"[{self.execution_id}] Starting async script execution: {script_path}")
            
            # Use asyncio subprocess for non-blocking execution
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Wait for completion with timeout (5 minutes)
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(),
                    timeout=300
                )
                
                stdout = stdout_bytes.decode('utf-8', errors='replace')
                stderr = stderr_bytes.decode('utf-8', errors='replace')
                returncode = process.returncode
                
            except asyncio.TimeoutError:
                logger.error(f"[{self.execution_id}] Script execution timed out after 5 minutes")
                process.kill()
                await process.wait()
                return {
                    "success": False,
                    "stdout": "",
                    "stderr": "Script execution timed out after 5 minutes",
                    "returncode": -1
                }
            
            logger.info(f"[{self.execution_id}] Script execution completed with return code: {returncode}")
            if stdout:
                logger.debug(f"[{self.execution_id}] STDOUT: {stdout[:500]}...")  # Log first 500 chars
            if stderr:
                logger.warning(f"[{self.execution_id}] STDERR: {stderr[:500]}...")  # Log first 500 chars
            
            return {
                "success": returncode == 0,
                "stdout": stdout,
                "stderr": stderr,
                "returncode": returncode
            }
            
        except Exception as e:
            logger.error(f"[{self.execution_id}] Script execution error: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Execution error: {str(e)}\n{traceback.format_exc()}",
                "returncode": -1
            }
    
    async def _generate_summary(
        self,
        scenario_name: str,
        scenario_id: str,
        execution_output: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate AI-powered summary of execution"""
        
        prompt = f"""
Analyze the following Selenium test execution results and provide a comprehensive, actionable summary.

Test Scenario: {scenario_name} ({scenario_id})

Execution Output:
- Success: {execution_output['success']}
- Return Code: {execution_output['returncode']}

Standard Output (Logs):
{execution_output['stdout']}

Standard Error (Errors):
{execution_output['stderr']}

Provide a detailed JSON response analyzing:

1. **summary**: Brief overview of execution (2-3 sentences) - what happened, which steps passed/failed
2. **result**: One of: "PASSED" (all assertions passed), "FAILED" (test logic failed), "ERROR" (script error/crash)
3. **observation**: Comprehensive analysis including:
   - Root cause of failure (if applicable)
   - Which specific step or element caused the issue
   - Common Selenium issues detected (timeout, stale element, element not clickable, etc.)
   - Specific actionable recommendations to fix the issue
   - Suggested code improvements (increase timeout, use better locators, add retries, etc.)

Common Selenium Error Patterns to Look For:
- TimeoutException → Element not found in time, suggest increasing timeout or checking locator
- ElementNotInteractableException → Element hidden/covered, suggest scrolling or waiting longer
- ElementClickInterceptedException → Element covered by overlay, suggest handling popups/overlays first
- StaleElementReferenceException → DOM changed, suggest re-finding element
- NoSuchElementException → Wrong locator, suggest verifying element exists and using multiple locator strategies
- WebDriverException → Browser/driver issue, suggest checking compatibility

Return ONLY valid JSON, no markdown, no additional text.

Example format:
{{
  "summary": "The test scenario YT_SEARCH_001 failed during step 3 when attempting to click the search button. Steps 1-2 completed successfully.",
  "result": "FAILED",
  "observation": "Root Cause: TimeoutException while waiting for search button to be clickable. The test waited 10 seconds but the element was not ready. Recommendations: 1) Increase explicit wait timeout from 10s to 30s. 2) Use multiple locator strategies (try ID, then CSS, then XPath). 3) Add retry mechanism for clicking. 4) Verify the search button locator is correct and stable. 5) Check if YouTube has dynamic content or overlays that block the button."
}}
"""
        
        try:
            response = await self.ai_model.generate(prompt=prompt)
            
            # Clean up the response
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            elif response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            import json
            summary_data = json.loads(response_text.strip())
            
            # Add execution details
            summary_data["execution_details"] = execution_output
            
            return summary_data
            
        except Exception as e:
            # Fallback summary
            return {
                "summary": f"Test execution {'succeeded' if execution_output['success'] else 'failed'}",
                "result": "PASSED" if execution_output['success'] else "FAILED",
                "observation": f"Execution completed with return code {execution_output['returncode']}",
                "execution_details": execution_output
            }
