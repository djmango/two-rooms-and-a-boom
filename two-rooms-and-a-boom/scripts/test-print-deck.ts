import {
  PLAYSETS,
  PACKS,
  buildDeck,
  hostagesFor,
  getPlayset,
  roundsFor,
} from "../shared/game/deck.ts";
import { generateCode, isValidCode, normalizeCode } from "../shared/game/codes.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    failed += 1;
  } else {
    console.log("OK", msg);
  }
}

console.log("=== PRINT / RANDOMIZER ===");

for (let i = 0; i < 15; i++) {
  const c = generateCode();
  assert(isValidCode(c), `code ${c}`);
  assert(normalizeCode(` ${c.replace(/-/g, "  ")} `) === c, `normalize ${c}`);
}
assert(!isValidCode("not-a-realwordzzz-code"), "rejects invalid words");
assert(normalizeCode("Coral_Lantern_Swift") === "coral-lantern-swift", "normalize case/underscore");

for (const ps of PLAYSETS) {
  if (ps.id === "custom") {
    for (const n of [6, 7, 10, 11, 16, 21]) {
      try {
        const { cards, buried } = buildDeck(n, ps, ["doctor-engineer"]);
        assert(cards.length === n && !buried, `custom ${n} size`);
        assert(
          cards.some((c) => c.id === "b001" || c.name === "President"),
          `custom ${n} president`
        );
        assert(
          cards.some((c) => c.id === "r001" || c.name === "Bomber"),
          `custom ${n} bomber`
        );
        assert(cards.some((c) => c.name === "Doctor"), `custom ${n} doctor`);
        assert(cards.some((c) => c.name === "Engineer"), `custom ${n} engineer`);
        if (n % 2 === 1) assert(cards.some((c) => c.team === "grey"), `custom ${n} grey`);
      } catch (e) {
        assert(false, `custom ${n}: ${(e as Error).message}`);
      }
    }
    try {
      buildDeck(6, ps, [
        "doctor-engineer",
        "daughter-martyr",
        "coy-boys",
        "negotiators",
        "agents",
        "spies",
        "acting",
      ]);
      assert(false, "custom overload should fail");
    } catch {
      assert(true, "custom overload rejected");
    }
    continue;
  }

  const tests = ps.fixedPlayers
    ? [ps.fixedPlayers]
    : [
        ...new Set([
          ps.players[0],
          Math.min(ps.players[1], ps.players[0] + 3),
          Math.min(ps.players[1], 18),
        ]),
      ];

  for (const n of tests) {
    try {
      const { cards, buried } = buildDeck(n, ps, []);
      assert(cards.length === n, `${ps.id} ${n} size=${cards.length}`);
      if (ps.bury) assert(!!buried, `${ps.id} ${n} buried`);
      else assert(!buried, `${ps.id} ${n} no bury`);
      // With bury, President/Bomber may be buried (Daughter/Martyr cover that in mystery).
      const all = buried ? [...cards, buried] : cards;
      assert(all.some((c) => c.name === "President"), `${ps.id} ${n} President in deck`);
      assert(all.some((c) => c.name === "Bomber"), `${ps.id} ${n} Bomber in deck`);
      if (!ps.bury) {
        assert(cards.some((c) => c.name === "President"), `${ps.id} ${n} President dealt`);
        assert(cards.some((c) => c.name === "Bomber"), `${ps.id} ${n} Bomber dealt`);
      }
      const [a, b, c] = hostagesFor(n);
      assert(a >= 1 && c >= 1, `${ps.id} ${n} hostages ${a},${b},${c}`);
      console.log("  roles", ps.id, n, cards.map((x) => x.name).sort().join(", "));
    } catch (e) {
      assert(false, `${ps.id} ${n}: ${(e as Error).message}`);
    }
  }
}

try {
  buildDeck(3, getPlayset("basic"), []);
  assert(false, "3 should fail");
} catch {
  assert(true, "reject 3");
}
try {
  buildDeck(31, getPlayset("basic"), []);
  assert(false, "31 should fail");
} catch {
  assert(true, "reject 31");
}
try {
  buildDeck(8, getPlayset("mystery-6"), []);
  assert(false, "mystery 8 fail");
} catch {
  assert(true, "mystery fixed 6");
}

const orders = new Set<string>();
for (let i = 0; i < 12; i++) {
  orders.add(buildDeck(10, getPlayset("basic"), []).cards.map((c) => `${c.name}`).join("|"));
}
assert(orders.size > 1, `shuffle varies (unique orders=${orders.size}/12)`);

try {
  const { cards, buried } = buildDeck(4, getPlayset("basic"), []);
  assert(cards.length === 4 && !buried, "basic 4 size=4");
  assert(cards.some((c) => c.name === "President"), "basic 4 President");
  assert(cards.some((c) => c.name === "Bomber"), "basic 4 Bomber");
  console.log("  roles basic 4", cards.map((x) => x.name).sort().join(", "));
} catch (e) {
  assert(false, `basic 4: ${(e as Error).message}`);
}

