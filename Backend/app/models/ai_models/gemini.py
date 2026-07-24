import logging
from typing import List, Optional

import google.generativeai as genai
from PIL import Image

from app.models.ai_models.base_model import BaseAIModel
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiModel(BaseAIModel):
    """
    Gemini AI Model (Text + Vision)
    Compatible with google-generativeai v1beta
    """

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key or settings.GEMINI_API_KEY)

        # Use Gemini 2.5 Flash (latest model with vision support)
        self.model_name = "gemini-2.5-flash"

        genai.configure(api_key=self.api_key)

        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": 0.2,
                "top_p": 0.9,
                "top_k": 40,
                "max_output_tokens": 4096,
            },
        )

        logger.info(f"Gemini model initialized: {self.model_name}")

    # ------------------------------------------------------------------
    # TEXT ONLY
    # ------------------------------------------------------------------
    async def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate text-only response
        """
        try:
            logger.debug(f"Gemini generate (text), length={len(prompt)}")

            response = self.model.generate_content(prompt)

            if not response or not response.text:
                raise RuntimeError("Empty response from Gemini")

            return response.text

        except Exception as e:
            logger.exception("Gemini text generation failed")
            raise RuntimeError(f"Gemini generation error: {e}")

    # ------------------------------------------------------------------
    # TEXT + IMAGES (VISION)
    # ------------------------------------------------------------------
    async def generate_with_images(
        self,
        prompt: str,
        image_paths: List[str],
        **kwargs,
    ) -> str:
        """
        Generate response using text + images
        """

        try:
            # 🔒 SAFETY GUARD — do NOT call vision if no images
            if not image_paths:
                logger.debug("No images provided, falling back to text-only")
                return await self.generate(prompt)

            logger.debug(f"Gemini generate with {len(image_paths)} images")

            content = [prompt]

            for path in image_paths:
                try:
                    image = Image.open(path)
                    content.append(image)
                    logger.debug(f"Loaded image: {path}")
                except Exception as img_err:
                    logger.warning(f"Skipping image {path}: {img_err}")

            response = self.model.generate_content(content)

            if not response or not response.text:
                raise RuntimeError("Empty vision response from Gemini")

            return response.text

        except Exception as e:
            logger.exception("Gemini image generation failed")
            raise RuntimeError(f"Gemini image generation error: {e}")
