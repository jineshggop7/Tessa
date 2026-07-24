from abc import ABC, abstractmethod
from app.models.ai_models import get_ai_model, BaseAIModel
from typing import Any, Dict, Optional
import time
import logging

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all agents with performance monitoring"""

    def __init__(self, model_type: str, execution_id: str):
        self.model_type = model_type
        self.execution_id = execution_id
        self.ai_model: BaseAIModel = get_ai_model(model_type)
        self.start_time = time.time()
        self.performance_metrics = {}

    @abstractmethod
    async def process(self, *args, **kwargs) -> Any:
        """Process the agent's task"""
        pass

    def get_agent_name(self) -> str:
        """Get the agent name"""
        return self.__class__.__name__

    def record_performance_metric(self, key: str, value: Any):
        """Record a performance metric"""
        self.performance_metrics[key] = value
        logger.debug(f"[{self.execution_id}] Performance metric - {key}: {value}")

    def get_execution_time(self) -> float:
        """Get total execution time"""
        return time.time() - self.start_time

    def log_performance_summary(self):
        """Log performance summary"""
        execution_time = self.get_execution_time()
        logger.info(f"[{self.execution_id}] {self.get_agent_name()} completed in {execution_time:.2f}s")
        for key, value in self.performance_metrics.items():
            logger.info(f"[{self.execution_id}] {key}: {value}")
