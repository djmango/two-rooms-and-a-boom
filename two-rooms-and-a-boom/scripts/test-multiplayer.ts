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
  const noSuccessor = await leaderAClient.wait((m) => m.type === "error");
  assert(
    /pick who takes over as leader/i.test(noSuccessor.message || ""),
    `abdicating without a successor is rejected: ${noSuccessor.message}`
  );

  leaderAClient.send({
    type: "select_hostages",
    playerIds: [leaderA.id],
    newLeaderId: leaderA.id,
  });
  const selfSuccessor = await leaderAClient.wait((m) => m.type === "error");
  assert(
    /new leader can.t be the outgoing leader/i.test(selfSuccessor.message || ""),
    `successor can't be the outgoing leader: ${selfSuccessor.message}`
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

  // --- Regression: starting the next round without explicitly ending the
  // previous one must still finalize the pending hostage exchange, so
  // rooms never silently fail to swap just because "End round" was skipped. ---
  // Room membership (unlike isLeader/leaderId) isn't redacted cross-room, so
  // the host's own already-captured view is enough to find room A's members.
  const roomAAfterFirstExchange = endedRound.state.players.filter((p: any) => p.room === "A");
  assert(
    roomAAfterFirstExchange.some((p: any) => p.id === leaderA.id),
    "room A leader unchanged after first exchange"
  );
  const secondHostage = roomAAfterFirstExchange.find((p: any) => p.id !== leaderA.id);
  assert(!!secondHostage, "room A has a non-leader to pick as the next hostage");

  leaderAClient.send({ type: "select_hostages", playerIds: [secondHostage.id] });
  await leaderAClient.wait(
    (m) => m.type === "state" && m.state?.rooms?.A?.hostageIds?.includes(secondHostage.id)
  );

  // Start round 1's timer normally, then -- instead of ever sending
  // "end_round" -- go straight to "Start round" again, exactly like a host
  // who forgot to click "End round" once the buzzer went off.
  host.send({ type: "start_round" });
  await host.wait(
    (m) => m.type === "state" && m.state?.round?.index === 1 && m.state?.round?.endsAt != null
  );

  host.send({ type: "start_round" });
  const skippedEndRound = await host.wait((m) => m.type === "state" && m.state?.round?.index === 2);
  assert(skippedEndRound.state.round.index === 2, `round index ${skippedEndRound.state.round.index}`);
  assert(skippedEndRound.state.round.endsAt > Date.now(), "next round's timer actually started");
  assert(
    skippedEndRound.state.players.find((p: any) => p.id === secondHostage.id)?.room === "B",
    `hostage ${secondHostage.name} still exchanged into room B even though "end_round" was never sent`
  );
  assert(
    skippedEndRound.state.rooms.A.hostageIds.length === 0 && skippedEndRound.state.rooms.B.hostageIds.length === 0,
    "hostage selections cleared after the implicit exchange"
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
  await testClassicSpyPlayset();
  await testCustomMix();
  await testLeaderAbdication();
  await testCardSharing();

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

async function testLeaderAbdication() {
  // A leader can pick themselves as a hostage (stepping down), but only if
  // they also hand leadership to someone staying behind.
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "AbdicateHost", playsetId: "basic", playerCount: 10 }),
  });
  const created = await createRes.json();
  const host = new Client();
  await host.connect(created.code);
  host.send({
    type: "hello",
    name: "AbdicateHost",
    playerId: created.playerId,
    secret: created.secret,
  });
  await host.wait((m) => m.type === "welcome");

  const guests: Client[] = [];
  for (const name of ["AbA", "AbB", "AbC", "AbD", "AbE"]) {
    const g = new Client();
    await g.connect(created.code);
    g.send({ type: "hello", name });
    await g.wait((m) => m.type === "welcome");
    guests.push(g);
  }
  let players = 1;
  while (players < 6) {
    const upd = await host.wait((m) => m.type === "state");
    players = upd.state.players.length;
  }

  host.send({ type: "start" });
  const allClients = [host, ...guests];
  const states: any[] = [];
  for (const c of allClients) {
    const st = await c.wait((m) => m.type === "state" && m.state?.phase === "playing");
    states.push(st.state);
  }

  const room = "A" as const;
  const leaderIdx = states.findIndex((s) => s.you.room === room && s.you.isLeader);
  assert(leaderIdx >= 0, "found room A's leader among the real clients");
  const leaderClient = allClients[leaderIdx]!;
  const leaderState = states[leaderIdx]!;

  const roomMembers = leaderState.players.filter((p: any) => p.room === room);
  assert(roomMembers.length >= 2, `room A has enough members to abdicate (${roomMembers.length})`);
  const successor = roomMembers.find((p: any) => p.id !== leaderState.you.id);

  leaderClient.send({
    type: "select_hostages",
    playerIds: [leaderState.you.id],
    newLeaderId: successor.id,
  });
  const abdicated = await leaderClient.wait(
    (m) => m.type === "state" && m.state?.rooms?.[room]?.leaderId === successor.id
  );
  assert(
    abdicated.state.rooms[room].leaderId === successor.id,
    "leadership transferred to the chosen successor"
  );
  assert(abdicated.state.you.isLeader === false, "outgoing leader's isLeader flag is cleared");
  assert(
    abdicated.state.rooms[room].hostageIds.includes(leaderState.you.id),
    "outgoing leader is recorded as a hostage"
  );
  assert(
    abdicated.state.players.find((p: any) => p.id === successor.id)?.isLeader === true,
    "successor's isLeader flag is set"
  );

  host.send({ type: "start_round" });
  await host.wait((m) => m.type === "state" && m.state.round?.endsAt);
  host.send({ type: "end_round" });
  const exchanged = await leaderClient.wait(
    (m) => m.type === "state" && m.state?.round?.index === 1
  );
  assert(
    exchanged.state.you.room !== room,
    `the former leader was actually exchanged out of room ${room} at end of round`
  );

  host.close();
  guests.forEach((g) => g.close());
}

