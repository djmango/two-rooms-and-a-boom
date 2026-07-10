import { useEffect, useState } from "react";
import type { PublicPlayer, RoomLeaderInfo } from "@shared/game/types";

export default function LeaderPanel({
  players,
  youId,
  room,
  roomInfo,
  isLeader,
  hostagesAllowed,
  onVote,
  onSelectHostages,
}: {
  players: PublicPlayer[];
  youId?: string;
  room: "A" | "B";
  roomInfo: RoomLeaderInfo;
  isLeader: boolean;
  hostagesAllowed: number;
  onVote: (targetId: string | null) => void;
  onSelectHostages: (ids: string[]) => void;
}) {
  const roommates = players.filter((p) => p.room === room);
  const leader = roommates.find((p) => p.id === roomInfo.leaderId);
  const myVote = youId ? roomInfo.votes[youId] : undefined;

  const [draft, setDraft] = useState<string[]>(roomInfo.hostageIds);
  useEffect(() => {
    setDraft(roomInfo.hostageIds);
  }, [roomInfo.hostageIds]);

  function toggleDraft(id: string) {
    setDraft((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= hostagesAllowed) return cur;
      return [...cur, id];
    });
  }

  function voteCount(id: string): number {
    return Object.values(roomInfo.votes).filter((t) => t === id).length;
  }

  const dirty =
    draft.length !== roomInfo.hostageIds.length ||
    draft.some((id) => !roomInfo.hostageIds.includes(id));

  return (
    <div className="leader-panel">
      <div className="leader-status">
        {isLeader ? (
          <span className="leader-you-badge">
            <span className="leader-crown" aria-hidden="true">
              ♛
            </span>
            You lead Room {room}
          </span>
        ) : (
          <span className="leader-who">
            Room {room} leader: <strong>{leader ? leader.name : "Choosing…"}</strong>
          </span>
        )}
      </div>

      {isLeader && hostagesAllowed > 0 && (
        <div className="hostage-picker">
          <p className="form-hint">
            Pick up to {hostagesAllowed} hostage{hostagesAllowed === 1 ? "" : "s"} to send to
            the other room
          </p>
          <ul className="hostage-list">
            {roommates
              .filter((p) => p.id !== youId)
              .map((p) => (
                <li key={p.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.includes(p.id)}
                      onChange={() => toggleDraft(p.id)}
                      disabled={!draft.includes(p.id) && draft.length >= hostagesAllowed}
                    />
                    {p.name}
                  </label>
                </li>
              ))}
          </ul>
          <button
            type="button"
            className="btn secondary"
            disabled={!dirty}
            onClick={() => onSelectHostages(draft)}
          >
            Confirm hostages
          </button>
        </div>
      )}

      {!isLeader && roomInfo.hostageIds.length > 0 && (
        <p className="form-hint">
          Hostages selected:{" "}
          {roomInfo.hostageIds
            .map((id) => roommates.find((p) => p.id === id)?.name || "?")
            .join(", ")}
        </p>
      )}

      <div className="leader-vote">
        <p className="form-hint">Not happy with the leader? Point at someone to vote them in.</p>
        <ul className="vote-list">
          {roommates
            .filter((p) => p.id !== youId)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`btn vote-btn ${myVote === p.id ? "primary" : "ghost"}`}
                  onClick={() => onVote(myVote === p.id ? null : p.id)}
                >
                  {p.name}
                  {voteCount(p.id) > 0 && (
                    <span className="pill pill-quiet">{voteCount(p.id)}</span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
