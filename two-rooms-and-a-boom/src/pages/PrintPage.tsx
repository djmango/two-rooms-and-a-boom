import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PLAYSETS,
  PACKS,
  buildDeck,
  roundsFor,
  shuffle,
} from "@shared/game/deck";
import type { CardDef, PlaysetDef } from "@shared/game/types";
import "@/styles/print.css";

const LEADERS: CardDef[] = [
  {
    id: "leader-a",
    name: "Leader, Room A",
    team: "leader",
    kind: "leader",
    short: "Room A",
    ability:
      "Hold this while you are leader. Choose hostages at round end. Leaders cannot be hostages.",
  },
  {
    id: "leader-b",
    name: "Leader, Room B",
    team: "leader",
    kind: "leader",
    short: "Room B",
    ability:
      "Hold this while you are leader. Choose hostages at round end. Leaders cannot be hostages.",
  },
];

export default function PrintPage() {
  const [playsetId, setPlaysetId] = useState("basic");
  const [players, setPlayers] = useState(10);
  const [packIds, setPackIds] = useState<string[]>(["doctor-engineer"]);
  const [names, setNames] = useState<string[]>([]);
  const [spoilerSafe, setSpoilerSafe] = useState(true);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [seed, setSeed] = useState(0);

  const playset = PLAYSETS.find((p) => p.id === playsetId) || PLAYSETS[0]!;

  const dealResult = useMemo(() => {
    try {
      const count = playset.fixedPlayers ?? players;
      const { cards, buried } = buildDeck(
        count,
        playset,
        playsetId === "custom" ? packIds : []
      );
      const roomOrder = shuffle(
        Array.from({ length: count }, (_, i) => (i < Math.ceil(count / 2) ? "A" : "B") as "A" | "B")
      );
      return {
        ok: true as const,
        deal: {
          cards,
          buried,
          assignments: cards.map((card, i) => ({
            card,
            name: names[i]?.trim() || `Player ${i + 1}`,
            room: roomOrder[i]!,
          })),
          players: count,
        },
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Deal failed",
      };
    }
  }, [playsetId, players, packIds, seed, playset, names]);

  const deal = dealResult.ok ? dealResult.deal : null;
  const dealError = dealResult.ok ? "" : dealResult.error;
  const rounds = roundsFor(playset, deal?.players ?? players);

  function updateNameCount(n: number) {
    setNames((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  }

  function selectPlayset(ps: PlaysetDef) {
    setPlaysetId(ps.id);
    if (ps.fixedPlayers) {
      setPlayers(ps.fixedPlayers);
      updateNameCount(ps.fixedPlayers);
    } else {
      const n = Math.min(Math.max(players, ps.players[0]), ps.players[1]);
      setPlayers(n);
      updateNameCount(n);
    }
  }

  return (
    <div className="print-app">
      <section className="panel setup no-print" id="setup">
        <div className="panel-head">
          <h2>Print deck</h2>
          <p>
            Offline shuffle for physical play. Prefer phones?{" "}
            <Link to="/">Create a live room</Link>.
          </p>
        </div>

        <div className="setup-grid">
          <fieldset className="field pack">
            <legend>Playset</legend>
            <div className="playsets">
              {PLAYSETS.map((ps) => (
                <label
                  key={ps.id}
                  className={`playset-card ${ps.id === playsetId ? "is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="playset"
                    checked={ps.id === playsetId}
                    onChange={() => selectPlayset(ps)}
                  />
                  <span className="playset-mark" aria-hidden="true">
                    {ps.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="playset-body">
                    <strong>{ps.name}</strong>
                    <em>{ps.blurb}</em>
                    <span className="playset-range">
                      {ps.fixedPlayers
                        ? `${ps.fixedPlayers}p`
                        : `${ps.players[0]}–${ps.players[1]}p`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Players</span>
            <input
              type="number"
              min={6}
              max={30}
              value={players}
              readOnly={Boolean(playset.fixedPlayers)}
              onChange={(e) => {
                const n = Number(e.target.value) || 10;
                setPlayers(n);
                updateNameCount(n);
              }}
            />
          </label>

          {playsetId === "custom" && (
            <fieldset className="field pack">
              <legend>Custom packs</legend>
              <div className="checks">
                {PACKS.map((pack) => (
                  <label key={pack.id} className="check">
                    <input
                      type="checkbox"
                      checked={packIds.includes(pack.id)}
                      onChange={(e) => {
                        setPackIds((ids) => {
                          if (e.target.checked) {
                            const next = [...ids, pack.id];
                            if (pack.requires && !next.includes(pack.requires)) {
                              next.push(pack.requires);
                            }
                            return next;
                          }
                          return ids.filter((id) => id !== pack.id);
                        });
                      }}
                    />
                    <span>
                      <strong>{pack.name}</strong>
                      <em>{pack.blurb}</em>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="check deal-mode-check">
            <input
              type="checkbox"
              checked={spoilerSafe}
              onChange={(e) => {
                setSpoilerSafe(e.target.checked);
                if (e.target.checked) setRevealed({});
              }}
            />
            <span>
              <strong>Spoiler-safe deal</strong>
              <em>Hide roles until you click a slip. Print still includes full cards.</em>
            </span>
          </label>

          <div className="setup-actions">
            <button type="button" className="btn primary" onClick={() => setSeed((s) => s + 1)}>
              Shuffle &amp; deal
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setSpoilerSafe(false);
                setRevealed({});
              }}
            >
              Reveal all
            </button>
            <button type="button" className="btn ghost" onClick={() => window.print()}>
              Print cards
            </button>
          </div>
        </div>

        <aside className="rules-chip">
          <strong>{deal?.players ?? players} players</strong> · Rounds:{" "}
          {rounds.map((round) => `${round.minutes} min / ${round.hostages}`).join(", ")}
          {dealError && (
            <>
              {" "}
              · <span className="rules-chip-error">{dealError}</span>
            </>
          )}
        </aside>
      </section>

      {deal && (
        <section className="panel deck-panel" id="deck">
          <div className="panel-head no-print">
            <h2>Your deal</h2>
            <p>
              {deal.players} players · {playset.name}
              {deal.buried ? " · 1 card buried" : ""}
            </p>
          </div>

          <div className="room-split no-print">
            {(["A", "B"] as const).map((room) => (
              <div key={room} className={`room-col room-col-${room.toLowerCase()}`}>
                <h3>
                  Room {room}{" "}
                  <small>
                    {deal.assignments.filter((a) => a.room === room).length}
                  </small>
                </h3>
                <ul>
                  {deal.assignments
                    .filter((a) => a.room === room)
                    .map((a) => (
                      <li key={a.name + a.card.id}>{a.name}</li>
                    ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="screen-cards no-print">
            {deal.assignments.map((row, idx) => {
              const hide = spoilerSafe && !revealed[idx];
              return (
                <article
                  key={idx}
                  className={`card face ${hide ? "team-hidden deal-slip" : `team-${row.card.team}`}`}
                  onClick={() => hide && setRevealed((r) => ({ ...r, [idx]: true }))}
                  style={hide ? { cursor: "pointer" } : undefined}
                >
                  <header className="card-top">
                    <span className="card-team">{hide ? "Facedown" : row.card.team}</span>
                    <span className="card-num">
                      {row.name} · Room {row.room}
                    </span>
                  </header>
                  <h3 className="card-name">{hide ? "???" : row.card.name}</h3>
                  <p className="card-short">{hide ? "Tap reveal" : row.card.short}</p>
                  <p className="card-ability">{hide ? "Keep this secret." : row.card.ability}</p>
                </article>
              );
            })}
          </div>

          <div className="print-sheet" id="print-sheet">
            <PrintSheets deal={deal} leaders={LEADERS} playset={playset} />
          </div>
        </section>
      )}
    </div>
  );
}

function PrintSheets({
  deal,
  leaders,
  playset,
}: {
  deal: {
    cards: CardDef[];
    buried: CardDef | null;
    assignments: Array<{ card: CardDef; name: string; room: "A" | "B" }>;
    players: number;
  };
  leaders: CardDef[];
  playset: PlaysetDef;
}) {
  const printCards = [...deal.cards];
  if (deal.buried) {
    printCards.push({ ...deal.buried, name: `${deal.buried.name} (BURIED)` });
  }
  const chunks: CardDef[][] = [];
  for (let i = 0; i < printCards.length; i += 8) chunks.push(printCards.slice(i, i + 8));

  const rounds = roundsFor(playset, deal.players);

  return (
    <>
      <div className="print-intro print-only">
        <h1>Two Rooms and a Boom</h1>
        <p>
          {deal.players} cards · print, cut, deal facedown
        </p>
      </div>
      {chunks.map((chunk, pageIdx) => (
        <div className="sheet-page" key={`f-${pageIdx}`}>
          <div className="card-grid">
            {chunk.map((c, i) => (
              <PrintCard key={i} card={c} />
            ))}
            {Array.from({ length: 8 - chunk.length }).map((_, i) => (
              <div key={`p-${i}`} className="card placeholder" />
            ))}
          </div>
        </div>
      ))}
      {chunks.map((chunk, pageIdx) => (
        <div className="sheet-page" key={`b-${pageIdx}`}>
          <div className="card-grid">
            {chunk.map((_, i) => (
              <div key={i} className="card back">
                <div className="back-inner">
                  <span className="back-brand">Two Rooms</span>
                  <span className="back-boom">BOOM</span>
                  <span className="back-sub">and a</span>
                </div>
              </div>
            ))}
            {Array.from({ length: 8 - chunk.length }).map((_, i) => (
              <div key={`pb-${i}`} className="card placeholder" />
            ))}
          </div>
        </div>
      ))}
      <div className="sheet-page">
        <div className="card-grid">
          {deal.assignments.slice(0, 8).map((row, i) => (
            <PrintCard
              key={i}
              card={{ ...row.card, short: `${row.name} · Room ${row.room}` }}
            />
          ))}
        </div>
      </div>
      <div className="sheet-page">
        <div className="card-grid">
          {leaders.map((l) => (
            <PrintCard key={l.id} card={l} />
          ))}
          <article className="card face team-leader">
            <header className="card-top">
              <span className="card-team">Reference</span>
            </header>
            <h3 className="card-name">Hostage Chart</h3>
            <p className="card-short">{deal.players} players</p>
            <ul className="hostage-list">
              {rounds.map((round, index) => (
                <li key={`${round.minutes}-${index}`}>
                  <strong>{round.minutes} min</strong>: {round.hostages}
                </li>
              ))}
            </ul>
            <p className="card-ability">Leaders cannot be hostages.</p>
          </article>
        </div>
      </div>
    </>
  );
}

function PrintCard({ card }: { card: CardDef }) {
  return (
    <article className={`card face team-${card.team}`}>
      <header className="card-top">
        <span className="card-team">{card.team}</span>
      </header>
      <h3 className="card-name">{card.name}</h3>
      <p className="card-short">{card.short}</p>
      <p className="card-ability">{card.ability}</p>
      <footer className="card-foot">Two Rooms and a Boom</footer>
    </article>
  );
}
