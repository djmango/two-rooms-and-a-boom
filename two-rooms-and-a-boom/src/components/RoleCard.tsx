import { useState } from "react";
import type { CardDef } from "@shared/game/types";

type Stage = "hidden" | "peeking" | "revealed";

const ANGLE: Record<Stage, number> = { hidden: 0, peeking: -65, revealed: 180 };

function nextStage(stage: Stage): Stage {
  if (stage === "hidden") return "peeking";
  if (stage === "peeking") return "revealed";
  return "hidden";
}

export default function RoleCard({
  card,
  revealed,
  onReveal,
  onHide,
}: {
  card: CardDef | null;
  revealed: boolean;
  onReveal: () => void;
  onHide?: () => void;
}) {
  const [peeking, setPeeking] = useState(false);

  if (!card) return null;

  const stage: Stage = revealed ? "revealed" : peeking ? "peeking" : "hidden";
  const angle = ANGLE[stage];
  const frontProgress = Math.max(0, Math.min(1, Math.min(Math.abs(angle), 90) / 90));
  const peekOpacity = Math.max(0, Math.min(1, frontProgress * 1.6 - 0.15));

  function advance() {
    const next = nextStage(stage);
    setPeeking(next === "peeking");
    if (next === "revealed") {
      if (!revealed) onReveal();
    } else if (revealed) {
      onHide?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    advance();
  }

  const ariaLabel =
    stage === "revealed"
      ? "Your role card, fully revealed. Tap to hide it."
      : stage === "peeking"
        ? "Your role card, peeking at your team. Tap to fully reveal it."
        : "Your role card. Tap to peek at your team.";

  return (
    <div className="you-card-wrap">
      <div
        className="role-card-flip"
        role="button"
        tabIndex={0}
        aria-pressed={revealed}
        aria-label={ariaLabel}
        onClick={advance}
        onKeyDown={handleKeyDown}
      >
        <div className="role-card-flip-inner" style={{ transform: `rotateY(${angle}deg)` }}>
          <div className="role-card-face role-card-face-front">
            <span className="card-reveal-ring" aria-hidden="true" />
            <div className="card-reveal-inner">
              <span className="peek" style={{ opacity: 1 - peekOpacity }}>
                Tap to peek at your team
              </span>
              <div className={`peek-team team-${card.team}`} style={{ opacity: peekOpacity }}>
                <span className="peek-team-main">
                  <span className="peek-team-dot" aria-hidden="true" />
                  <span className="peek-team-label">{card.team} team</span>
                </span>
                <span className="peek-team-hint">Tap for full reveal</span>
              </div>
            </div>
          </div>
          <div className="role-card-face role-card-face-back">
            <article className={`role-card team-${card.team}`}>
              <div className="team">{card.team}</div>
              <h3>{card.name}</h3>
              <p className="short">{card.short}</p>
              <p className="ability">{card.ability}</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
