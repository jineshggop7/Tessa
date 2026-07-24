from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


class MongoDB:
    client: AsyncIOMotorClient = None
    
    
db = MongoDB()


async def connect_to_mongo():
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"Connected to MongoDB at {settings.MONGODB_URL}")


async def close_mongo_connection():
    db.client.close()
    print("Closed MongoDB connection")


def get_database():
    return db.client[settings.MONGODB_DB_NAME]
