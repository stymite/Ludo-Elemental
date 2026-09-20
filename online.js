// The rules of an online match, kept free of any React Native or Supabase
// import so they can be exercised straight from Node (see online-demo.js). Who
// sits where, which colour they get, and whether an incoming action is allowed
// are not things to find out about on a phone halfway through a game.

// Board order. Index matters: seats 0 and 2 face each other, as do 1 and 3.
const BOARD_ORDER = ['GREEN', 'YELLOW', 'BLUE', 'RED'];

// The two pairs of colours sitting opposite each other. A duel uses one pair so
// both players travel the same distance; 2v2 makes each pair a side, so
// partners face each other across the board rather than sitting adjacent.
const OPPOSITE_PAIRS = [['GREEN', 'BLUE'], ['YELLOW', 'RED']];

// The three ways four seats can pair off, named for the shape each one makes on
// the board. Read the board as a 2x2 grid — GREEN top-left, YELLOW top-right,
// RED bottom-left, BLUE bottom-right — and the names are the picture:
//
//   CROSS    GREEN . | . BLUE      the diagonals
//   FLANKS   GREEN RED | YELLOW BLUE   left column against right
//   FRONTS   GREEN YELLOW | RED BLUE   top row against bottom
//
// Every formation puts GREEN on side A, so the picker's icons all read from the
// same corner and only the partner cell moves.
const FORMATIONS = {
  NONE: { label: 'Free for All', hint: 'Every colour for itself', pairs: null },
  CROSS: { label: 'Cross', hint: 'Partners sit across the board', pairs: OPPOSITE_PAIRS },
  FLANKS: { label: 'Flanks', hint: 'Left side against right', pairs: [['GREEN', 'RED'], ['YELLOW', 'BLUE']] },
  FRONTS: { label: 'Fronts', hint: 'Top side against bottom', pairs: [['GREEN', 'YELLOW'], ['RED', 'BLUE']] }
};

// Colour -> team id, or null for no teams at all. The engine wants nothing else:
// areAllies reads this map and only this map, which is why a formation only has
// to describe the pairing and never has to teach any ability about partners.
function teamsFor(formation) {
  const pairs = (FORMATIONS[formation] || FORMATIONS.NONE).pairs;
  if (!pairs) return null;
  return Object.fromEntries(
    pairs.flatMap((pair, index) => pair.map(colour => [colour, index === 0 ? 'A' : 'B']))
  );
}

// The one place a mode's name and player count are written down. Both screens
// that show them read from here — they each kept their own copy once, which
// meant changing a player count here left the mode picker quietly lying.
const MODES = {
  FFA: { players: 4, label: 'Free for All' },
  DUEL: { players: 2, label: '1 v 1' },
  TEAM: { players: 4, label: '2 v 2' }
};

function requiredPlayers(mode) {
  return (MODES[mode] || MODES.FFA).players;
}

// Ordered by join time, so every peer derives the same seating from the same
// presence list without anyone having to be told. Ties break on id, which only
// matters when two devices join inside the same millisecond.
function assignSeats(members) {
  return [...members]
    .sort((a, b) => (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : 1))
    .slice(0, 4)
    .map((member, index) => ({ ...member, seat: index }));
}

// Fisher-Yates against an injectable rng, so the demo can pin a sequence and
// still exercise the real shuffle rather than a test-only branch.
function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Turns a room full of people into an actual game setup: which colours are in
// play, who owns each, which are left to the computer, and who is allied.
//
// Colour is always random — nobody gets green every match — but randomness is
// applied to the *assignment of people to colours*, never to which colours are
// on the board. In a duel the colours are a facing pair; in 2v2 all four play
// and the facing pairs become the two sides, so the shuffle is what decides
// your partner.
function buildMatch(members, mode = 'FFA', rng = Math.random) {
  const seated = assignSeats(members);

  let colours;
  let teams = null;

  if (mode === 'DUEL') {
    colours = OPPOSITE_PAIRS[Math.floor(rng() * OPPOSITE_PAIRS.length)];
  } else {
    colours = [...BOARD_ORDER];
    if (mode === 'TEAM') {
      teams = {};
      OPPOSITE_PAIRS.forEach((pair, index) => {
        pair.forEach(colour => { teams[colour] = index === 0 ? 'A' : 'B'; });
      });
    }
  }

  // Turn order must follow the board, not the order people happened to join.
  const players = [...colours].sort(
    (a, b) => BOARD_ORDER.indexOf(a) - BOARD_ORDER.indexOf(b)
  );

  const pool = shuffle(players, rng);
  const assignments = seated
    .slice(0, players.length)
    .map((member, index) => ({ ...member, colour: pool[index] }));

  const taken = new Set(assignments.map(a => a.colour));
  const bots = players.filter(colour => !taken.has(colour));

  return { mode, players, teams, assignments, bots };
}

// The host runs this over everything a guest asks for. `actor` is the colour the
// sender's seat entitles them to move; null means the host acting as referee
// (bots, timeouts, and the forced auto-play), which is not bound to the turn.
//
// This is the only thing standing between the game and a guest that has been
// tampered with, so it refuses by default rather than allowing by default.
function isActionAllowed(state, action, actor = null) {
  if (!action || typeof action !== 'object') return false;
  if (!state || state.gameOver) return false;
  if (actor && state.activePlayer !== actor) return false;

  switch (action.type) {
    case 'roll':
      return state.turnPhase === 'WAITING_FOR_ROLL';
    case 'move':
      return state.turnPhase === 'WAITING_FOR_MOVE';
    case 'shield':
    case 'gust':
    case 'fire':
    case 'wall':
    case 'skipAbility':
      return true; // the engine's own can* guards decide these
    default:
      return false;
  }
}

// Network data must have the engine's minimum shape before React renders it.
function validSnapshot(state, match) {
  if (!state || !match || !Array.isArray(state.turnOrder) || !Array.isArray(state.pieces) ||
      !Array.isArray(state.pendingRolls) || !Array.isArray(match.assignments) ||
      !Array.isArray(match.players) || !Array.isArray(match.bots) || !state.players) return false;
  const order = state.turnOrder;
  return order.length >= 2 && order.length <= 4 && new Set(order).size === order.length &&
    order.every(c => BOARD_ORDER.includes(c) && state.players[c] && typeof state.players[c] === 'object') &&
    order.includes(state.activePlayer) && typeof state.gameId === 'string' &&
    ['WAITING_FOR_ROLL','WAITING_FOR_MOVE','WAITING_FOR_ABILITY','GAME_OVER'].includes(state.turnPhase) &&
    state.pieces.length === order.length * 4 && state.pieces.every(p => p && typeof p.id === 'string' &&
      order.includes(p.player) && Number.isInteger(p.relativePosition) && p.relativePosition >= -1 && p.relativePosition <= 57) &&
    state.pendingRolls.every(n => Number.isInteger(n) && n >= 1 && n <= 6) &&
    match.assignments.every(a => a && typeof a.id === 'string' && order.includes(a.colour));
}

module.exports = {
  BOARD_ORDER,
  OPPOSITE_PAIRS,
  FORMATIONS,
  teamsFor,
  MODES,
  requiredPlayers,
  assignSeats,
  shuffle,
  buildMatch,
  isActionAllowed,
  validSnapshot
};
