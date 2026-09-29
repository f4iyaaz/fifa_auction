import { useState, useEffect } from "react";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [budget, setBudget] = useState(500);
  const [message, setMessage] = useState("");

  const [joinedCode, setJoinedCode] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [auction, setAuction] = useState(null);

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

    setJoinedCode(data.code);
    setParticipantId(data.participant_id);
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

    setJoinedCode(data.code);
    setParticipantId(data.participant_id);
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

  useEffect(() => {
    if (!joinedCode) return;

    async function fetchAuction() {
      const response = await fetch(`${API_URL}/auctions/${joinedCode}`);
      const data = await response.json();
      setAuction(data);
    }

    fetchAuction();
    const interval = setInterval(fetchAuction, 2000);

    return () => clearInterval(interval);
  }, [joinedCode]);

  if (joinedCode && participantId) {
  const isHost = auction && auction.host_id === participantId;

  return (
    <div>
      <h1>Waiting Room</h1>
      <p>Auction code: {joinedCode}</p>
      <h3>Participants:</h3>
      <ul>
        {auction &&
          auction.participants.map((p) => (
            <li key={p.name}>
              {p.name} — {p.budget_left} left
            </li>
          ))}
      </ul>
      {isHost && <button onClick={handleStart}>Start Auction</button>}
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