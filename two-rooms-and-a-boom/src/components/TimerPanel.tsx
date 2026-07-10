import { useEffect, useState } from "react";
import type { RoundInfo } from "@shared/game/types";

export default function TimerPanel({
  round,
  clockSkew,
  isHost,
  onStartRound,
  onPause,
  onEndRound,
  onReshuffle,
  onRevealAll,
}: {
  round: RoundInfo | null;
  clockSkew: number;
  isHost: boolean;
  onStartRound: () => void;
  onPause: () => void;
  onEndRound: () => void;
  onReshuffle: () => void;
  onRevealAll: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!round) {
      setRemainingMs(null);
      return;
    }

    let raf = 0;
    const tick = () => {
      let rem = round.remainingMs;
      if (!round.paused && round.endsAt) {
        rem = Math.max(0, round.endsAt - (Date.now() + clockSkew));
      }
      setRemainingMs(rem ?? null);
      if (!round.paused && round.endsAt && (rem ?? 0) > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [round, clockSkew]);

  const totalMs = (round?.minutes ?? 1) * 60 * 1000;
  const secs = remainingMs == null ? null : Math.ceil(remainingMs / 1000);
  const display =
    secs == null
      ? "Ready"
      : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const pct = remainingMs == null ? 1 : Math.max(0, Math.min(1, remainingMs / totalMs));

  return (
    <div className="timer-block">
      <div className="timer-meta">
        <span>
          {round
            ? `Round ${round.index + 1} / ${round.total} · ${round.label}`
            : "Rounds"}
        </span>
        <span>
          {round ? `${round.hostages} hostage${round.hostages === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <div className={`timer-display ${secs != null && secs <= 30 ? "is-urgent" : ""}`}>
        {display}
      </div>
      <div className="timer-bar">
        <div className="timer-bar-fill" style={{ transform: `scaleX(${pct})` }} />
      </div>
      {isHost && (
        <div className="host-timer-actions">
          <button type="button" className="btn ghost" onClick={onStartRound}>
            Start round
          </button>
          <button type="button" className="btn ghost" onClick={onPause}>
            {round?.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn ghost" onClick={onEndRound}>
            End round
          </button>
          <button type="button" className="btn ghost" onClick={onReshuffle}>
            Back to lobby
          </button>
          <button type="button" className="btn primary" onClick={onRevealAll}>
            Reveal all / end
          </button>
        </div>
      )}
    </div>
  );
}
