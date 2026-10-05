
## Tech stack

- **Frontend**: React (via Vite), plain CSS with custom properties, no UI
  framework.
- **Backend**: FastAPI, PyMongo (async), Pydantic for request validation.
- **Database**: MongoDB, with two collections — `players` (the FIFA player
  dataset) and `auctions` (one document per game, holding state,
  participants, bids, and results).

## Running it locally

### 1. Database

Start MongoDB locally (or point `database.py` at an Atlas connection
string). The `players` collection should already be imported from your FIFA
dataset JSON via MongoDB Compass.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # Git Bash on Windows; venv/bin/activate on Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs at `http://127.0.0.1:8000`. Interactive API docs at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`. The frontend's `API_URL` constant in
`App.jsx` currently points at `127.0.0.1:8000`; update this to your
computer's local network IP (e.g. `http://192.168.x.x:8000`) when testing
from a phone on the same Wi-Fi.

## API overview

**Setup**
- `POST /auctions` — create an auction, become host
- `POST /auctions/{code}/join` — join with a name
- `POST /auctions/{code}/wishlist` — add a player to your wishlist
- `GET /auctions/{code}/wishlist/{participant_id}` — view your wishlist
- `POST /auctions/{code}/start` — host starts the auction, locks turn order

**Playing**
- `POST /auctions/{code}/call` — call a player from your wishlist (your turn only)
- `POST /auctions/{code}/bid` — submit a sealed bid or pass
- `GET /auctions/{code}/status/{participant_id}` — live game state: current
  player, who's answered, last result, everyone's rosters

**Wrap-up**
- `GET /auctions/{code}` — public lobby info (names, budgets, host)
- `GET /auctions/{code}/results` — final leaderboard, once the auction is finished

**Player data**
- `GET /players?search=&position=&min_rating=&limit=` — search the player
  database
- `GET /players/count` — sanity check on the imported dataset

## Design notes

- **Security**: participant IDs act as session tickets and are never shown
  to other players. Bid amounts stay hidden server-side until everyone in
  the round has answered, so no client can read another player's bid before
  submitting their own.
- **Persistence**: session (`joinedCode`, `participantId`, current screen)
  is saved to `localStorage`, so refreshing the page or losing connection
  mid-game doesn't lose your place. The backend's `status` endpoint is
  polled every 2 seconds so all devices stay in sync automatically.
- **Responsive layout**: a bottom tab bar on narrow (phone) screens becomes
  a left sidebar on screens ≥720px wide, same single component in both
  cases via CSS media queries.

## Known limitations / possible next steps

- An unsold player (everyone passed) remains callable indefinitely by
  anyone with them on their wishlist — there's no cap on re-attempts.
- No reconnection handling for a crashed server mid-round beyond what
  MongoDB persists; a crash between a tie's reveal and the next write could
  leave a round stuck.
- Not yet deployed — currently intended for local network play (same Wi-Fi)
  via each device's browser pointed at the host machine's IP.