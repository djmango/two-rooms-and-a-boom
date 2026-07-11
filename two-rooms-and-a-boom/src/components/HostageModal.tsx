import type { PublicPlayer, RoomLeaderInfo } from "@shared/game/types";
import HostagePicker from "./HostagePicker";

export default function HostageModal({
  players,
  youId,
  room,
  roomInfo,
  hostagesAllowed,
  onSelectHostages,
  onClose,
}: {
  players: PublicPlayer[];
  youId?: string;
  room: "A" | "B";
  roomInfo: RoomLeaderInfo;
  hostagesAllowed: number;
  onSelectHostages: (playerIds: string[], newLeaderId?: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Room ${room} hostage selection`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Time&rsquo;s up! Rooms just swapped</h2>
          <button
            type="button"
            className="btn ghost modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <p className="form-hint">
          The exchange already happened automatically. As Room {room}&rsquo;s leader, get a head
          start on who goes over next time.
        </p>
        {hostagesAllowed > 0 ? (
          <HostagePicker
            players={players}
            youId={youId}
            room={room}
            hostagesAllowed={hostagesAllowed}
            currentHostageIds={roomInfo.hostageIds}
            onConfirm={(ids, newLeaderId) => {
              onSelectHostages(ids, newLeaderId);
              onClose();
            }}
            confirmLabel="Confirm & close"
          />
        ) : (
          <p className="form-hint">No hostages to send next round.</p>
        )}
      </div>
    </div>
  );
}
