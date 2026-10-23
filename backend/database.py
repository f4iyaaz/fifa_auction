import os
from dotenv import load_dotenv
from pymongo import AsyncMongoClient

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]

client = AsyncMongoClient(MONGO_URL)
db = client["fifa_auction"]