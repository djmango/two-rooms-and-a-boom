const STORAGE_KEY = "trab-session";

/** @typedef {import('../../src/game/types').PublicState} PublicState */
/** @typedef {import('../../src/game/types').ServerMessage} ServerMessage */

const els = {
  home: document.querySelector('[data-view="home"]'),
  game: document.querySelector('[data-view="game"]'),
  joinPanel: document.getElementById("join-panel"),
  joinCode: document.getElementById("join-code"),
  joinName: document.getElementById("join-name"),
  joinError: document.getElementById("join-error"),
  btnCreate: document.getElementById("btn-create"),
  btnShowJoin: document.getElementById("btn-show-join"),
  roomCode: document.getElementById("room-code"),
  copyToast: document.getElementById("copy-toast"),
  conn: document.getElementById("conn-status"),
  toast: document.getElementById("toast"),
  playerList: document.getElementById("player-list"),
  playerCountPill: document.getElementById("player-count-pill"),
  lobbyControls: document.getElementById("lobby-controls"),
  playControls: document.getElementById("play-controls"),
  lobbyBlurb: document.getElementById("lobby-blurb"),
  selfName: document.getElementById("self-name"),
  hostSetup: document.getElementById("host-setup"),
  playsetSelect: document.getElementById("playset-select"),
  playsetBlurb: document.getElementById("playset-blurb"),
  btnStart: document.getElementById("btn-start"),
  btnReady: document.getElementById("btn-ready"),
  btnLeave: document.getElementById("btn-leave"),
  cardReveal: document.getElementById("card-reveal"),
  roleCard: document.getElementById("role-card"),
  roomBadge: document.getElementById("room-badge"),
  roundLabel: document.getElementById("round-label"),
  hostageLabel: document.getElementById("hostage-label"),
  timerDisplay: document.getElementById("timer-display"),
  timerBar: document.getElementById("timer-bar"),
  hostTimerActions: document.getElementById("host-timer-actions"),
  btnStartRound: document.getElementById("btn-start-round"),
  btnPause: document.getElementById("btn-pause"),
  btnEndRound: document.getElementById("btn-end-round"),
  btnReshuffle: document.getElementById("btn-reshuffle"),
  btnRevealAll: document.getElementById("btn-reveal-all"),
};

