from app.agents.base_agent import BaseAgent
from typing import Dict, Any
import json
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
        app_platform: str = "web"
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
        
        steps_description = "\n".join([
            f"{step['step_number']}. {step['action']} - Expected: {step['expected_result']}"
            for step in test_steps
        ])
        
        prompt = f"""
Generate a complete, production-ready, HIGHLY OPTIMIZED Selenium Python test script for web automation.

Scenario ID: {scenario_id}
Scenario Name: {scenario_name}
Platform: {app_platform}

Test Steps:
{steps_description}

CRITICAL REQUIREMENTS FOR FAST, RELIABLE WEB AUTOMATION:

1. **Optimized WebDriver Setup**:
   - Use Chrome with performance-optimized options
   - Set implicit wait to 5 seconds (not 10)
   - Page load timeout: 30 seconds
   - Script timeout: 30 seconds
   - Chrome options: --no-sandbox, --disable-dev-shm-usage, --disable-gpu, --disable-extensions, --disable-plugins, --disable-images (for faster loading), --start-maximized
   - DO NOT use --headless mode for testing/debugging - browser must be VISIBLE
   - Only use --headless for production/CI environments

2. **Smart Explicit Waits**:
   - Use WebDriverWait with 15-second timeout (not 30)
   - Use presence_of_element_located for fast detection
   - Use element_to_be_clickable only when necessary
   - Combine waits with actions for efficiency

3. **YouTube/Video Sites Optimization**:
   - Handle cookie banners FIRST (before any other actions)
   - Use direct URL navigation when possible
   - Press ENTER immediately after typing (no delays)
   - Skip autocomplete suggestions by pressing ESC
   - Use fast locators: NAME > ID > CSS > XPATH

4. **Multiple Fast Locator Strategies**:
   - Primary: NAME attribute (fastest for forms)
   - Secondary: ID attribute
   - Tertiary: CSS selectors with data attributes
   - Fallback: XPATH with contains() for text matching
   - Skip complex XPATH expressions

5. **Aggressive Retry with Smart Backoff**:
   - Max 2 retries per operation
   - 0.5 second delay between retries
   - Different locator strategy on retry
   - Fail fast on critical errors

6. **Optimized Element Interactions**:
   - Use JavaScript click for stubborn elements: driver.execute_script("arguments[0].click();", element)
   - Send keys directly without clearing first (when safe)
   - Use Actions class for complex interactions
   - Scroll into view only when necessary

7. **Performance Optimizations**:
   - Disable images: --disable-images
   - Block unnecessary resources
   - Use fast page load strategies
   - Minimize sleep() calls - use waits instead
   - Parallel execution when possible

8. **YouTube-Specific Fast Search**:
```python
def fast_youtube_search(driver, query):
    # Handle cookie banner first
    dismiss_cookie_banner(driver)
    
    # Find search box quickly
    search_box = driver.find_element(By.NAME, "search_query")
    search_box.clear()
    search_box.send_keys(query)
    
    # Press ENTER immediately (no wait for autocomplete)
    search_box.send_keys(Keys.ENTER)
    
    # Wait for results with short timeout
    WebDriverWait(driver, 10).until(
        lambda d: "results" in d.current_url or "search" in d.current_url
    )
    return True
```

9. **Cookie Banner Handler**:
```python
def dismiss_cookie_banner(driver):
    selectors = [
        "[aria-label*='Accept']",
        "[aria-label*='Agree']", 
        "button:contains('Accept')",
        "button:contains('Agree')",
        "#consent-bump button",
        ".consent-bump button"
    ]
    for selector in selectors:
        try:
            btn = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            btn.click()
            return True
        except:
            continue
    return False
```

10. **Error Recovery**:
    - StaleElementReferenceException: Re-find element
    - ElementClickInterceptedException: Use JavaScript click
    - TimeoutException: Try alternative locator
    - NoSuchElementException: Check page loaded, retry with different strategy

11. **Fast Verification**:
    - Check URL changes instead of waiting for elements
    - Use driver.current_url for navigation verification
    - Quick presence checks instead of full waits
    - Early returns on success

12. **Logging Optimization**:
    - Minimal logging in performance-critical paths
    - Log only failures and key milestones
    - Use debug level for detailed traces

Return ONLY the Python code, no explanations.
Focus on SPEED and RELIABILITY for web automation tasks like YouTube navigation and search.

CRITICAL FOR TESTING: Browser must be VISIBLE during execution. Add time.sleep(5) in tearDown() method before closing browser so users can see test results.
"""
        
        try:
            logger.info(f"[{self.execution_id}] Generating optimized code with AI model: {self.model_type}")
            start_time = time.time()
            
            code = await self.ai_model.generate(prompt=prompt)
            
            generation_time = time.time() - start_time
            self.record_performance_metric("code_generation_time", f"{generation_time:.2f}s")
            
            logger.debug(f"[{self.execution_id}] Code generated in {generation_time:.2f}s, length: {len(code)} characters")
            
            # Clean up the response
            code = code.strip()
            if code.startswith("```python"):
                code = code[9:]
            elif code.startswith("```"):
                code = code[3:]
            if code.endswith("```"):
                code = code[:-3]
            
            # Add performance optimizations to the generated code
            optimized_code = self._optimize_generated_code(code)
            
            logger.info(f"[{self.execution_id}] Code generation and optimization completed")
            return optimized_code.strip()
            
        except Exception as e:
            logger.error(f"[{self.execution_id}] CodeGeneratorAgent error: {str(e)}")
            raise Exception(f"CodeGeneratorAgent error: {str(e)}")
    
    def _optimize_generated_code(self, code: str) -> str:
        """Add performance optimizations to generated code"""
        import re
        
        # Add performance imports if not present
        if "from selenium.webdriver.chrome.options import Options" not in code:
            code = code.replace(
                "from selenium import webdriver",
                "from selenium import webdriver\nfrom selenium.webdriver.chrome.options import Options"
            )
        
        # Optimize WebDriverWait timeouts (reduce from 30s to 15s)
        code = re.sub(r'WebDriverWait\(driver, 30\)', 'WebDriverWait(driver, 15)', code)
        code = re.sub(r'WebDriverWait\(self\.driver, 30\)', 'WebDriverWait(self.driver, 15)', code)
        
        # Optimize implicit waits (reduce from 10s to 5s)
        code = re.sub(r'driver\.implicitly_wait\(10\)', 'driver.implicitly_wait(5)', code)
        
        # Add performance logging
        if "logger.info(" in code and "Performance:" not in code:
            # Add a performance note to the first logger.info
            code = code.replace(
                "logger.info(",
                "logger.info(f\"[PERFORMANCE] \",",
                1
            )
        
        return code
