import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createRoom, normalizeCode, saveSession } from "@/lib/api";

export default function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [joinOpen, setJoinOpen] = useState(Boolean(params.get("room")));
  const [code, setCode] = useState(normalizeCode(params.get("room") || ""));
  const [name, setName] = useState("Player");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      const hostName = name.trim() || "Host";
      const data = await createRoom(hostName);
      saveSession({
        code: data.code,
        playerId: data.playerId,
        secret: data.secret,
        name: hostName,
      });
      navigate(`/play/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setJoinOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function onJoin(ev: FormEvent) {
    ev.preventDefault();
    const room = normalizeCode(code);
    if (room.split("-").length !== 3) {
      setError("Use a three-word code like coral-lantern-swift");
      return;
    }
    const playerName = name.trim() || "Player";
    saveSession({ code: room, playerId: "", secret: "", name: playerName });
    navigate(`/play/${room}`);
  }

  return (
    <section className="view view-home">
      <div className="hero">
        <p className="brand-mark">Two Rooms and a Boom</p>
        <h1>Deal roles. Split rooms. Survive the boom.</h1>
        <p className="lede">
          Create a room, share a three-word code, and play on your phones — or print
          a shuffled deck for the table.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={onCreate}>
            {busy ? "Creating…" : "Create room"}
          </button>
          <button type="button" className="btn ghost" onClick={() => setJoinOpen((v) => !v)}>
            Join with code
          </button>
          <a className="btn ghost" href="/print">
            Print cards
          </a>
        </div>
      </div>

      {joinOpen && (
        <form className="join-panel" onSubmit={onJoin}>
          <label className="field">
            <span>Room code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="coral-lantern-swift"
            />
          </label>
          <label className="field">
            <span>Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Alex"
            />
          </label>
          <button type="submit" className="btn primary">
            Join game
          </button>
          {error && <p className="form-hint error">{error}</p>}
        </form>
      )}

      {!joinOpen && error && <p className="form-hint error">{error}</p>}

      <div className="feature-row">
        <article className="feature">
          <h3>Easy codes</h3>
          <p>
            Say <em>maple-ember-harbor</em> out loud. Enough entropy for a night of games.
          </p>
        </article>
        <article className="feature">
          <h3>Private roles</h3>
          <p>Only you see your card. Host controls playset, deal, and round timer.</p>
        </article>
        <article className="feature">
          <h3>Durable realtime</h3>
          <p>
            Vite + React on Workers, rooms on Durable Objects — reconnects if your phone
            sleeps.
          </p>
        </article>
      </div>
    </section>
  );
}
