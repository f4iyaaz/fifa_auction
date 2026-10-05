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
    const savedScreen = localStorage.getItem("screen");
    if (savedCode && savedId && savedScreen) return savedScreen;
    return savedCode && savedId ? "wishlist" : "lobby";
  });

  const [page, setPage] = useState("game");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [bidAmount, setBidAmount] = useState("");

  function changeScreen(newScreen) {
    localStorage.setItem("screen", newScreen);
    setScreen(newScreen);
  }

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
    localStorage.removeItem("screen");
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
    changeScreen("wishlist");
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
    changeScreen("wishlist");
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
    if (screen !== "wishlist" && !(status && status.state === "BIDDING")) return;
    if (wishlist.length > 0) return;

    fetchWishlist();
  }, [screen, status, joinedCode, participantId]);

  function renderGameContent() {
    if (screen === "wishlist") {
      return (
        <div className="page">
          <h1>Build Your Wishlist</h1>

          <div className="wishlist-layout">
            <div className="wishlist-search-col">
              <div className="search-row">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player name"
                />
                <button className="btn-sm" onClick={handleSearch}>
                  Search
                </button>
              </div>

              <div className="search-results">
                {results.map((p) => (
                  <div className="player-row" key={p._id}>
                    <div className="player-info">
                      <span className="player-name">{p.playerName}</span>
                      <span className="player-meta">
                        {p.position} — {p.club}
                      </span>
                    </div>
                    <div className="player-row-main">
                      <span className="player-rating">{p.rating}</span>
                      <button
                        className="btn-sm"
                        onClick={() => handleAddToWishlist(p._id)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="wishlist-col">
              <div className="section-title">Your Wishlist ({wishlist.length})</div>
              {wishlist.map((p) => (
                <div className="player-row" key={p._id}>
                  <div className="player-info">
                    <span className="player-name">{p.playerName}</span>
                  </div>
                  <span className="player-rating">{p.rating}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn-gold"
            style={{ width: "100%", marginTop: "20px" }}
            onClick={() => changeScreen("waiting")}
            disabled={wishlist.length === 0}
          >
            I'm Ready
          </button>
          {wishlist.length === 0 && (
            <p className="error-text">Add at least one player before continuing.</p>
          )}
          {message && <p className="error-text">{message}</p>}
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
          <div className="page">
            <h1>Bidding</h1>
            <p className="turn-banner">Current turn: {status.current_turn}</p>

            {status.last_result && (
              <div className="result-banner">
                {status.last_result.outcome === "sold" && (
                  <>
                    {status.last_result.winner} won {status.last_result.player} for{" "}
                    {status.last_result.amount}
                  </>
                )}
                {status.last_result.outcome === "unsold" && (
                  <>{status.last_result.player} went unsold (everyone passed)</>
                )}
                {status.last_result.outcome === "tie" && (
                  <>
                    Tie at {status.last_result.amount} between{" "}
                    {status.last_result.tied.join(" and ")} for {status.last_result.player}.
                    Re-bidding...
                  </>
                )}
              </div>
            )}

            {!status.current_player && status.is_your_turn && (
              <div>
                <div className="section-title">It's your turn — call a player</div>
                {wishlist
                  .filter((p) => !isPlayerSold(p._id, status))
                  .map((p) => (
                    <div className="player-row" key={p._id}>
                      <div className="player-info">
                        <span className="player-name">{p.playerName}</span>
                      </div>
                      <div className="player-row-main">
                        <span className="player-rating">{p.rating}</span>
                        <button
                          className="btn-sm btn-gold"
                          onClick={() => handleCallPlayer(p._id)}
                        >
                          Call
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {!status.current_player && !status.is_your_turn && (
              <p className="waiting-text">
                Waiting for {status.current_turn} to call a player...
              </p>
            )}

            {status.current_player && (
              <div className="on-the-clock">
                <div className="player-meta">{status.current_player.club}</div>
                <h2>{status.current_player.playerName}</h2>
                <span className="player-rating">{status.current_player.rating}</span>

                {status.you_can_bid && (
                  <div className="bid-row">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Bid"
                    />
                    <button className="btn-gold" onClick={handleBid}>
                      Bid
                    </button>
                    <button className="btn-pass" onClick={handlePass}>
                      Pass
                    </button>
                  </div>
                )}

                {!status.you_can_bid && status.you_answered && (
                  <p className="waiting-text">
                    Waiting for: {status.waiting_for.join(", ")}
                  </p>
                )}

                {!status.you_can_bid && !status.you_answered && (
                  <p className="waiting-text">You are not part of this bidding round.</p>
                )}
              </div>
            )}

            {message && <p className="error-text">{message}</p>}
          </div>
        );
      }

      const isHost = status && status.is_host;

      return (
        <div className="page">
          <h1>Waiting Room</h1>
          <p>Auction code: {joinedCode}</p>
          <div className="section-title">Participants</div>
          {status &&
            status.rosters.map((p) => (
              <div className="player-row" key={p.name}>
                <div className="player-info">
                  <span className="player-name">{p.name}</span>
                </div>
                <span className="player-meta">{p.budget_left} left</span>
              </div>
            ))}
          {isHost && (
            <button
              className="btn-gold"
              style={{ width: "100%", marginTop: "16px" }}
              onClick={handleStart}
            >
              Start Auction
            </button>
          )}
          <button style={{ width: "100%", marginTop: "10px" }} onClick={handleLeave}>
            Leave (for testing)
          </button>
          {message && <p className="error-text">{message}</p>}
        </div>
      );
    }

    return null;
  }

  if (!joinedCode) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <h1>FIFA Auction</h1>
          <p className="lobby-sub">Draft your dream squad, one bid at a time.</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Budget"
          />
          <button className="btn-gold" onClick={handleCreate}>
            Create Auction
          </button>

          <div className="lobby-divider">or join with a code</div>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Join code"
          />
          <button onClick={handleJoin}>Join Auction</button>

          {message && <p className="error-text">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {page === "game" && renderGameContent()}
        {page === "rosters" && <RostersPage status={status} />}
        {page === "stats" && <StatsPage status={status} />}
      </div>

      <nav className="tab-bar">
        <button
          className={`tab-btn ${page === "game" ? "tab-active" : ""}`}
          onClick={() => setPage("game")}
        >
          Game
        </button>
        <button
          className={`tab-btn ${page === "rosters" ? "tab-active" : ""}`}
          onClick={() => setPage("rosters")}
        >
          Rosters
        </button>
        <button
          className={`tab-btn ${page === "stats" ? "tab-active" : ""}`}
          onClick={() => setPage("stats")}
        >
          Stats
        </button>
      </nav>
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
    return <p className="page">Loading results...</p>;
  }

  return (
    <div className="page">
      <h1>Final Results</h1>
      <div className="rosters-grid">
        {results.squads.map((squad) => (
          <div className="roster-column" key={squad.name}>
            <div className="section-title">
              {squad.name} — spent {squad.spent}, {squad.budget_left} left
            </div>
            {squad.squad.map((p) => (
              <div className="player-row" key={p._id}>
                <div className="player-info">
                  <span className="player-name">{p.playerName}</span>
                </div>
                <span className="player-rating">{p.rating}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RostersPage({ status }) {
  if (!status) return <p className="page">Loading...</p>;

  return (
    <div className="page">
      <h1>All Rosters</h1>
      <div className="rosters-grid">
        {status.rosters.map((r) => (
          <div className="roster-column" key={r.name}>
            <div className="section-title">
              {r.name} — {r.budget_left} left
            </div>
            {r.won_players.length === 0 && <p className="waiting-text">No players yet</p>}
            {r.won_players.map((p) => (
              <div className="player-row" key={p._id}>
                <div className="player-info">
                  <span className="player-name">{p.playerName}</span>
                </div>
                <span className="player-rating">{p.rating}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsPage({ status }) {
  if (!status) return <p className="page">Loading...</p>;

  return (
    <div className="page">
      <h1>Team Stats</h1>
      {status.rosters.map((r) => {
        const best = r.won_players.reduce(
          (top, p) => (!top || p.rating > top.rating ? p : top),
          null
        );
        return (
          <div className="player-row" key={r.name}>
            <div className="player-info">
              <span className="player-name">{r.name}</span>
              <span className="player-meta">Highest rated</span>
            </div>
            <div className="player-row-main">
              {best ? (
                <>
                  <span className="player-name" style={{ marginRight: "10px" }}>
                    {best.playerName}
                  </span>
                  <span className="player-rating">{best.rating}</span>
                </>
              ) : (
                <span className="player-meta">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;