import type { PublicPlayer, Phase } from "@shared/game/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function PlayerList({
  players,
  youId,
  phase,
  isHost,
  onKick,
}: {
  players: PublicPlayer[];
  youId?: string;
  phase: Phase;
  isHost?: boolean;
  onKick?: (playerId: string) => void;
}) {
  return (
    <ul className="player-list">
      {players.map((p) => {
        const canKick = isHost && onKick && !p.isHost && p.id !== youId;
        return (
          <li
            key={p.id}
            className={`${p.id === youId ? "is-you" : ""} ${p.isHost ? "is-host" : ""}`}
          >
            <span className="pavatar" aria-hidden="true">
              {initials(p.name)}
            </span>
            <span className="pinfo">
              <span className="pname">{p.name}</span>
              <span className="pmeta">
                <span className={`dot-online ${p.connected ? "" : "dot-offline"}`} />
                {p.room != null && (
                  <span className={`room-tag ${p.room.toLowerCase()}`}>Room {p.room}</span>
                )}
                {phase === "lobby" && (
                  <span className="ready-tag" data-ready={p.ready}>
                    {p.ready ? "Ready" : "Not ready"}
                  </span>
                )}
              </span>
            </span>
            {canKick && (
              <button
                type="button"
                className="kick-btn"
                onClick={() => onKick!(p.id)}
                aria-label={`Remove ${p.name}`}
                title={`Remove ${p.name}`}
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