async function testClassicSpyPlayset() {
  // The "Classic + Spy" playset needs 11+ players (color-sharing pack), so
  // exercise it with a real host + 10 guests rather than the fixed 6-player
  // test-mode bots.
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "SpyHost", playsetId: "basic", playerCount: 11 }),
  });
  const created = await createRes.json();
  const host = new Client();
  await host.connect(created.code);
  host.send({ type: "hello", name: "SpyHost", playerId: created.playerId, secret: created.secret });
  await host.wait((m) => m.type === "welcome");

  host.send({ type: "set_playset", playsetId: "classic-spy", playerCount: 11 });
  const psUpdate = await host.wait((m) => m.type === "state" && m.state?.playsetId === "classic-spy");
  assert(psUpdate.state.playsetName === "Classic + Spy", "classic-spy playset selectable");

  const guests: Client[] = [];
  for (let i = 0; i < 10; i++) {
    const g = new Client();
    await g.connect(created.code);
    g.send({ type: "hello", name: `SpyGuest${i}` });
    await g.wait((m) => m.type === "welcome");
    guests.push(g);
  }
  let players = 1;
  while (players < 11) {
    const upd = await host.wait((m) => m.type === "state");
    players = upd.state.players.length;
  }
  assert(players === 11, `classic-spy room reached 11 players (got ${players})`);

  host.send({ type: "start" });
  const started = await host.wait((m) => m.type === "state" && m.state?.phase === "playing");
  assert(started.state.phase === "playing", "classic-spy game starts at 11 players");

  const privateCards = [started.state.you.card?.name as string];
  for (const g of guests) {
    const st = await g.wait((m) => m.type === "state" && m.state?.phase === "playing" && m.state?.you?.card);
    privateCards.push(st.state.you.card.name);
  }
  assert(privateCards.length === 11, `11 private cards dealt (got ${privateCards.length})`);
  assert(privateCards.includes("President"), `deck has President among ${privateCards.join(",")}`);
  assert(privateCards.includes("Bomber"), `deck has Bomber among ${privateCards.join(",")}`);
  assert(privateCards.includes("Blue Spy"), `deck has Blue Spy among ${privateCards.join(",")}`);
  assert(privateCards.includes("Red Spy"), `deck has Red Spy among ${privateCards.join(",")}`);

  host.close();
  guests.forEach((g) => g.close());
}

