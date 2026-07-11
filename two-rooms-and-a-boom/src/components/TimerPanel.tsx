import { useEffect, useRef, useState } from "react";
import type { RoundInfo } from "@shared/game/types";
import { playRoundEndAlarm } from "@/lib/sound";
import { vibrateRoundEnd } from "@/lib/haptics";

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
  const alarmedEndsAt = useRef<number | null>(null);

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
      } else if (!round.paused && round.endsAt && (rem ?? 0) <= 0) {
        if (alarmedEndsAt.current !== round.endsAt) {
          alarmedEndsAt.current = round.endsAt;
          playRoundEndAlarm();
          vibrateRoundEnd();
        }
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
  const isUrgent = secs != null && secs <= 30;
  const dashOffset = RING_CIRCUMFERENCE * (1 - pct);

  return (
    <div className="timer-block">
      <div className="timer-meta">
        <span>
          {round
            ? `Round ${round.index + 1} of ${round.total} · ${round.label}`
            : "Rounds"}
        </span>
        <span className="pill pill-quiet">
          {round ? `${round.hostages} hostage${round.hostages === 1 ? "" : "s"}` : "No round yet"}
        </span>
      </div>

      <div className="timer-ring-wrap">
        <svg className="timer-ring" viewBox="0 0 120 120" role="img" aria-label={`${display} remaining`}>
          <circle className="timer-ring-track" cx="60" cy="60" r={RING_RADIUS} />
          <circle
            className={`timer-ring-progress ${isUrgent ? "is-urgent" : ""}`}
            cx="60"
            cy="60"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={round ? dashOffset : 0}
          />
        </svg>
        <div className={`timer-display ${isUrgent ? "is-urgent" : ""}`}>{display}</div>
      </div>

      {isHost && (
        <div className="host-timer-actions">
          <button type="button" className="btn secondary" onClick={onStartRound}>
            Start round
          </button>
          <button type="button" className="btn secondary" onClick={onPause}>
            {round?.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn secondary" onClick={onEndRound}>
            End round
          </button>
          <button type="button" className="btn ghost" onClick={onReshuffle}>
            Back to lobby
          </button>
          <button type="button" className="btn primary" onClick={onRevealAll}>
            Reveal all &amp; end
          </button>
        </div>
      )}
    </div>
  );
}
