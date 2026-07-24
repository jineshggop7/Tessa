from openai import AsyncOpenAI
from app.models.ai_models.base_model import BaseAIModel
from app.config import settings
import base64
import logging

logger = logging.getLogger(__name__)


class GPTModel(BaseAIModel):
    """OpenAI GPT Model Implementation"""
    
    def __init__(self, api_key: str = None):
        super().__init__(api_key or settings.OPENAI_API_KEY)
        self.model_name = "gpt-4o"
        self.client = AsyncOpenAI(api_key=self.api_key)
        
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate response from GPT"""
        try:
            logger.debug(f"GPT generate request, prompt length: {len(prompt)}")
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant for test automation."},
                    {"role": "user", "content": prompt}
                ],
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 4000)
            )
            logger.info(f"GPT response generated successfully")
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"GPT generation error: {str(e)}")
            raise Exception(f"GPT generation error: {str(e)}")
    
    async def generate_with_images(self, prompt: str, image_paths: list, **kwargs) -> str:
        """Generate response with image context"""
        try:
            logger.debug(f"GPT generate with {len(image_paths)} images")
            messages = [
                {"role": "system", "content": "You are a helpful AI assistant for test automation."}
            ]
            
            content = [{"type": "text", "text": prompt}]
            
            for image_path in image_paths:
                with open(image_path, "rb") as image_file:
                    base64_image = base64.b64encode(image_file.read()).decode('utf-8')
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    })
                logger.debug(f"Encoded image: {image_path}")
            
            messages.append({"role": "user", "content": content})
            
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 4000)
            )
            logger.info(f"GPT image response generated successfully")
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"GPT image generation error: {str(e)}")
            raise Exception(f"GPT image generation error: {str(e)}")
