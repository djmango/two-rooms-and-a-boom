(() => {
  const { PRIMARY, PACKS, LEADERS, hostagesFor, roundLabels } = window.TRAB;

  const els = {
    form: document.getElementById("setup-form"),
    playerCount: document.getElementById("player-count"),
    advanced: document.getElementById("advanced-options"),
    hostageInfo: document.getElementById("hostage-info"),
    screenCards: document.getElementById("screen-cards"),
    printSheet: document.getElementById("print-sheet"),
    deckSummary: document.getElementById("deck-summary"),
    printSummary: document.getElementById("print-summary"),
    reshuffle: document.getElementById("reshuffle"),
    printBtn: document.getElementById("print-btn"),
    quickDeal: document.getElementById("quick-deal"),
  };

  /** @type {{ players: number, packIds: string[], cards: object[], leaders: object[] } | null} */
  let lastDeal = null;

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

  function selectedPackIds() {
    return [...els.advanced.querySelectorAll('input[type="checkbox"]:checked')].map(
      (el) => el.value
    );
  }

  function resolvePacks(packIds) {
    const selected = new Set(packIds);
    const packs = [];
    for (const pack of PACKS) {
      if (!selected.has(pack.id)) continue;
      if (pack.requires && !selected.has(pack.requires)) continue;
      packs.push(pack);
    }
    return packs;
  }

  /**
   * Build a legal character deck for `players`.
   * Rules:
   * - Always President + Bomber
   * - Odd players: include Gambler
   * - Remaining slots: equal Red/Blue (after greys from packs + gambler)
   * - Advanced colored packs replace plain team cards of matching color
   * - Grey packs consume slots that would otherwise be team cards (balanced by dropping one red + one blue when possible)
   */
  function buildDeck(players, packIds) {
    if (players < 6 || players > 30) {
      throw new Error("Player count must be between 6 and 30.");
    }

    const packs = resolvePacks(packIds);
    const odd = players % 2 === 1;

    const cards = [];
    cards.push({ ...PRIMARY.president });
    cards.push({ ...PRIMARY.bomber });
    if (odd) cards.push({ ...PRIMARY.gambler });

    let blueExtras = [];
    let redExtras = [];
    let greyExtras = [];

    for (const pack of packs) {
      for (const card of pack.cards) {
        if (card.team === "blue") blueExtras.push({ ...card });
        else if (card.team === "red") redExtras.push({ ...card });
        else greyExtras.push({ ...card });
      }
    }

    // Remaining slots after primaries (+ gambler)
    let remaining = players - cards.length;

    // Greys from packs need slots; Red/Blue counts stay equal, so
    // (players - greys) must be even (President+Bomber already even).
    if (greyExtras.length > remaining) {
      throw new Error(
        `Too many grey roles for ${players} players. Uncheck some grey packs.`
      );
    }

    remaining -= greyExtras.length;
    cards.push(...greyExtras);

    if (remaining % 2 !== 0) {
      throw new Error(
        "Grey roles leave an odd number of team slots. Add another grey pack (or remove one) so Red and Blue stay equal."
      );
    }

    let blueSlots = remaining / 2;
    let redSlots = remaining / 2;

    if (blueExtras.length > blueSlots || redExtras.length > redSlots) {
      throw new Error(
        `Too many advanced team roles for ${players} players. Uncheck some packs.`
      );
    }

    cards.push(...blueExtras);
    cards.push(...redExtras);
    blueSlots -= blueExtras.length;
    redSlots -= redExtras.length;

    for (let i = 0; i < blueSlots; i += 1) {
      cards.push({ ...PRIMARY.blueTeam, id: `blue-team-${i + 1}` });
    }
    for (let i = 0; i < redSlots; i += 1) {
      cards.push({ ...PRIMARY.redTeam, id: `red-team-${i + 1}` });
    }

    if (cards.length !== players) {
      throw new Error(`Deck size ${cards.length} does not match ${players} players.`);
    }

    return shuffle(cards).map((c, i) => cloneCard(c, i + 1));
  }

  function teamLabel(team) {
    if (team === "blue") return "Blue";
    if (team === "red") return "Red";
    if (team === "grey") return "Grey";
    if (team === "leader") return "Leader";
    return team;
  }

  function cardFaceHTML(card, opts = {}) {
    const { showNumber = false } = opts;
    const team = card.team;
    const num = showNumber && card.dealIndex ? `<span class="card-num">#${card.dealIndex}</span>` : "";
    return `
      <article class="card face team-${team}" data-id="${card.id}">
        <header class="card-top">
          <span class="card-team">${teamLabel(team)}</span>
          ${num}
        </header>
        <h3 class="card-name">${card.name}</h3>
        <p class="card-short">${card.short || ""}</p>
        <p class="card-ability">${card.ability}</p>
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
      ${players % 2 === 1 ? " · Includes Gambler" : ""}
    `;
  }

  function renderPackOptions() {
    els.advanced.innerHTML = PACKS.map((pack) => {
      const req = pack.requires
        ? `<span class="req">needs ${PACKS.find((p) => p.id === pack.requires)?.name || pack.requires}</span>`
        : "";
      const rec = pack.recommended ? `<span class="rec">recommended</span>` : "";
      return `
        <label class="check">
          <input type="checkbox" name="pack" value="${pack.id}" ${pack.recommended ? "checked" : ""} />
          <span>
            <strong>${pack.name}</strong>
            ${rec}${req}
            <em>${pack.blurb}</em>
          </span>
        </label>
      `;
    }).join("");

    els.advanced.addEventListener("change", () => {
      // Auto-check dependency
      const nurse = els.advanced.querySelector('input[value="nurse-tinkerer"]');
      const doc = els.advanced.querySelector('input[value="doctor-engineer"]');
      if (nurse?.checked && doc && !doc.checked) doc.checked = true;
    });
  }

  function renderDeal(deal) {
    const { players, cards, leaders, packIds } = deal;
    const packNames = resolvePacks(packIds).map((p) => p.name);
    const summary = `${players} cards shuffled${
      packNames.length ? ` · ${packNames.join(", ")}` : " · basic roles only"
    }. Print, cut, deal facedown.`;

    els.deckSummary.textContent = summary;
    els.printSummary.textContent = summary;

    els.screenCards.innerHTML = cards.map((c) => cardFaceHTML(c, { showNumber: true })).join("");

    // Print sheet: fronts in pages of 8, then backs, then leaders + chart
    const printCards = [...cards];
    const chunks = [];
    for (let i = 0; i < printCards.length; i += 8) {
      chunks.push(printCards.slice(i, i + 8));
    }

    let html = "";
    chunks.forEach((chunk, pageIdx) => {
      html += `<div class="sheet-page"><h2 class="sheet-label no-print">Character fronts — page ${pageIdx + 1}</h2><div class="card-grid">`;
      chunk.forEach((c) => {
        html += cardFaceHTML(c, { showNumber: true });
      });
      // pad to 8 for consistent cut layout
      for (let i = chunk.length; i < 8; i += 1) {
        html += `<div class="card placeholder" aria-hidden="true"></div>`;
      }
      html += `</div></div>`;
    });

    // Matching backs (same count / layout)
    chunks.forEach((chunk, pageIdx) => {
      html += `<div class="sheet-page backs-page"><h2 class="sheet-label no-print">Character backs — page ${pageIdx + 1} (flip / duplex)</h2><div class="card-grid">`;
      chunk.forEach(() => {
        html += cardBackHTML();
      });
      for (let i = chunk.length; i < 8; i += 1) {
        html += `<div class="card placeholder" aria-hidden="true"></div>`;
      }
      html += `</div></div>`;
    });

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

  function deal(players, packIds) {
    try {
      const cards = buildDeck(players, packIds);
      const leaders = LEADERS.map((l) => ({ ...l }));
      lastDeal = { players, packIds: [...packIds], cards, leaders };
      renderDeal(lastDeal);
      updateHostageInfo(players);
      document.getElementById("deck")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      els.deckSummary.textContent = err.message;
      els.screenCards.innerHTML = "";
      els.printSheet.innerHTML = "";
      alert(err.message);
    }
  }

  function currentPlayers() {
    return Number(els.playerCount.value) || 10;
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    deal(currentPlayers(), selectedPackIds());
  });

  els.reshuffle.addEventListener("click", () => {
    if (lastDeal) {
      deal(lastDeal.players, lastDeal.packIds);
    } else {
      deal(currentPlayers(), selectedPackIds());
    }
  });

  els.printBtn.addEventListener("click", () => {
    if (!lastDeal) deal(currentPlayers(), selectedPackIds());
    window.print();
  });

  els.quickDeal.addEventListener("click", () => {
    els.playerCount.value = "10";
    deal(10, selectedPackIds());
  });

  els.playerCount.addEventListener("input", () => {
    updateHostageInfo(currentPlayers());
  });

  renderPackOptions();
  updateHostageInfo(currentPlayers());
  deal(currentPlayers(), selectedPackIds());
})();
