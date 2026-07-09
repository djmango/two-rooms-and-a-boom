/**
 * Character catalog for Two Rooms and a Boom print deck.
 * Primary cards are always included. Advanced packs replace plain team cards.
 */
window.TRAB = window.TRAB || {};

window.TRAB.PRIMARY = {
  president: {
    id: "president",
    name: "President",
    team: "blue",
    kind: "primary",
    short: "Blue primary",
    ability:
      "You are the Blue Team primary. Blue wins if you are not in the same room as the Bomber at the end of the game.",
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    team: "red",
    kind: "primary",
    short: "Red primary",
    ability:
      "You are the Red Team primary. Everyone in your room at game end gains the dead condition. Red wins if the President is dead.",
  },
  gambler: {
    id: "gambler",
    name: "Gambler",
    team: "grey",
    kind: "grey",
    short: "Odd-player grey",
    ability:
      "After the last hostage exchange, pause the game and announce which team you think will win. You win if your prediction is correct.",
  },
  blueTeam: {
    id: "blue-team",
    name: "Blue Team",
    team: "blue",
    kind: "basic",
    short: "Blue member",
    ability: "You are on the Blue Team. Help keep the President away from the Bomber.",
  },
  redTeam: {
    id: "red-team",
    name: "Red Team",
    team: "red",
    kind: "basic",
    short: "Red member",
    ability: "You are on the Red Team. Help get the Bomber into the same room as the President.",
  },
};

/**
 * Advanced role packs. Each pack lists cards that replace plain team cards.
 * pair: true means include both (or all) listed cards together.
 * replaces: how many plain team slots this pack consumes (usually cards.length).
 * oddOnly: only offered when player count is odd (besides Gambler).
 */
