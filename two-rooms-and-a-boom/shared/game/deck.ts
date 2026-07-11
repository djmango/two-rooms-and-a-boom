import data from "./catalog-data.json";
import type { CardDef, PlaysetDef, Team } from "./types";

const CATALOG = data.CATALOG as Record<string, CardDef>;
export const PLAYSETS = data.PLAYSETS as PlaysetDef[];
export const PACKS = data.PACKS as Array<{
  id: string;
  name: string;
  blurb: string;
  recommended?: boolean;
  requires?: string | null;
  cardIds: string[];
}>;
export const ROUND_LABELS = data.roundLabels as string[];

export function cardFromId(id: string): CardDef {
  const base = id.replace(/-\d+$/, "");
  const c = CATALOG[id] || CATALOG[base];
  if (!c) throw new Error(`Unknown card: ${id}`);
  return { ...c, id };
}

export function getPlayset(id: string): PlaysetDef {
  const ps = PLAYSETS.find((p) => p.id === id);
  if (!ps) throw new Error(`Unknown playset: ${id}`);
  return ps;
}

// Cards the host can toggle on/off in a "Custom mix" deck. The core
// (President, Bomber) is always included and the basic team filler cards
// fill whatever slots are left over, so neither is pickable. Everything
// else -- including the Gambler (g008) -- is pickable in any amount; a
// custom mix has no balance/parity validation.
export const CORE_CARD_IDS = ["b001", "r001"] as const;
export const ODD_CARD_ID = "g008";
export const TEAM_FILLER_IDS = ["b000", "r000"] as const;

export function pickableCards(): CardDef[] {
  return Object.values(CATALOG).filter((c) => {
    if (CORE_CARD_IDS.includes(c.id as (typeof CORE_CARD_IDS)[number])) return false;
    if (TEAM_FILLER_IDS.includes(c.id as (typeof TEAM_FILLER_IDS)[number])) return false;
    return true;
  });
}

export function hostagesFor(players: number): [number, number, number] {
  if (players <= 10) return [1, 1, 1];
  if (players <= 21) return [2, 1, 1];
  return [3, 2, 1];
}

export interface RoundRule {
  minutes: number;
  hostages: number;
}

const DEFAULT_ROUNDS: RoundRule[] = [
  { minutes: 3, hostages: 1 },
  { minutes: 2, hostages: 1 },
  { minutes: 1, hostages: 1 },
];

/**
 * Round schedule used by Luke-lwz/kaboom's generateDefaultRounds().
 * The Classic Kaboom playset is intentionally capped at 17 players.
 */
export function roundsFor(playset: PlaysetDef, players: number): RoundRule[] {
  if (playset.ruleset !== "classic-kaboom") {
    const hostages = hostagesFor(players);
    return DEFAULT_ROUNDS.map((round, index) => ({
      minutes: round.minutes,
      hostages: hostages[index]!,
    }));
  }

  if (players >= 14) {
    return [
      { minutes: 5, hostages: 3 },
      { minutes: 4, hostages: 2 },
      { minutes: 3, hostages: 2 },
      { minutes: 2, hostages: 1 },
      { minutes: 1, hostages: 1 },
    ];
  }
  if (players >= 8) {
    return [
      { minutes: 3, hostages: 2 },
      { minutes: 2, hostages: 1 },
      { minutes: 2, hostages: 1 },
    ];
  }
  return [
    { minutes: 3, hostages: 2 },
    { minutes: 2, hostages: 1 },
    { minutes: 1, hostages: 1 },
  ];
}

export function shuffle<T>(array: T[]): T[] {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0]! % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface BuiltDeck {
  cards: CardDef[];
  buried: CardDef | null;
}

