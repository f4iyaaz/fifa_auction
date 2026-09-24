from fastapi import FastAPI
from database import db

app = FastAPI()

@app.get("/")
def home():
    return {"message": "FIFA auction backend is running"}

@app.get("/players/count")
async def count_players():
    count = await db.players.count_documents({})
    return {"count": count}