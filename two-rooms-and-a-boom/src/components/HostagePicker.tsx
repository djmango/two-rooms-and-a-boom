import { useEffect, useRef, useState } from "react";
import type { PublicPlayer } from "@shared/game/types";

function idsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

export default function HostagePicker({
  players,
  youId,
  room,
  hostagesAllowed,
  currentHostageIds,
  onConfirm,
  confirmLabel = "Confirm hostages",
}: {
  players: PublicPlayer[];
  youId?: string;
  room: "A" | "B";
  hostagesAllowed: number;
  currentHostageIds: string[];
  onConfirm: (playerIds: string[], newLeaderId?: string) => void;
  confirmLabel?: string;
}) {
  const roommates = players.filter((p) => p.room === room);

  const [draft, setDraft] = useState<string[]>(currentHostageIds);
  const [newLeaderId, setNewLeaderId] = useState<string | null>(null);

  // Every broadcast produces a brand-new array reference even when the
  // underlying hostage selection hasn't actually changed (e.g. another
  // player voting elsewhere). Re-sync on content, not identity, so we
  // don't silently wipe out someone's in-progress, unsaved selection.
  const hostageKey = idsKey(currentHostageIds);
  const lastSyncedKey = useRef(hostageKey);
  useEffect(() => {
    if (hostageKey !== lastSyncedKey.current) {
      lastSyncedKey.current = hostageKey;
      setDraft(currentHostageIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostageKey]);

  const steppingDown = youId != null && draft.includes(youId);

  useEffect(() => {
    if (!steppingDown) setNewLeaderId(null);
  }, [steppingDown]);

  function toggleDraft(id: string) {
    setDraft((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= hostagesAllowed) return cur;
      return [...cur, id];
    });
  }

  const successorOptions = roommates.filter((p) => p.id !== youId && !draft.includes(p.id));

  const dirty =
    draft.length !== currentHostageIds.length ||
    draft.some((id) => !currentHostageIds.includes(id));
  const canConfirm = dirty && (!steppingDown || Boolean(newLeaderId));

  return (
    <div className="hostage-picker">
      <p className="form-hint">
        Pick up to {hostagesAllowed} hostage{hostagesAllowed === 1 ? "" : "s"} to send to the
        other room
      </p>
      <ul className="hostage-list">
        {roommates.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={draft.includes(p.id)}
                onChange={() => toggleDraft(p.id)}
                disabled={!draft.includes(p.id) && draft.length >= hostagesAllowed}
              />
              {p.id === youId ? "You (step down and go yourself)" : p.name}
            </label>
          </li>
        ))}
      </ul>

      {steppingDown && (
        <div className="successor-picker">
          <p className="form-hint">You&rsquo;re stepping down. Who leads Room {room} next?</p>
          {successorOptions.length > 0 ? (
            <ul className="successor-list">
              {successorOptions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`btn vote-btn ${newLeaderId === p.id ? "primary" : "ghost"}`}
                    onClick={() => setNewLeaderId(p.id)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-hint error">No one else is left in the room to take over.</p>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn secondary"
        disabled={!canConfirm}
        onClick={() => onConfirm(draft, steppingDown ? (newLeaderId ?? undefined) : undefined)}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
