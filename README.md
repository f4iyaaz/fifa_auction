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
