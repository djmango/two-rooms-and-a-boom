/**
 * Character catalog + playset presets for Two Rooms and a Boom print deck.
 * Playsets are inspired by playkaboom.com / Luke-lwz/kaboom official & tutorial sets,
 * adapted for offline print play (no PeerJS / phone sync).
 */
window.TRAB = window.TRAB || {};

window.TRAB.CATALOG = {
  "b000": {
    id: "b000",
    name: "Blue Team",
    team: "blue",
    kind: "basic",
    short: "Keep the President away from the Bomber",
    ability:
      "You are on the Blue Team. You win if the President does not gain the dead condition.",
  },
  "r000": {
    id: "r000",
    name: "Red Team",
    team: "red",
    kind: "basic",
    short: "Get the Bomber with the President",
    ability:
      "You are on the Red Team. You win if the President gains the dead condition.",
  },
  "b001": {
    id: "b001",
    name: "President",
    team: "blue",
    kind: "primary",
    short: "Avoid the Bomber",
    ability:
      "You are a primary character. Blue Team wins if you do not gain the dead condition at the end of the game.",
  },
  "r001": {
    id: "r001",
    name: "Bomber",
    team: "red",
    kind: "primary",
    short: "Be with the President",
    ability:
      "You are a primary character. Everyone in your room at game end gains the dead condition. Red wins if the President is dead.",
  },
  "g008": {
    id: "g008",
    name: "Gambler",
    team: "grey",
    kind: "grey",
    short: "Guess which team wins",
    ability:
      "After the last hostage exchange, pause and announce which team you think will win (Red, Blue, or neither). You win if correct.",
  },
  "b014": {
    id: "b014",
    name: "Doctor",
    team: "blue",
    kind: "advanced",
    short: "Card share with the President",
    ability:
      "Blue has an extra win condition: the President must card share with the Doctor before the end of the game, or Blue loses.",
  },
  "r014": {
    id: "r014",
    name: "Engineer",
    team: "red",
    kind: "advanced",
    short: "Card share with the Bomber",
    ability:
      "Red has an extra win condition: the Bomber must card share with the Engineer before the end of the game, or Red loses.",
  },
  "b015": {
    id: "b015",
    name: "Tuesday Knight",
    team: "blue",
    kind: "advanced",
    short: "Card share with Bomber → instant win",
    ability:
      "If you card share with the Bomber, the game ends immediately and Blue Team wins.",
  },
  "r015": {
    id: "r015",
    name: "Dr. Boom",
    team: "red",
    kind: "advanced",
    short: "Card share with President → instant win",
    ability:
      "If you card share with the President, the game ends immediately and Red Team wins.",
  },
  "b024": {
    id: "b024",
    name: "Nurse",
    team: "blue",
    kind: "advanced",
    short: "Doctor backup",
    ability:
      "Backup for the Doctor. If the Doctor is buried or dead, you carry out the Doctor’s card-share responsibility with the President.",
  },
  "r024": {
    id: "r024",
    name: "Tinkerer",
    team: "red",
    kind: "advanced",
    short: "Engineer backup",
    ability:
      "Backup for the Engineer. If the Engineer is buried or dead, you carry out the Engineer’s card-share responsibility with the Bomber.",
  },
  "b002": {
    id: "b002",
    name: "Agent",
    team: "blue",
    kind: "advanced",
    short: "Force a card share",
    ability:
      "Once per round, privately reveal to a player and force them to card share with you.",
  },
  "r002": {
    id: "r002",
    name: "Agent",
    team: "red",
    kind: "advanced",
    short: "Force a card share",
    ability:
      "Once per round, privately reveal to a player and force them to card share with you.",
  },
  "b018": {
    id: "b018",
    name: "President’s Daughter",
    team: "blue",
    kind: "advanced",
    short: "Backup President",
    ability:
      "If the President is buried or dead, you become the target: Red wins if you gain the dead condition.",
  },
  "r018": {
    id: "r018",
    name: "Martyr",
    team: "red",
    kind: "advanced",
    short: "Backup Bomber",
    ability:
      "If the Bomber is buried or dead, you boom instead: everyone in your room gains the dead condition at game end.",
  },
  "b009": {
    id: "b009",
    name: "Coy Boy",
    team: "blue",
    kind: "advanced",
    short: "Coy — limited sharing",
    ability:
      "You cannot card share, privately reveal, or publicly reveal (except Psychologist exceptions). Color share only when allowed by rules.",
  },
  "r009": {
    id: "r009",
    name: "Coy Boy",
    team: "red",
    kind: "advanced",
    short: "Coy — limited sharing",
    ability:
      "You cannot card share, privately reveal, or publicly reveal (except Psychologist exceptions). Color share only when allowed by rules.",
  },
  "b023": {
    id: "b023",
    name: "Negotiator",
    team: "blue",
    kind: "advanced",
    short: "Savvy share gatekeeper",
    ability:
      "You can initiate card shares. In rooms with Negotiators, sharing rules follow the Negotiator / savvy conditions.",
  },
  "r023": {
    id: "r023",
    name: "Negotiator",
    team: "red",
    kind: "advanced",
    short: "Savvy share gatekeeper",
    ability:
      "You can initiate card shares. In rooms with Negotiators, sharing rules follow the Negotiator / savvy conditions.",
  },
  "b004": {
    id: "b004",
    name: "Angel",
    team: "blue",
    kind: "advanced",
    short: "Honest condition",
    ability: "You begin with the honest condition — you must always verbally tell the truth.",
  },
  "r004": {
    id: "r004",
    name: "Angel",
    team: "red",
    kind: "advanced",
    short: "Honest condition",
    ability: "You begin with the honest condition — you must always verbally tell the truth.",
  },
  "b013": {
    id: "b013",
    name: "Liar",
    team: "blue",
    kind: "advanced",
    short: "Must lie",
    ability: "You begin with the liar condition — you must always verbally lie.",
  },
  "r013": {
    id: "r013",
    name: "Liar",
    team: "red",
    kind: "advanced",
    short: "Must lie",
    ability: "You begin with the liar condition — you must always verbally lie.",
  },
  "b007": {
    id: "b007",
    name: "Clown",
    team: "blue",
    kind: "advanced",
    short: "Always smile",
    ability: "You must smile for the entire game. No frowning.",
  },
  "r007": {
    id: "r007",
    name: "Clown",
    team: "red",
    kind: "advanced",
    short: "Always smile",
    ability: "You must smile for the entire game. No frowning.",
  },
  "b021": {
    id: "b021",
    name: "Mime",
    team: "blue",
    kind: "advanced",
    short: "Never speak",
    ability: "You may not speak for the entire game. Gestures only.",
  },
  "r021": {
    id: "r021",
    name: "Mime",
    team: "red",
    kind: "advanced",
    short: "Never speak",
    ability: "You may not speak for the entire game. Gestures only.",
  },
  "b025": {
    id: "b025",
    name: "Paparazzo",
    team: "blue",
    kind: "advanced",
    short: "Ignore privacy",
    ability: "You ignore the Privacy Promise variant — you may look at private shares when able.",
  },
  "r025": {
    id: "r025",
    name: "Paparazzo",
    team: "red",
    kind: "advanced",
    short: "Ignore privacy",
    ability: "You ignore the Privacy Promise variant — you may look at private shares when able.",
  },
  "b030": {
    id: "b030",
    name: "Red Spy",
    team: "red",
    kind: "advanced",
    short: "Looks blue — wins with Red",
    ability:
      "You are on the Red Team, but your card is blue (looks Blue). Best with 11+ players (color sharing).",
  },
  "r030": {
    id: "r030",
    name: "Blue Spy",
    team: "blue",
    kind: "advanced",
    short: "Looks red — wins with Blue",
    ability:
      "You are on the Blue Team, but your card is red (looks Red). Best with 11+ players (color sharing).",
  },
  "g001": {
    id: "g001",
    name: "Agoraphobe",
    team: "grey",
    kind: "grey",
    short: "Never leave your room",
    ability: "You win if you never leave your starting room.",
  },
  "g002": {
    id: "g002",
    name: "Ahab",
    team: "grey",
    kind: "grey",
    short: "Moby dies, you don’t",
    ability: "You win if Moby gains the dead condition and you do not. Play with Moby.",
  },
  "g017": {
    id: "g017",
    name: "Moby",
    team: "grey",
    kind: "grey",
    short: "Avoid Bomber and Ahab",
    ability: "You win if you avoid the Bomber and Ahab as described on your card. Play with Ahab.",
  },
  "g007": {
    id: "g007",
    name: "Decoy",
    team: "grey",
    kind: "grey",
    short: "Get shot by the Sniper",
    ability: "You win if the Sniper shoots you. Play with Sniper / Target.",
  },
  "g009": {
    id: "g009",
    name: "Hot Potato",
    team: "grey",
    kind: "grey",
    short: "Sharing swaps cards",
    ability:
      "You lose by default, but when someone card shares with you, you swap cards with them.",
  },
  "g010": {
    id: "g010",
    name: "Intern",
    team: "grey",
    kind: "grey",
    short: "Be with the President",
    ability: "You win if you are in the same room as the President at the end of the game.",
  },
  "g014": {
    id: "g014",
    name: "MI6",
    team: "grey",
    kind: "grey",
    short: "Share with President and Bomber",
    ability:
      "You win if you card share with both the President and the Bomber before the end of the game.",
  },
  "g019": {
    id: "g019",
    name: "Private Eye",
    team: "grey",
    kind: "grey",
    short: "Guess the buried card",
    ability:
      "When playing with a buried card, guess what was buried. You win if correct.",
  },
  "g021": {
    id: "g021",
    name: "Rival",
    team: "grey",
    kind: "grey",
    short: "Avoid the President",
    ability: "You win if you are not in the same room as the President at the end of the game.",
  },
  "g024": {
    id: "g024",
    name: "Sniper",
    team: "grey",
    kind: "grey",
    short: "Shoot the Target",
    ability: "At game end, shoot a player. You win if you shoot the Target. Play with Target / Decoy.",
  },
  "g026": {
    id: "g026",
    name: "Target",
    team: "grey",
    kind: "grey",
    short: "Don’t get shot",
    ability: "You win if the Sniper does not shoot you. Play with Sniper / Decoy.",
  },
  "g028": {
    id: "g028",
    name: "Survivor",
    team: "grey",
    kind: "grey",
    short: "Don’t die",
    ability: "You win if you do not gain the dead condition at the end of the game.",
  },
  "g025": {
    id: "g025",
    name: "Victim",
    team: "grey",
    kind: "grey",
    short: "Die in the boom",
    ability: "You win if you gain the dead condition at the end of the game.",
  },
  "g029": {
    id: "g029",
    name: "Wife",
    team: "grey",
    kind: "grey",
    short: "Love & hate set",
    ability: "Grey win tied to Ahab / Moby / Mistress setups. Check the character guide for the full objective.",
  },
  "g016": {
    id: "g016",
    name: "Mistress",
    team: "grey",
    kind: "grey",
    short: "Love & hate set",
    ability: "Grey win tied to Ahab / Moby / Wife setups. Check the character guide for the full objective.",
  },
};