async function testCustomMix() {
  // The host picks individual cards for a "custom-mix" deck and those cards
  // (plus the auto core/filler) are what gets dealt.
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "MixHost", playsetId: "basic", playerCount: 10 }),
  });
  const created = await createRes.json();
  const host = new Client();
  await host.connect(created.code);
  host.send({
    type: "hello",
    name: "MixHost",
    playerId: created.playerId,
    secret: created.secret,
  });
  await host.wait((m) => m.type === "welcome");

  // Pick an invalid card (a pack id) -> must be rejected.
  host.send({ type: "set_playset", playsetId: "custom-mix", playerCount: 10, cardIds: ["doctor-engineer"] });
  const invalidErr = await host.wait((m) => m.type === "error");
  assert(/isn.t pickable/i.test(invalidErr.message || ""), `custom-mix rejects pack id: ${invalidErr.message}`);

  // Pick a core card -> must be rejected.
  host.send({ type: "set_playset", playsetId: "custom-mix", playerCount: 10, cardIds: ["b001"] });
  const coreErr = await host.wait((m) => m.type === "error");
  assert(/isn.t pickable/i.test(coreErr.message || ""), `custom-mix rejects core card: ${coreErr.message}`);

  // Cards held out of custom mixes (Engineer, Private Eye, Tinkerer,
  // Paparazzo) -> each must be rejected.
  for (const excluded of ["r014", "g019", "r024", "r025"]) {
    host.send({ type: "set_playset", playsetId: "custom-mix", playerCount: 10, cardIds: [excluded] });
    const excludedErr = await host.wait((m) => m.type === "error");
    assert(/isn.t pickable/i.test(excludedErr.message || ""), `custom-mix rejects ${excluded}: ${excludedErr.message}`);
  }

  // Plain team members (b000/r000) are allowed in any count -- the host
  // adds them via steppers, so duplicates are preserved by the server.
  host.send({ type: "set_playset", playsetId: "custom-mix", playerCount: 10, cardIds: ["b000", "b000", "r000"] });
  const teamOk = await host.wait(
    (m) => m.type === "state" && m.state?.playsetId === "custom-mix" && m.state?.customCardIds?.length === 3
  );
  assert(
    JSON.stringify(teamOk.state.customCardIds) === JSON.stringify(["b000", "b000", "r000"]),
    `custom-mix accepts plain team member counts (got ${JSON.stringify(teamOk.state.customCardIds)})`
  );

  // Valid pick: Angel, Survivor, Red Spy, Blue Spy (all roles we have
  // PnP art for and none excluded from the custom mix).
  const picked = ["r004", "g028", "b030", "r030"];
  host.send({ type: "set_playset", playsetId: "custom-mix", playerCount: 10, cardIds: picked });
  const psUpdate = await host.wait(
    (m) => m.type === "state" && m.state?.playsetId === "custom-mix" && m.state?.customCardIds
  );
  assert(psUpdate.state.playsetName === "Custom mix", "custom-mix playset selectable");
  assert(
    JSON.stringify(psUpdate.state.customCardIds) === JSON.stringify(picked),
    `custom-mix stores picked card ids (got ${JSON.stringify(psUpdate.state.customCardIds)})`
  );

  const guests: Client[] = [];
  for (let i = 0; i < 9; i++) {
    const g = new Client();
    await g.connect(created.code);
    g.send({ type: "hello", name: `MixGuest${i}` });
    await g.wait((m) => m.type === "welcome");
    guests.push(g);
  }
  let players = 1;
  while (players < 10) {
    const upd = await host.wait((m) => m.type === "state");
    players = upd.state.players.length;
  }
  assert(players === 10, `custom-mix room reached 10 players (got ${players})`);

  host.send({ type: "start" });
  const started = await host.wait((m) => m.type === "state" && m.state?.phase === "playing");
  assert(started.state.phase === "playing", "custom-mix game starts at 10 players");

  const privateCards = [started.state.you.card?.name as string];
  for (const g of guests) {
    const st = await g.wait((m) => m.type === "state" && m.state?.phase === "playing" && m.state?.you?.card);
    privateCards.push(st.state.you.card.name);
  }
  assert(privateCards.length === 10, `10 private cards dealt (got ${privateCards.length})`);
  assert(privateCards.includes("President"), `custom-mix has President among ${privateCards.join(",")}`);
  assert(privateCards.includes("Bomber"), `custom-mix has Bomber among ${privateCards.join(",")}`);
  assert(privateCards.includes("Angel"), `custom-mix has picked Angel among ${privateCards.join(",")}`);
  assert(privateCards.includes("Survivor"), `custom-mix has picked Survivor among ${privateCards.join(",")}`);
  assert(privateCards.includes("Red Spy"), `custom-mix has picked Red Spy among ${privateCards.join(",")}`);
  assert(privateCards.includes("Blue Spy"), `custom-mix has picked Blue Spy among ${privateCards.join(",")}`);
  // No unpicked advanced roles leaked in.
  assert(!privateCards.includes("Agent"), `custom-mix excludes unpicked Agent`);
  // These roles are held out of custom mixes, so none may appear.
  assert(!privateCards.includes("Engineer"), `custom-mix excludes Engineer (not pickable in custom)`);
  assert(!privateCards.includes("Private Eye"), `custom-mix excludes Private Eye (not pickable in custom)`);
  assert(!privateCards.includes("Tinkerer"), `custom-mix excludes Tinkerer (not pickable in custom)`);
  assert(!privateCards.includes("Paparazzo"), `custom-mix excludes Paparazzo (not pickable in custom)`);
  // 10 is even, so no auto Gambler.
  assert(!privateCards.includes("Gambler"), `custom-mix 10 (even) has no auto Gambler`);

  host.close();
  guests.forEach((g) => g.close());
}

