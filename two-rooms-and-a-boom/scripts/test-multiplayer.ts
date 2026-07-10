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
  assert(/6/.test(tooFew.message || ""), `too few error: ${tooFew.message}`);

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

  host2.send({ type: "start" });
  await host2.wait((m) => m.type === "state" && m.state?.phase === "playing");
  host2.send({ type: "reveal_all" });
  const ended = await host2.wait((m) => m.type === "state" && m.state?.phase === "ended");
  assert(ended.state.phase === "ended", "game ended");

  host2.send({ type: "set_name", name: "Captain" });
  const renamed = await host2.wait((m) => m.type === "state" && m.state?.you?.name === "Captain");
  assert(renamed.state.you.name === "Captain", "renamed");

  // SPA routes
  for (const path of ["/", "/print", `/play/${created.code}`]) {
    const res = await fetch(`${BASE}${path}`);
    assert(res.ok, `spa ${path} -> ${res.status}`);
  }

  host2.close();
  guests.forEach((g) => g.close());

  console.log(failed ? `\n${failed} MULTIPLAYER FAILURES` : "\nALL MULTIPLAYER TESTS PASSED");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
