import re
import random
import uuid
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from database import db
from typing import Optional

MIN_BID = 20

app = FastAPI()

def has_available_player(participant, sold_ids):
    return any(pid not in sold_ids for pid in participant["wishlist"])

async def resolve_round(auction):
    names = {p["id"]: p["name"] for p in auction["participants"]}
    bids = auction["bids"]
    player_id = auction["current_player_id"]

    player = await db.players.find_one({"_id": ObjectId(player_id)})
    player_name = player["playerName"]

    # Everyone's answers, by name, so phones can show them after the reveal
    revealed = {names[pid]: amount for pid, amount in bids.items()}

    # Only real numbers count; passes are None
    numbers = {pid: amt for pid, amt in bids.items() if amt is not None}

    # next_index = (auction["current_turn_index"] + 1) % len(auction["turn_order"])
    sold_ids = auction.get("sold_player_ids", [])
    if player_id not in sold_ids:
        sold_ids = sold_ids + [player_id]  # this round's sale, if any, isn't saved to the doc yet

    participants_by_id = {p["id"]: p for p in auction["participants"]}
    turn_order = auction["turn_order"]
    current_index = auction["current_turn_index"]

    next_index = None
    for step in range(1, len(turn_order) + 1):
        candidate_index = (current_index + step) % len(turn_order)
        candidate_id = turn_order[candidate_index]
        if has_available_player(participants_by_id[candidate_id], sold_ids):
            next_index = candidate_index
            break

    auction_finished = next_index is None


    # Outcome 1: everyone passed
    if not numbers:
        await db.auctions.update_one(
            {"code": auction["code"]},
            {
                "$set": {
                    "current_player_id": None,
                    "bids": {},
                    "eligible_bidders": [],
                    "tied_amount": None,
                    "current_turn_index": next_index,
                    "state": "FINISHED" if auction_finished else "BIDDING",
                    "last_result": {
                        "outcome": "unsold",
                        "player": player_name,
                        "bids": revealed,
                    },
                }
            },
        )
        return

    top = max(numbers.values())
    winners = [pid for pid, amt in numbers.items() if amt == top]

    # Outcome 3: tie, so re-bid between the tied friends only
    if len(winners) > 1:
        await db.auctions.update_one(
            {"code": auction["code"]},
            {
                "$set": {
                    "bids": {},
                    "eligible_bidders": winners,
                    "tied_amount": top,
                    "last_result": {
                        "outcome": "tie",
                        "player": player_name,
                        "amount": top,
                        "tied": [names[pid] for pid in winners],
                        "bids": revealed,
                    },
                }
            },
        )
        return

    # Outcome 2: one clear winner
    winner_id = winners[0]
    await db.auctions.update_one(
        {"code": auction["code"], "participants.id": winner_id},
        {
            "$inc": {"participants.$.budget_left": -top},
            "$push": {
                "participants.$.won_players": player_id,
                "sold_player_ids": player_id,
            },
            "$set": {
                "current_player_id": None,
                "bids": {},
                "eligible_bidders": [],
                "tied_amount": None,
                "current_turn_index": next_index,
                "state": "FINISHED" if auction_finished else "BIDDING",
                "last_result": {
                    "outcome": "sold",
                    "player": player_name,
                    "winner": names[winner_id],
                    "amount": top,
                    "bids": revealed,
                },
            },
        },
    )


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
                "sold_player_ids": [],
            }
        },
    )
    return {"message": "Auction started", "turn_order": turn_order}

class CallPlayer(BaseModel):
    participant_id: str
    player_id: str


@app.post("/auctions/{code}/call")
async def call_player(code: str, data: CallPlayer):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    if auction["state"] != "BIDDING":
        raise HTTPException(status_code=400, detail="Auction is not in bidding state")

    if auction.get("current_player_id") is not None:
        raise HTTPException(status_code=400, detail="A player is already being auctioned")

    current_turn_id = auction["turn_order"][auction["current_turn_index"]]
    if data.participant_id != current_turn_id:
        raise HTTPException(status_code=403, detail="It is not your turn")

    caller = next(
        (p for p in auction["participants"] if p["id"] == data.participant_id), None
    )
    if data.player_id not in caller["wishlist"]:
        raise HTTPException(status_code=400, detail="Player is not in your wishlist")

    sold_ids = auction.get("sold_player_ids", [])
    if data.player_id in sold_ids:
        raise HTTPException(status_code=400, detail="Player already sold")

    await db.auctions.update_one(
        {"code": auction["code"]},
        {
            "$set": {
                "current_player_id": data.player_id,
                "bids": {},
                "eligible_bidders": [p["id"] for p in auction["participants"]],
            }
        },
    )
    return {"message": "Player called, bidding is open", "player_id": data.player_id}

