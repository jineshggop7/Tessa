from app.agents.base_agent import BaseAgent
from typing import List, Dict, Any
from app.database.mongodb import get_database
import logging

logger = logging.getLogger(__name__)


class ChatbotAgent(BaseAgent):
    """Agent 4: Chatbot (Tessa) aware of all execution details"""
    
    def __init__(self, model_type: str, execution_id: str):
        super().__init__(model_type, execution_id)
        
    async def process(
        self,
        user_message: str,
        execution_context: Dict[str, Any] = None
    ) -> str:
        """
        Process user query with full context awareness
        Returns: Chatbot response - professional, concise, with emojis
        """
        logger.info(f"[{self.execution_id}] ChatbotAgent (Tessa) processing message")
        logger.debug(f"[{self.execution_id}] User message: {user_message}")
        
        # Get execution context if not provided
        if not execution_context:
            logger.debug(f"[{self.execution_id}] Fetching execution context from database")
            execution_context = await self._get_execution_context()
        
        # Determine if user is asking for details or just greeting
        is_detail_request = self._is_detail_request(user_message)
        wants_detailed_explanation = self._wants_detailed_explanation(user_message)
        
        # Build context-aware prompt - only include full details if asking for them
        context_prompt = self._build_context_prompt(execution_context, include_details=is_detail_request)
        
        # Adjust response format based on what user is asking
        if wants_detailed_explanation:
            response_format = "detailed explanation (multiple paragraphs, comprehensive analysis)"
            sentence_limit = "no sentence limit - provide thorough explanation"
        else:
            response_format = "concise response"
            sentence_limit = "2-5 sentences max"
        
        full_prompt = f"""You are Tessa, a professional test automation analyst AI assistant.
CRITICAL INSTRUCTIONS:
1. ONLY answer based on the execution data provided below - if not in data, politely explain that the specific information they're asking about is not available in the current test execution data
2. {sentence_limit}
3. Use emojis (✅ passed, ❌ failed, 📈 stats, 🔍 details, ℹ️ info, 📋 info)
4. Never assume or hallucinate data
5. For greetings (hi, hello, hey) - give brief friendly response WITHOUT execution details
6. For detailed explanation requests - provide comprehensive analysis with examples and breakdown

EXECUTION DATA:
{context_prompt}

USER QUESTION: {user_message}

RESPONSE ({response_format}):"""
        
        try:
            response = await self.ai_model.generate(prompt=full_prompt)
            return response.strip()
        except Exception as e:
            logger.error(f"[{self.execution_id}] Error generating response: {str(e)}")
            return f"❌ Error: {str(e)}"
    
    async def _get_execution_context(self) -> Dict[str, Any]:
        """Retrieve full execution context from database"""
        try:
            db = get_database()
            execution = await db.executions.find_one(
                {"execution_id": self.execution_id}
            )
            
            if not execution:
                logger.warning(f"[{self.execution_id}] Execution not found in database")
                return {"_not_found": True, "execution_id": self.execution_id}
            
            # Convert ObjectId to string
            if "_id" in execution:
                execution["_id"] = str(execution["_id"])
            
            return execution
        except Exception as e:
            logger.error(f"[{self.execution_id}] Error fetching execution context: {str(e)}")
            return {"_error": True, "error_message": str(e)}
    
    def _is_detail_request(self, user_message: str) -> bool:
        """Check if user is asking for details or just greeting"""
        message_lower = user_message.lower().strip()
        
        # Greetings that don't need full context
        greetings = ['hi', 'hello', 'hey', 'howdy', 'good morning', 'good afternoon', 'good evening']
        
        # If it's just a greeting, don't include full details
        if message_lower in greetings:
            return False
        
        # If asking about execution, results, scenarios, steps, failures, etc.
        detail_keywords = ['execution', 'result', 'scenario', 'step', 'failed', 'passed', 'test', 
                          'status', 'summary', 'how many', 'what is', 'details', 'analysis',
                          'which', 'where', 'why', 'breakdown', 'report']
        
        if any(keyword in message_lower for keyword in detail_keywords):
            return True
        
        return False
    
    def _wants_detailed_explanation(self, user_message: str) -> bool:
        """Check if user is asking for detailed/comprehensive explanation"""
        message_lower = user_message.lower().strip()
        
        # Keywords that indicate wanting detailed explanation
        detail_keywords = [
            'explain', 'detailed', 'detailed explanation', 'comprehensive', 'breakdown', 
            'elaborate', 'tell me more', 'how exactly', 'why did', 'what happened', 
            'root cause', 'analysis', 'describe', 'give me details', 'full details',
            'step by step', 'in detail', 'thoroughly', 'everything about', 'all about',
            'explain in detail', 'more information', 'elaborate on'
        ]
        
        # Check if any detail keyword is in the message
        for keyword in detail_keywords:
            if keyword in message_lower:
                return True
        
        return False
    
    def _build_context_prompt(self, context: Dict[str, Any], include_details: bool = True) -> str:
        """Build structured context prompt from execution data - clear and factual"""
        # Check if execution was not found
        if context.get("_not_found"):
            return "STATUS: Execution not found"
        
        # Check if there was an error
        if context.get("_error"):
            return f"STATUS: Error retrieving data"
        
        # Check if context is empty
        if not context:
            return "STATUS: No data available"
        
        # If not asking for details, only return minimal info
        if not include_details:
            return ""
        
        prompt_parts = []
        
        # Basic info
        basic_info = []
        if "app_name" in context:
            basic_info.append(f"App: {context['app_name']}")
        if "app_platform" in context:
            basic_info.append(f"Platform: {context['app_platform']}")
        if "status" in context:
            basic_info.append(f"Status: {context['status']}")
        
        if basic_info:
            prompt_parts.append(f"EXECUTION: {' | '.join(basic_info)}")
        
        # Test scenarios with steps
        if "test_scenarios" in context and context["test_scenarios"]:
            prompt_parts.append(f"\nSCENARIOS ({len(context['test_scenarios'])} total):")
            
            for scenario in context["test_scenarios"]:
                s_id = scenario.get('scenario_id', 'Unknown')
                s_name = scenario.get('scenario_name', 'Unknown')
                steps = scenario.get('test_steps', [])
                
                prompt_parts.append(f"  {s_id}: {s_name}")
                
                # Include test steps
                if steps:
                    for step in steps:
                        step_num = step.get('step_number', '?')
                        action = step.get('action', 'Unknown')
                        expected = step.get('expected_result', 'Unknown')
                        prompt_parts.append(f"    Step {step_num}: {action} → Expected: {expected}")
        
        # Execution results
        if "execution_results" in context and context["execution_results"]:
            results = context["execution_results"]
            passed = sum(1 for r in results if r.get('result') == 'PASSED')
            failed = sum(1 for r in results if r.get('result') == 'FAILED')
            
            prompt_parts.append(f"\nRESULTS: {len(results)} executed | ✅ {passed} passed | ❌ {failed} failed")
            
            for result in results:
                s_id = result.get('scenario_id', 'Unknown')
                res = result.get('result', 'Unknown')
                summary = self._format_context_value(result.get('summary')) or 'No summary'
                observation = self._format_context_value(result.get('observation'))
                details = result.get('execution_details') or {}
                stderr = self._format_context_value(details.get('stderr')) if isinstance(details, dict) else ''
                
                prompt_parts.append(f"  {s_id}: {res}")
                prompt_parts.append(f"    Summary: {summary}")
                if observation:
                    prompt_parts.append(f"    Details: {observation[:500]}")
                if stderr:
                    prompt_parts.append(f"    Execution error output: {stderr[:1000]}")
        
        # Overall summary
        if "overall_result" in context and context["overall_result"]:
            prompt_parts.append(f"\nOVERALL: {context['overall_result']}")
        
        if not prompt_parts:
            prompt_parts.append("No test data available yet")
        
        return "\n".join(prompt_parts)

    def _format_context_value(self, value: Any) -> str:
        """Convert database values into readable text before placing them in the prompt."""
        if value is None:
            return ''
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            return '\n'.join(
                f"{key}: {self._format_context_value(item)}"
                for key, item in value.items()
                if item is not None
            )
        if isinstance(value, (list, tuple)):
            return '\n'.join(self._format_context_value(item) for item in value if item is not None)
        return str(value)