window.TRAB.PACKS = [
  {
    id: "doctor-engineer",
    name: "Doctor & Engineer",
    blurb: "Extra card-share win conditions for both teams.",
    recommended: true,
    cards: [
      {
        id: "doctor",
        name: "Doctor",
        team: "blue",
        kind: "advanced",
        short: "Card-share power",
        ability:
          "Blue has an extra win condition: the President must card share with the Doctor before the end of the game, or Blue loses.",
      },
      {
        id: "engineer",
        name: "Engineer",
        team: "red",
        kind: "advanced",
        short: "Card-share power",
        ability:
          "Red has an extra win condition: the Bomber must card share with the Engineer before the end of the game, or Red loses.",
      },
    ],
  },
  {
    id: "nurse-tinkerer",
    name: "Nurse & Tinkerer",
    blurb: "Backups if Doctor / Engineer are buried or dead.",
    requires: "doctor-engineer",
    cards: [
      {
        id: "nurse",
        name: "Nurse",
        team: "blue",
        kind: "advanced",
        short: "Doctor backup",
        ability:
          "Backup for the Doctor. If the Doctor is buried or dead, you carry out the Doctor’s card-share responsibility with the President.",
      },
      {
        id: "tinkerer",
        name: "Tinkerer",
        team: "red",
        kind: "advanced",
        short: "Engineer backup",
        ability:
          "Backup for the Engineer. If the Engineer is buried or dead, you carry out the Engineer’s card-share responsibility with the Bomber.",
      },
    ],
  },
  {
    id: "spies",
    name: "Spies",
    blurb: "Your card color is the opposite of your true team.",
    cards: [
      {
        id: "blue-spy",
        name: "Blue Spy",
        team: "blue",
        kind: "advanced",
        short: "Appears red",
        ability:
          "You are on the Blue Team, but your card looks Red. You win with Blue. Best with 11+ players (color sharing).",
      },
      {
        id: "red-spy",
        name: "Red Spy",
        team: "red",
        kind: "advanced",
        short: "Appears blue",
        ability:
          "You are on the Red Team, but your card looks Blue. You win with Red. Best with 11+ players (color sharing).",
      },
    ],
  },
  {
    id: "coy-boys",
    name: "Coy Boys",
    blurb: "Cannot card share or reveal unless forced by Psychologist rules.",
    cards: [
      {
        id: "blue-coy-boy",
        name: "Coy Boy",
        team: "blue",
        kind: "advanced",
        short: "Coy condition",
        ability:
          "You cannot card share, privately reveal, or publicly reveal your card or color (except Psychologist exceptions).",
      },
      {
        id: "red-coy-boy",
        name: "Coy Boy",
        team: "red",
        kind: "advanced",
        short: "Coy condition",
        ability:
          "You cannot card share, privately reveal, or publicly reveal your card or color (except Psychologist exceptions).",
      },
    ],
  },
  {
    id: "negotiators",
    name: "Negotiators",
    blurb: "Only Negotiators may initiate card shares in their room.",
    cards: [
      {
        id: "blue-negotiator",
        name: "Negotiator",
        team: "blue",
        kind: "advanced",
        short: "Share gatekeeper",
        ability:
          "In a room with a Negotiator, only Negotiators may initiate card shares. Works well with Coy Boys.",
      },
      {
        id: "red-negotiator",
        name: "Negotiator",
        team: "red",
        kind: "advanced",
        short: "Share gatekeeper",
        ability:
          "In a room with a Negotiator, only Negotiators may initiate card shares. Works well with Coy Boys.",
      },
    ],
  },
  {
    id: "presidents-daughter-martyr",
    name: "President’s Daughter & Martyr",
    blurb: "Backup President / backup Bomber win paths.",
    cards: [
      {
        id: "presidents-daughter",
        name: "President’s Daughter",
        team: "blue",
        kind: "advanced",
        short: "President backup",
        ability:
          "If the President is buried or dead, you become the target: Red wins if you are in the same room as the Bomber (or Martyr boom).",
      },
      {
        id: "martyr",
        name: "Martyr",
        team: "red",
        kind: "advanced",
        short: "Bomber backup",
        ability:
          "If the Bomber is buried or dead, you can boom: everyone in your room gains the dead condition at game end.",
      },
    ],
  },
  {
    id: "agents",
    name: "Agents",
    blurb: "Once per round, force a card share.",
    cards: [
      {
        id: "blue-agent",
        name: "Agent",
        team: "blue",
        kind: "advanced",
        short: "Force share",
        ability:
          "Once per round, privately reveal to a player and force them to card share with you.",
      },
      {
        id: "red-agent",
        name: "Agent",
        team: "red",
        kind: "advanced",
        short: "Force share",
        ability:
          "Once per round, privately reveal to a player and force them to card share with you.",
      },
    ],
  },
  {
    id: "born-leaders",
    name: "Born Leaders (×2)",
    blurb: "Grey win: be a room leader at game end.",
    greySlots: 2,
    cards: [
      {
        id: "born-leader-1",
        name: "Born Leader",
        team: "grey",
        kind: "grey",
        short: "Grey win",
        ability: "You win if you are a room’s leader at the end of the game.",
      },
      {
        id: "born-leader-2",
        name: "Born Leader",
        team: "grey",
        kind: "grey",
        short: "Grey win",
        ability: "You win if you are a room’s leader at the end of the game.",
      },
    ],
  },
  {
    id: "survivor-victim",
    name: "Survivor & Victim",
    blurb: "Grey win conditions tied to the boom.",
    greySlots: 2,
    cards: [
      {
        id: "survivor",
        name: "Survivor",
        team: "grey",
        kind: "grey",
        short: "Grey win",
        ability: "You win if you do not gain the dead condition at the end of the game.",
      },
      {
        id: "victim",
        name: "Victim",
        team: "grey",
        kind: "grey",
        short: "Grey win",
        ability: "You win if you gain the dead condition at the end of the game.",
      },
    ],
  },
  {
    id: "anarchist-mi6",
    name: "Anarchist & MI6",
    blurb: "Two grey win conditions (usurp leaders / share with both primaries).",
    greySlots: 2,
    cards: [
      {
        id: "anarchist",
        name: "Anarchist",
        team: "grey",
        kind: "grey",
        short: "Grey win",
        ability:
          "You win if your vote helped successfully usurp a leader during a majority of the rounds.",
      },
      {
        id: "mi6",
        name: "MI6",
        team: "grey",
        kind: "grey",
        short: "Grey win",
        ability:
          "You win if you card share with both the President and the Bomber before the end of the game.",
      },
    ],
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
      "Hold this card while you are leader. Choose hostages at round end. Leaders cannot be hostages.",
  },
  {
    id: "leader-b",
    name: "Leader — Room B",
    team: "leader",
    kind: "leader",
    short: "Room B",
    ability:
      "Hold this card while you are leader. Choose hostages at round end. Leaders cannot be hostages.",
  },
];

window.TRAB.hostagesFor = function hostagesFor(players) {
  if (players <= 10) return [1, 1, 1];
  if (players <= 21) return [2, 1, 1];
  return [3, 2, 1];
};

window.TRAB.roundLabels = ["3 min", "2 min", "1 min"];