/** @type {{ code: string, playerId: string, secret: string, name: string } | null} */
let session = loadSession();
/** @type {PublicState | null} */
let state = null;
/** @type {WebSocket | null} */
let ws = null;
let intentionalClose = false;
let reconnectAttempt = 0;
let reconnectTimer = 0;
let heartbeatTimer = 0;
let timerRaf = 0;
let cardRevealed = false;
/** @type {Array<{id:string,name:string,blurb:string,players:number[]}>} */
let playsets = [];
let clockSkew = 0;

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(next) {
  session = next;
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else localStorage.removeItem(STORAGE_KEY);
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function showView(name) {
  els.home.hidden = name !== "home";
  els.game.hidden = name !== "game";
  els.home.classList.toggle("is-active", name === "home");
  els.game.classList.toggle("is-active", name === "game");
}

function setConn(status, text) {
  els.conn.dataset.status = status;
  els.conn.querySelector(".conn-text").textContent = text;
}

function showToast(message) {
  els.toast.hidden = !message;
  els.toast.textContent = message || "";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadMeta() {
  const res = await fetch("/api/meta");
  const data = await res.json();
  playsets = data.playsets || [];
  els.playsetSelect.innerHTML = playsets
    .filter((p) => p.id !== "custom")
    .map(
      (p) =>
        `<option value="${p.id}">${escapeHtml(p.emoji || "")} ${escapeHtml(p.name)}</option>`
    )
    .join("");
  updatePlaysetBlurb();
}

function updatePlaysetBlurb() {
  const ps = playsets.find((p) => p.id === els.playsetSelect.value);
  els.playsetBlurb.textContent = ps
    ? `${ps.blurb} (${ps.players[0]}–${ps.players[1]} players)`
    : "";
}

function wsUrl(code) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/rooms/${encodeURIComponent(code)}/ws`;
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function connect() {
  if (!session?.code) return;
  intentionalClose = false;
  setConn("reconnecting", reconnectAttempt ? "Reconnecting…" : "Connecting…");

  if (ws) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }

  ws = new WebSocket(wsUrl(session.code));

  ws.addEventListener("open", () => {
    reconnectAttempt = 0;
    setConn("live", "Live");
    send({
      type: "hello",
      name: session.name,
      playerId: session.playerId,
      secret: session.secret,
    });
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => send({ type: "ping" }), 25000);
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    onServerMessage(msg);
  });

  ws.addEventListener("close", () => {
    clearInterval(heartbeatTimer);
    if (intentionalClose) {
      setConn("offline", "Disconnected");
      return;
    }
    setConn("reconnecting", "Reconnecting…");
    const delay = Math.min(8000, 500 * 2 ** reconnectAttempt + Math.random() * 300);
    reconnectAttempt += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  });

  ws.addEventListener("error", () => {
    /* close handler reconnects */
  });
}

function onServerMessage(msg) {
  if (msg.type === "welcome") {
    saveSession({
      code: session.code,
      playerId: msg.playerId,
      secret: msg.secret,
      name: msg.state.you?.name || session.name,
    });
    clockSkew = msg.state.serverTime - Date.now();
    applyState(msg.state);
    return;
  }
  if (msg.type === "state") {
    clockSkew = msg.state.serverTime - Date.now();
    applyState(msg.state);
    return;
  }
  if (msg.type === "error") {
    showToast(msg.message);
    return;
  }
  if (msg.type === "pong") {
    clockSkew = msg.t - Date.now();
  }
}

function applyState(next) {
  const prevPhase = state?.phase;
  state = next;
  showView("game");
  showToast("");
  els.roomCode.textContent = next.code;
  els.selfName.value = next.you?.name || session?.name || "";
  renderPlayers();
  renderPhase();
  if (prevPhase === "lobby" && next.phase === "playing") {
    cardRevealed = false;
  }
  if (next.phase === "ended") cardRevealed = true;
  renderCard();
  renderTimer();
}

function renderPlayers() {
  if (!state) return;
  els.playerCountPill.textContent = String(state.players.length);
  els.playerList.innerHTML = state.players
    .map((p) => {
      const you = p.id === state.you?.id;
      const room =
        p.room != null
          ? `<span class="room-tag ${p.room.toLowerCase()}">Room ${p.room}</span>`
          : "";
      const ready =
        state.phase === "lobby"
          ? p.ready
            ? "ready"
            : "…"
          : "";
      return `<li class="${you ? "is-you" : ""} ${p.isHost ? "is-host" : ""}">
        <span class="pname">${escapeHtml(p.name)}</span>
        <span class="pmeta">
          <span class="dot-online ${p.connected ? "" : "dot-offline"}"></span>
          ${room}
          ${ready ? `<span>${ready}</span>` : ""}
        </span>
      </li>`;
    })
    .join("");
}

function renderPhase() {
  if (!state) return;
  const isLobby = state.phase === "lobby";
  els.lobbyControls.hidden = !isLobby;
  els.playControls.hidden = isLobby;
  els.hostSetup.hidden = !(isLobby && state.you?.isHost);
  els.hostTimerActions.hidden = !(!isLobby && state.you?.isHost);

  if (isLobby) {
    const n = state.players.length;
    const need = Math.max(0, 6 - n);
    els.lobbyBlurb.textContent = need
      ? `${n} joined · need ${need} more to start`
      : `${n} players · host can deal when ready`;
    els.btnReady.textContent = state.you && state.players.find((p) => p.id === state.you.id)?.ready
      ? "Unready"
      : "I’m ready";
    if (state.you?.isHost) {
      els.playsetSelect.value = state.playsetId;
      updatePlaysetBlurb();
    }
  } else {
    els.roomBadge.dataset.room = state.you?.room || "";
    els.roomBadge.textContent = state.you?.room
      ? `Go to Room ${state.you.room}`
      : "";
    if (state.you?.isHost) {
      els.btnPause.textContent = state.round?.paused ? "Resume" : "Pause";
    }
  }
}

function renderCard() {
  if (!state?.you) return;
  const card = state.you.card;
  if (!card) {
    els.cardReveal.hidden = true;
    els.roleCard.hidden = true;
    return;
  }
  if (!cardRevealed && state.phase !== "ended") {
    els.cardReveal.hidden = false;
    els.roleCard.hidden = true;
    return;
  }
  els.cardReveal.hidden = true;
  els.roleCard.hidden = false;
  els.roleCard.className = `role-card team-${card.team}`;
  els.roleCard.innerHTML = `
    <div class="team">${card.team}</div>
    <h3>${escapeHtml(card.name)}</h3>
    <p class="short">${escapeHtml(card.short || "")}</p>
    <p class="ability">${escapeHtml(card.ability || "")}</p>
  `;
}

function nowServer() {
  return Date.now() + clockSkew;
}

function renderTimer() {
  cancelAnimationFrame(timerRaf);
  if (!state?.round) {
    els.timerDisplay.textContent = "—:—";
    els.timerBar.style.transform = "scaleX(1)";
    els.roundLabel.textContent = "Rounds";
    els.hostageLabel.textContent = "";
    return;
  }
  const round = state.round;
  els.roundLabel.textContent = `Round ${round.index + 1} / ${round.total} · ${round.label}`;
  els.hostageLabel.textContent = `${round.hostages} hostage${round.hostages === 1 ? "" : "s"}`;

  const totalMs = round.minutes * 60 * 1000;

  const tick = () => {
    if (!state?.round) return;
    let remaining = state.round.remainingMs;
    if (!state.round.paused && state.round.endsAt) {
      remaining = Math.max(0, state.round.endsAt - nowServer());
    }
    if (remaining == null) {
      els.timerDisplay.textContent = "Ready";
      els.timerDisplay.classList.remove("is-urgent");
      els.timerBar.style.transform = "scaleX(1)";
      return;
    }
    const secs = Math.ceil(remaining / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    els.timerDisplay.textContent = `${m}:${String(s).padStart(2, "0")}`;
    els.timerDisplay.classList.toggle("is-urgent", secs <= 30);
    const pct = Math.max(0, Math.min(1, remaining / totalMs));
    els.timerBar.style.transform = `scaleX(${pct})`;
    if (!state.round.paused && remaining > 0) {
      timerRaf = requestAnimationFrame(tick);
    }
  };
  tick();
}

async function createRoom() {
  const name = (els.joinName.value || prompt("Your name?") || "Host").trim();
  els.btnCreate.disabled = true;
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostName: name, playsetId: "basic", playerCount: 10 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not create room");
    saveSession({
      code: data.code,
      playerId: data.playerId,
      secret: data.secret,
      name,
    });
    history.replaceState({}, "", `/?room=${encodeURIComponent(data.code)}`);
    connect();
  } catch (err) {
    showToast(err.message || "Create failed");
    els.joinPanel.hidden = false;
  } finally {
    els.btnCreate.disabled = false;
  }
}

function joinFromForm(ev) {
  ev.preventDefault();
  const code = normalizeCode(els.joinCode.value);
  const name = (els.joinName.value || "Player").trim();
  if (!code.includes("-")) {
    els.joinError.hidden = false;
    els.joinError.textContent = "Use a three-word code like coral-lantern-swift";
    return;
  }
  els.joinError.hidden = true;
  saveSession({ code, playerId: "", secret: "", name });
  history.replaceState({}, "", `/?room=${encodeURIComponent(code)}`);
  connect();
}

function leaveRoom() {
  intentionalClose = true;
  if (ws) ws.close(1000, "leave");
  saveSession(null);
  state = null;
  history.replaceState({}, "", "/");
  showView("home");
  setConn("offline", "Offline");
}

// Events
els.btnCreate.addEventListener("click", createRoom);
els.btnShowJoin.addEventListener("click", () => {
  els.joinPanel.hidden = !els.joinPanel.hidden;
  if (!els.joinPanel.hidden) els.joinCode.focus();
});
els.joinPanel.addEventListener("submit", joinFromForm);

els.roomCode.addEventListener("click", async () => {
  if (!state?.code) return;
  try {
    await navigator.clipboard.writeText(state.code);
    els.copyToast.hidden = false;
    setTimeout(() => {
      els.copyToast.hidden = true;
    }, 1200);
  } catch {
    /* ignore */
  }
});

let nameTimer = 0;
els.selfName.addEventListener("input", () => {
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => {
    const name = els.selfName.value.trim();
    if (!name) return;
    if (session) saveSession({ ...session, name });
    send({ type: "set_name", name });
  }, 300);
});

els.btnReady.addEventListener("click", () => {
  if (!state?.you) return;
  const me = state.players.find((p) => p.id === state.you.id);
  send({ type: "ready", ready: !me?.ready });
});

els.btnLeave.addEventListener("click", leaveRoom);

els.playsetSelect.addEventListener("change", () => {
  updatePlaysetBlurb();
  if (!state?.you?.isHost) return;
  send({
    type: "set_playset",
    playsetId: els.playsetSelect.value,
    playerCount: Math.max(6, state.players.length),
  });
});

els.btnStart.addEventListener("click", () => send({ type: "start" }));
els.btnStartRound.addEventListener("click", () => send({ type: "start_round" }));
els.btnPause.addEventListener("click", () => {
  if (state?.round?.paused) send({ type: "resume_timer" });
  else send({ type: "pause_timer" });
});
els.btnEndRound.addEventListener("click", () => send({ type: "end_round" }));
els.btnReshuffle.addEventListener("click", () => {
  if (confirm("Return everyone to the lobby and clear roles?")) send({ type: "reshuffle" });
});
els.btnRevealAll.addEventListener("click", () => {
  if (confirm("End the game and allow final reveals?")) send({ type: "reveal_all" });
});

els.cardReveal.addEventListener("click", () => {
  cardRevealed = true;
  renderCard();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && session?.code) {
    if (!ws || ws.readyState !== WebSocket.OPEN) connect();
    else send({ type: "ping" });
  }
});

// Boot
await loadMeta();

const params = new URLSearchParams(location.search);
const roomParam = normalizeCode(params.get("room") || "");
if (roomParam) {
  els.joinPanel.hidden = false;
  els.joinCode.value = roomParam;
  if (session?.code === roomParam && session.playerId && session.secret) {
    connect();
  } else if (session?.name) {
    els.joinName.value = session.name;
  }
} else if (session?.code && session.playerId && session.secret) {
  history.replaceState({}, "", `/?room=${encodeURIComponent(session.code)}`);
  connect();
}
