import { PLAYSETS, PACKS, buildDeck, hostagesFor, getPlayset } from "../shared/game/deck.ts";
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
  buildDeck(5, getPlayset("basic"), []);
  assert(false, "5 should fail");
} catch {
  assert(true, "reject 5");
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

console.log("\nPACKS", PACKS.length, "PLAYSETS", PLAYSETS.length);
console.log(failed ? `${failed} FAILURES` : "ALL PRINT DECK TESTS PASSED");
process.exit(failed ? 1 : 0);
