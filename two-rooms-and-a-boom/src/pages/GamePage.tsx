import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGameSocket } from "@/hooks/useGameSocket";
import { loadSession, normalizeCode } from "@/lib/api";
import type { PlaysetDef } from "@shared/game/types";
import PlayerList from "@/components/PlayerList";
import RoleCard from "@/components/RoleCard";
import TimerPanel from "@/components/TimerPanel";
import QrCode from "@/components/QrCode";

export default function GamePage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const code = normalizeCode(codeParam || "");
  const saved = loadSession();
  const initialName = saved?.code === code ? saved.name : "Player";

  const {
    session,
    state,
    conn,
    error,
    setError,
    clockSkew,
    send,
    disconnect,
    updateName,
  } = useGameSocket(code || null, initialName);

  const [playsets, setPlaysets] = useState<PlaysetDef[]>([]);
  const [nameDraft, setNameDraft] = useState(initialName);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate("/");
      return;
    }
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d: { playsets: PlaysetDef[] }) => setPlaysets(d.playsets || []))
      .catch(() => undefined);
  }, [code, navigate]);

  useEffect(() => {
    if (state?.you?.name) setNameDraft(state.you.name);
  }, [state?.you?.name]);

  useEffect(() => {
    if (state?.phase === "playing") setCardRevealed(false);
    if (state?.phase === "ended") setCardRevealed(true);
  }, [state?.phase]);

  const playsetBlurb = useMemo(() => {
    const ps = playsets.find((p) => p.id === state?.playsetId);
    return ps ? `${ps.blurb} (${ps.players[0]}–${ps.players[1]} players)` : "";
  }, [playsets, state?.playsetId]);

  if (!code) return null;

  const isLobby = !state || state.phase === "lobby";
  const isHost = Boolean(state?.you?.isHost);
  const meReady = state?.players.find((p) => p.id === state.you?.id)?.ready;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  async function copyLink() {
    const url = `${location.origin}/play/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  function leave() {
    disconnect();
    navigate("/");
  }

  return (
    <section className="view view-game">
      <div className="game-shell">
        <header className="game-header">
          <div className="code-block">
            <span className="code-label">Room</span>
            <button type="button" className="code-value" onClick={copyCode} title="Copy code">
              {code}
            </button>
            {copied && <span className="copy-toast">Copied</span>}
            <button
              type="button"
              className="btn ghost share-btn"
              onClick={() => setShareOpen((v) => !v)}
              aria-expanded={shareOpen}
              aria-label="Share room"
              title="Share room"
            >
              Share
            </button>
          </div>
          <div className="conn" data-status={conn === "live" ? "live" : conn === "offline" ? "offline" : "reconnecting"}>
            <span className="conn-dot" />
            <span className="conn-text">
              {conn === "live"
                ? "Live"
                : conn === "offline"
                  ? "Offline"
                  : conn === "reconnecting"
                    ? "Reconnecting…"
                    : "Connecting…"}
            </span>
          </div>
        </header>

        {shareOpen && (
          <div className="share-panel" role="dialog" aria-label="Share room">
            <div className="share-panel-head">
              <h2>Invite players</h2>
              <button
                type="button"
                className="btn ghost share-close"
                onClick={() => setShareOpen(false)}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <QrCode value={`${location.origin}/play/${code}`} size={192} />
            <p className="share-hint">
              Scan to open <span className="share-code">{code}</span> on your phone
            </p>
            <div className="share-actions">
              <button type="button" className="btn secondary" onClick={copyLink}>
                Copy link
              </button>
              <button type="button" className="btn secondary" onClick={copyCode}>
                Copy code
              </button>
            </div>
          </div>
        )}

        {(error || (!session && conn === "offline")) && (
          <p className="toast">
            {error || "Disconnected"}{" "}
            <Link to="/">Back home</Link>
          </p>
        )}

        {!state && conn !== "offline" && (
          <div className="panel">
            <p className="form-hint">Joining {code}…</p>
          </div>
        )}

        {state && (
          <div className="game-grid">
            <aside className="panel players-panel">
              <div className="panel-head">
                <h2>Players</h2>
                <span className="pill">{state.players.length}</span>
              </div>
              <PlayerList
                players={state.players}
                youId={state.you?.id}
                phase={state.phase}
                isHost={isHost}
                onKick={(pid) => send({ type: "kick", playerId: pid })}
              />
            </aside>

            <section className="panel main-panel">
              {isLobby ? (
                <div className="lobby-controls">
                  <div className="panel-head stacked">
                    <h2>Lobby</h2>
                    <p>
                      {state.players.length < 4
                        ? `${state.players.length} joined · need ${4 - state.players.length} more`
                        : `${state.players.length} players · host can deal`}
                    </p>
                  </div>

                  <label className="field">
                    <span>Your name</span>
                    <input
                      value={nameDraft}
                      maxLength={24}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => updateName(nameDraft)}
                    />
                  </label>

                  {isHost && (
                    <div className="host-setup">
                      <label className="field">
                        <span>Playset</span>
                        <select
                          value={state.playsetId}
                          onChange={(e) =>
                            send({
                              type: "set_playset",
                              playsetId: e.target.value,
                              playerCount: Math.max(4, state.players.length),
                            })
                          }
                        >
                          {playsets
                            .filter((p) => p.id !== "custom")
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <p className="form-hint">{playsetBlurb}</p>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={state.players.length < 4}
                        onClick={() => {
                          setError("");
                          send({ type: "start" });
                        }}
                      >
                        Deal &amp; start
                      </button>
                    </div>
                  )}

                  <div className="lobby-actions">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => send({ type: "ready", ready: !meReady })}
                    >
                      {meReady ? "Unready" : "Ready up"}
                    </button>
                    <button type="button" className="btn ghost danger" onClick={leave}>
                      Leave
                    </button>
                  </div>
                </div>
              ) : (
                <div className="play-controls">
                  <RoleCard
                    card={state.you?.card ?? null}
                    revealed={cardRevealed || state.phase === "ended"}
                    onReveal={() => setCardRevealed(true)}
                  />

                  {state.you?.room && (
                    <div className="room-badge" data-room={state.you.room}>
                      Go to Room {state.you.room}
                    </div>
                  )}

                  <TimerPanel
                    round={state.round}
                    clockSkew={clockSkew}
                    isHost={isHost}
                    onStartRound={() => send({ type: "start_round" })}
                    onPause={() =>
                      send({
                        type: state.round?.paused ? "resume_timer" : "pause_timer",
                      })
                    }
                    onEndRound={() => send({ type: "end_round" })}
                    onReshuffle={() => {
                      if (confirm("Return everyone to the lobby and clear roles?")) {
                        send({ type: "reshuffle" });
                      }
                    }}
                    onRevealAll={() => {
                      if (confirm("End the game and allow final reveals?")) {
                        send({ type: "reveal_all" });
                      }
                    }}
                  />

                  <div className="lobby-actions">
                    <button type="button" className="btn ghost danger" onClick={leave}>
                      Leave
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
