import { useRef, useState } from "react";
import type { CardDef } from "@shared/game/types";

const SWIPE_DEG_PER_PX = 180 / 130;
const TAP_SLOP = 8;
const HIDDEN_ANGLE = 0;
const FULL_ANGLE = 180;
const PEEK_ANGLE = -65;
const FULL_SNAP_THRESHOLD = 90;
const PEEK_SNAP_THRESHOLD = PEEK_ANGLE / 2;

type Stage = "hidden" | "peeking" | "revealed";
type DragInfo = { pointerId: number; startY: number; base: number; moved: boolean };

function restAngleFor(stage: Stage): number {
  if (stage === "revealed") return FULL_ANGLE;
  if (stage === "peeking") return PEEK_ANGLE;
  return HIDDEN_ANGLE;
}

function resolveStage(finalAngle: number): Stage {
  if (finalAngle >= FULL_SNAP_THRESHOLD) return "revealed";
  if (finalAngle <= PEEK_SNAP_THRESHOLD) return "peeking";
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
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const drag = useRef<DragInfo | null>(null);

  if (!card) return null;

  const stage: Stage = revealed ? "revealed" : peeking ? "peeking" : "hidden";
  const dragging = dragAngle !== null;
  const angle = dragAngle ?? restAngleFor(stage);
  const frontProgress = Math.max(0, Math.min(1, Math.min(Math.abs(angle), 90) / 90));
  const peekOpacity = Math.max(0, Math.min(1, frontProgress * 1.6 - 0.15));

  function applyStage(target: Stage) {
    setPeeking(target === "peeking");
    if (target === "revealed") {
      if (!revealed) onReveal();
    } else if (revealed) {
      onHide?.();
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = restAngleFor(stage);
    drag.current = { pointerId: e.pointerId, startY: e.clientY, base, moved: false };
    setDragAngle(base);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > TAP_SLOP) d.moved = true;
    const next = Math.max(PEEK_ANGLE, Math.min(FULL_ANGLE, d.base + delta * SWIPE_DEG_PER_PX));
    setDragAngle(next);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!d || d.pointerId !== e.pointerId) {
      setDragAngle(null);
      return;
    }
    if (!d.moved) {
      setDragAngle(null);
      applyStage(revealed ? "hidden" : "revealed");
      return;
    }
    const finalAngle = dragAngle ?? d.base;
    setDragAngle(null);
    applyStage(resolveStage(finalAngle));
  }

  function handlePointerCancel() {
    drag.current = null;
    setDragAngle(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    applyStage(revealed ? "hidden" : "revealed");
  }

  const ariaLabel =
    stage === "revealed"
      ? "Your role card. Swipe down or tap to hide it."
      : stage === "peeking"
        ? "Your role card, peeking at your team. Swipe up to fully reveal it, swipe down or tap to hide it."
        : "Your role card. Swipe up to fully reveal it, swipe down to peek at your team, or tap to reveal it.";

  return (
    <div className="you-card-wrap">
      <div
        className={`role-card-flip${dragging ? " dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={revealed}
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <div
          className="role-card-flip-inner"
          style={{
            transform: `rotateY(${angle}deg)`,
            transition: dragging ? "none" : undefined,
          }}
        >
          <div className="role-card-face role-card-face-front">
            <span className="card-reveal-ring" aria-hidden="true" />
            <div className="card-reveal-inner">
              <span className="peek" style={{ opacity: 1 - peekOpacity }}>
                Swipe up to reveal
                <br />
                swipe down to peek team
              </span>
              <div className={`peek-team team-${card.team}`} style={{ opacity: peekOpacity }}>
                <span className="peek-team-dot" aria-hidden="true" />
                <span className="peek-team-label">{card.team} team</span>
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
