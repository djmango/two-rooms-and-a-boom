import { useRef, useState } from "react";
import type { CardDef } from "@shared/game/types";

const SWIPE_DEG_PER_PX = 180 / 130;
const TAP_SLOP = 8;

type DragInfo = { pointerId: number; startY: number; moved: boolean };

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
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const drag = useRef<DragInfo | null>(null);

  if (!card) return null;

  const dragging = dragAngle !== null;
  const angle = dragAngle ?? (revealed ? 180 : 0);
  const frontProgress = Math.max(0, Math.min(1, Math.min(angle, 90) / 90));
  const peekOpacity = Math.max(0, Math.min(1, frontProgress * 1.6 - 0.15));

  function settle(finalAngle: number) {
    setDragAngle(null);
    if (finalAngle >= 90) {
      if (!revealed) onReveal();
    } else if (revealed) {
      onHide?.();
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, startY: e.clientY, moved: false };
    setDragAngle(revealed ? 180 : 0);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > TAP_SLOP) d.moved = true;
    const base = revealed ? 180 : 0;
    const next = Math.max(0, Math.min(180, base + delta * SWIPE_DEG_PER_PX));
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
      if (revealed) onHide?.();
      else onReveal();
      return;
    }
    settle(dragAngle ?? (revealed ? 180 : 0));
  }

  function handlePointerCancel() {
    drag.current = null;
    setDragAngle(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (revealed) onHide?.();
    else onReveal();
  }

  return (
    <div className="you-card-wrap">
      <div
        className={`role-card-flip${dragging ? " dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={revealed}
        aria-label={
          revealed
            ? "Your role card. Swipe down or tap to hide it."
            : "Your role card. Swipe up or tap to reveal it."
        }
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
                Swipe up to reveal your role
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
