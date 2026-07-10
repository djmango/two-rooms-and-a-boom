import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createRoom, normalizeCode, saveSession } from "@/lib/api";

const STEPS = [
  {
    title: "Create a room",
    body: "Host taps create and gets a three-word code — nothing to type on the way in.",
  },
  {
    title: "Everyone joins",
    body: "Players open the link on their phone, drop in a name, and land in the lobby.",
  },
  {
    title: "Deal and split",
    body: "Host picks a playset. Roles deal privately, rooms split, the timer starts.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [joinOpen, setJoinOpen] = useState(Boolean(params.get("room")));
  const [code, setCode] = useState(normalizeCode(params.get("room") || ""));
  const [name, setName] = useState("");
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
        <div className="hero-copy">
          <p className="eyebrow">Free · no install · play in the browser</p>
          <h1>Split the rooms. Trade the hostages. Don&rsquo;t trigger the boom.</h1>
          <p className="lede">
            Create a room, share a three-word code, and play the social deduction
            classic on your phones — or print a shuffled deck for the table.
          </p>

          <div className="hero-actions">
            <button type="button" className="btn primary lg" disabled={busy} onClick={onCreate}>
              {busy ? "Creating room…" : "Create a room"}
            </button>
            <button
              type="button"
              className="btn secondary lg"
              onClick={() => setJoinOpen((v) => !v)}
              aria-expanded={joinOpen}
            >
              Join with a code
            </button>
          </div>

          {joinOpen && (
            <form className="join-panel" onSubmit={onJoin}>
              <div className="join-panel-grid">
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
              </div>
              <button type="submit" className="btn primary">
                Join game
              </button>
            </form>
          )}

          {error && <p className="form-hint error" role="alert">{error}</p>}

          <a className="text-link" href="/print">
            Prefer physical cards? Print a deck instead →
          </a>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="room-diagram">
            <div className="room-diagram-room room-diagram-a">
              <span className="room-diagram-label">Room A</span>
              <div className="room-diagram-dots">
                <span className="room-dot" />
                <span className="room-dot" />
                <span className="room-dot" />
                <span className="room-dot" />
              </div>
            </div>
            <div className="room-diagram-core">
              <span className="room-diagram-core-ring" />
              <span className="room-diagram-core-label">Boom</span>
            </div>
            <div className="room-diagram-room room-diagram-b">
              <span className="room-diagram-label">Room B</span>
              <div className="room-diagram-dots">
                <span className="room-dot" />
                <span className="room-dot" />
                <span className="room-dot" />
                <span className="room-dot" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="how-it-works">
        <ol className="steps-row">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step">
              <span className="step-index">{String(i + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="feature-row">
        <article className="feature">
          <h3>Easy codes</h3>
          <p>
            Say <em>maple-ember-harbor</em> out loud. Plenty of entropy for a night
            of games, none of the friction of an account.
          </p>
        </article>
        <article className="feature">
          <h3>Private roles</h3>
          <p>Only you see your card. The host controls the playset, the deal, and the round timer.</p>
        </article>
        <article className="feature">
          <h3>Durable realtime</h3>
          <p>
            Rooms run on Cloudflare Durable Objects — reconnect instantly if your
            phone sleeps or your signal drops.
          </p>
        </article>
      </div>
    </section>
  );
}