/** Role packs for custom mode (replace plain team cards). */
window.TRAB.PACKS = [
  {
    id: "doctor-engineer",
    name: "Doctor & Engineer",
    blurb: "Extra card-share win conditions.",
    recommended: true,
    cardIds: ["b014", "r014"],
  },
  {
    id: "nurse-tinkerer",
    name: "Nurse & Tinkerer",
    blurb: "Backups for Doctor / Engineer.",
    requires: "doctor-engineer",
    cardIds: ["b024", "r024"],
  },
  {
    id: "daughter-martyr",
    name: "President’s Daughter & Martyr",
    blurb: "Backup President / Bomber.",
    cardIds: ["b018", "r018"],
  },
  {
    id: "coy-boys",
    name: "Coy Boys",
    blurb: "Limited revealing / sharing.",
    cardIds: ["b009", "r009"],
  },
  {
    id: "negotiators",
    name: "Negotiators",
    blurb: "Savvy share gatekeepers.",
    cardIds: ["b023", "r023"],
  },
  {
    id: "agents",
    name: "Agents",
    blurb: "Force a card share once per round.",
    cardIds: ["b002", "r002"],
  },
  {
    id: "spies",
    name: "Spies",
    blurb: "Card color is the opposite of your true team.",
    cardIds: ["b030", "r030"],
  },
  {
    id: "acting",
    name: "Clown & Mime",
    blurb: "Acting conditions (smile / silence).",
    cardIds: ["b007", "r007", "b021", "r021"],
  },
  {
    id: "survivor-victim",
    name: "Survivor & Victim",
    blurb: "Grey boom win conditions.",
    cardIds: ["g028", "g025"],
  },
  {
    id: "mi6-agoraphobe",
    name: "MI6 & Agoraphobe",
    blurb: "Two classic grey objectives.",
    cardIds: ["g014", "g001"],
  },
];

