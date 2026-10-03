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

  const [page, setPage] = useState("game");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [bidAmount, setBidAmount] = useState("");

  function isPlayerSold(playerId, status) {
    return status.rosters.some((r) =>
      r.won_players.some((wp) => wp._id === playerId)
    );
  }

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

  async function handleCallPlayer(playerId) {
    const response = await fetch(`${API_URL}/auctions/${joinedCode}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, player_id: playerId }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    setMessage("");
  }

  async function handleBid() {
    const response = await fetch(`${API_URL}/auctions/${joinedCode}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, amount: Number(bidAmount) }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    setMessage("");
    setBidAmount("");
  }

  async function handlePass() {
    const response = await fetch(`${API_URL}/auctions/${joinedCode}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId, passed: true }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.detail);
      return;
    }

    setMessage("");
    setBidAmount("");
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

  useEffect(() => {
    if (!joinedCode || !participantId) return;
    if (!status || status.state !== "BIDDING") return;
    if (wishlist.length > 0) return;

    fetchWishlist();
  }, [status, joinedCode, participantId]);

  function renderGameContent() {
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

          <button onClick={() => setScreen("waiting")} disabled={wishlist.length === 0}>
            I'm Ready
          </button>
          {wishlist.length === 0 && (
            <p style={{ color: "red" }}>Add at least one player before continuing.</p>
          )}
          <p style={{ color: "red" }}>{message}</p>
        </div>
      );
    }

    if (
      screen === "waiting" ||
      (status && (status.state === "BIDDING" || status.state === "FINISHED"))
    ) {
      if (status && status.state === "FINISHED") {
        return <ResultsScreen code={joinedCode} />;
      }

      if (status && status.state === "BIDDING") {
        return (
          <div>
            <h1>Bidding</h1>
            <p>Current turn: {status.current_turn}</p>

            {status.last_result && (
              <div style={{ border: "1px solid gray", padding: "8px", marginBottom: "8px" }}>
                {status.last_result.outcome === "sold" && (
                  <p>
                    {status.last_result.winner} won {status.last_result.player} for{" "}
                    {status.last_result.amount}
                  </p>
                )}
                {status.last_result.outcome === "unsold" && (
                  <p>{status.last_result.player} went unsold (everyone passed)</p>
                )}
                {status.last_result.outcome === "tie" && (
                  <p>
                    Tie at {status.last_result.amount} between{" "}
                    {status.last_result.tied.join(" and ")} for {status.last_result.player}.
                    Re-bidding...
                  </p>
                )}
              </div>
            )}

            {!status.current_player && status.is_your_turn && (
              <div>
                <h3>It's your turn! Call a player:</h3>
                <ul>
                  {wishlist
                    .filter((p) => !isPlayerSold(p._id, status))
                    .map((p) => (
                      <li key={p._id}>
                        {p.playerName}
                        <button onClick={() => handleCallPlayer(p._id)}>Call</button>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {!status.current_player && !status.is_your_turn && (
              <p>Waiting for {status.current_turn} to call a player...</p>
            )}

            {status.current_player && (
              <div>
                <h3>Current player: {status.current_player.playerName}</h3>
                <p>
                  {status.current_player.club} — Rating {status.current_player.rating}
                </p>

                {status.you_can_bid && (
                  <div>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Your bid"
                    />
                    <button onClick={handleBid}>Bid</button>
                    <button onClick={handlePass}>Pass</button>
                  </div>
                )}

                {!status.you_can_bid && status.you_answered && (
                  <p>Waiting for: {status.waiting_for.join(", ")}</p>
                )}

                {!status.you_can_bid && !status.you_answered && (
                  <p>You are not part of this bidding round.</p>
                )}
              </div>
            )}

            <p style={{ color: "red" }}>{message}</p>
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

    return null;
  }

  if (!joinedCode) {
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

  return (
    <div style={{ display: "flex" }}>
      <nav style={{ width: "150px", borderRight: "1px solid gray", padding: "8px" }}>
        <p
          onClick={() => setPage("game")}
          style={{ cursor: "pointer", fontWeight: page === "game" ? "bold" : "normal" }}
        >
          Game
        </p>
        <p
          onClick={() => setPage("rosters")}
          style={{ cursor: "pointer", fontWeight: page === "rosters" ? "bold" : "normal" }}
        >
          All Rosters
        </p>
        <p
          onClick={() => setPage("stats")}
          style={{ cursor: "pointer", fontWeight: page === "stats" ? "bold" : "normal" }}
        >
          Team Stats
        </p>
      </nav>
      <div style={{ flex: 1, padding: "8px" }}>
        {page === "game" && renderGameContent()}
        {page === "rosters" && <RostersPage status={status} />}
        {page === "stats" && <StatsPage status={status} />}
      </div>
    </div>
  );
}

function ResultsScreen({ code }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    async function fetchResults() {
      const response = await fetch(`${API_URL}/auctions/${code}/results`);
      const data = await response.json();
      setResults(data);
    }

    fetchResults();
  }, [code]);

  if (!results) {
    return <p>Loading results...</p>;
  }

  return (
    <div>
      <h1>Final Results</h1>
      {results.squads.map((squad) => (
        <div
          key={squad.name}
          style={{ border: "1px solid gray", padding: "8px", marginBottom: "8px" }}
        >
          <h3>
            {squad.name} — spent {squad.spent}, {squad.budget_left} left
          </h3>
          <ul>
            {squad.squad.map((p) => (
              <li key={p._id}>
                {p.playerName} ({p.rating})
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RostersPage({ status }) {
  if (!status) return <p>Loading...</p>;

  return (
    <div>
      <h1>All Rosters</h1>
      {status.rosters.map((r) => (
        <div
          key={r.name}
          style={{ border: "1px solid gray", padding: "8px", marginBottom: "8px" }}
        >
          <h3>
            {r.name} — {r.budget_left} left
          </h3>
          <ul>
            {r.won_players.length === 0 && <li>No players yet</li>}
            {r.won_players.map((p) => (
              <li key={p._id}>
                {p.playerName} ({p.rating})
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatsPage({ status }) {
  if (!status) return <p>Loading...</p>;

  return (
    <div>
      <h1>Team Stats</h1>
      <table>
        <thead>
          <tr>
            <th>Participant</th>
            <th>Highest Rated Player</th>
          </tr>
        </thead>
        <tbody>
          {status.rosters.map((r) => {
            const best = r.won_players.reduce(
              (top, p) => (!top || p.rating > top.rating ? p : top),
              null
            );
            return (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{best ? `${best.playerName} (${best.rating})` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;