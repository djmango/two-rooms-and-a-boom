(() => {
  const {
    PRIMARY,
    PACKS,
    PLAYSETS,
    LEADERS,
    hostagesFor,
    roundLabels,
    cardFromId,
  } = window.TRAB;

  const els = {
    form: document.getElementById("setup-form"),
    playerCount: document.getElementById("player-count"),
    playsets: document.getElementById("playset-options"),
    advancedWrap: document.getElementById("advanced-wrap"),
    advanced: document.getElementById("advanced-options"),
    playerNames: document.getElementById("player-names"),
    nameFields: document.getElementById("name-fields"),
    hostageInfo: document.getElementById("hostage-info"),
    screenCards: document.getElementById("screen-cards"),
    printSheet: document.getElementById("print-sheet"),
    deckSummary: document.getElementById("deck-summary"),
    printSummary: document.getElementById("print-summary"),
    reshuffle: document.getElementById("reshuffle"),
    printBtn: document.getElementById("print-btn"),
    quickDeal: document.getElementById("quick-deal"),
    dealMode: document.getElementById("deal-mode"),
    roomSplit: document.getElementById("room-split"),
    buriedNote: document.getElementById("buried-note"),
  };

  /** @type {object | null} */
  let lastDeal = null;
  let selectedPlaysetId = "basic";
  let revealAll = false;

  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function cloneCard(card, index) {
    return { ...card, dealIndex: index };
  }

  function currentPlayset() {
    return PLAYSETS.find((p) => p.id === selectedPlaysetId) || PLAYSETS[0];
  }

  function selectedPackIds() {
    return [...els.advanced.querySelectorAll('input[type="checkbox"]:checked')].map(
      (el) => el.value
    );
  }

  function resolvePacks(packIds) {
    const selected = new Set(packIds);
    return PACKS.filter(
      (pack) => selected.has(pack.id) && (!pack.requires || selected.has(pack.requires))
    );
  }

  function parseNames(players) {
    const inputs = [...els.nameFields.querySelectorAll("input")];
    const names = [];
    for (let i = 0; i < players; i += 1) {
      const raw = (inputs[i]?.value || "").trim();
      names.push(raw || `Player ${i + 1}`);
    }
    return names;
  }

  function renderNameFields(count) {
    const prev = [...els.nameFields.querySelectorAll("input")].map((i) => i.value);
    els.nameFields.innerHTML = Array.from({ length: count }, (_, i) => {
      const val = prev[i] ? ` value="${escapeAttr(prev[i])}"` : "";
      return `<label class="name-field">
        <span>#${i + 1}</span>
        <input type="text" maxlength="24" placeholder="Player ${i + 1}"${val} />
      </label>`;
    }).join("");
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Build deck from playset or custom packs.
   * Always: President + Bomber.
   * Odd: oddCard (usually Gambler) unless bury consumes the odd slot differently.
   * Specials replace plain team cards; greys consume balanced slots.
   */
  function buildDeck(players, playset, packIds) {
    if (players < 6 || players > 30) {
      throw new Error("Player count must be between 6 and 30.");
    }
    if (playset.fixedPlayers && players !== playset.fixedPlayers) {
      throw new Error(`${playset.name} is fixed at ${playset.fixedPlayers} players.`);
    }
    const [minP, maxP] = playset.players;
    if (players < minP || players > maxP) {
      throw new Error(`${playset.name} supports ${minP}–${maxP} players.`);
    }

    const bury = Boolean(playset.bury);
    const deckSize = bury ? players + 1 : players;

    const cards = [];
    cards.push(cardFromId("b001"));
    cards.push(cardFromId("r001"));

    let specials = [];
    if (playset.id === "custom") {
      for (const pack of resolvePacks(packIds)) {
        specials.push(...pack.cards.map((c) => ({ ...c })));
      }
    } else {
      specials = (playset.cardIds || []).map((id) => cardFromId(id));
    }

    const oddId = playset.oddCard;
    const needOdd = deckSize % 2 === 1;
    // After President+Bomber (2), remaining = deckSize-2.
    // If remaining is odd, we need one grey odd card (or bury already made deck even/odd).
    let remaining = deckSize - cards.length;

    let blueExtras = [];
    let redExtras = [];
    let greyExtras = [];
    for (const card of specials) {
      if (card.team === "blue") blueExtras.push(card);
      else if (card.team === "red") redExtras.push(card);
      else greyExtras.push(card);
    }

    if (needOdd) {
      if (oddId) {
        greyExtras.push(cardFromId(oddId));
      } else if (!greyExtras.length) {
        greyExtras.push(cardFromId("g008"));
      }
    }

    if (greyExtras.length > remaining) {
      throw new Error(`Too many grey / special roles for ${players} players.`);
    }

    remaining -= greyExtras.length;
    cards.push(...greyExtras);

    if (remaining % 2 !== 0) {
      throw new Error(
        "Roles leave an odd number of team slots. Adjust the playset or player count."
      );
    }

    let blueSlots = remaining / 2;
    let redSlots = remaining / 2;

    if (blueExtras.length > blueSlots || redExtras.length > redSlots) {
      throw new Error(`Too many advanced team roles for ${players} players.`);
    }

    cards.push(...blueExtras, ...redExtras);
    blueSlots -= blueExtras.length;
    redSlots -= redExtras.length;

    for (let i = 0; i < blueSlots; i += 1) {
      cards.push({ ...PRIMARY.blueTeam, id: `b000-${i + 1}` });
    }
    for (let i = 0; i < redSlots; i += 1) {
      cards.push({ ...PRIMARY.redTeam, id: `r000-${i + 1}` });
    }

    if (cards.length !== deckSize) {
      throw new Error(`Deck size ${cards.length} ≠ expected ${deckSize}.`);
    }

    const shuffled = shuffle(cards);
    let buried = null;
    let dealt = shuffled;
    if (bury) {
      buried = shuffled[shuffled.length - 1];
      dealt = shuffled.slice(0, players);
    }

    return {
      cards: dealt.map((c, i) => cloneCard(c, i + 1)),
      buried: buried ? cloneCard(buried, 0) : null,
    };
  }

  function assignRooms(players) {
    const indices = shuffle(Array.from({ length: players }, (_, i) => i));
    const aCount = Math.ceil(players / 2);
    const rooms = Array(players).fill("B");
    indices.slice(0, aCount).forEach((i) => {
      rooms[i] = "A";
    });
    return rooms;
  }

  function teamLabel(team) {
    if (team === "blue") return "Blue";
    if (team === "red") return "Red";
    if (team === "grey") return "Grey";
    if (team === "leader") return "Leader";
    return team;
  }

  function cardFaceHTML(card, opts = {}) {
    const { showNumber = false, playerName = null, room = null, hidden = false } = opts;
    if (hidden) {
      return `
        <article class="card face team-hidden deal-slip" data-id="${card.id}">
          <header class="card-top">
            <span class="card-team">Facedown</span>
            ${playerName ? `<span class="card-num">${escapeHtml(playerName)}</span>` : ""}
          </header>
          <h3 class="card-name">???</h3>
          <p class="card-short">Tap reveal · keep secret</p>
          <p class="card-ability">Hand this slip to ${escapeHtml(playerName || "the player")}. They look privately.</p>
          <footer class="card-foot">Two Rooms and a Boom</footer>
        </article>
      `;
    }
    const num =
      showNumber && card.dealIndex
        ? `<span class="card-num">#${card.dealIndex}</span>`
        : "";
    const meta = [
      playerName ? escapeHtml(playerName) : null,
      room ? `Room ${room}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `
      <article class="card face team-${card.team}" data-id="${card.id}">
        <header class="card-top">
          <span class="card-team">${teamLabel(card.team)}</span>
          ${meta ? `<span class="card-num">${meta}</span>` : num}
        </header>
        <h3 class="card-name">${escapeHtml(card.name)}</h3>
        <p class="card-short">${escapeHtml(card.short || "")}</p>
        <p class="card-ability">${escapeHtml(card.ability)}</p>
        <footer class="card-foot">Two Rooms and a Boom</footer>
      </article>
    `;
  }

  function cardBackHTML() {
    return `
      <article class="card back" aria-hidden="true">
        <div class="back-inner">
          <span class="back-brand">Two Rooms</span>
          <span class="back-boom">BOOM</span>
          <span class="back-sub">and a</span>
        </div>
      </article>
    `;
  }

  function hostageChartHTML(players) {
    const [h3, h2, h1] = hostagesFor(players);
    return `
      <article class="card face team-leader chart-card">
        <header class="card-top"><span class="card-team">Reference</span></header>
        <h3 class="card-name">Hostage Chart</h3>
        <p class="card-short">${players} players</p>
        <ul class="hostage-list">
          <li><strong>${roundLabels[0]}</strong> — ${h3} hostage${h3 === 1 ? "" : "s"}</li>
          <li><strong>${roundLabels[1]}</strong> — ${h2} hostage${h2 === 1 ? "" : "s"}</li>
          <li><strong>${roundLabels[2]}</strong> — ${h1} hostage${h1 === 1 ? "" : "s"}</li>
        </ul>
        <p class="card-ability">Leaders cannot be hostages. Split players evenly into two rooms.</p>
        <footer class="card-foot">Two Rooms and a Boom</footer>
      </article>
    `;
  }

  function updateHostageInfo(players) {
    const [a, b, c] = hostagesFor(players);
    const rooms = [Math.ceil(players / 2), Math.floor(players / 2)];
    els.hostageInfo.innerHTML = `
      <strong>${players} players</strong> · Rooms ~${rooms[0]} / ${rooms[1]} ·
      Hostages: ${a} → ${b} → ${c}
      ${players % 2 === 1 ? " · Odd count → grey odd card" : ""}
    `;
  }

  function renderPlaysets() {
    els.playsets.innerHTML = PLAYSETS.map((ps) => {
      const range =
        ps.fixedPlayers != null
          ? `${ps.fixedPlayers}p`
          : `${ps.players[0]}–${ps.players[1]}p`;
      return `
        <label class="playset-card ${ps.id === selectedPlaysetId ? "is-active" : ""}">
          <input type="radio" name="playset" value="${ps.id}" ${
        ps.id === selectedPlaysetId ? "checked" : ""
      } />
          <span class="playset-emoji" aria-hidden="true">${ps.emoji}</span>
          <span class="playset-body">
            <strong>${escapeHtml(ps.name)}</strong>
            <em>${escapeHtml(ps.blurb)}</em>
            <span class="playset-range">${range}</span>
          </span>
        </label>
      `;
    }).join("");

    els.playsets.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.name === "playset") {
        selectedPlaysetId = t.value;
        [...els.playsets.querySelectorAll(".playset-card")].forEach((el) => {
          el.classList.toggle("is-active", el.querySelector("input")?.value === selectedPlaysetId);
        });
        syncPlaysetUI();
      }
    });
  }

  function syncPlaysetUI() {
    const ps = currentPlayset();
    const isCustom = ps.id === "custom";
    els.advancedWrap.hidden = !isCustom;
    if (ps.fixedPlayers) {
      els.playerCount.value = String(ps.fixedPlayers);
      els.playerCount.readOnly = true;
    } else {
      els.playerCount.readOnly = false;
      const n = currentPlayers();
      if (n < ps.players[0]) els.playerCount.value = String(ps.players[0]);
      if (n > ps.players[1]) els.playerCount.value = String(ps.players[1]);
    }
    renderNameFields(currentPlayers());
    updateHostageInfo(currentPlayers());
  }

  function renderPackOptions() {
    els.advanced.innerHTML = PACKS.map((pack) => {
      const req = pack.requires
        ? `<span class="req">needs ${
            PACKS.find((p) => p.id === pack.requires)?.name || pack.requires
          }</span>`
        : "";
      const rec = pack.recommended ? `<span class="rec">recommended</span>` : "";
      return `
        <label class="check">
          <input type="checkbox" name="pack" value="${pack.id}" ${
        pack.recommended ? "checked" : ""
      } />
          <span>
            <strong>${escapeHtml(pack.name)}</strong>
            ${rec}${req}
            <em>${escapeHtml(pack.blurb)}</em>
          </span>
        </label>
      `;
    }).join("");

    els.advanced.addEventListener("change", () => {
      const nurse = els.advanced.querySelector('input[value="nurse-tinkerer"]');
      const doc = els.advanced.querySelector('input[value="doctor-engineer"]');
      if (nurse?.checked && doc && !doc.checked) doc.checked = true;
    });
  }

  function renderRoomSplit(deal) {
    if (!els.roomSplit) return;
    const a = [];
    const b = [];
    deal.assignments.forEach((row) => {
      (row.room === "A" ? a : b).push(row);
    });
    els.roomSplit.innerHTML = `
      <div class="room-col room-col-a">
        <h3>Room A <small>${a.length}</small></h3>
        <ul>${a.map((r) => `<li>${escapeHtml(r.name)}</li>`).join("")}</ul>
      </div>
      <div class="room-col room-col-b">
        <h3>Room B <small>${b.length}</small></h3>
        <ul>${b.map((r) => `<li>${escapeHtml(r.name)}</li>`).join("")}</ul>
      </div>
    `;
  }

  function renderDeal(deal) {
    const { players, cards, leaders, playset, buried, assignments } = deal;
    const summary = `${players} players · ${playset.name}${
      buried ? " · 1 card buried" : ""
    }. Print cuttable cards, or use named deal slips.`;

    els.deckSummary.textContent = summary;
    els.printSummary.textContent = summary;

    if (els.buriedNote) {
      if (buried) {
        els.buriedNote.hidden = false;
        els.buriedNote.innerHTML = revealAll
          ? `<strong>Buried:</strong> ${escapeHtml(buried.name)} (${teamLabel(
              buried.team
            )}) — keep facedown until Private Eye / end.`
          : `<strong>Buried card</strong> set aside facedown (hidden on screen). Print sheet includes it marked BURIED.`;
      } else {
        els.buriedNote.hidden = true;
        els.buriedNote.innerHTML = "";
      }
    }

    const hideRoles = !revealAll;
    els.screenCards.innerHTML = assignments
      .map((row) =>
        cardFaceHTML(row.card, {
          showNumber: true,
          playerName: row.name,
          room: row.room,
          hidden: hideRoles,
        })
      )
      .join("");

    // Click-to-reveal individual slips in spoiler-safe mode
    if (hideRoles) {
      els.screenCards.querySelectorAll(".deal-slip").forEach((el, idx) => {
        el.style.cursor = "pointer";
        el.title = "Click to reveal this card only";
        el.addEventListener("click", () => {
          const row = assignments[idx];
          el.outerHTML = cardFaceHTML(row.card, {
            showNumber: true,
            playerName: row.name,
            room: row.room,
            hidden: false,
          });
        });
      });
    }

    renderRoomSplit(deal);

    // Print: character fronts, backs, leaders, chart, optional buried, named slips
    const printCards = [...cards];
    if (buried) printCards.push({ ...buried, dealIndex: "B", name: `${buried.name} (BURIED)` });

    const chunks = [];
    for (let i = 0; i < printCards.length; i += 8) {
      chunks.push(printCards.slice(i, i + 8));
    }

    let html = "";
    chunks.forEach((chunk, pageIdx) => {
      html += `<div class="sheet-page"><h2 class="sheet-label no-print">Character fronts — page ${
        pageIdx + 1
      }</h2><div class="card-grid">`;
      chunk.forEach((c) => {
        html += cardFaceHTML(c, { showNumber: true });
      });
      for (let i = chunk.length; i < 8; i += 1) {
        html += `<div class="card placeholder" aria-hidden="true"></div>`;
      }
      html += `</div></div>`;
    });

    chunks.forEach((chunk, pageIdx) => {
      html += `<div class="sheet-page backs-page"><h2 class="sheet-label no-print">Character backs — page ${
        pageIdx + 1
      }</h2><div class="card-grid">`;
      chunk.forEach(() => {
        html += cardBackHTML();
      });
      for (let i = chunk.length; i < 8; i += 1) {
        html += `<div class="card placeholder" aria-hidden="true"></div>`;
      }
      html += `</div></div>`;
    });

    // Named deal slips (one per player) — useful if you don't cut full cards
    const slipCards = assignments.map((row) => ({
      ...row.card,
      short: `${row.name} · Room ${row.room}`,
      _player: row.name,
      _room: row.room,
    }));
    for (let i = 0; i < slipCards.length; i += 8) {
      const chunk = slipCards.slice(i, i + 8);
      const label = i === 0 ? "Named deal slips" : "Named deal slips (cont.)";
      html += `<div class="sheet-page"><h2 class="sheet-label no-print">${label}</h2><div class="card-grid">`;
      chunk.forEach((c) => {
        html += cardFaceHTML(c, {
          playerName: c._player,
          room: c._room,
        });
      });
      for (let j = chunk.length; j < 8; j += 1) {
        html += `<div class="card placeholder" aria-hidden="true"></div>`;
      }
      html += `</div></div>`;
    }

    html += `<div class="sheet-page"><h2 class="sheet-label no-print">Leaders &amp; chart</h2><div class="card-grid">`;
    leaders.forEach((l) => {
      html += cardFaceHTML(l);
    });
    html += hostageChartHTML(players);
    html += cardBackHTML();
    html += cardBackHTML();
    html += `<div class="card placeholder" aria-hidden="true"></div>`;
    html += `<div class="card placeholder" aria-hidden="true"></div>`;
    html += `<div class="card placeholder" aria-hidden="true"></div>`;
    html += `</div></div>`;

    els.printSheet.innerHTML = html;
  }

  function deal() {
    const players = currentPlayers();
    const playset = currentPlayset();
    const packIds = selectedPackIds();
    try {
      const { cards, buried } = buildDeck(players, playset, packIds);
      const names = parseNames(players);
      const rooms = assignRooms(players);
      const assignments = cards.map((card, i) => ({
        card,
        name: names[i],
        room: rooms[i],
      }));
      const leaders = LEADERS.map((l) => ({ ...l }));
      lastDeal = {
        players,
        playset,
        packIds: [...packIds],
        cards,
        buried,
        leaders,
        assignments,
      };
      // Spoiler-safe checkbox checked → hide roles on screen
      revealAll = !(els.dealMode && els.dealMode.checked);
      renderDeal(lastDeal);
      updateHostageInfo(players);
      document.getElementById("deck")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      els.deckSummary.textContent = err.message;
      els.screenCards.innerHTML = "";
      els.printSheet.innerHTML = "";
      if (els.roomSplit) els.roomSplit.innerHTML = "";
      alert(err.message);
    }
  }

  function currentPlayers() {
    return Number(els.playerCount.value) || 10;
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    deal();
  });

  els.reshuffle.addEventListener("click", () => deal());

  els.printBtn.addEventListener("click", () => {
    if (!lastDeal) deal();
    window.print();
  });

  els.quickDeal.addEventListener("click", () => {
    selectedPlaysetId = "basic";
    const radio = els.playsets.querySelector('input[value="basic"]');
    if (radio) radio.checked = true;
    [...els.playsets.querySelectorAll(".playset-card")].forEach((el) => {
      el.classList.toggle("is-active", el.querySelector("input")?.value === "basic");
    });
    els.playerCount.readOnly = false;
    els.playerCount.value = "10";
    syncPlaysetUI();
    deal();
  });

  els.playerCount.addEventListener("input", () => {
    renderNameFields(currentPlayers());
    updateHostageInfo(currentPlayers());
  });

  if (els.dealMode) {
    els.dealMode.addEventListener("change", () => {
      if (!lastDeal) return;
      revealAll = !els.dealMode.checked;
      renderDeal(lastDeal);
    });
  }

  const revealBtn = document.getElementById("reveal-all");
  if (revealBtn) {
    revealBtn.addEventListener("click", () => {
      if (!lastDeal) return;
      revealAll = true;
      if (els.dealMode) els.dealMode.checked = false;
      renderDeal(lastDeal);
    });
  }

  renderPlaysets();
  renderPackOptions();
  syncPlaysetUI();
  deal();
})();