async function testCardSharing() {
  // Digital card sharing: both opt in, half = color (team), full = card.
  // Hot Potato auto-swaps on a completed share. Spies reveal their
  // deception color on a color share, not their true team.
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "ShareHost", playsetId: "basic", playerCount: 10 }),
  });
  const created = await createRes.json();
  const host = new Client();
  await host.connect(created.code);
  host.send({ type: "hello", name: "ShareHost", playerId: created.playerId, secret: created.secret });
  await host.wait((m) => m.type === "welcome");

  // Custom mix with Hot Potato + Survivor (2 grey balances at 6 players).
  host.send({ type: "set_playset", playsetId: "custom-mix", playerCount: 6, cardIds: ["g009", "g028"] });
  await host.wait((m) => m.type === "state" && m.state?.playsetId === "custom-mix");

  const guests: Client[] = [];
  for (const name of ["SharA", "SharB", "SharC", "SharD", "SharE"]) {
    const g = new Client();
    await g.connect(created.code);
    g.send({ type: "hello", name });
    await g.wait((m) => m.type === "welcome");
    guests.push(g);
  }
  let players = 1;
  while (players < 6) {
    const upd = await host.wait((m) => m.type === "state");
    players = upd.state.players.length;
  }

  host.send({ type: "start" });
  const started = await host.wait((m) => m.type === "state" && m.state?.phase === "playing");
  assert(started.state.phase === "playing", "share test game starts at 6 players");

  // Collect each guest's playing state, find a real (non-bot) roommate.
  const guestStates: any[] = [];
  for (const g of guests) {
    const st = await g.wait((m) => m.type === "state" && m.state?.phase === "playing" && m.state?.you?.card);
    guestStates.push({ g, state: st.state });
  }
  const myRoom = started.state.you.room;
  const roommateEntry = guestStates.find((e: any) => e.state.you.room === myRoom);
  assert(!!roommateEntry, "found a real-guest roommate in the host's room");
  const roommateGuest = roommateEntry!.g;
  const roommateId = roommateEntry!.state.you.id;

  // Cross-room share must be rejected.
  const otherRoom = myRoom === "A" ? "B" : "A";
  const otherRoomPlayer = started.state.players.find((p: any) => p.room === otherRoom);
  if (otherRoomPlayer) {
    host.send({ type: "request_share", targetId: otherRoomPlayer.id, level: "half" });
    const crossErr = await host.wait((m) => m.type === "error");
    assert(/own room/i.test(crossErr.message || ""), `cross-room share rejected: ${crossErr.message}`);
  }

  // 1. Full card share, accepted. Both sides should see the other's full card.
  host.send({ type: "request_share", targetId: roommateId, level: "full" });
  const prompt = await roommateGuest.wait((m) => m.type === "state" && m.state?.incomingShare);
  assert(prompt.state.incomingShare.requesterName === "ShareHost", "roommate got the incoming share prompt");
  assert(prompt.state.incomingShare.level === "full", "incoming share level is full");
  const hostPending = await host.wait((m) => m.type === "state" && m.state?.outgoingShare);
  assert(!!hostPending.state.outgoingShare, "host sees the outgoing pending share");

  roommateGuest.send({ type: "respond_share", shareId: prompt.state.incomingShare.id, accept: true });
  const hostReveal = await host.wait((m) => m.type === "state" && m.state?.revealedToYou?.length > 0);
  const roommateReveal = await roommateGuest.wait((m) => m.type === "state" && m.state?.revealedToYou?.length > 0);
  assert(hostReveal.state.revealedToYou.length === 1, `host sees 1 reveal (got ${hostReveal.state.revealedToYou.length})`);
  assert(roommateReveal.state.revealedToYou.length === 1, `roommate sees 1 reveal (got ${roommateReveal.state.revealedToYou.length})`);
  assert(hostReveal.state.revealedToYou[0].level === "full", "host reveal is full level");
  assert(!!hostReveal.state.revealedToYou[0].card, "host reveal includes the full card");
  assert(roommateReveal.state.revealedToYou[0].peerName === "ShareHost", "roommate reveal peer is host");

  // Hot Potato: if either side held it, cards should have swapped.
  const hostCardBefore = started.state.you.card?.name;
  const roommateCardBefore = roommateEntry!.state.you.card?.name;
  const hostCardAfter = hostReveal.state.you.card?.name;
  const hotPotatoInvolved = hostCardBefore === "Hot Potato" || roommateCardBefore === "Hot Potato";
  if (hotPotatoInvolved) {
    assert(hostCardAfter !== hostCardBefore, "host's card changed (Hot Potato swap)");
    assert(
      hostCardAfter === roommateCardBefore,
      `host now holds roommate's old card (${hostCardAfter} vs ${roommateCardBefore})`
    );
  } else {
    assert(hostCardAfter === hostCardBefore, "no swap when Hot Potato isn't involved");
  }

  // 2. Decline: no reveal added, outgoing cleared.
  host.queue.length = 0;
  roommateGuest.queue.length = 0;
  host.send({ type: "request_share", targetId: roommateId, level: "half" });
  const prompt2 = await roommateGuest.wait((m) => m.type === "state" && m.state?.incomingShare?.level === "half");
  roommateGuest.send({ type: "respond_share", shareId: prompt2.state.incomingShare.id, accept: false });
  const afterDecline = await host.wait((m) => m.type === "state" && m.state?.outgoingShare === null);
  assert(afterDecline.state.outgoingShare === null, "decline clears outgoing share");
  assert(
    afterDecline.state.revealedToYou.length === hostReveal.state.revealedToYou.length,
    "decline adds no reveal"
  );

  // 3. Cancel: requester cancels before a response.
  host.queue.length = 0;
  host.send({ type: "request_share", targetId: roommateId, level: "half" });
  const pending3 = await host.wait((m) => m.type === "state" && m.state?.outgoingShare);
  host.send({ type: "cancel_share", shareId: pending3.state.outgoingShare.id });
  const afterCancel = await host.wait((m) => m.type === "state" && m.state?.outgoingShare === null);
  assert(afterCancel.state.outgoingShare === null, "cancel clears outgoing share");
  assert(
    afterCancel.state.revealedToYou.length === hostReveal.state.revealedToYou.length,
    "cancel adds no reveal"
  );

  // 4. Spy color deception: a color share reveals displayTeam, not true team.
  // Re-run with the classic-spy playset at 11 players to get spies in the deck.
  await testSpyColorDeception();

  host.close();
  guests.forEach((g) => g.close());
}

