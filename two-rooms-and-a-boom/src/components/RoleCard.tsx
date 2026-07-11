import type { CardDef } from "@shared/game/types";
import { useState } from "react";
import { cardImageUrl } from "@/lib/cardImages";
import { displayTeam } from "@shared/game/deck";

type Stage = "hidden" | "peeking" | "revealed";

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
  // Spies print in their deceptive color, not their true team's -- a quick
  // peek at your own card should show exactly what a glance at the card
  // shows anyone else, so Spies peek their apparent (cover) team here too.
  const peekTeam = displayTeam(card);

  // Two independent, full (0deg <-> 180deg) flips on different axes, so the
  // card always lands flat and readable: never resting mid-rotation.
  const rotateX = stage === "peeking" ? 180 : 0;
  const rotateY = stage === "revealed" ? 180 : 0;
  // The back face's own counter-rotation must match whichever axis is
  // carrying it into view, otherwise it renders upside down or mirrored.
  const backLocalRotate = stage === "peeking" ? "rotateX(180deg)" : "rotateY(180deg)";

  function goHidden() {
    setPeeking(false);
    if (revealed) onHide?.();
  }

  function goPeek() {
    setPeeking(true);
  }

  function goFull() {
    setPeeking(false);
    if (!revealed) onReveal();
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (stage !== "hidden") {
      goHidden();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const tappedTopHalf = e.clientY - rect.top < rect.height / 2;
    if (tappedTopHalf) goPeek();
    else goFull();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (stage === "hidden") goFull();
    else goHidden();
  }

  const ariaLabel =
    stage === "revealed"
      ? "Your role card, fully revealed. Tap to hide it."
      : stage === "peeking"
        ? "Your role card, peeking at your team. Tap to hide it."
        : "Your role card. Tap the top half to peek at your team, or the bottom half to fully reveal it.";

  return (
    <div className="you-card-wrap">
      <div
        className="role-card-flip"
        role="button"
        tabIndex={0}
        aria-pressed={revealed}
        aria-label={ariaLabel}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div
          className="role-card-flip-inner"
          style={{ transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` }}
        >
          <div className="role-card-face role-card-face-front">
            <div className="tap-zone tap-zone-top">
              <span className="tap-zone-label">Peek team</span>
            </div>
            <span className="tap-zone-divider" aria-hidden="true" />
            <div className="tap-zone tap-zone-bottom">
              <span className="tap-zone-label">Full reveal</span>
            </div>
          </div>
          <div className="role-card-face role-card-face-back" style={{ transform: backLocalRotate }}>
            {stage === "peeking" ? (
              <article className={`role-card role-card-peek team-${peekTeam}`}>
                <div className="team">{peekTeam}</div>
                <h3>{peekTeam} team</h3>
                <p className="short">Tap to see your full role</p>
              </article>
            ) : cardImageUrl(card) ? (
              <img
                className="role-card-art"
                src={cardImageUrl(card)!}
                alt={`${card.name}: ${card.ability}`}
                draggable={false}
              />
            ) : (
              <article className={`role-card team-${card.team}`}>
                <div className="team">{card.team}</div>
                <h3>{card.name}</h3>
                <p className="short">{card.short}</p>
                <p className="ability">{card.ability}</p>
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
