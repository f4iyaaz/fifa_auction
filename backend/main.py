import re
import random
import uuid
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from database import db

app = FastAPI()


def serialize_player(player):
    player["_id"] = str(player["_id"])
    return player


def make_code():
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(letters, k=4))


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


class AddToWishlist(BaseModel):
    participant_id: str
    player_id: str


@app.post("/auctions/{code}/wishlist")
async def add_to_wishlist(code: str, data: AddToWishlist):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    participant = next(
        (p for p in auction["participants"] if p["id"] == data.participant_id), None
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="Invalid participant")

    if data.player_id in participant["wishlist"]:
        raise HTTPException(status_code=400, detail="Player already in wishlist")

    try:
        player_object_id = ObjectId(data.player_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid player id")

    player = await db.players.find_one({"_id": player_object_id})
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")

    await db.auctions.update_one(
        {"code": auction["code"], "participants.id": data.participant_id},
        {"$push": {"participants.$.wishlist": data.player_id}},
    )
    return {"message": f"{player['playerName']} added to wishlist"}


@app.get("/auctions/{code}/wishlist/{participant_id}")
async def get_wishlist(code: str, participant_id: str):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    participant = next(
        (p for p in auction["participants"] if p["id"] == participant_id), None
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="Invalid participant")

    ids = []
    for pid in participant["wishlist"]:
        try:
            ids.append(ObjectId(pid))
        except Exception:
            continue

    players = await db.players.find({"_id": {"$in": ids}}).to_list(length=None)
    return [serialize_player(p) for p in players]


class StartAuction(BaseModel):
    participant_id: str


@app.post("/auctions/{code}/start")
async def start_auction(code: str, data: StartAuction):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    if auction["state"] != "LOBBY":
        raise HTTPException(status_code=400, detail="Auction already started")

    if data.participant_id != auction["host_id"]:
        raise HTTPException(status_code=403, detail="Only the host can start the auction")

    if len(auction["participants"]) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 participants")

    for p in auction["participants"]:
        if len(p["wishlist"]) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"{p['name']} has an empty wishlist",
            )

    turn_order = [p["id"] for p in auction["participants"]]

    await db.auctions.update_one(
        {"code": auction["code"]},
        {
            "$set": {
                "state": "BIDDING",
                "turn_order": turn_order,
                "current_turn_index": 0,
                "current_player_id": None,
                "bids": {},
            }
        },
    )
    return {"message": "Auction started", "turn_order": turn_order}