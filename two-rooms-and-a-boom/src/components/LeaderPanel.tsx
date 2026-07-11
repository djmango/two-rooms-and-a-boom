import type { PublicPlayer, RoomLeaderInfo } from "@shared/game/types";
import HostagePicker from "./HostagePicker";

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
  onSelectHostages: (playerIds: string[], newLeaderId?: string) => void;
}) {
  const roommates = players.filter((p) => p.room === room);
  const leader = roommates.find((p) => p.id === roomInfo.leaderId);
  const myVote = youId ? roomInfo.votes[youId] : undefined;

  function voteCount(id: string): number {
    return Object.values(roomInfo.votes).filter((t) => t === id).length;
  }

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
        <HostagePicker
          players={players}
          youId={youId}
          room={room}
          hostagesAllowed={hostagesAllowed}
          currentHostageIds={roomInfo.hostageIds}
          onConfirm={onSelectHostages}
        />
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
