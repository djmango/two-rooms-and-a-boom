const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";

type Msg = { type: string; state?: any; message?: string; playerId?: string; secret?: string };

function wsUrl(code: string) {
  return BASE.replace(/^http/, "ws") + `/api/rooms/${encodeURIComponent(code)}/ws`;
}

class Client {
  ws!: WebSocket;
  queue: Msg[] = [];
  waiters: Array<{ pred: (m: Msg) => boolean; resolve: (m: Msg) => void; reject: (e: Error) => void; t: ReturnType<typeof setTimeout> }> = [];

  async connect(code: string) {
    this.ws = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl(code));
      ws.addEventListener("open", () => resolve(ws));
      ws.addEventListener("error", (e) => reject(e));
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as Msg;
      const idx = this.waiters.findIndex((w) => w.pred(msg));
      if (idx >= 0) {
        const [w] = this.waiters.splice(idx, 1);
        clearTimeout(w!.t);
        w!.resolve(msg);
      } else {
        this.queue.push(msg);
      }
    });
  }

  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }

  wait(pred: (m: Msg) => boolean = () => true, timeoutMs = 8000): Promise<Msg> {
    const queuedIdx = this.queue.findIndex(pred);
    if (queuedIdx >= 0) {
      const [msg] = this.queue.splice(queuedIdx, 1);
      return Promise.resolve(msg!);
    }
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.t !== t);
        reject(new Error(`timeout waiting for message (queue has ${this.queue.map((m) => m.type).join(",")})`));
      }, timeoutMs);
      this.waiters.push({ pred, resolve, reject, t });
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    failed += 1;
  } else console.log("OK", msg);
}

