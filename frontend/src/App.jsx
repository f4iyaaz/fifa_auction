import { useState, useEffect } from "react";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [budget, setBudget] = useState(500);
  const [message, setMessage] = useState("");

  const [joinedCode, setJoinedCode] = useState(
    () => localStorage.getItem("joinedCode") || null
  );
  const [participantId, setParticipantId] = useState(
    () => localStorage.getItem("participantId") || null
  );
  const [status, setStatus] = useState(null);

  const [screen, setScreen] = useState(() => {
    const savedCode = localStorage.getItem("joinedCode");
    const savedId = localStorage.getItem("participantId");
    return savedCode && savedId ? "waiting" : "lobby";
  });

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  function saveSession(newCode, newParticipantId) {
    localStorage.setItem("joinedCode", newCode);
    localStorage.setItem("participantId", newParticipantId);
    setJoinedCode(newCode);
    setParticipantId(newParticipantId);
  }

  function handleLeave() {
    localStorage.removeItem("joinedCode");
    localStorage.removeItem("participantId");
    setJoinedCode(null);
    setParticipantId(null);
    setScreen("lobby");
  }

  async function handleCreate() {
    const response = await fetch(`${API_URL}/auctions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host_name: name, budget: Number(budget) }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    saveSession(data.code, data.participant_id);
    setScreen("wishlist");
  }

  async function handleJoin() {
    const response = await fetch(`${API_URL}/auctions/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    saveSession(data.code, data.participant_id);
    setScreen("wishlist");
  }

  async function handleStart() {
    const response = await fetch(`${API_URL}/auctions/${joinedCode}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    setMessage("Auction started!");
  }

  async function handleSearch() {
    const response = await fetch(`${API_URL}/players?search=${search}`);
    const data = await response.json();
    setResults(data);
  }

  async function handleAddToWishlist(playerId) {
    const response = await fetch(`${API_URL}/auctions/${joinedCode}/wishlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, player_id: playerId }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    fetchWishlist();
  }

  async function fetchWishlist() {
    const response = await fetch(
      `${API_URL}/auctions/${joinedCode}/wishlist/${participantId}`
    );
    const data = await response.json();
    setWishlist(data);
  }

  useEffect(() => {
    if (!joinedCode || !participantId) return;

    async function fetchStatus() {
      const response = await fetch(
        `${API_URL}/auctions/${joinedCode}/status/${participantId}`
      );
      const data = await response.json();
      setStatus(data);
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [joinedCode, participantId]);

  if (screen === "wishlist") {
    return (
      <div>
        <h1>Build Your Wishlist</h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player name"
        />
        <button onClick={handleSearch}>Search</button>

        <ul>
          {results.map((p) => (
            <li key={p._id}>
              {p.playerName} ({p.rating}) — {p.club}
              <button onClick={() => handleAddToWishlist(p._id)}>Add</button>
            </li>
          ))}
        </ul>

        <h3>Your Wishlist ({wishlist.length}):</h3>
        <ul>
          {wishlist.map((p) => (
            <li key={p._id}>{p.playerName}</li>
          ))}
        </ul>

        <button onClick={() => setScreen("waiting")}>I'm Ready</button>
        <p style={{ color: "red" }}>{message}</p>
      </div>
    );
  }

  if (screen === "waiting" || (status && status.state === "BIDDING")) {
    if (status && status.state === "BIDDING") {
      return (
        <div>
          <h1>Bidding</h1>
          <p>Current turn: {status.current_turn}</p>
          <p>
            Current player:{" "}
            {status.current_player ? status.current_player.playerName : "None called yet"}
          </p>
        </div>
      );
    }

    const isHost = status && status.is_host;

    return (
      <div>
        <h1>Waiting Room</h1>
        <p>Auction code: {joinedCode}</p>
        <h3>Participants:</h3>
        <ul>
          {status &&
            status.rosters.map((p) => (
              <li key={p.name}>
                {p.name} — {p.budget_left} left
              </li>
            ))}
        </ul>
        {isHost && <button onClick={handleStart}>Start Auction</button>}
        <button onClick={handleLeave}>Leave (for testing)</button>
        <p style={{ color: "red" }}>{message}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>FIFA Auction</h1>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
      />
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Join code"
      />
      <input
        type="number"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        placeholder="Budget"
      />
      <button onClick={handleCreate}>Create Auction</button>
      <button onClick={handleJoin}>Join Auction</button>
      <p style={{ color: "red" }}>{message}</p>
    </div>
  );
}

export default App;