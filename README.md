# ⚽ FIFA Auction

A real-time, multiplayer draft-auction app for FIFA squad building. Four people,
one shared player pool, sealed bidding, and a live scoreboard — built as a
full-stack web app with a React frontend, a FastAPI backend, and MongoDB for
persistence.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#1-database-setup)
  - [Backend Setup](#2-backend-setup)
  - [Frontend Setup](#3-frontend-setup)
  - [Playing Across Devices](#playing-across-devices)
- [Auction Rules](#game-rules)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Design System](#design-system)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Overview

FIFA Auction digitizes a cousin-group tradition: drafting FIFA squads through
a live, sealed-bid auction. Each participant gets an equal starting budget,
builds a private wishlist of players they want, and takes turns calling
players up for auction. Everyone bids in secret; the highest bid wins, and
ties trigger a re-bid restricted to the tied participants.

The app is built mobile-first, since players typically join from a mix of
phones and laptops in the same room (or over the same Wi-Fi network), and
stays in sync across all devices via polling, with no manual refresh needed.

## Features

- 🔐 **Sealed bidding** — bid amounts are never exposed to other clients
  until every eligible participant has answered.
- 🔄 **Live sync** — every connected device polls shared game state, so a
  call, bid, or reveal appears on everyone's screen within seconds.
- 🤝 **Fair tie-breaking** — ties trigger a restricted re-bid among only the
  tied participants, strictly above the tied amount.
- 📱 **Responsive, mobile-first UI** — a bottom tab bar on phones becomes a
  sidebar on desktop, from the same components.
- 💾 **Session persistence** — refreshing mid-game or losing connection
  doesn't lose your place; session state is restored from `localStorage` and
  re-synced from the server.
- 🔍 **Player search & filters** — search the full player database by name,
  position, and minimum rating while building a wishlist.
- 📊 **Live rosters & stats** — a dedicated view shows every participant's
  current squad and highest-rated player at any point in the game.
- 🏁 **Automatic game progression** — turns skip participants with no
  remaining callable players, and the auction ends automatically once no
  player can call anything further.

## Tech Stack

| Layer      | Technology                                   |
|------------|-----------------------------------------------|
| Frontend   | React 18 (Vite), plain CSS with custom properties |
| Backend    | FastAPI, Pydantic, Uvicorn                   |
| Database   | MongoDB (PyMongo async driver)               |
| Dev tools  | Postman / Swagger UI (`/docs`) for API testing |

No external UI framework — all styling is hand-written CSS using a small
design-token system (see [Design System](#design-system)).

## Architecture
┌─────────────┐ HTTP (JSON) ┌──────────────┐ ┌──────────┐
│ React │ ──────────────────────▶ │ FastAPI │ ─────▶ │ MongoDB │
│ (Vite dev │ ◀────────────────────── │ (Uvicorn) │ ◀───── │ │
│ server) │ polling every 2s └──────────────┘ └──────────┘
└─────────────┘

The backend is the single source of truth for all game state. The frontend
never trusts or stores sensitive data (bid amounts mid-round, other players'
participant IDs) — it only renders what the backend explicitly exposes.
Game state transitions (`LOBBY → BIDDING → FINISHED`) are entirely
server-driven; clients discover state changes via polling, not by acting on
local assumptions.

## Project Structure
````
fifa_auction/
├── .gitignore
├── README.md
│
├── backend/
│ ├── main.py # FastAPI app — all routes and game logic
│ ├── database.py # MongoDB client/connection setup
│ ├── requirements.txt # Python dependencies (pip freeze)
│ ├── data/
│ │ └── players.json # Source FIFA player dataset (imported into MongoDB)
│ └── venv/ # Virtual environment (not committed)
│
└── frontend/
├── index.html # Vite entry HTML, Google Fonts links
├── package.json
├── vite.config.js
├── src/
│ ├── main.jsx # React entry point
│ ├── App.jsx # All screens, state, and API calls
│ └── index.css # Design tokens + global styles
└── node_modules/ # Installed packages (not committed)
````

## Getting Started

### Prerequisites

- **Python** 3.10+
- **Node.js** 18+ and npm
- **MongoDB** running locally, or a MongoDB Atlas connection string
- A FIFA player dataset in JSON format (array of player objects)

### 1. Database Setup

Start a local MongoDB instance, or create a free MongoDB Atlas cluster.
Using MongoDB Compass (or `mongosh`), create a database named
`fifa_auction` with a `players` collection, and import your player dataset
JSON into it. Each document should have at least:

```json
{
  "playerName": "J. Bellingham",
  "position": "CAM, CM",
  "rating": 90,
  "potential": 94,
  "club": "Real Madrid",
  "league": "La Liga",
  "nationalTeam": "England"
}
```

MongoDB will assign each document a unique `_id` automatically — this is the
ID the app uses to reference players throughout.

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Activate the virtual environment
source venv/Scripts/activate   # Git Bash on Windows
# venv\Scripts\activate        # PowerShell/CMD on Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
uvicorn main:app --reload
```

The API is now running at `http://127.0.0.1:8000`, with interactive
Swagger docs at `http://127.0.0.1:8000/docs`.

By default, `database.py` connects to `mongodb://localhost:27017`. Update
this if you're using Atlas or a different host.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app is now running at `http://localhost:5173`.

> **Note:** `App.jsx` defines `const API_URL = "http://127.0.0.1:8000"` at
> the top of the file. This must match wherever your backend is actually
> reachable (see below for multi-device setups).

### Playing Across Devices

To play with friends on separate phones/laptops over the same Wi-Fi
network:

1. Find your computer's local network IP address (e.g. `192.168.1.42`).
2. In `backend/main.py`, ensure your CORS configuration allows your local
   network origin, or run the frontend accessible on that IP.
3. In `frontend/src/App.jsx`, change `API_URL` to
   `http://<your-local-ip>:8000`.
4. Run Uvicorn with `--host 0.0.0.0` so it accepts connections from other
   devices on the network:
```bash
   uvicorn main:app --reload --host 0.0.0.0
```
5. Each friend opens `http://<your-local-ip>:5173` on their own device.

## Game Rules

1. All participants start with an equal, host-defined budget.
2. Each participant privately builds a wishlist of players before the
   auction starts; at least one player per person is required to begin.
3. Turn order is fixed at auction start, based on join order (host first).
4. On their turn, a participant calls one player from **their own**
   wishlist only.
5. All participants then submit a sealed bid (minimum 20) or pass.
   Bids are final and cannot be changed once submitted.
6. Once everyone eligible has answered, bids are revealed simultaneously:
   - **Highest unique bid** wins the player; the winner's budget is reduced
     by that amount, and the player is added to their squad.
   - **Everyone passes** → the player goes unsold and remains on the
     caller's wishlist for a future turn.
   - **Tie for highest** → only the tied participants re-bid, and must bid
     strictly above the tied amount (or pass). If all tied participants
     pass, the player goes unsold.
7. Turn passes to the next participant (by original join order) who still
   has an un-sold, uncalled player on their wishlist.
8. The auction ends automatically once no participant has any callable
   player remaining. Final squads, spend, and leftover budget are then
   displayed.

## Data Model

**`players` collection** — one document per player in the dataset (static,
shared across all auctions).

**`auctions` collection** — one document per game:

```jsonc
{
  "code": "G64C",
  "state": "LOBBY | BIDDING | FINISHED",
  "budget": 500,
  "host_id": "uuid",
  "participants": [
    {
      "id": "uuid",
      "name": "Ali",
      "budget_left": 450,
      "wishlist": ["playerId", "..."],
      "won_players": ["playerId", "..."]
    }
  ],
  "turn_order": ["uuid", "uuid", "uuid", "uuid"],
  "current_turn_index": 0,
  "current_player_id": null,
  "bids": {},
  "eligible_bidders": [],
  "tied_amount": null,
  "sold_player_ids": [],
  "last_result": { "outcome": "sold | unsold | tie", "...": "..." }
}
```

Participant IDs act as bearer tokens — whoever holds one can act as that
participant. They are generated server-side and returned only to the
device that created or joined as that participant; no endpoint ever
returns another participant's ID.

## API Reference

### Setup

| Method | Endpoint | Description |
|--------|----------|--------------|
| `POST` | `/auctions` | Create an auction; returns a join code and host participant ID |
| `POST` | `/auctions/{code}/join` | Join an auction by code |
| `POST` | `/auctions/{code}/wishlist` | Add a player to your wishlist |
| `GET`  | `/auctions/{code}/wishlist/{participant_id}` | View your wishlist |
| `POST` | `/auctions/{code}/start` | Host starts the auction; locks turn order |

### Gameplay

| Method | Endpoint | Description |
|--------|----------|--------------|
| `POST` | `/auctions/{code}/call` | Call a player from your wishlist (your turn only) |
| `POST` | `/auctions/{code}/bid` | Submit a sealed bid, or pass |
| `GET`  | `/auctions/{code}/status/{participant_id}` | Live game state for this participant |

### Results

| Method | Endpoint | Description |
|--------|----------|--------------|
| `GET`  | `/auctions/{code}` | Public lobby info (names, budgets, host) |
| `GET`  | `/auctions/{code}/results` | Final leaderboard, once the auction is finished |

### Player Data

| Method | Endpoint | Description |
|--------|----------|--------------|
| `GET`  | `/players?search=&position=&min_rating=&limit=` | Search the player database |
| `GET`  | `/players/count` | Total imported player count |

Full interactive documentation (with request/response schemas) is available
at `/docs` while the backend is running.

## Design System

A football-themed, mobile-first visual identity:

| Token | Value | Usage |
|-------|-------|-------|
| `--pitch-dark` | `#0B2E23` | Primary background |
| `--turf` | `#145C3F` | Cards, panels |
| `--gold` | `#E3B23C` | Reserved exclusively for money/bids/ratings |
| `--bone` | `#F5F3EC` | Text on dark backgrounds |
| `--ink` | `#0E1512` | Text on light backgrounds |
| `--red` | `#C94B3F` | Errors, pass actions |

Typography: **Barlow Condensed** (headings, ratings, scoreboard-style
numbers) paired with **Inter** (body text, inputs). Layout switches between
a fixed bottom tab bar (mobile) and a left sidebar (≥720px) via a single
responsive component.

## Known Limitations

- Unsold players (everyone passed) remain callable indefinitely — there's
  no limit on re-attempts across future turns.
- No automatic recovery if the server crashes mid-round between a tie's
  resolution and the next database write.
- Currently intended for local-network play; not yet deployed to a public
  host.
- No authentication — participant identity relies solely on a locally
  stored, unguessable ID (UUID), with no password or account system.

## Roadmap

- [ ] Deploy backend (Render/Fly.io), frontend (Vercel/Netlify), and
      database (MongoDB Atlas) for play without a shared Wi-Fi network.
- [ ] Replace polling with WebSockets for lower-latency live updates.
- [ ] Add a cap or cooldown on re-calling unsold players.
- [ ] Position-based squad stats (highest-rated GK/DEF/MID/FWD per team).
- [ ] Export final results as a shareable image or PDF.