/**
 * Presets inspired by playkaboom tutorial/official playsets.
 * `cardIds` are specials (excluding President/Bomber fillers).
 * Primaries are always b001/r001 unless overridden.
 */
window.TRAB.PLAYSETS = [
  {
    id: "basic",
    name: "My first game",
    emoji: "🎓",
    blurb: "President, Bomber, team cards only. Best for teaching.",
    players: [6, 30],
    cardIds: [],
    oddCard: "g008",
  },
  {
    id: "doctor-engineer",
    name: "First color share",
    emoji: "🩺",
    blurb: "Doctor & Engineer — classic first advanced game.",
    players: [6, 30],
    cardIds: ["b014", "r014"],
    oddCard: "g008",
  },
  {
    id: "instant-death",
    name: "Instant Death",
    emoji: "☠️",
    blurb: "Doctor, Engineer, Tuesday Knight, Dr. Boom — games can end early.",
    players: [6, 30],
    cardIds: ["b014", "r014", "b015", "r015"],
    oddCard: "g008",
  },
  {
    id: "mystery-6",
    name: "6 Player Mystery",
    emoji: "🕵️",
    blurb: "Daughter, Martyr, Private Eye — bury one card.",
    players: [6, 6],
    cardIds: ["b018", "r018", "g019"],
    oddCard: null,
    bury: true,
    fixedPlayers: 6,
  },
  {
    id: "love-hate",
    name: "Love & Hate",
    emoji: "💔",
    blurb: "Ahab, Moby, Wife, Mistress greys.",
    players: [6, 6],
    cardIds: ["g002", "g017", "g029", "g016"],
    oddCard: null,
    fixedPlayers: 6,
  },
  {
    id: "gunshot",
    name: "2 Rooms + Gunshot",
    emoji: "🔫",
    blurb: "Sniper, Target, Decoy, Hot Potato.",
    players: [6, 20],
    cardIds: ["g024", "g026", "g007", "g009"],
    oddCard: "g008",
  },
  {
    id: "speak-no-evil",
    name: "Speak no evil",
    emoji: "🤐",
    blurb: "Angels, Liars, Mimes, Coy Boys.",
    players: [10, 24],
    cardIds: ["b004", "r004", "b013", "r013", "b021", "r021", "b009", "r009"],
    oddCard: "g014",
  },
  {
    id: "acting",
    name: "Acting Auditions",
    emoji: "🎭",
    blurb: "Angels, Clowns, Mimes, Paparazzi.",
    players: [10, 25],
    cardIds: ["b004", "r004", "b007", "r007", "b021", "r021", "b025", "r025"],
    oddCard: "g014",
  },
  {
    id: "custom",
    name: "Custom packs",
    emoji: "🧩",
    blurb: "Pick advanced packs yourself below.",
    players: [6, 30],
    cardIds: null,
    oddCard: "g008",
  },
];