export function buildDeck(
  players: number,
  playset: PlaysetDef,
  packIds: string[] = []
): BuiltDeck {
  if (players < 4 || players > 30) {
    throw new Error("Player count must be between 4 and 30.");
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

  if (playset.id === "custom-mix") {
    return buildCustomMixDeck(deckSize, players, packIds);
  }

  const cards: CardDef[] = [cardFromId("b001"), cardFromId("r001")];

  let specials: CardDef[] = [];
  if (playset.id === "custom") {
    const selected = new Set(packIds);
    for (const pack of PACKS) {
      if (!selected.has(pack.id)) continue;
      if (pack.requires && !selected.has(pack.requires)) continue;
      specials.push(...pack.cardIds.map((id) => cardFromId(id)));
    }
  } else {
    specials = (playset.cardIds || []).map((id) => cardFromId(id));
  }

  let remaining = deckSize - cards.length;
  const blueExtras: CardDef[] = [];
  const redExtras: CardDef[] = [];
  const greyExtras: CardDef[] = [];

  for (const card of specials) {
    if (card.team === "blue") blueExtras.push(card);
    else if (card.team === "red") redExtras.push(card);
    else greyExtras.push(card);
  }

  // Auto-add the odd-card (Gambler) so an odd player count always balances.
  const needOdd = deckSize % 2 === 1;
  if (needOdd) {
    if (playset.oddCard) greyExtras.push(cardFromId(playset.oddCard));
    else if (!greyExtras.length) greyExtras.push(cardFromId("g008"));
  }

  if (greyExtras.length > remaining) {
    throw new Error(`Too many grey / special roles for ${players} players.`);
  }

  remaining -= greyExtras.length;
  cards.push(...greyExtras);

  if (remaining % 2 !== 0) {
    throw new Error("Roles leave an odd number of team slots.");
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
    cards.push({ ...cardFromId("b000"), id: `b000-${i + 1}` });
  }
  for (let i = 0; i < redSlots; i += 1) {
    cards.push({ ...cardFromId("r000"), id: `r000-${i + 1}` });
  }

  if (cards.length !== deckSize) {
    throw new Error(`Deck size ${cards.length} ≠ expected ${deckSize}.`);
  }

  const shuffled = shuffle(cards);
  if (bury) {
    return {
      cards: shuffled.slice(0, players),
      buried: shuffled[shuffled.length - 1]!,
    };
  }
  return { cards: shuffled, buried: null };
}

// Custom mix has no balance/parity rules -- the host can pick any
// combination of roles in any amount. The core (President, Bomber) is
// always included, and whatever slots are left over after the picked
// roles are filled with plain team members (split as evenly as possible).
// The only unavoidable limit is that you can't deal more unique role
// cards than there are players.
function buildCustomMixDeck(
  deckSize: number,
  players: number,
  cardIds: string[]
): BuiltDeck {
  const cards: CardDef[] = [cardFromId("b001"), cardFromId("r001")];

  const seen = new Set<string>();
  const specials: CardDef[] = [];
  for (const id of cardIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (
      CORE_CARD_IDS.includes(id as (typeof CORE_CARD_IDS)[number]) ||
      TEAM_FILLER_IDS.includes(id as (typeof TEAM_FILLER_IDS)[number])
    ) {
      throw new Error(`Card ${id} can't be picked in a custom mix; it's auto-included.`);
    }
    specials.push(cardFromId(id));
  }

  cards.push(...specials);

  const fillerSlots = deckSize - cards.length;
  if (fillerSlots < 0) {
    throw new Error(
      `You've picked ${specials.length} roles, but a ${players}-player game only has room for ${deckSize - 2}. Remove some roles or add more players.`
    );
  }

  const blueFillers = Math.ceil(fillerSlots / 2);
  const redFillers = fillerSlots - blueFillers;
  for (let i = 0; i < blueFillers; i += 1) {
    cards.push({ ...cardFromId("b000"), id: `b000-${i + 1}` });
  }
  for (let i = 0; i < redFillers; i += 1) {
    cards.push({ ...cardFromId("r000"), id: `r000-${i + 1}` });
  }

  return { cards: shuffle(cards), buried: null };
}

export function assignRooms(count: number): Array<"A" | "B"> {
  const indices = shuffle(Array.from({ length: count }, (_, i) => i));
  const aCount = Math.ceil(count / 2);
  const rooms: Array<"A" | "B"> = Array(count).fill("B");
  indices.slice(0, aCount).forEach((i) => {
    rooms[i] = "A";
  });
  return rooms;
}

export function teamLabel(team: Team): string {
  if (team === "blue") return "Blue";
  if (team === "red") return "Red";
  if (team === "grey") return "Grey";
  return "Leader";
}
