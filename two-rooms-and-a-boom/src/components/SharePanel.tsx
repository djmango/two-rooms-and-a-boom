import type { PublicPlayer, RevealedShare, ShareRequest } from "@shared/game/types";

export default function SharePanel({
  players,
  youId,
  room,
  outgoingShare,
  revealedToYou,
  onRequestShare,
  onCancelShare,
}: {
  players: PublicPlayer[];
  youId?: string;
  room: "A" | "B";
  outgoingShare: ShareRequest | null;
  revealedToYou: RevealedShare[];
  onRequestShare: (targetId: string, level: "half" | "full") => void;
  onCancelShare: (shareId: string) => void;
}) {
  const roommates = players.filter((p) => p.room === room && p.id !== youId);

  return (
    <div className="share-panel">
      <p className="share-panel-title">Card shares</p>
      <p className="form-hint">
        Ask a roommate to share. They must accept. Color share shows their team
        color; card share shows their full role.
      </p>

      <ul className="share-roommates">
        {roommates.map((p) => (
          <li key={p.id} className="share-roommate">
            <span className="share-roommate-name">{p.name}</span>
            <span className="share-roommate-actions">
              <button
                type="button"
                className="btn ghost share-btn"
                onClick={() => onRequestShare(p.id, "half")}
              >
                Color
              </button>
              <button
                type="button"
                className="btn ghost share-btn"
                onClick={() => onRequestShare(p.id, "full")}
              >
                Card
              </button>
            </span>
          </li>
        ))}
      </ul>

      {outgoingShare && (
        <div className="share-outgoing">
          <span>
            Waiting for {outgoingShare.targetName} to accept your{" "}
            {outgoingShare.level === "half" ? "color" : "card"} share…
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => onCancelShare(outgoingShare.id)}
          >
            Cancel
          </button>
        </div>
      )}

      {revealedToYou.length > 0 && (
        <div className="share-revealed">
          <p className="share-revealed-title">Shared with you</p>
          <ul className="share-revealed-list">
            {revealedToYou.map((r, i) => (
              <li
                key={`${r.peerId}-${i}`}
                className={`share-revealed-item team-${r.team}`}
              >
                <span className="share-revealed-name">{r.peerName}</span>
                {r.level === "full" && r.card ? (
                  <span className="share-revealed-card">
                    <strong>{r.card.name}</strong>
                    <em>{r.card.short}</em>
                  </span>
                ) : (
                  <span className="share-revealed-team">
                    {r.team} team
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
