from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class MongoDB:
    client: AsyncIOMotorClient = None
    
    
db = MongoDB()


async def connect_to_mongo():
    try:
        logger.info(f"Attempting to connect to MongoDB at {settings.MONGODB_URL}")
        db.client = AsyncIOMotorClient(settings.MONGODB_URL)
        # Test connection
        await db.client.admin.command('ping')
        logger.info(f"Successfully connected to MongoDB at {settings.MONGODB_URL}")
        logger.info(f"Using database: {settings.MONGODB_DB_NAME}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        raise


async def close_mongo_connection():
    try:
        logger.info("Closing MongoDB connection")
        db.client.close()
        logger.info("MongoDB connection closed successfully")
    except Exception as e:
        logger.error(f"Error closing MongoDB connection: {str(e)}")


def get_database():
    if db.client is None:
        logger.error("Database client is None - connection not established")
        raise RuntimeError("Database connection not established")
    return db.client[settings.MONGODB_DB_NAME]
