from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseAIModel(ABC):
    """Base class for all AI models"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.model_name = None
        
    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate response from the AI model"""
        pass
    
    @abstractmethod
    async def generate_with_images(self, prompt: str, image_paths: list, **kwargs) -> str:
        """Generate response with image context"""
        pass
    
    def get_model_name(self) -> str:
        """Get the model name"""
        return self.model_name
