import { DurableObject } from "cloudflare:workers";
import { normalizeCode } from "../shared/game/codes";
import {
  PLAYSETS,
  assignRooms,
  buildDeck,
  getPlayset,
  pickableCards,
  roundsFor,
} from "../shared/game/deck";
import type {
  CardDef,
  ClientMessage,
  Phase,
  PublicState,
  ServerMessage,
} from "../shared/game/types";

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

interface PlayerRecord {
  id: string;
  secret: string;
  name: string;
  ready: boolean;
  card: CardDef | null;
  room: "A" | "B" | null;
  lastSeen: number;
  isBot?: boolean;
}

interface RoomState {
  code: string;
  phase: Phase;
  playsetId: string;
  playerCountTarget: number;
  packIds: string[];
  hostId: string | null;
  players: PlayerRecord[];
  buried: CardDef | null;
  roundIndex: number;
  roundEndsAt: number | null;
  roundPaused: boolean;
  roundPausedRemainingMs: number | null;
  leaders: { A: string | null; B: string | null };
  hostageSelections: { A: string[]; B: string[] };
  leaderVotes: { A: Record<string, string>; B: Record<string, string> };
  createdAt: number;
  updatedAt: number;
}

interface WsAttach {
  playerId: string;
}

const MAX_PLAYERS = 30;
const IDLE_ALARM_MS = 1000 * 60 * 60 * 6; // 6h cleanup
const NAME_MAX = 24;

// Card IDs the host is allowed to toggle into a "custom-mix" deck.
// Built once at module load from the catalog.
const PICKABLE_CARD_IDS: ReadonlySet<string> = new Set(pickableCards().map((c) => c.id));

// Joining or creating a room as "test" (any case) drops in a handful of
// ready bot players so solo dev/testing doesn't need extra devices/tabs.
const TEST_MODE_NAME = "test";
const TEST_BOT_NAMES = ["Agent Nova", "Agent Blitz", "Agent Comet", "Agent Sable", "Agent Rex"];

function isTestModeName(name: string): boolean {
  return name.trim().toLowerCase() === TEST_MODE_NAME;
}

function seedTestBots(state: RoomState): void {
  if (state.players.some((p) => p.isBot)) return;
  for (const name of TEST_BOT_NAMES) {
    state.players.push({
      id: randomId(),
      secret: randomId(),
      name,
      ready: true,
      card: null,
      room: null,
      lastSeen: Date.now(),
      isBot: true,
    });
  }
}

