from app.agents.base_agent import BaseAgent
from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)


class TestcaseGeneratorAgent(BaseAgent):
    """Agent 1: Generates test scenarios and test steps"""
    
    def __init__(self, model_type: str, execution_id: str):
        super().__init__(model_type, execution_id)
        
    async def process(
        self,
        image_paths: List[str],
        app_name: str,
        app_description: str,
        app_platform: str,
        custom_prompt: str = None
    ) -> List[Dict[str, Any]]:
        """
        Generate test scenarios based on input data
        Returns: List of test scenarios with steps
        """
        logger.info(f"[{self.execution_id}] TestcaseGeneratorAgent started")
        logger.info(f"[{self.execution_id}] App: {app_name}, Platform: {app_platform}")
        logger.info(f"[{self.execution_id}] Processing {len(image_paths)} images")
        logger.debug(f"[{self.execution_id}] Image paths: {image_paths}")
        
        base_prompt = f"""
You are an expert test automation engineer. Analyze the provided application screenshots and generate comprehensive test scenarios.

Application Details:
- Name: {app_name}
- Platform: {app_platform}
- Description: {app_description or 'Not provided'}

User's custom instructions for scenario coverage and ordering:
{custom_prompt or 'No additional instructions provided.'}

Based on the screenshots, generate detailed test scenarios in JSON format. Each scenario should include:
1. scenario_id: Unique identifier
2. scenario_name: Clear, descriptive name
3. description: What the scenario tests
4. priority: high, medium, or low
5. test_steps: List of detailed steps with actions and expected results

Use the custom instructions to decide which flows to cover and how to prioritize them. Keep the required JSON structure and output limits below.

Output limits:
- Keep descriptions, actions, and expected results brief, and ensure the JSON array is complete.

Return ONLY valid JSON array of scenarios, no additional text.

Example format:
[
  {{
    "scenario_id": "TC001",
    "scenario_name": "User Login Flow",
    "description": "Verify user can successfully login with valid credentials",
    "priority": "high",
    "test_steps": [
      {{
        "step_number": 1,
        "action": "Navigate to login page",
        "expected_result": "Login page is displayed"
      }},
      {{
        "step_number": 2,
        "action": "Enter valid username",
        "expected_result": "Username is entered successfully"
      }}
    ]
  }}
]
"""
        
        try:
            logger.info(f"[{self.execution_id}] Generating test scenarios with AI model: {self.model_type}")
            response = await self.ai_model.generate_with_images(
                prompt=base_prompt,
                image_paths=image_paths
            )
            logger.debug(f"[{self.execution_id}] AI response received, length: {len(response)}")
            
            # Extract JSON from response
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            test_scenarios = json.loads(response_text.strip())
            logger.info(f"[{self.execution_id}] Successfully generated {len(test_scenarios)} test scenarios")
            for scenario in test_scenarios:
                logger.debug(f"[{self.execution_id}] Scenario: {scenario.get('scenario_id')} - {scenario.get('scenario_name')}")
            return test_scenarios
            
        except json.JSONDecodeError as e:
            logger.error(f"[{self.execution_id}] JSON decode error: {str(e)}")
            error_context = response_text[max(0, e.pos - 80):e.pos + 80]
            logger.debug(f"[{self.execution_id}] Invalid JSON near character {e.pos}: {error_context!r}")
            logger.warning(f"[{self.execution_id}] Returning fallback scenario")
            # Fallback: return basic scenario
            return [{
                "scenario_id": "TC001",
                "scenario_name": "Basic Application Test",
                "description": f"Test basic functionality of {app_name}",
                "priority": "high",
                "test_steps": [
                    {
                        "step_number": 1,
                        "action": "Open application",
                        "expected_result": "Application loads successfully"
                    }
                ]
            }]
        except Exception as e:
            logger.error(f"[{self.execution_id}] TestcaseGeneratorAgent error: {str(e)}")
            raise Exception(f"TestcaseGeneratorAgent error: {str(e)}")
