import type { PublicPlayer, Phase } from "@shared/game/types";

export default function PlayerList({
  players,
  youId,
  phase,
}: {
  players: PublicPlayer[];
  youId?: string;
  phase: Phase;
}) {
  return (
    <ul className="player-list">
      {players.map((p) => (
        <li
          key={p.id}
          className={`${p.id === youId ? "is-you" : ""} ${p.isHost ? "is-host" : ""}`}
        >
          <span className="pname">{p.name}</span>
          <span className="pmeta">
            <span className={`dot-online ${p.connected ? "" : "dot-offline"}`} />
            {p.room != null && (
              <span className={`room-tag ${p.room.toLowerCase()}`}>Room {p.room}</span>
            )}
            {phase === "lobby" && <span>{p.ready ? "ready" : "…"}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