const classic = getPlayset("classic-kaboom");
assert(classic.players[0] === 4 && classic.players[1] === 17, "classic kaboom supports 4-17");
assert(
  JSON.stringify(roundsFor(classic, 6)) ===
    JSON.stringify([
      { minutes: 3, hostages: 2 },
      { minutes: 2, hostages: 1 },
      { minutes: 1, hostages: 1 },
    ]),
  "classic kaboom 6-player rounds"
);
assert(
  JSON.stringify(roundsFor(classic, 9)) ===
    JSON.stringify([
      { minutes: 3, hostages: 2 },
      { minutes: 2, hostages: 1 },
      { minutes: 2, hostages: 1 },
    ]),
  "classic kaboom 9-player rounds"
);
assert(
  JSON.stringify(roundsFor(classic, 17)) ===
    JSON.stringify([
      { minutes: 5, hostages: 3 },
      { minutes: 4, hostages: 2 },
      { minutes: 3, hostages: 2 },
      { minutes: 2, hostages: 1 },
      { minutes: 1, hostages: 1 },
    ]),
  "classic kaboom 17-player rounds"
);

// Custom mix: the host picks individual card IDs and those cards (plus the
// auto core/filler) are what gets dealt.
{
  const mix = getPlayset("custom-mix");
  const picked = ["r004", "g028", "b030", "r030"]; // Angel, Survivor, Red Spy, Blue Spy (all have PnP art, none excluded)
  try {
    const { cards } = buildDeck(10, mix, picked);
    assert(cards.length === 10, `custom-mix 10 size=${cards.length}`);
    assert(cards.some((c) => c.name === "President"), "custom-mix always has President");
    assert(cards.some((c) => c.name === "Bomber"), "custom-mix always has Bomber");
    assert(cards.some((c) => c.name === "Angel"), "custom-mix has picked Angel");
    assert(cards.some((c) => c.name === "Survivor"), "custom-mix has picked Survivor");
    assert(cards.some((c) => c.name === "Red Spy"), "custom-mix has picked Red Spy");
    assert(cards.some((c) => c.name === "Blue Spy"), "custom-mix has picked Blue Spy");
    // No unpicked advanced/grey roles leaked in.
    const names = cards.map((c) => c.name);
    assert(!names.includes("Agent"), "custom-mix doesn't include unpicked Agent");
    assert(!names.includes("Gambler"), "custom-mix 10 (even) has no auto Gambler");
    console.log("  roles custom-mix 10", names.sort().join(", "));
  } catch (e) {
    assert(false, `custom-mix 10: ${(e as Error).message}`);
  }

  // Custom mix has no balance/parity validation: an empty pick with an odd
  // player count should just work, filling the rest with plain team members.
  try {
    const { cards } = buildDeck(7, mix, []);
    assert(cards.length === 7, `custom-mix empty 7 size=${cards.length}`);
    assert(!cards.some((c) => c.name === "Gambler"), "custom-mix empty 7 has no auto Gambler");
  } catch (e) {
    assert(false, `custom-mix empty 7: ${(e as Error).message}`);
  }

  // Picking way more roles than there are players is the one unavoidable
  // limit (you can't deal more unique cards than players).
  try {
    buildDeck(4, mix, ["r004", "g028", "b030", "r030", "g008"]);
    assert(false, "custom-mix overload (5 specials in a 4p game) should be rejected");
  } catch {
    assert(true, "custom-mix overload rejected");
  }

  // Plain team members (b000/r000) can be added in any count. The host
  // picks them explicitly and the builder pads any remaining slots.
  try {
    const { cards } = buildDeck(6, mix, ["b000", "b000", "r000"]);
    const blues = cards.filter((c) => c.name === "Blue Team").length;
    const reds = cards.filter((c) => c.name === "Red Team").length;
    assert(cards.length === 6, `custom-mix team members 6 size=${cards.length}`);
    assert(blues === 3 && reds === 1, `custom-mix team member counts blue=${blues} red=${reds} (2 explicit blue + 1 explicit red + 1 auto blue)`);
    assert(cards.some((c) => c.name === "President") && cards.some((c) => c.name === "Bomber"), "custom-mix team member deck still has core");
  } catch (e) {
    assert(false, `custom-mix team members: ${(e as Error).message}`);
  }

  // Duplicate specials are collapsed (one Angel, not two); plain team
  // members are not collapsed.
  try {
    const { cards } = buildDeck(6, mix, ["r004", "r004", "b000"]);
    const angels = cards.filter((c) => c.name === "Angel").length;
    assert(angels === 1, `custom-mix dedupes specials (Angel x${angels})`);
  } catch (e) {
    assert(false, `custom-mix dedup: ${(e as Error).message}`);
  }

  // Too many plain team members overflows the same way specials do.
  try {
    buildDeck(4, mix, ["b000", "b000", "b000", "r000", "r000", "r000"]);
    assert(false, "custom-mix too many team members should be rejected");
  } catch {
    assert(true, "custom-mix rejects too many team members");
  }

  // Picking a core card, a role with no PnP art, or a role held out of
  // custom mixes (Engineer, Private Eye, Tinkerer, Paparazzo) must be
  // rejected. Plain team members (b000/r000) are allowed. The Gambler
  // (g008) is pickable, so picking it succeeds.
  for (const bad of ["b001", "r001", "g024", "r014", "g019", "r024", "r025"]) {
    try {
      buildDeck(10, mix, [bad]);
      assert(false, `custom-mix should reject picking ${bad}`);
    } catch {
      assert(true, `custom-mix rejects picking ${bad}`);
    }
  }
  try {
    const { cards } = buildDeck(7, mix, ["g008"]);
    assert(cards.some((c) => c.name === "Gambler"), "custom-mix lets the host pick the Gambler");
  } catch (e) {
    assert(false, `custom-mix picking Gambler: ${(e as Error).message}`);
  }
}

console.log("\nPACKS", PACKS.length, "PLAYSETS", PLAYSETS.length);
console.log(failed ? `${failed} FAILURES` : "ALL PRINT DECK TESTS PASSED");
process.exit(failed ? 1 : 0);
