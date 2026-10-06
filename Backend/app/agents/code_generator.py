from app.agents.base_agent import BaseAgent
from typing import Dict, Any
import ast
import logging
import time
import re
import json

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

    async def edit_script(self, code: str, instruction: str, scenario: Dict[str, Any]) -> str:
        """Use the configured model to revise a Selenium script and verify its syntax."""
        prompt = f"""
You are Tessa, an expert Selenium automation engineer. Apply the user's requested change to the supplied Python script.

Scenario:
{json.dumps(scenario, ensure_ascii=True, indent=2)}

User instruction:
{instruction}

Return the complete updated Python script only. Preserve existing behavior and scenario steps unless asked to change them.
Keep Chrome visible and do not add a --headless argument. Return valid executable Python without Markdown fences.

Current script:
{code}
"""
        updated_code = self._prepare_code(await self.ai_model.generate(prompt=prompt))
        ast.parse(updated_code)
        return updated_code

    async def classify_script_message(self, message: str) -> str:
        """Distinguish a question about the script from a request to change it."""
        prompt = f"""
Classify the user's message as exactly one label:
EDIT means the user asks to change, fix, add, remove, or otherwise modify the script.
QUESTION means the user asks for an explanation, opinion, or clarification without requesting a change.
Return only EDIT or QUESTION.

User message: {message}
"""
        response = (await self.ai_model.generate(prompt=prompt)).strip().upper()
        if response.startswith("EDIT"):
            return "edit"
        if response.startswith("QUESTION"):
            return "question"
        return "edit" if re.search(
            r"\b(add|change|modify|edit|update|fix|remove|delete|replace|implement|refactor|rewrite)\b",
            message,
            re.IGNORECASE,
        ) else "question"

    async def answer_script_question(
        self,
        code: str,
        question: str,
        scenario: Dict[str, Any]
    ) -> str:
        prompt = f"""
You are Tessa, a conversational Selenium code assistant. Answer the user's question using this scenario
and the current script. Explain code, Selenium behavior, failures, tradeoffs, or next steps as relevant.
Do not modify or rewrite the script. Be clear and concise; state when the answer is not in the supplied context.

Scenario:
{json.dumps(scenario, ensure_ascii=True, indent=2)}

Current Python script:
{code}

User question:
{question}
"""
        return (await self.ai_model.generate(prompt=prompt)).strip()

    async def summarize_script_edit(
        self,
        instruction: str,
        original_code: str,
        updated_code: str
    ) -> str:
        prompt = f"""
Summarize the actual changes in this Selenium script in 1-3 concise sentences. Mention the requested
change and important behavior affected. Do not claim changes that are absent from the updated script.

Request: {instruction}

Original script:
{original_code}

Updated script:
{updated_code}
"""
        try:
            return (await self.ai_model.generate(prompt=prompt)).strip()
        except Exception:
            return "The requested code changes are ready for review in the proposal below."
