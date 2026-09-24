import re
from fastapi import FastAPI, Query, HTTPException
from database import db
import random
import uuid
from pydantic import BaseModel, Field

app = FastAPI()

def serialize_player(player):
    player["_id"] = str(player["_id"])
    return player

@app.get("/")
def home():
    return {"message": "FIFA auction backend is running"}

@app.get("/players/count")
async def count_players():
    count = await db.players.count_documents({})
    return {"count": count}

@app.get("/players")
async def search_players(search: str = "", limit: int = Query(20, le=50)):
    query = {}
    if search:
        query["playerName"] = {"$regex": re.escape(search), "$options": "i"}

    cursor = db.players.find(query).sort("rating", -1).limit(limit)
    players = await cursor.to_list(length=limit)
    return [serialize_player(p) for p in players]

class CreateAuction(BaseModel):
    host_name: str = Field(min_length=1, max_length=20)
    budget: int = Field(gt=0)


def make_code():
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(letters, k=4))


@app.post("/auctions")
async def create_auction(data: CreateAuction):
    code = make_code()
    while await db.auctions.find_one({"code": code}):
        code = make_code()

    host_id = str(uuid.uuid4())
    auction = {
        "code": code,
        "state": "LOBBY",
        "budget": data.budget,
        "host_id": host_id,
        "participants": [
            {
                "id": host_id,
                "name": data.host_name,
                "budget_left": data.budget,
                "wishlist": [],
                "won_players": [],
            }
        ],
    }
    await db.auctions.insert_one(auction)
    return {"code": code, "participant_id": host_id}

class JoinAuction(BaseModel):
    name: str = Field(min_length=1, max_length=20)


@app.post("/auctions/{code}/join")
async def join_auction(code: str, data: JoinAuction):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["state"] != "LOBBY":
        raise HTTPException(status_code=400, detail="Auction already started")
    if len(auction["participants"]) >= 4:
        raise HTTPException(status_code=400, detail="Auction is full")
    if any(p["name"].lower() == data.name.lower() for p in auction["participants"]):
        raise HTTPException(status_code=400, detail="Name already taken")

    participant_id = str(uuid.uuid4())
    participant = {
        "id": participant_id,
        "name": data.name,
        "budget_left": auction["budget"],
        "wishlist": [],
        "won_players": [],
    }
    await db.auctions.update_one(
        {"code": auction["code"]},
        {"$push": {"participants": participant}},
    )
    return {"code": auction["code"], "participant_id": participant_id}


@app.get("/auctions/{code}")
async def get_auction(code: str):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")
    return {
        "code": auction["code"],
        "state": auction["state"],
        "budget": auction["budget"],
        "participants": [
            {"name": p["name"], "budget_left": p["budget_left"]}
            for p in auction["participants"]
        ],
    }