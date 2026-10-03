from app.agents.base_agent import BaseAgent
from typing import Dict, Any
import ast
import logging
import time
import re

logger = logging.getLogger(__name__)


class CodeGeneratorAgent(BaseAgent):
    """Agent 2: Generates Selenium Python code for test scenarios"""
    
    def __init__(self, model_type: str, execution_id: str):
        super().__init__(model_type, execution_id)
        
    async def process(
        self,
        test_scenario: Dict[str, Any],
        app_platform: str = "web",
        custom_prompt: str = None
    ) -> str:
        """
        Generate Selenium Python code for a test scenario
        Returns: Python code as string
        """
        
        scenario_name = test_scenario.get("scenario_name", "Test Scenario")
        scenario_id = test_scenario.get("scenario_id", "TC001")
        test_steps = test_scenario.get("test_steps", [])
        
        logger.info(f"[{self.execution_id}] CodeGeneratorAgent processing scenario: {scenario_id}")
        logger.info(f"[{self.execution_id}] Scenario name: {scenario_name}")
        logger.debug(f"[{self.execution_id}] Number of test steps: {len(test_steps)}")
        
        steps_description = "\n".join(
            f"{step.get('step_number', index)}. {step.get('action', '')} - Expected: {step.get('expected_result', '')}"
            for index, step in enumerate(test_steps, start=1)
        )
        
        prompt = f"""
Write one complete, executable Python 3 Selenium script for this web test.

Scenario ID: {scenario_id}
Scenario Name: {scenario_name}
Platform: {app_platform}

User custom instructions (apply to the test behavior and scenario, not the runtime requirements):
{custom_prompt or 'No additional instructions provided.'}

Test Steps:
{steps_description}

Requirements:
- Execute every listed step in order; do not invent steps, URLs, or selectors unsupported by the scenario.
- Use Chrome in visible mode. Never add a --headless argument.
- Use Selenium explicit waits (WebDriverWait) rather than fixed sleeps for synchronization.
- Use valid Selenium locators; do not use unsupported CSS such as :contains().
- Log each step and verify its expected result with a meaningful assertion or explicit check.
- Keep the browser open for 5 seconds after the test, then always close it in a finally block.
- Include all imports and a main entry point. Return only Python source code, without Markdown fences or explanation.
"""
        
        try:
            logger.info(f"[{self.execution_id}] Generating optimized code with AI model: {self.model_type}")
            start_time = time.time()
            
            code = await self.ai_model.generate(prompt=prompt)
            
            generation_time = time.time() - start_time
            self.record_performance_metric("code_generation_time", f"{generation_time:.2f}s")
            
            logger.debug(f"[{self.execution_id}] Code generated in {generation_time:.2f}s, length: {len(code)} characters")
            
            code = self._prepare_code(code)
            try:
                ast.parse(code)
            except SyntaxError as syntax_error:
                logger.warning(
                    f"[{self.execution_id}] Generated script has invalid syntax at line "
                    f"{syntax_error.lineno}; requesting one repair"
                )
                repair_prompt = f"""
Repair the Python syntax in the script below. Preserve its Selenium test behavior and all test steps.
The browser must remain visible; do not add --headless. Return only complete Python source code.

Syntax error: {syntax_error.msg} at line {syntax_error.lineno}

Script:
{code}
"""
                repaired_code = await self.ai_model.generate(prompt=repair_prompt)
                code = self._prepare_code(repaired_code)
                ast.parse(code)

            logger.info(f"[{self.execution_id}] Code generation completed with valid Python syntax")
            return code
            
        except Exception as e:
            logger.error(f"[{self.execution_id}] CodeGeneratorAgent error: {str(e)}")
            raise Exception(f"CodeGeneratorAgent error: {str(e)}")
    
    def _prepare_code(self, code: str) -> str:
        """Remove response wrappers and force generated Chrome options to stay visible."""
        code = code.strip()
        if code.startswith("```python"):
            code = code[9:]
        elif code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]

        code = re.sub(
            r"(?m)^[ \t]*[\w.]+\.add_argument\(\s*(['\"])--headless(?:=[^'\"]*)?\1\s*\)\s*(?:#.*)?\r?\n?",
            "",
            code,
        )
        return code.strip()