async function main() {
  console.log("=== MULTIPLAYER ===");
  console.log("BASE", BASE);

  const meta = await fetch(`${BASE}/api/meta`).then((r) => r.json());
  assert(Array.isArray(meta.playsets) && meta.playsets.length >= 5, `meta playsets=${meta.playsets?.length}`);

  const bad = await fetch(`${BASE}/api/rooms/not-real-zzz/info`);
  assert(bad.status === 400 || bad.status === 404, `invalid code info status ${bad.status}`);

  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Host", playsetId: "basic", playerCount: 10 }),
  });
  const created = await createRes.json();
  assert(createRes.ok && created.code && created.playerId && created.secret, `create ${JSON.stringify(created)}`);
  assert((created.code as string).split("-").length === 3, `code shape ${created.code}`);

  const info = await fetch(`${BASE}/api/rooms/${created.code}/info`).then((r) => r.json());
  assert(info.exists && info.phase === "lobby" && info.playerCount === 1, `info ${JSON.stringify(info)}`);

  const host = new Client();
  await host.connect(created.code);
  host.send({
    type: "hello",
    name: "Host",
    playerId: created.playerId,
    secret: created.secret,
  });
  const welcome = await host.wait((m) => m.type === "welcome");
  assert(welcome.state.phase === "lobby", "host welcome lobby");
  assert(welcome.state.you?.isHost === true, "host isHost");
  assert(welcome.state.code === created.code, "host code matches");

  host.send({ type: "start" });
  const tooFew = await host.wait((m) => m.type === "error");
  assert(/4/.test(tooFew.message || ""), `too few error: ${tooFew.message}`);

  const guests: Client[] = [];
  for (const name of ["Alex", "Blake", "Casey", "Drew", "Eli"]) {
    const g = new Client();
    await g.connect(created.code);
    g.send({ type: "hello", name });
    const w = await g.wait((m) => m.type === "welcome");
    assert(w.playerId && w.secret, `${name} got credentials`);
    guests.push(g);
  }

  let players = welcome.state.players.length;
  while (players < 6) {
    const upd = await host.wait((m) => m.type === "state");
    players = upd.state.players.length;
  }
  assert(players === 6, `host sees 6 (got ${players})`);

  guests[0]!.send({ type: "start" });
  const denied = await guests[0]!.wait((m) => m.type === "error");
  assert(/host/i.test(denied.message || ""), `non-host denied: ${denied.message}`);

  host.send({ type: "set_playset", playsetId: "doctor-engineer", playerCount: 6 });
  const psUpdate = await host.wait((m) => m.type === "state" && m.state?.playsetId === "doctor-engineer");
  assert(psUpdate.state.playsetId === "doctor-engineer", "playset updated");

  // ensure Doctor/Engineer present after deal
  host.send({ type: "start" });
  const started = await host.wait((m) => m.type === "state" && m.state?.phase === "playing");
  assert(started.state.phase === "playing", "phase playing");
  assert(started.state.you?.card?.name, `host has card ${started.state.you?.card?.name}`);
  assert(started.state.you?.room === "A" || started.state.you?.room === "B", `host room ${started.state.you?.room}`);
  assert(
    started.state.players.every((p: any) => p.room === "A" || p.room === "B"),
    "all players have rooms"
  );
  const roomA = started.state.players.filter((p: any) => p.room === "A").length;
  const roomB = started.state.players.filter((p: any) => p.room === "B").length;
  assert(Math.abs(roomA - roomB) <= 1 && roomA + roomB === 6, `rooms balanced ${roomA}/${roomB}`);
  assert(
    started.state.players.every((p: any) => p.card === undefined),
    "public players omit cards"
  );

  // --- Room leader, hostage selection, and usurpation voting ---
  const nameToClient: Record<string, Client> = {
    Host: host,
    Alex: guests[0]!,
    Blake: guests[1]!,
    Casey: guests[2]!,
    Drew: guests[3]!,
    Eli: guests[4]!,
  };

  // Leadership is room-local: a viewer only ever sees their own room's
  // leader, so we ask a representative member of each room what THEY see,
  // rather than reading isLeader off a single (host) viewpoint.
  const hostRoom = started.state.you.room as "A" | "B";
  const otherRoom = hostRoom === "A" ? "B" : "A";

  const otherRoomMemberNames = started.state.players
    .filter((p: any) => p.room === otherRoom)
    .map((p: any) => p.name);
  const otherRepName = otherRoomMemberNames.find((n: string) => n !== "Alex") ?? otherRoomMemberNames[0]!;
  const otherRepClient = nameToClient[otherRepName]!;
  const otherRepState = (
    await otherRepClient.wait((m) => m.type === "state" && m.state?.phase === "playing")
  ).state;

  const hostRoomLeader = started.state.players.find((p: any) => p.room === hostRoom && p.isLeader);
  const otherRoomLeader = otherRepState.players.find((p: any) => p.room === otherRoom && p.isLeader);
  const leaderA = hostRoom === "A" ? hostRoomLeader : otherRoomLeader;
  const leaderB = hostRoom === "B" ? hostRoomLeader : otherRoomLeader;
  assert(!!leaderA && !!leaderB, `each room has a leader (A=${leaderA?.name}, B=${leaderB?.name})`);
  assert(
    started.state.players.filter((p: any) => p.room === hostRoom && p.isLeader).length === 1,
    "exactly one leader in the host's own room, from the host's view"
  );
  assert(
    otherRepState.players.filter((p: any) => p.room === otherRoom && p.isLeader).length === 1,
    "exactly one leader in the other room, from that room's own view"
  );
  assert(
    started.state.rooms?.[hostRoom]?.leaderId === hostRoomLeader.id,
    "rooms.<hostRoom>.leaderId matches the host's own leader"
  );
  assert(
    started.state.rooms?.[otherRoom]?.leaderId === null,
    "the other room's leaderId is redacted from the host's view (no cross-room leader share)"
  );
  assert(
    !started.state.players.some((p: any) => p.room === otherRoom && p.isLeader),
    "no player in the other room shows isLeader=true from the host's view"
  );

  const leaderAClient = nameToClient[leaderA.name]!;
  const roommateA = started.state.players.find((p: any) => p.room === "A" && p.id !== leaderA.id);
  const nonLeaderAClient = nameToClient[roommateA.name]!;

  nonLeaderAClient.send({ type: "select_hostages", playerIds: [] });
  const hostageDenied = await nonLeaderAClient.wait((m) => m.type === "error");
  assert(
    /leader/i.test(hostageDenied.message || ""),
    `non-leader denied hostage pick: ${hostageDenied.message}`
  );

  leaderAClient.send({ type: "select_hostages", playerIds: [leaderA.id] });
  const selfHostage = await leaderAClient.wait((m) => m.type === "error");
  assert(
    /leader can.t be a hostage/i.test(selfHostage.message || ""),
    `leader can't select self as hostage: ${selfHostage.message}`
  );

  leaderAClient.send({ type: "select_hostages", playerIds: [roommateA.id] });
  const hostagePicked = await leaderAClient.wait(
    (m) => m.type === "state" && m.state?.rooms?.A?.hostageIds?.includes(roommateA.id)
  );
  assert(
    hostagePicked.state.rooms.A.hostageIds.includes(roommateA.id),
    `hostage selection recorded (${roommateA.name})`
  );

  const roomBOthers = started.state.players.filter((p: any) => p.room === "B" && p.id !== leaderB.id);
  assert(roomBOthers.length >= 2, `room B has enough members to test voting (${roomBOthers.length})`);
  const candidate = roomBOthers[0];
  const otherVoter = roomBOthers[1];
  const leaderBClient = nameToClient[leaderB.name]!;
  const otherVoterClient = nameToClient[otherVoter.name]!;

  leaderBClient.send({ type: "vote_leader", targetId: candidate.id });
  const firstVote = await leaderBClient.wait(
    (m) => m.type === "state" && m.state?.rooms?.B?.votes?.[leaderB.id] === candidate.id
  );
  assert(
    firstVote.state.rooms.B.votes[leaderB.id] === candidate.id,
    "first usurpation vote recorded, leader not yet replaced"
  );
  assert(
    firstVote.state.rooms.B.leaderId === leaderB.id,
    "leadership unchanged after a single vote (no majority yet)"
  );

  otherVoterClient.send({ type: "vote_leader", targetId: candidate.id });
  const leadershipChanged = await otherVoterClient.wait(
    (m) => m.type === "state" && m.state?.rooms?.B?.leaderId === candidate.id
  );
  assert(
    leadershipChanged.state.rooms.B.leaderId === candidate.id,
    `room B leadership transferred to ${candidate.name} by majority vote`
  );
  assert(
    leadershipChanged.state.players.find((p: any) => p.id === candidate.id)?.isLeader === true,
    "new leader's isLeader flag is set"
  );
  assert(
    leadershipChanged.state.players.find((p: any) => p.id === leaderB.id)?.isLeader === false,
    "old leader's isLeader flag is cleared"
  );

  const gState = await guests[0]!.wait((m) => m.type === "state" && m.state?.phase === "playing");
  assert(gState.state.you?.card?.name, `guest card ${gState.state.you?.card?.name}`);

  // Collect all private cards (guest 0 already consumed playing state above).
  const privateCards = [
    started.state.you.card.name as string,
    gState.state.you.card.name as string,
  ];
  for (const g of guests.slice(1)) {
    let st = g.queue.find(
      (m) => m.type === "state" && m.state?.phase === "playing" && m.state?.you?.card
    );
    if (st) {
      g.queue = g.queue.filter((m) => m !== st);
    } else {
      st = await g.wait(
        (m) => m.type === "state" && m.state?.phase === "playing" && m.state?.you?.card
      );
    }
    privateCards.push(st.state.you.card.name);
  }
  assert(privateCards.includes("President"), `deck has President among ${privateCards.join(",")}`);
  assert(privateCards.includes("Bomber"), `deck has Bomber among ${privateCards.join(",")}`);
  assert(privateCards.includes("Doctor"), `deck has Doctor among ${privateCards.join(",")}`);
  assert(privateCards.includes("Engineer"), `deck has Engineer among ${privateCards.join(",")}`);
  assert(privateCards.length === 6, `6 private cards got ${privateCards.length}`);

  const late = new Client();
  await late.connect(created.code);
  late.send({ type: "hello", name: "Late" });
  const lateErr = await late.wait((m) => m.type === "error");
  assert(/progress|rejoin/i.test(lateErr.message || ""), `late join blocked: ${lateErr.message}`);
  late.close();

  host.send({ type: "start_round" });
  const round = await host.wait((m) => m.type === "state" && m.state?.round?.endsAt);
  assert(round.state.round.minutes === 3, `round minutes ${round.state.round.minutes}`);
  assert(round.state.round.hostages === 1, `hostages ${round.state.round.hostages}`);
  assert(round.state.round.endsAt > Date.now(), "endsAt future");

  host.send({ type: "pause_timer" });
  const paused = await host.wait((m) => m.type === "state" && m.state?.round?.paused === true);
  assert(paused.state.round.paused && paused.state.round.remainingMs != null, "paused with remaining");

  host.send({ type: "resume_timer" });
  const resumed = await host.wait(
    (m) => m.type === "state" && m.state?.round?.paused === false && m.state?.round?.endsAt
  );
  assert(!resumed.state.round.paused && resumed.state.round.endsAt, "resumed");

  host.send({ type: "end_round" });
  const endedRound = await host.wait((m) => m.type === "state" && m.state?.round?.index === 1);
  assert(endedRound.state.round.index === 1, `round index ${endedRound.state.round.index}`);
  assert(
    endedRound.state.players.find((p: any) => p.id === roommateA.id)?.room === "B",
    `hostage ${roommateA.name} exchanged from room A into room B at end of round`
  );
  assert(
    endedRound.state.rooms.A.hostageIds.length === 0 && endedRound.state.rooms.B.hostageIds.length === 0,
    "hostage selections cleared after exchange"
  );

  host.close();
  await new Promise((r) => setTimeout(r, 150));

  const host2 = new Client();
  await host2.connect(created.code);
  host2.send({
    type: "hello",
    name: "Host",
    playerId: created.playerId,
    secret: created.secret,
  });
  const rejoin = await host2.wait((m) => m.type === "welcome");
  assert(rejoin.state.phase === "playing", "rejoin mid-game");
  assert(rejoin.state.you?.card?.name, `rejoin still has card ${rejoin.state.you?.card?.name}`);
  assert(rejoin.state.you?.isHost, "still host after rejoin");

  host2.send({ type: "reshuffle" });
  const lobby = await host2.wait((m) => m.type === "state" && m.state?.phase === "lobby");
  assert(lobby.state.phase === "lobby", "back to lobby");
  assert(lobby.state.you?.card == null, "card cleared");

  host2.send({ type: "set_playset", playsetId: "classic-kaboom", playerCount: 6 });
  const classicUpdate = await host2.wait(
    (m) => m.type === "state" && m.state?.playsetId === "classic-kaboom"
  );
  assert(classicUpdate.state.playsetName === "Classic Kaboom", "classic kaboom selected");

  host2.send({ type: "start" });
  await host2.wait((m) => m.type === "state" && m.state?.phase === "playing");
  host2.send({ type: "start_round" });
  const classicRound = await host2.wait(
    (m) => m.type === "state" && m.state?.round?.endsAt
  );
  assert(classicRound.state.round.total === 3, "classic kaboom has 3 rounds at 6 players");
  assert(classicRound.state.round.minutes === 3, "classic kaboom starts at 3 minutes");
  assert(classicRound.state.round.hostages === 2, "classic kaboom starts with 2 hostages");

  host2.send({ type: "reveal_all" });
  const ended = await host2.wait((m) => m.type === "state" && m.state?.phase === "ended");
  assert(ended.state.phase === "ended", "game ended");

  host2.send({ type: "set_name", name: "Captain" });
  const renamed = await host2.wait((m) => m.type === "state" && m.state?.you?.name === "Captain");
  assert(renamed.state.you.name === "Captain", "renamed");

  // Back to lobby to test kick + reclaim
  host2.send({ type: "reshuffle" });
  await host2.wait((m) => m.type === "state" && m.state?.phase === "lobby");

  // Reclaim: a guest reconnects without credentials, same name -> should not duplicate
  const beforeReclaim = renamed.state.players.length;
  guests[0]!.close();
  await new Promise((r) => setTimeout(r, 200));
  const reclaimer = new Client();
  await reclaimer.connect(created.code);
  reclaimer.send({ type: "hello", name: "Alex" });
  const reclaimWelcome = await reclaimer.wait((m) => m.type === "welcome");
  const afterReclaim = reclaimWelcome.state.players.length;
  assert(afterReclaim === beforeReclaim, `reclaim no duplicate (${beforeReclaim} -> ${afterReclaim})`);

  // Kick: host removes a player
  const kickTarget = reclaimWelcome.state.players.find(
    (p: any) => !p.isHost && p.name !== "Alex"
  );
  assert(!!kickTarget, "kick target found");
  host2.send({ type: "kick", playerId: kickTarget!.id });
  const afterKick = await host2.wait(
    (m) => m.type === "state" && !m.state?.players?.some((p: any) => p.id === kickTarget!.id)
  );
  assert(
    !afterKick.state.players.some((p: any) => p.id === kickTarget!.id),
    "kicked player removed"
  );
  reclaimer.close();

  // SPA routes
  for (const path of ["/", "/print", `/play/${created.code}`]) {
    const res = await fetch(`${BASE}${path}`);
    assert(res.ok, `spa ${path} -> ${res.status}`);
  }

  host2.close();
  guests.forEach((g) => g.close());

  await testTestMode();

  console.log(failed ? `\n${failed} MULTIPLAYER FAILURES` : "\nALL MULTIPLAYER TESTS PASSED");
  process.exit(failed ? 1 : 0);
}

