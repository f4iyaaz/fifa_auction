from pymongo import AsyncMongoClient

MONGO_URL = "mongodb://localhost:27017"

client = AsyncMongoClient(MONGO_URL)
db = client["fifa_auction"]