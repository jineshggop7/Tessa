from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Tessa AI Test Automation"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "tessa_automation"
    
    # Storage
    STORAGE_BASE_PATH: str = "./storage"
    IMAGES_PATH: str = "./storage/images"
    SCRIPTS_PATH: str = "./storage/scripts"
    
    # AI Models
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    # WebSocket
    WS_MESSAGE_QUEUE_SIZE: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
