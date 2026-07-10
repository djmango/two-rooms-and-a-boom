export type Team = "blue" | "red" | "grey" | "leader";

export type Phase = "lobby" | "dealing" | "playing" | "ended";

export interface CardDef {
  id: string;
  name: string;
  team: Team;
  kind: string;
  short: string;
  ability: string;
}

export interface PlaysetDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  players: [number, number];
  cardIds: string[] | null;
  oddCard: string | null;
  bury?: boolean;
  fixedPlayers?: number;
  ruleset?: "classic-kaboom";
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isLeader: boolean;
  isBot: boolean;
  room: "A" | "B" | null;
}

export interface RoomLeaderInfo {
  leaderId: string | null;
  hostageIds: string[];
  votes: Record<string, string>;
}

export interface RoundInfo {
  index: number;
  total: number;
  label: string;
  minutes: number;
  hostages: number;
  endsAt: number | null;
  paused: boolean;
  remainingMs: number | null;
}

export interface PublicState {
  code: string;
  phase: Phase;
  playsetId: string;
  playsetName: string;
  playerCountTarget: number;
  players: PublicPlayer[];
  hostId: string | null;
  round: RoundInfo | null;
  buriedPresent: boolean;
  rooms: { A: RoomLeaderInfo; B: RoomLeaderInfo } | null;
  you: {
    id: string;
    name: string;
    isHost: boolean;
    isLeader: boolean;
    card: CardDef | null;
    room: "A" | "B" | null;
  } | null;
  serverTime: number;
}

export type ClientMessage =
  | { type: "hello"; name: string; playerId?: string; secret?: string }
  | { type: "set_name"; name: string }
  | { type: "ready"; ready: boolean }
  | { type: "set_playset"; playsetId: string; playerCount: number }
  | { type: "start" }
  | { type: "reshuffle" }
  | { type: "start_round" }
  | { type: "pause_timer" }
  | { type: "resume_timer" }
  | { type: "end_round" }
  | { type: "reveal_all" }
  | { type: "kick"; playerId: string }
  | { type: "vote_leader"; targetId: string | null }
  | { type: "select_hostages"; playerIds: string[] }
  | { type: "ping" };

export type ServerMessage =
  | { type: "welcome"; playerId: string; secret: string; state: PublicState }
  | { type: "state"; state: PublicState }
  | { type: "error"; message: string }
  | { type: "pong"; t: number };