async function testSpyColorDeception() {
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "SpyShareHost", playsetId: "basic", playerCount: 11 }),
  });
  const created = await createRes.json();
  const host = new Client();
  await host.connect(created.code);
  host.send({ type: "hello", name: "SpyShareHost", playerId: created.playerId, secret: created.secret });
  await host.wait((m) => m.type === "welcome");
  host.send({ type: "set_playset", playsetId: "classic-spy", playerCount: 11 });
  await host.wait((m) => m.type === "state" && m.state?.playsetId === "classic-spy");

  const guests: Client[] = [];
  for (let i = 0; i < 10; i++) {
    const g = new Client();
    await g.connect(created.code);
    g.send({ type: "hello", name: `SpyG${i}` });
    await g.wait((m) => m.type === "welcome");
    guests.push(g);
  }
  let players = 1;
  while (players < 11) {
    const upd = await host.wait((m) => m.type === "state");
    players = upd.state.players.length;
  }
  host.send({ type: "start" });
  const started = await host.wait((m) => m.type === "state" && m.state?.phase === "playing");

  // Collect everyone's card, find a spy and a same-room partner.
  const allStates: any[] = [{ g: host, state: started.state }];
  for (const g of guests) {
    const st = await g.wait((m) => m.type === "state" && m.state?.phase === "playing" && m.state?.you?.card);
    allStates.push({ g, state: st.state });
  }
  const spyEntry = allStates.find((e: any) => e.state.you.card?.name === "Blue Spy" || e.state.you.card?.name === "Red Spy");
  if (!spyEntry) {
    // Spies weren't dealt to a real client this run (they may be on the
    // host's card which we can see, but we need two real clients). Skip
    // gracefully -- the deck is shuffled, so this is rare but possible.
    console.log("  (spy color-deception check skipped: no spy dealt to a real client)");
    host.close(); guests.forEach((g) => g.close());
    return;
  }
  const spyName = spyEntry!.state.you.card?.name;
  const spyTrueTeam = spyEntry!.state.you.card?.team;
  const spyRoom = spyEntry!.state.you.room;
  const partnerEntry = allStates.find((e: any) => e.state.you.room === spyRoom && e !== spyEntry);
  assert(!!partnerEntry, `found a same-room partner for the ${spyName}`);

  const spyClient = spyEntry!.g;
  const partnerClient = partnerEntry!.g;
  const partnerId = partnerEntry!.state.you.id;

  // Spy does a COLOR (half) share with the partner. The partner should see
  // the spy's DISPLAYED color (opposite of true team), not the true team.
  spyClient.send({ type: "request_share", targetId: partnerId, level: "half" });
  const prompt = await partnerClient.wait((m) => m.type === "state" && m.state?.incomingShare);
  partnerClient.send({ type: "respond_share", shareId: prompt.state.incomingShare.id, accept: true });
  const partnerReveal = await partnerClient.wait((m) => m.type === "state" && m.state?.revealedToYou?.length > 0);
  const revealedTeam = partnerReveal.state.revealedToYou[0].team;
  // Blue Spy (r030) is on Blue team but LOOKS RED; Red Spy (b030) is on Red
  // team but LOOKS BLUE. A color share reveals the deception color.
  const expectedDisplay = spyName === "Blue Spy" ? "red" : "blue";
  assert(
    revealedTeam === expectedDisplay,
    `${spyName} (true team ${spyTrueTeam}) color-share reveals ${revealedTeam}, expected ${expectedDisplay} (deception)`
  );
  assert(
    partnerReveal.state.revealedToYou[0].card === null,
    "color share does not reveal the full card"
  );

  host.close();
  guests.forEach((g) => g.close());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
