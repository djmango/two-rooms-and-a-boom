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
