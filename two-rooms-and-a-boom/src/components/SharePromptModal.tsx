import type { ShareRequest } from "@shared/game/types";

export default function SharePromptModal({
  share,
  onRespond,
}: {
  share: ShareRequest;
  onRespond: (shareId: string, accept: boolean) => void;
}) {
  const levelLabel = share.level === "half" ? "color" : "card";
  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${share.requesterName} wants to ${levelLabel} share`}
      >
        <div className="modal-head">
          <h2>Share request</h2>
        </div>
        <p className="form-hint">
          <strong>{share.requesterName}</strong> wants to {levelLabel} share
          with you. {share.level === "half" ? "They&rsquo;ll see your team color." : "They&rsquo;ll see your full role."} You&rsquo;ll see theirs.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => onRespond(share.id, true)}
          >
            Accept
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => onRespond(share.id, false)}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
