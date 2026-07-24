from app.models.ai_models.base_model import BaseAIModel
from app.models.ai_models.gemini import GeminiModel
from app.models.ai_models.gpt import GPTModel


def get_ai_model(model_type: str, api_key: str = None) -> BaseAIModel:
    """Factory function to get AI model instance"""
    model_type = model_type.lower()
    
    if model_type == "gemini":
        return GeminiModel(api_key)
    elif model_type in ["gpt", "openai", "gpt-4", "gpt-4o"]:
        return GPTModel(api_key)
    else:
        raise ValueError(f"Unsupported model type: {model_type}")


__all__ = ["BaseAIModel", "GeminiModel", "GPTModel", "get_ai_model"]