async function testTestMode() {
  // Creating a room as "test" (any case/whitespace) should drop in ready
  // bot players so a solo dev can start a game without extra devices.
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: " TeSt ", playsetId: "basic", playerCount: 10 }),
  });
  const created = await createRes.json();

  const info = await fetch(`${BASE}/api/rooms/${created.code}/info`).then((r) => r.json());
  assert(info.playerCount >= 4, `test-mode room seeded with players (${info.playerCount})`);

  const host = new Client();
  await host.connect(created.code);
  host.send({ type: "hello", name: "TeSt", playerId: created.playerId, secret: created.secret });
  const welcome = await host.wait((m) => m.type === "welcome");
  const bots = welcome.state.players.filter((p: any) => p.isBot);
  assert(bots.length >= 3, `bots seeded (${bots.length})`);
  assert(bots.every((p: any) => p.ready && p.connected), "seeded bots are ready and connected");

  // Solo host can start immediately without any other real device joining.
  host.send({ type: "start" });
  const started = await host.wait((m) => m.type === "state" && m.state?.phase === "playing");
  assert(started.state.phase === "playing", "test-mode game starts solo");
  assert(started.state.you?.card?.name, `solo host dealt a card (${started.state.you?.card?.name})`);

  // A second "test" room (via a guest joining, not creating) should also
  // seed bots, and joining twice must not seed a duplicate set.
  const createRes2 = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Real Host", playsetId: "basic", playerCount: 10 }),
  });
  const created2 = await createRes2.json();
  const host2 = new Client();
  await host2.connect(created2.code);
  host2.send({ type: "hello", name: "Real Host", playerId: created2.playerId, secret: created2.secret });
  await host2.wait((m) => m.type === "welcome");

  const guest = new Client();
  await guest.connect(created2.code);
  guest.send({ type: "hello", name: "TEST" });
  await guest.wait((m) => m.type === "welcome");

  const afterGuest = await host2.wait((m) => m.type === "state" && m.state.players.length > 2);
  const botsFromGuest = afterGuest.state.players.filter((p: any) => p.isBot);
  assert(botsFromGuest.length >= 3, `guest joining as TEST seeds bots (${botsFromGuest.length})`);

  const guest2 = new Client();
  await guest2.connect(created2.code);
  guest2.send({ type: "hello", name: "test" });
  await guest2.wait((m) => m.type === "welcome");
  const afterSecondTest = await host2.wait(
    (m) => m.type === "state" && m.state.players.some((p: any) => p.name === "test")
  );
  const botCountAfter = afterSecondTest.state.players.filter((p: any) => p.isBot).length;
  assert(botCountAfter === botsFromGuest.length, "a second 'test' joiner does not duplicate bots");

  // Renaming to "test" from the lobby (set_name), not just the initial
  // hello, must also seed bots.
  const createRes3 = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Alex", playsetId: "basic", playerCount: 10 }),
  });
  const created3 = await createRes3.json();
  const host3 = new Client();
  await host3.connect(created3.code);
  host3.send({ type: "hello", name: "Alex", playerId: created3.playerId, secret: created3.secret });
  await host3.wait((m) => m.type === "welcome");
  host3.send({ type: "set_name", name: "test" });
  const afterRename = await host3.wait(
    (m) => m.type === "state" && m.state.players.some((p: any) => p.isBot)
  );
  assert(
    afterRename.state.players.filter((p: any) => p.isBot).length >= 3,
    "renaming to 'test' in the lobby also seeds bots"
  );

  host.close();
  host2.close();
  host3.close();
  guest.close();
  guest2.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