class PlaceBid(BaseModel):
    participant_id: str
    amount: Optional[int] = None
    passed: bool = False


@app.post("/auctions/{code}/bid")
async def place_bid(code: str, data: PlaceBid):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    if auction["state"] != "BIDDING":
        raise HTTPException(status_code=400, detail="Auction is not in bidding state")

    if auction.get("current_player_id") is None:
        raise HTTPException(status_code=400, detail="No player is being auctioned")

    participant = next(
        (p for p in auction["participants"] if p["id"] == data.participant_id), None
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="Invalid participant")

    if data.participant_id not in auction.get("eligible_bidders", []):
        raise HTTPException(status_code=403, detail="You are not part of this bidding round")

    if data.passed:
        if data.amount is not None:
            raise HTTPException(status_code=400, detail="Cannot pass and bid at the same time")
        value = None
    else:
        if data.amount is None:
            raise HTTPException(status_code=400, detail="Send an amount, or pass")
        if data.amount < MIN_BID:
            raise HTTPException(status_code=400, detail=f"Minimum bid is {MIN_BID}")
        tied_amount = auction.get("tied_amount")
        if tied_amount is not None and data.amount <= tied_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Re-bid must be higher than {tied_amount}",
            )
        if data.amount > participant["budget_left"]:
            raise HTTPException(status_code=400, detail="Bid is higher than your budget")
        value = data.amount

    result = await db.auctions.update_one(
        {
            "code": auction["code"],
            f"bids.{data.participant_id}": {"$exists": False},
        },
        {"$set": {f"bids.{data.participant_id}": value}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="You already placed a bid")

    # Has everyone eligible answered now?
    updated = await db.auctions.find_one({"code": auction["code"]})
    if all(pid in updated["bids"] for pid in updated["eligible_bidders"]):
        claim = await db.auctions.update_one(
            {"code": updated["code"], "bids": updated["bids"]},
            {"$set": {"bids": {}}},
        )
        if claim.modified_count == 1:
            await resolve_round(updated)

    return {"message": "Pass recorded" if data.passed else "Bid recorded"}

@app.get("/auctions/{code}/status/{participant_id}")
async def get_status(code: str, participant_id: str):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    if not any(p["id"] == participant_id for p in auction["participants"]):
        raise HTTPException(status_code=403, detail="Invalid participant")

    names = {p["id"]: p["name"] for p in auction["participants"]}
    bids = auction.get("bids", {})
    eligible = auction.get("eligible_bidders", [])

    turn_order = auction.get("turn_order", [])
    turn_index = auction.get("current_turn_index", 0)
    # current_turn = names.get(turn_order[turn_index]) if turn_order else None
    current_turn = names.get(turn_order[turn_index]) if turn_order and turn_index is not None else None

    current_player = None
    player_id = auction.get("current_player_id")
    if player_id:
        player = await db.players.find_one({"_id": ObjectId(player_id)})
        if player:
            current_player = serialize_player(player)

    rosters = []
    for p in auction["participants"]:
        won_ids = [ObjectId(pid) for pid in p["won_players"]]
        won_players = await db.players.find({"_id": {"$in": won_ids}}).to_list(length=None)
        rosters.append({
            "name": p["name"],
            "budget_left": p["budget_left"],
            "won_players": [serialize_player(wp) for wp in won_players],
        })

    return {
        "state": auction["state"],
        "current_turn": current_turn,
        "current_player": current_player,
        "answered": [names[pid] for pid in bids],
        "waiting_for": [names[pid] for pid in eligible if pid not in bids],
        "you_answered": participant_id in bids,
        "you_can_bid": participant_id in eligible and participant_id not in bids,
        "last_result": auction.get("last_result"),
        "rosters": rosters,
    }

@app.get("/auctions/{code}/results")
async def get_results(code: str):
    auction = await db.auctions.find_one({"code": code.upper()})
    if auction is None:
        raise HTTPException(status_code=404, detail="Auction not found")

    if auction["state"] != "FINISHED":
        raise HTTPException(status_code=400, detail="Auction is not finished yet")

    squads = []
    for p in auction["participants"]:
        won_ids = [ObjectId(pid) for pid in p["won_players"]]
        won_players = await db.players.find({"_id": {"$in": won_ids}}).to_list(length=None)
        spent = auction["budget"] - p["budget_left"]
        squads.append({
            "name": p["name"],
            "spent": spent,
            "budget_left": p["budget_left"],
            "players_won": len(won_players),
            "squad": [serialize_player(wp) for wp in won_players],
        })

    squads.sort(key=lambda s: s["spent"], reverse=True)

    return {
        "code": auction["code"],
        "squads": squads,
    }