window.TRAB.LEADERS = [
  {
    id: "leader-a",
    name: "Leader — Room A",
    team: "leader",
    kind: "leader",
    short: "Room A",
    ability:
      "Hold this while you are leader. Choose hostages at round end. Leaders cannot be hostages.",
  },
  {
    id: "leader-b",
    name: "Leader — Room B",
    team: "leader",
    kind: "leader",
    short: "Room B",
    ability:
      "Hold this while you are leader. Choose hostages at round end. Leaders cannot be hostages.",
  },
];

window.TRAB.cardFromId = function cardFromId(id) {
  const c = window.TRAB.CATALOG[id];
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return { ...c };
};

/** Official-style 3-round hostage chart (rulebook). */
window.TRAB.hostagesFor = function hostagesFor(players) {
  if (players <= 10) return [1, 1, 1];
  if (players <= 21) return [2, 1, 1];
  return [3, 2, 1];
};

window.TRAB.roundLabels = ["3 min", "2 min", "1 min"];

/** Expand PACKS.cardIds into full card objects for UI. */
window.TRAB.PACKS.forEach((pack) => {
  pack.cards = pack.cardIds.map((id) => window.TRAB.cardFromId(id));
});

window.TRAB.PRIMARY = {
  president: window.TRAB.cardFromId("b001"),
  bomber: window.TRAB.cardFromId("r001"),
  gambler: window.TRAB.cardFromId("g008"),
  blueTeam: window.TRAB.cardFromId("b000"),
  redTeam: window.TRAB.cardFromId("r000"),
};