function randomId(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export class GameRoom extends DurableObject<Env> {
  private cache: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const existing = await this.ctx.storage.get<RoomState>("room");
      if (existing) this.cache = migrateState(existing);
    });
  }

  private async load(): Promise<RoomState | null> {
    if (this.cache) return this.cache;
    const existing = await this.ctx.storage.get<RoomState>("room");
    this.cache = existing ? migrateState(existing) : null;
    return this.cache;
  }

  private async save(state: RoomState): Promise<void> {
    state.updatedAt = Date.now();
    this.cache = state;
    await this.ctx.storage.put("room", state);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_ALARM_MS);
  }

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const idle = Date.now() - state.updatedAt;
    const sockets = this.ctx.getWebSockets().length;
    if (sockets === 0 && idle >= IDLE_ALARM_MS - 1000) {
      await this.ctx.storage.deleteAll();
      this.cache = null;
    } else {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_ALARM_MS);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/create") && request.method === "POST") {
      return this.handleCreate(request);
    }
    if (path.endsWith("/info") && request.method === "GET") {
      return this.handleInfo();
    }
    if (path.endsWith("/ws")) {
      return this.handleWs(request);
    }
    return json({ error: "Not found" }, 404);
  }

  private async handleCreate(request: Request): Promise<Response> {
    let body: { hostName?: string; playsetId?: string; playerCount?: number } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* empty */
    }

    const existing = await this.load();
    if (existing && existing.players.some((p) => this.isConnected(p.id))) {
      return json({ error: "Room code already in use. Try again." }, 409);
    }

    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code") || "");
    if (!code) return json({ error: "Missing room code" }, 400);

    const hostId = randomId();
    const secret = randomId();
    const hostName = sanitizeName(body.hostName || "Host");
    const playsetId = body.playsetId && PLAYSETS.some((p) => p.id === body.playsetId)
      ? body.playsetId
      : "basic";
    const playerCount = clamp(
      Number(body.playerCount) || 10,
      4,
      MAX_PLAYERS
    );

    const state: RoomState = {
      code,
      phase: "lobby",
      playsetId,
      playerCountTarget: playerCount,
      packIds: [],
      hostId,
      players: [
        {
          id: hostId,
          secret,
          name: hostName,
          ready: true,
          card: null,
          room: null,
          lastSeen: Date.now(),
        },
      ],
      buried: null,
      roundIndex: 0,
      roundEndsAt: null,
      roundPaused: false,
      roundPausedRemainingMs: null,
      leaders: { A: null, B: null },
      hostageSelections: { A: [], B: [] },
      leaderVotes: { A: {}, B: {} },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (isTestModeName(hostName)) seedTestBots(state);

    await this.save(state);
    return json({
      code,
      playerId: hostId,
      secret,
      playsetId,
      playerCount,
    });
  }

  private async handleInfo(): Promise<Response> {
    const state = await this.load();
    if (!state) return json({ exists: false }, 404);
    return json({
      exists: true,
      code: state.code,
      phase: state.phase,
      playerCount: state.players.length,
      playerCountTarget: state.playerCountTarget,
      playsetId: state.playsetId,
    });
  }

  private async handleWs(request: Request): Promise<Response> {
    const state = await this.load();
    if (!state) return json({ error: "Room not found" }, 404);

    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ error: "Expected WebSocket" }, 426);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);

    // Attachment filled after hello
    server.serializeAttachment({ playerId: "" } satisfies WsAttach);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      this.send(ws, { type: "error", message: "Invalid message" });
      return;
    }

    try {
      if (msg.type === "ping") {
        this.send(ws, { type: "pong", t: Date.now() });
        return;
      }
      if (msg.type === "hello") {
        await this.onHello(ws, msg);
        return;
      }

      const attach = ws.deserializeAttachment() as WsAttach | null;
      if (!attach?.playerId) {
        this.send(ws, { type: "error", message: "Say hello first" });
        return;
      }

      const state = await this.load();
      if (!state) {
        this.send(ws, { type: "error", message: "Room gone" });
        return;
      }

      const player = state.players.find((p) => p.id === attach.playerId);
      if (!player) {
        this.send(ws, { type: "error", message: "Not in room" });
        return;
      }
      player.lastSeen = Date.now();

      switch (msg.type) {
        case "set_name":
          player.name = sanitizeName(msg.name);
          if (state.phase === "lobby" && isTestModeName(player.name)) seedTestBots(state);
          break;
        case "ready":
          if (state.phase === "lobby") player.ready = Boolean(msg.ready);
          break;
        case "set_playset":
          if (player.id !== state.hostId) throw new Error("Only the host can change the playset.");
          if (state.phase !== "lobby") throw new Error("Game already started.");
          getPlayset(msg.playsetId);
          state.playsetId = msg.playsetId;
          state.playerCountTarget = clamp(Number(msg.playerCount) || state.playerCountTarget, 4, MAX_PLAYERS);
          if (msg.playsetId === "custom-mix") {
            const ids = [...new Set(msg.cardIds ?? [])];
            for (const id of ids) {
              if (!PICKABLE_CARD_IDS.has(id)) {
                throw new Error(`Card ${id} isn't pickable in a custom mix.`);
              }
            }
            state.packIds = ids;
          } else {
            state.packIds = [];
          }
          break;
        case "start":
          await this.startGame(state, player.id);
          break;
        case "reshuffle":
          await this.reshuffle(state, player.id);
          break;
        case "start_round":
          this.startRound(state, player.id);
          break;
        case "pause_timer":
          this.pauseTimer(state, player.id);
          break;
        case "resume_timer":
          this.resumeTimer(state, player.id);
          break;
        case "end_round":
          this.endRound(state, player.id);
          break;
        case "reveal_all":
          if (player.id !== state.hostId) throw new Error("Only the host can end the game.");
          state.phase = "ended";
          state.roundEndsAt = null;
          break;
        case "kick":
          if (player.id !== state.hostId) throw new Error("Only the host can kick.");
          if (msg.playerId === state.hostId) throw new Error("Cannot kick the host.");
          state.players = state.players.filter((p) => p.id !== msg.playerId);
          this.closePlayerSockets(msg.playerId, 4000, "Kicked");
          break;
        case "vote_leader":
          this.voteLeader(state, player.id, msg.targetId);
          break;
        case "select_hostages":
          this.selectHostages(state, player.id, msg.playerIds, msg.newLeaderId);
          break;
        default:
          throw new Error("Unknown action");
      }

      await this.save(state);
      this.broadcastState(state);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Something went wrong";
      this.send(ws, { type: "error", message: messageText });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attach = ws.deserializeAttachment() as WsAttach | null;
    if (!attach?.playerId) return;
    const state = await this.load();
    if (!state) return;
    // Keep player in lobby/game for reconnect; just mark via connected flag in public state
    await this.save(state);
    this.broadcastState(state);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, "error");
    } catch {
      /* ignore */
    }
  }

  private async onHello(
    ws: WebSocket,
    msg: Extract<ClientMessage, { type: "hello" }>
  ): Promise<void> {
    const state = await this.load();
    if (!state) {
      this.send(ws, { type: "error", message: "Room not found" });
      return;
    }

    let player: PlayerRecord | undefined;

    if (msg.playerId && msg.secret) {
      player = state.players.find((p) => p.id === msg.playerId && p.secret === msg.secret);
      if (player) {
        // Drop duplicate sockets for same player (single device)
        for (const other of this.ctx.getWebSockets()) {
          if (other === ws) continue;
          const a = other.deserializeAttachment() as WsAttach | null;
          if (a?.playerId === player.id) {
            try {
              other.close(4001, "Replaced by new connection");
            } catch {
              /* ignore */
            }
          }
        }
        if (msg.name) player.name = sanitizeName(msg.name);
        player.lastSeen = Date.now();
      }
    }

    if (!player) {
      if (state.phase !== "lobby") {
        this.send(ws, { type: "error", message: "Game already in progress. Ask the host for a rejoin link." });
        return;
      }
      if (state.players.length >= MAX_PLAYERS) {
        this.send(ws, { type: "error", message: "Room is full." });
        return;
      }

      // Reclaim a disconnected player slot with the same name instead of
      // creating a duplicate (e.g. when a device loses its localStorage session).
      const incomingName = sanitizeName(msg.name || `Player ${state.players.length + 1}`);
      const stale = state.players.find(
        (p) => p.name === incomingName && p.id !== state.hostId && !this.isConnected(p.id)
      );
      if (stale) {
        stale.secret = randomId();
        stale.lastSeen = Date.now();
        stale.ready = false;
        player = stale;
      } else {
        player = {
          id: randomId(),
          secret: randomId(),
          name: incomingName,
          ready: false,
          card: null,
          room: null,
          lastSeen: Date.now(),
        };
        state.players.push(player);
      }
    }

    if (state.phase === "lobby" && isTestModeName(player.name)) seedTestBots(state);

    ws.serializeAttachment({ playerId: player.id } satisfies WsAttach);
    await this.save(state);

    this.send(ws, {
      type: "welcome",
      playerId: player.id,
      secret: player.secret,
      state: this.publicState(state, player.id),
    });
    this.broadcastState(state);
  }

  private async startGame(state: RoomState, actorId: string): Promise<void> {
    if (actorId !== state.hostId) throw new Error("Only the host can start.");
    if (state.phase !== "lobby") throw new Error("Already started.");
    if (state.players.length < 4) throw new Error("Need at least 4 players.");

    const playset = getPlayset(state.playsetId);
    const n = state.players.length;
    const { cards, buried } = buildDeck(n, playset, state.packIds);
    const rooms = assignRooms(n);
    const order = shuffleIndices(n);

    const roomMembers: { A: string[]; B: string[] } = { A: [], B: [] };
    for (let i = 0; i < n; i += 1) {
      const p = state.players[order[i]!]!;
      p.card = cards[i]!;
      p.room = rooms[i]!;
      p.ready = false;
      roomMembers[p.room].push(p.id);
    }

    state.buried = buried;
    state.phase = "playing";
    state.roundIndex = 0;
    state.roundEndsAt = null;
    state.roundPaused = false;
    state.roundPausedRemainingMs = null;
    state.leaders = {
      A: pickRandom(roomMembers.A),
      B: pickRandom(roomMembers.B),
    };
    state.hostageSelections = { A: [], B: [] };
    state.leaderVotes = { A: {}, B: {} };
  }

  private async reshuffle(state: RoomState, actorId: string): Promise<void> {
    if (actorId !== state.hostId) throw new Error("Only the host can reshuffle.");
    if (state.phase === "lobby") throw new Error("Start the game first.");
    state.phase = "lobby";
    state.buried = null;
    state.roundIndex = 0;
    state.roundEndsAt = null;
    state.leaders = { A: null, B: null };
    state.hostageSelections = { A: [], B: [] };
    state.leaderVotes = { A: {}, B: {} };
    for (const p of state.players) {
      p.card = null;
      p.room = null;
      p.ready = p.id === state.hostId;
    }
  }

  private requireHost(state: RoomState, actorId: string): void {
    if (actorId !== state.hostId) throw new Error("Only the host can control the timer.");
  }

  private startRound(state: RoomState, actorId: string): void {
    this.requireHost(state, actorId);
    if (state.phase !== "playing" && state.phase !== "ended") {
      throw new Error("Game not in progress.");
    }
    state.phase = "playing";
    const rounds = roundsFor(getPlayset(state.playsetId), state.players.length);
    if (state.roundIndex >= rounds.length) state.roundIndex = 0;
    const round = rounds[state.roundIndex]!;
    state.roundEndsAt = Date.now() + round.minutes * 60 * 1000;
    state.roundPaused = false;
    state.roundPausedRemainingMs = null;
  }

  private pauseTimer(state: RoomState, actorId: string): void {
    this.requireHost(state, actorId);
    if (!state.roundEndsAt || state.roundPaused) return;
    state.roundPausedRemainingMs = Math.max(0, state.roundEndsAt - Date.now());
    state.roundPaused = true;
    state.roundEndsAt = null;
  }

  private resumeTimer(state: RoomState, actorId: string): void {
    this.requireHost(state, actorId);
    if (!state.roundPaused || state.roundPausedRemainingMs == null) return;
    state.roundEndsAt = Date.now() + state.roundPausedRemainingMs;
    state.roundPaused = false;
    state.roundPausedRemainingMs = null;
  }

  private endRound(state: RoomState, actorId: string): void {
    this.requireHost(state, actorId);
    this.exchangeHostages(state);
    state.roundEndsAt = null;
    state.roundPaused = false;
    state.roundPausedRemainingMs = null;
    const rounds = roundsFor(getPlayset(state.playsetId), state.players.length);
    state.roundIndex = Math.min(rounds.length - 1, state.roundIndex + 1);
  }

  private exchangeHostages(state: RoomState): void {
    for (const id of state.hostageSelections.A) {
      const p = state.players.find((pp) => pp.id === id);
      if (p && p.room === "A") p.room = "B";
    }
    for (const id of state.hostageSelections.B) {
      const p = state.players.find((pp) => pp.id === id);
      if (p && p.room === "B") p.room = "A";
    }
    state.hostageSelections = { A: [], B: [] };
    // Room membership just changed, so clear stale usurpation votes.
    state.leaderVotes = { A: {}, B: {} };
  }

  private selectHostages(
    state: RoomState,
    actorId: string,
    playerIds: string[],
    newLeaderId?: string | null
  ): void {
    if (state.phase !== "playing") throw new Error("Hostages can only be picked while playing.");
    const actor = state.players.find((p) => p.id === actorId);
    if (!actor?.room) throw new Error("You are not assigned to a room.");
    const room = actor.room;
    if (state.leaders[room] !== actorId) {
      throw new Error("Only your room's leader can select hostages.");
    }

    const rounds = roundsFor(getPlayset(state.playsetId), state.players.length);
    const roundIndex = Math.min(state.roundIndex, rounds.length - 1);
    const maxHostages = rounds[roundIndex]!.hostages;

    const ids = [...new Set(playerIds)];
    if (ids.length > maxHostages) {
      throw new Error(`You can only send ${maxHostages} hostage${maxHostages === 1 ? "" : "s"} this round.`);
    }
    for (const id of ids) {
      const p = state.players.find((pp) => pp.id === id);
      if (!p || p.room !== room) throw new Error("Hostages must be from your own room.");
    }

    // A leader can choose to go out as a hostage themselves (abdicating),
    // but only if they hand the leadership to someone staying behind first.
    const abdicating = ids.includes(actorId);
    if (abdicating) {
      if (!newLeaderId) {
        throw new Error("Pick who takes over as leader before you can step down.");
      }
      if (newLeaderId === actorId) {
        throw new Error("The new leader can't be the outgoing leader.");
      }
      if (ids.includes(newLeaderId)) {
        throw new Error("The new leader can't also be a hostage.");
      }
      const successor = state.players.find((p) => p.id === newLeaderId);
      if (!successor || successor.room !== room) {
        throw new Error("The new leader must be from your own room.");
      }
      state.leaders[room] = newLeaderId;
      state.leaderVotes[room] = {};
    }

    state.hostageSelections[room] = ids;
  }

  private voteLeader(state: RoomState, actorId: string, targetId: string | null): void {
    if (state.phase !== "playing") throw new Error("Leadership votes only happen while playing.");
    const actor = state.players.find((p) => p.id === actorId);
    if (!actor?.room) throw new Error("You are not assigned to a room.");
    const room = actor.room;

    if (targetId == null) {
      delete state.leaderVotes[room][actorId];
      return;
    }

    const target = state.players.find((p) => p.id === targetId);
    if (!target || target.room !== room) {
      throw new Error("You can only vote for someone in your own room.");
    }

    state.leaderVotes[room][actorId] = targetId;
    this.tallyLeaderVotes(state, room);
  }

  private tallyLeaderVotes(state: RoomState, room: "A" | "B"): void {
    const members = state.players.filter((p) => p.room === room);
    const memberIds = new Set(members.map((p) => p.id));
    const votes = state.leaderVotes[room];

    const tally = new Map<string, number>();
    for (const [voterId, targetId] of Object.entries(votes)) {
      if (!memberIds.has(voterId)) {
        delete votes[voterId];
        continue;
      }
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }

    const majority = Math.floor(members.length / 2) + 1;
    for (const [candidateId, count] of tally) {
      if (count >= majority && memberIds.has(candidateId)) {
        state.leaders[room] = candidateId;
        state.leaderVotes[room] = {};
        state.hostageSelections[room] = state.hostageSelections[room].filter(
          (id) => id !== candidateId
        );
        return;
      }
    }
  }

  private isConnected(playerId: string): boolean {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as WsAttach | null;
      if (a?.playerId === playerId && ws.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  private closePlayerSockets(playerId: string, code: number, reason: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as WsAttach | null;
      if (a?.playerId === playerId) {
        try {
          ws.close(code, reason);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private publicState(state: RoomState, viewerId: string | null): PublicState {
    const playset = PLAYSETS.find((p) => p.id === state.playsetId) || PLAYSETS[0]!;
    const rounds = roundsFor(playset, state.players.length);
    const roundIndex = Math.min(state.roundIndex, rounds.length - 1);
    const round = rounds[roundIndex]!;
    const viewer = viewerId ? state.players.find((p) => p.id === viewerId) : null;
    const viewerRoom = viewer?.room ?? null;

    let remainingMs: number | null = null;
    if (state.roundPaused) remainingMs = state.roundPausedRemainingMs;
    else if (state.roundEndsAt) remainingMs = Math.max(0, state.roundEndsAt - Date.now());

    // Leadership is room-local information: the two rooms are physically
    // separate, so a viewer should only ever learn who leads their own
    // room, never the other one.
    const redactedRoom = { leaderId: null, hostageIds: [], votes: {} };
    const ownRoomInfo = (room: "A" | "B") => ({
      leaderId: state.leaders[room],
      hostageIds: state.hostageSelections[room],
      votes: state.leaderVotes[room],
    });

    return {
      code: state.code,
      phase: state.phase,
      playsetId: state.playsetId,
      playsetName: playset.name,
      playerCountTarget: state.playerCountTarget,
      customCardIds: state.playsetId === "custom-mix" ? state.packIds.slice() : null,
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.isBot ? true : this.isConnected(p.id),
        ready: p.ready,
        isHost: p.id === state.hostId,
        isLeader: p.room != null && p.room === viewerRoom && state.leaders[p.room] === p.id,
        isBot: Boolean(p.isBot),
        room: state.phase === "lobby" ? null : p.room,
      })),
      hostId: state.hostId,
      round:
        state.phase === "lobby"
          ? null
          : {
              index: roundIndex,
              total: rounds.length,
              label: `${round.minutes} min`,
              minutes: round.minutes,
              hostages: round.hostages,
              endsAt: state.roundEndsAt,
              paused: state.roundPaused,
              remainingMs,
            },
      buriedPresent: Boolean(state.buried),
      rooms:
        state.phase === "lobby" || !viewerRoom
          ? null
          : {
              A: viewerRoom === "A" ? ownRoomInfo("A") : redactedRoom,
              B: viewerRoom === "B" ? ownRoomInfo("B") : redactedRoom,
            },
      you: viewer
        ? {
            id: viewer.id,
            name: viewer.name,
            isHost: viewer.id === state.hostId,
            isLeader: viewer.room != null && state.leaders[viewer.room] === viewer.id,
            card:
              state.phase === "lobby"
                ? null
                : state.phase === "ended" || viewer.card
                  ? viewer.card
                  : null,
            room: state.phase === "lobby" ? null : viewer.room,
          }
        : null,
      serverTime: Date.now(),
    };
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  private broadcastState(state: RoomState): void {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as WsAttach | null;
      if (!a?.playerId) continue;
      this.send(ws, { type: "state", state: this.publicState(state, a.playerId) });
    }
  }
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return cleaned || "Player";
}

function migrateState(state: RoomState): RoomState {
  if (!state.leaders) state.leaders = { A: null, B: null };
  if (!state.hostageSelections) state.hostageSelections = { A: [], B: [] };
  if (!state.leaderVotes) state.leaderVotes = { A: {}, B: {} };

  // Backfill a leader for rooms that were already mid-game before the
  // leader feature shipped, so they aren't stuck permanently leaderless.
  if (state.phase === "playing" || state.phase === "ended") {
    for (const room of ["A", "B"] as const) {
      if (state.leaders[room]) continue;
      const members = state.players.filter((p) => p.room === room).map((p) => p.id);
      if (members.length) state.leaders[room] = pickRandom(members);
    }
  }

  return state;
}

function pickRandom(ids: string[]): string | null {
  if (!ids.length) return null;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return ids[buf[0]! % ids.length]!;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0]! % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
