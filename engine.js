const PLAYERS = ['GREEN', 'YELLOW', 'BLUE', 'RED'];
const BASE_OFFSETS = { GREEN: 0, YELLOW: 13, BLUE: 26, RED: 39 };
const SAFE_TILES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Elemental ability charge: every dice pip a player rolls is banked as a point.
// The charge normally needs 40 points, but once a player has goaled at least one
// token their own bar only needs 30 (per player, not global).
const ABILITY_POINTS_BASE = 40;
const ABILITY_POINTS_AFTER_GOAL = 30;

function getAbilityThreshold(playerState) {
  if (!playerState) return ABILITY_POINTS_BASE;
  return playerState.completedPieces > 0 ? ABILITY_POINTS_AFTER_GOAL : ABILITY_POINTS_BASE;
}

// Recomputes the threshold + readiness flag the UI reads. Safe to call any time.
function refreshAbility(state, player) {
  const p = state.players[player];
  if (!p) return;
  p.abilityThreshold = getAbilityThreshold(p);
  // The bar stops dead at full. Once charged it sits on the threshold and banks
  // nothing more until the power is spent — no overflow carries over.
  if (p.points > p.abilityThreshold) p.points = p.abilityThreshold;
  p.abilityReady = p.status === 'PLAYING' && p.points >= p.abilityThreshold;
}

// Banks the pips of a single roll. Points persist across turns and are never
// reset when the turn passes around the table. refreshAbility caps the total at
// the threshold, so a full bar simply stays full.
function awardDicePoints(state, player, amount) {
  const p = state.players[player];
  if (!p || p.status !== 'PLAYING') return;

  p.points += amount;
  refreshAbility(state, player);
}

// ---------------------------------------------------------------------------
// ABILITY TIMING — the same window for every element
//
// A charged ability may be fired before rolling OR after rolling, but never
// once the token has been moved. Firing it does not consume the dice roll: the
// player still rolls and moves exactly as they otherwise would.
// ---------------------------------------------------------------------------
// Firing any ability empties the bar completely — it starts again from zero.
function spendAbilityCharge(state, player) {
  const p = state.players[player];
  if (!p) return;
  p.points = 0;
  refreshAbility(state, player);
}

const ABILITY_PHASES = ['WAITING_FOR_ROLL', 'WAITING_FOR_MOVE', 'WAITING_FOR_ABILITY'];

function canUseAbility(state, player) {
  if (state.gameOver) return false;
  if (state.activePlayer !== player) return false;
  if (ABILITY_PHASES.indexOf(state.turnPhase) === -1) return false;
  const p = state.players[player];
  return !!p && p.status === 'PLAYING' && p.abilityReady;
}

// A charged bar earns its window even when the dice left nothing to play —
// including a bar that only filled on this very roll. Without this the turn
// would pass instantly and the charge would sit unused for a whole lap.
// Bots are excluded: they never press the button, so they would just hang.
function hasAbilityWindow(state, player) {
  const p = state.players[player];
  return !!p && p.status === 'PLAYING' && !p.isBot && p.abilityReady;
}

// Closes that window. A revive can open up a move with the dice already rolled,
// so re-check before ending the turn.
function resolveAbilityWindow(state) {
  if (state.turnPhase !== 'WAITING_FOR_ABILITY') return state;
  if (getLegalMoves(state).length > 0) {
    state.turnPhase = 'WAITING_FOR_MOVE';
  } else {
    passTurn(state);
  }
  return state;
}

// The player declines the window and ends their turn, charge intact.
function skipAbilityWindow(state) {
  if (state.turnPhase !== 'WAITING_FOR_ABILITY') return state;
  passTurn(state);
  return state;
}

// ---------------------------------------------------------------------------
// EARTH ABILITY — the wall
//
// GREEN (Earth) may drop a wall on any track tile — the whole 52-tile ring plus
// anyone's private home lane, so a rival can be locked out of their own run-in.
// Every other player's pieces are forced to stop on the tile immediately before
// it; the owner walks through freely. Dropping it on a stop sign also shoves the
// tokens sheltering there one step on. The wall stands until the owner's own
// turn comes back around.
//
// In 2v2 a partner counts as the owner for both: the wall is not something you
// can accidentally do to your own side.
// ---------------------------------------------------------------------------
const WALL_ABILITY_PLAYERS = { GREEN: true };

function isValidWallCell(state, cell) {
  if (!cell) return false;
  if (cell.kind === 'RING') {
    return Number.isInteger(cell.globalPos) && cell.globalPos >= 0 && cell.globalPos <= 51;
  }
  if (cell.kind === 'HOME') {
    if (!state.players[cell.player]) return false;
    return Number.isInteger(cell.index) && cell.index >= 0 && cell.index <= 4;
  }
  return false;
}

function canPlaceWall(state, player) {
  return canUseAbility(state, player) && !!WALL_ABILITY_PLAYERS[player];
}

// Dropping the wall onto a stop sign shoves everyone sheltering there one step
// along their own path — the owner's own tokens, and a partner's, hold their
// ground. They lose the safe tile, but the shove does carry them past the wall
// that displaced them. Nothing else fires: it is a shove, not a move, so no
// captures.
function shoveOffSafeTile(state, cell, owner) {
  if (cell.kind !== 'RING') return 0;
  if (!SAFE_TILES.has(cell.globalPos)) return 0;

  let shoved = 0;
  state.pieces.forEach(p => {
    if (p.player === owner) return;
    if (areAllies(state, p.player, owner)) return;
    if (isShielded(state, p)) return; // ice does not budge
    if (p.relativePosition < 0 || p.relativePosition > 50) return;
    if (p.relativePosition + 1 > 56) return;
    if ((BASE_OFFSETS[p.player] + p.relativePosition) % 52 !== cell.globalPos) return;
    p.relativePosition += 1;
    shoved += 1;
  });
  return shoved;
}

// Spends the charge and drops the wall. Does not consume the dice roll, so the
// player still rolls / moves exactly as they otherwise would.
function placeWall(state, cell) {
  const player = state.activePlayer;
  if (!canPlaceWall(state, player)) return state;
  if (!isValidWallCell(state, cell)) return state;

  spendAbilityCharge(state, player);
  state.wall = { owner: player, ...cell };
  shoveOffSafeTile(state, cell, player);
  return resolveAbilityWindow(state);
}

// ---------------------------------------------------------------------------
// WATER ABILITY — the ice shield
//
// BLUE (Water) sheathes every one of its own tokens in spiked ice. Enemies are
// NOT blocked: anyone with enough pips walks straight past. But landing exactly
// on a shielded token impales the attacker — the attacker goes back to its base
// and the shielded token holds its ground. The owner is immune to its own
// spikes, and in 2v2 so is a partner: allies share a tile rather than trade
// blows on it. Like the wall, it stands until the owner's turn comes back
// around.
//
// While it holds, a shielded token is untouchable by every other ability:
// Fire cannot burn it or shove it, Air cannot sweep it, and Earth cannot shove
// it off a stop sign. Water is the hard counter to all three.
// ---------------------------------------------------------------------------
const SHIELD_ABILITY_PLAYERS = { BLUE: true };

function canRaiseShield(state, player) {
  return canUseAbility(state, player) && !!SHIELD_ABILITY_PLAYERS[player];
}

// Pulls one stranded token back out of the base onto its start tile. This is
// Water's alone — no other power can be cashed in for a deployment.
// Returns the piece that was revived, or null when the base was empty.
function reviveFromBase(state, player) {
  const stranded = state.pieces.find(
    p => p.player === player && p.relativePosition === -1
  );
  if (!stranded) return null;
  stranded.relativePosition = 0;
  return stranded;
}

// Instant, untargeted: every token the player owns is covered at once, and the
// tide carries one token back out of the base while it is at it.
function raiseShield(state) {
  const player = state.activePlayer;
  if (!canRaiseShield(state, player)) return state;

  spendAbilityCharge(state, player);
  state.shield = { owner: player };
  // The revived token is covered too — the shield is player-wide.
  reviveFromBase(state, player);
  return resolveAbilityWindow(state);
}

function isShielded(state, piece) {
  return !!state.shield && state.shield.owner === piece.player;
}

// ---------------------------------------------------------------------------
// FIRE ABILITY — the blaze
//
// RED (Fire) charges a single move: the token burns every enemy on the tiles it
// crosses, landing tile included. Stop signs shelter their occupants, Water's
// ice does not burn, and in 2v2 a partner is never caught.
//
// ONE move — that is where the balance lives, and it is worth being exact about
// because a turn is often several moves. Roll 6, 6, 5 and there are three runs
// to make; the blaze rides exactly one of them, whichever the player spends
// first. Burning every path a turn walks would be a different, much stronger
// ability.
//
// Because that one-move limit is the cost, the timing is free: like the gust it
// can be armed before the roll or after it, with the dice already on the table.
// ---------------------------------------------------------------------------
const FIRE_ABILITY_PLAYERS = { RED: true };

function canIgniteFire(state, player) {
  return canUseAbility(state, player) && !!FIRE_ABILITY_PLAYERS[player];
}

// Arming empties the bar and leaves the blaze hanging over the next move. Like
// the gust it is only cleared by a move actually happening, so a turn with
// nothing to play never wastes it.
function igniteFire(state) {
  const player = state.activePlayer;
  if (!canIgniteFire(state, player)) return state;

  spendAbilityCharge(state, player);
  state.fire = { owner: player };
  // Armable from the post-roll window too, which is a phase that has to be
  // closed behind it.
  return resolveAbilityWindow(state);
}

function hasFire(state, player) {
  return !!state.fire && state.fire.owner === player;
}

// Everything standing on the tiles a token just crossed — landing tile
// included — is sent home. Returns how many were caught.
function burnAlong(state, piece, fromRel, toRel) {
  let burned = 0;
  for (let rel = fromRel + 1; rel <= toRel; rel++) {
    if (rel < 0 || rel > 50) continue; // only ring tiles can hold enemies
    const globalPos = (BASE_OFFSETS[piece.player] + rel) % 52;
    if (SAFE_TILES.has(globalPos)) continue; // stop signs shelter their occupants

    state.pieces.forEach(p => {
      if (p.player === piece.player) return;
      if (areAllies(state, p.player, piece.player)) return;
      if (p.relativePosition < 0 || p.relativePosition > 50) return;
      if (isShielded(state, p)) return; // ice does not burn
      if ((BASE_OFFSETS[p.player] + p.relativePosition) % 52 === globalPos) {
        p.relativePosition = -1;
        burned += 1;
      }
    });
  }
  return burned;
}

// ---------------------------------------------------------------------------
// AIR ABILITY — the gust
//
// YELLOW (Air) charges a single move and adds nine steps to it: a 3 carries
// twelve, a 6 carries fifteen. It captures normally wherever it lands.
//
// The one thing the wind will not do is carry a token out of the yard. A gust
// armed over a six would otherwise be a free deploy plus most of a lap; armed,
// the six has to be spent on a token already running, so the ability costs you
// the board position you would have gained by deploying.
//
// It can be armed before the roll or after it. Unlike the other three this is a
// one-shot, not a lap-long aura: it is cleared by the owner's next move, and
// keeps until then if no move was possible.
// ---------------------------------------------------------------------------
const AIR_ABILITY_PLAYERS = { YELLOW: true };
const GUST_BONUS_STEPS = 9;

// Whether the board would still offer a move with the gust up. Armed, the same
// roll plays differently: a six can no longer deploy, and nine extra steps can
// overshoot the goal a shorter move would have reached.
function gustLeavesAMove(state, player) {
  const before = state.gust;
  state.gust = { owner: player };
  const any = getLegalMoves(state).length > 0;
  state.gust = before;
  return any;
}

function canSummonGust(state, player) {
  if (!canUseAbility(state, player) || !AIR_ABILITY_PLAYERS[player]) return false;
  // With the roll already known, arming must not take the last move off the
  // table — every token in the yard and a six on the dice is exactly that.
  // Before the roll there is nothing to check against: armed blind, a dead roll
  // simply keeps the gust for next turn.
  if (state.turnPhase === 'WAITING_FOR_MOVE') return gustLeavesAMove(state, player);
  return true;
}

function summonGust(state) {
  const player = state.activePlayer;
  if (!canSummonGust(state, player)) return state;

  spendAbilityCharge(state, player);
  state.gust = { owner: player };
  return resolveAbilityWindow(state);
}

function hasGust(state, player) {
  return !!state.gust && state.gust.owner === player;
}

// The gust adds its nine steps to whatever was rolled.
function getEffectiveSteps(state, player, diceValue) {
  if (hasGust(state, player)) {
    return diceValue + GUST_BONUS_STEPS;
  }
  return diceValue;
}

// Translates the wall into the given player's own 0..55 path coordinate,
// or null when the wall does not sit on that player's route at all.
function getWallRelativeFor(wall, player) {
  if (!wall) return null;
  if (wall.kind === 'RING') {
    const rel = (wall.globalPos - BASE_OFFSETS[player] + 52) % 52;
    return rel <= 50 ? rel : null;
  }
  if (wall.kind === 'HOME') {
    return wall.player === player ? 51 + wall.index : null;
  }
  return null;
}

// Highest relativePosition this piece may reach while the wall stands.
// null means unobstructed.
function getWallStop(state, piece) {
  const wall = state.wall;
  if (!wall) return null;
  if (isShielded(state, piece)) return null; // Water passes through Earth walls.
  if (piece.player === wall.owner) return null; // the owner walks through
  if (areAllies(state, piece.player, wall.owner)) return null; // and so does a partner
  const wallRel = getWallRelativeFor(wall, piece.player);
  if (wallRel === null) return null;
  if (piece.relativePosition >= wallRel) return null; // already past it
  return wallRel - 1;
}

// Where a piece actually ends up for this dice value, after the wall clamps it.
// Returns null when there is no legal move for that piece.
function resolveDestination(state, piece, diceValue) {
  if (!diceValue) return null;
  if (piece.relativePosition === 56) return null;

  const steps = getEffectiveSteps(state, piece.player, diceValue);
  const stop = getWallStop(state, piece);

  if (piece.relativePosition === -1) {
    if (diceValue !== 6) return null;
    // The wind will not carry a token out of the yard: with a gust armed, the
    // six has to be spent on something already running.
    if (hasGust(state, piece.player)) return null;
    // A wall sitting on the entry tile keeps the piece in the yard.
    if (stop !== null && stop < 0) return null;
    // Entering spends the six itself, so it lands on its own start tile.
    return 0;
  }

  let target = piece.relativePosition + steps;
  if (target > 56) return null;
  // No roll is big enough to jump a wall — the piece just stops short of it.
  if (stop !== null && target > stop) target = stop;
  if (target <= piece.relativePosition) return null;
  return target;
}

// Auras stand for one full lap of the table: they are cleared the moment their
// owner's turn comes back around (or if the owner drops out of the game).
// This runs from passTurn only, so extra rolls from a six never burn the
// duration — a table turn means everyone actually had their go.
function expireAura(state, key) {
  const aura = state[key];
  if (!aura) return;
  const owner = state.players[aura.owner];
  if (state.activePlayer === aura.owner || !owner || owner.status !== 'PLAYING') {
    state[key] = null;
  }
}

// Fire and the gust are not auras: both are armed over a single move and are
// cleared by that move happening, so a turn with nothing to play keeps them
// rather than burning them.
function expireAuras(state) {
  expireAura(state, 'wall');
  expireAura(state, 'shield');
  expireAura(state, 'fireTrail');
  expireAura(state, 'gustTrail');
}

// `options.players` overrides which colours are in play, which matters for 1v1:
// PLAYERS.slice(0, 2) would seat GREEN and YELLOW side by side, and adjacent
// seats do not travel the same distance to their goal. Duels are seated
// opposite instead.
//
// `options.teams` maps each colour to a team id. Present only in 2v2. When set,
// allies cannot capture each other, may share a tile, and win together.
function createGame(numPlayers = 4, bots = [], options = {}) {
  const activePlayers = options.players
    ? options.players.filter(p => PLAYERS.includes(p))
    : PLAYERS.slice(0, Math.max(2, Math.min(4, numPlayers)));
  const pieces = [];
  const players = {};

  activePlayers.forEach(player => {
    players[player] = {
      status: 'PLAYING',
      rank: null,
      completedPieces: 0,
      isBot: bots.includes(player),
      points: 0,
      chargeStarted: false,
      abilityThreshold: ABILITY_POINTS_BASE,
      abilityReady: false,
      // This seat's own last number and its own roll counter — see rollDice.
      lastRoll: null,
      rollSeq: 0
    };
    for (let i = 0; i < 4; i++) {
      pieces.push({ id: `${player}_${i}`, player, relativePosition: -1 });
    }
  });

  return {
    gameId: Math.random().toString(36).substring(2, 9),
    turnOrder: activePlayers,
    // Who moves first is drawn, not given to whoever happens to sit at seat 0 —
    // being first is a real edge, and handing it to the same colour every game
    // is the same unfairness as always dealing somebody green. Turn ORDER still
    // follows the board; only the starting seat is drawn.
    // `options.rng` is here so the suites can pin it.
    activePlayer: activePlayers[Math.floor((options.rng || Math.random)() * activePlayers.length)],
    turnPhase: 'WAITING_FOR_ROLL',
    // The value of the LAST roll, kept purely so the dice face has something to
    // show. It is NOT what moves are worked out from — that's pendingRolls.
    diceValue: null,
    // Bumped by every roll — see rollDice.
    rollSeq: 0,
    // Every rolled value banked and not yet spent, in the order they landed.
    // A six forces another roll before anything may move, so this is how a
    // turn ends up holding 6+4: the six waits here while the 4 is rolled.
    pendingRolls: [],
    consecutiveSixes: 0,
    sixThisTurn: false,
    // Set for one beat when a third straight six burns the turn, so the UI can
    // say why everything vanished. Cleared by the next roll.
    burnedBy: null,
    pieces,
    players,
    gameOver: false,
    nextRank: 1,
    // 'FFA' | 'DUEL' | 'TEAM'. Only TEAM carries a teams map.
    mode: options.mode || (activePlayers.length === 2 ? 'DUEL' : 'FFA'),
    teams: options.teams || null,
    winningTeam: null,
    wall: null,
    shield: null,
    fire: null,
    gust: null,
    fireTrail: null,
    gustTrail: null
  };
}

// Two colours on the same side. Always false outside 2v2, and false for a
// colour against itself is never asked — callers check identity first.
function areAllies(state, a, b) {
  if (!state.teams) return false;
  return Boolean(state.teams[a]) && state.teams[a] === state.teams[b];
}

// Decides what happens once there is nothing left to roll: play the banked
// values, hold the turn open for a charge, or end it. Deliberately does NOT
// clear pendingRolls when the board offers nothing — an ability fired from the
// window (Water's revive) can open up a move for a value still sitting there.
// Only passTurn discards them.
function settleTurn(state) {
  if (state.gameOver) return state;

  if (getLegalMoves(state).length > 0) {
    state.turnPhase = 'WAITING_FOR_MOVE';
  } else if (hasAbilityWindow(state, state.activePlayer)) {
    state.turnPhase = 'WAITING_FOR_ABILITY';
  } else {
    passTurn(state);
  }
  return state;
}

// A six never moves anything by itself — it banks and hands the dice straight
// back. Nothing may move until the player rolls a number that isn't a six (or
// burns out on the third), which is what lets 6+4 sit as two spendable values
// and makes the three-six burn a plain consequence of the same rule.
function rollDice(state, fixedValue = null) {
  if (state.turnPhase !== 'WAITING_FOR_ROLL' || state.gameOver) return state;

  state.burnedBy = null;
  const roll = fixedValue || Math.floor(Math.random() * 6) + 1;
  state.diceValue = roll;
  // Counts rolls rather than describing one, so the UI can tell "rolled again"
  // from "still showing the last number". The value alone cannot: roll a 4
  // twice in a row and nothing about the state changes, which is why the die
  // used to sit dead still on the second one.
  state.rollSeq = (state.rollSeq || 0) + 1;
  const roller = state.players[state.activePlayer];
  roller.lastRoll = roll;
  // Counted per seat as well, because the game-wide counter cannot say WHOSE
  // roll it was — and a roll that leaves nothing playable passes the turn
  // inside this same call (see settleTurn). A die keyed on whose turn it is
  // *now* therefore missed the roll that had just happened, which is most
  // rolls early on, when every seat is still waiting for a six.
  roller.rollSeq = (roller.rollSeq || 0) + 1;

  if (roll === 6) {
    // Remembered for the whole turn, not just this roll: a six spends Air's
    // gust on distance, and the sweep is off the table until the turn ends —
    // including across the extra rolls the six itself grants.
    state.sixThisTurn = true;
    state.consecutiveSixes += 1;

    if (state.consecutiveSixes === 3) {
      // Burnt. The third six takes the whole turn down with it — the two sixes
      // already banked are forfeited unspent, and none of it scores.
      state.pendingRolls = [];
      const burned = state.activePlayer;
      passTurn(state);
      state.burnedBy = burned;
      return state;
    }

    state.pendingRolls.push(roll);
    awardDicePoints(state, state.activePlayer, roll);
    // Straight back to the dice — no move may be made while a six is live.
    state.turnPhase = 'WAITING_FOR_ROLL';
    return state;
  }

  state.consecutiveSixes = 0;
  state.pendingRolls.push(roll);
  awardDicePoints(state, state.activePlayer, roll);

  return settleTurn(state);
}

// Which of the banked values this piece could actually spend right now. This is
// what the on-token chooser lists, so a piece playable by both the 6 and the 4
// offers both. Duplicates collapse: two banked sixes are one choice, not two.
function getMoveValuesForPiece(state, pieceId) {
  const piece = state.pieces.find(p => p.id === pieceId);
  if (!piece || piece.player !== state.activePlayer) return [];

  const seen = new Set();
  return state.pendingRolls.filter(value => {
    if (seen.has(value)) return false;
    if (resolveDestination(state, piece, value) === null) return false;
    seen.add(value);
    return true;
  });
}

// Every piece with at least one banked value it can spend. A value that no
// piece can use is not pruned here — a later move can open it up (deploying
// with the 6 can make the 4 playable), so it only dies when the turn ends.
function getLegalMoves(state) {
  const { activePlayer, pendingRolls, pieces } = state;
  if (!pendingRolls || pendingRolls.length === 0) return [];

  return pieces.filter(p =>
    p.player === activePlayer &&
    pendingRolls.some(value => resolveDestination(state, p, value) !== null)
  );
}

// `value` picks which banked roll to spend — that's the 6-or-4 choice the
// player makes on the token itself. Omitting it spends the only usable value
// (and is what the auto-play path and the older single-value callers rely on).
function movePiece(state, pieceId, value = null) {
  if (state.turnPhase !== 'WAITING_FOR_MOVE' || state.gameOver) return state;

  const piece = state.pieces.find(p => p.id === pieceId);
  if (!piece || piece.player !== state.activePlayer) return state;

  const usable = getMoveValuesForPiece(state, pieceId);
  if (usable.length === 0) return state;

  const spend = value === null ? usable[0] : value;
  if (usable.indexOf(spend) === -1) return state;

  // Off the bank it comes — one copy only, so a banked 6+6 still owes a move.
  state.pendingRolls.splice(state.pendingRolls.indexOf(spend), 1);

  // A six no longer grants anything here: it was already paid for with the
  // forced re-roll back when it landed. Only a capture or a goal buys a roll.
  let extraRoll = false;

  // Both one-shots are read before the piece moves and cleared after it, so a
  // turn with nothing to play never burns either of them.
  const gustActive = hasGust(state, piece.player);
  const fireActive = hasFire(state, piece.player);

  // Clamped by the wall when one stands in this piece's way.
  const startPosition = piece.relativePosition;
  const destination = resolveDestination(state, piece, spend);
  if (destination === null) return state;
  piece.relativePosition = destination;

  // Fire burns the whole run. A token coming out of the yard crosses nothing,
  // so there is nothing to catch — it still spends the blaze, same as the gust
  // is spent by whatever move follows it.
  if (fireActive) {
    const path = [];
    const fromRel = Math.max(0, startPosition + 1);
    for (let rel = fromRel; rel <= destination; rel++) {
      if (rel <= 50) {
        path.push({ kind: 'RING', globalPos: (BASE_OFFSETS[piece.player] + rel) % 52 });
      } else if (rel <= 55) {
        path.push({ kind: 'HOME', player: piece.player, index: rel - 51 });
      }
    }
    if (path.length > 0) {
      state.fireTrail = { owner: piece.player, path, pieceId: piece.id };
    }

    if (startPosition >= 0 && burnAlong(state, piece, startPosition, destination) > 0) {
      extraRoll = true;
    }
    state.fire = null;
  }

  if (gustActive) {
    const path = [];
    const fromRel = Math.max(0, startPosition + 1);
    for (let rel = fromRel; rel <= destination; rel++) {
      if (rel <= 50) {
        path.push({ kind: 'RING', globalPos: (BASE_OFFSETS[piece.player] + rel) % 52 });
      } else if (rel <= 55) {
        path.push({ kind: 'HOME', player: piece.player, index: rel - 51 });
      }
    }
    if (path.length > 0) {
      state.gustTrail = { owner: piece.player, path, pieceId: piece.id };
    }
    state.gust = null;
  }

  if (piece.relativePosition >= 0 && piece.relativePosition <= 50) {
    const globalPos = (BASE_OFFSETS[piece.player] + piece.relativePosition) % 52;

    const enemies = state.pieces.filter(p => {
      if (p.player === piece.player) return false;
      // In 2v2 an ally's token is not a target: partners share tiles safely,
      // which is most of what makes the mode play differently.
      if (areAllies(state, p.player, piece.player)) return false;
      if (p.relativePosition < 0 || p.relativePosition > 50) return false;
      const enemyGlobalPos = (BASE_OFFSETS[p.player] + p.relativePosition) % 52;
      return enemyGlobalPos === globalPos;
    });

    // Ice spikes bite first, and they bite anywhere — a safe tile shelters its
    // occupant from capture, but it does not blunt the spikes.
    const spiked = enemies.some(e => isShielded(state, e));

    if (spiked) {
      piece.relativePosition = -1; // the attacker impales itself
    } else if (!SAFE_TILES.has(globalPos) && enemies.length > 0) {
      enemies.forEach(e => { e.relativePosition = -1; });
      extraRoll = true;
    }
  }

  if (piece.relativePosition === 56) {
    state.players[piece.player].completedPieces += 1;
    extraRoll = true;

    if (state.players[piece.player].completedPieces === 1) {
      state.triggerFirstScoreAnimation = piece.player;
    }

    if (state.players[piece.player].completedPieces === 4) {
      state.players[piece.player].status = 'FINISHED';
      state.players[piece.player].rank = state.nextRank++;
      extraRoll = false;
    }
    // Goaling the first token permanently lowers this player's ability cost,
    // which can unlock the ability immediately with points already banked.
    refreshAbility(state, piece.player);
    checkGameOver(state);
  }

  if (state.gameOver) {
    return state;
  }

  if (extraRoll) {
    // Earned by a capture or a goal, and taken straight away — whatever it
    // rolls joins the values still banked, to be spent alongside them. A six
    // here behaves like any other: bank it and roll again.
    state.turnPhase = 'WAITING_FOR_ROLL';
    return state;
  }

  // Anything still banked is played on; when nothing can use it, it's lost.
  if (getLegalMoves(state).length > 0) {
    state.turnPhase = 'WAITING_FOR_MOVE';
  } else {
    passTurn(state);
  }
  return state;
}

function checkGameOver(state) {
  // 2v2 ends the moment one side is entirely home — the other pair does not
  // play on for a consolation placing, because there is nothing left to place.
  if (state.teams) {
    const sides = {};
    state.turnOrder.forEach(p => {
      const team = state.teams[p];
      (sides[team] = sides[team] || []).push(p);
    });

    const won = Object.keys(sides).find(team =>
      sides[team].every(p => state.players[p].status === 'FINISHED')
    );

    if (won) {
      state.gameOver = true;
      state.winningTeam = won;
      state.turnOrder.forEach(p => {
        if (state.players[p].status === 'PLAYING') {
          state.players[p].status = 'FINISHED';
          state.players[p].rank = state.nextRank;
          refreshAbility(state, p);
        }
      });
      state.turnPhase = 'GAME_OVER';
    }
    return;
  }

  const playingCount = state.turnOrder.filter(p => state.players[p].status === 'PLAYING').length;
  if (playingCount <= 1) {
    state.gameOver = true;
    const lastPlayer = state.turnOrder.find(p => state.players[p].status === 'PLAYING');
    if (lastPlayer) {
      state.players[lastPlayer].status = 'FINISHED';
      state.players[lastPlayer].rank = state.nextRank;
      refreshAbility(state, lastPlayer);
    }
    state.turnPhase = 'GAME_OVER';
  }
}

function passTurn(state) {
  state.consecutiveSixes = 0;
  state.sixThisTurn = false;
  state.turnPhase = 'WAITING_FOR_ROLL';
  // The roll belongs to the player who just finished, not to whoever goes
  // next — clear it so the next seat's dice isn't shown holding a number
  // they never rolled. Same for anything left in the bank: values nobody
  // could spend die with the turn rather than following it around the table.
  state.diceValue = null;
  state.pendingRolls = [];

  let currentIndex = state.turnOrder.indexOf(state.activePlayer);
  for (let i = 1; i <= state.turnOrder.length; i++) {
    const nextIndex = (currentIndex + i) % state.turnOrder.length;
    const nextPlayer = state.turnOrder[nextIndex];
    if (state.players[nextPlayer].status === 'PLAYING') {
      state.activePlayer = nextPlayer;
      break;
    }
  }

  expireAuras(state);
}

module.exports = {
  createGame,
  areAllies,
  rollDice,
  getLegalMoves,
  getMoveValuesForPiece,
  movePiece,
  getAbilityThreshold,
  canUseAbility,
  skipAbilityWindow,
  placeWall,
  canPlaceWall,
  getWallRelativeFor,
  raiseShield,
  canRaiseShield,
  isShielded,
  reviveFromBase,
  igniteFire,
  canIgniteFire,
  hasFire,
  summonGust,
  canSummonGust,
  hasGust,
  getEffectiveSteps,
  resolveDestination,
  ABILITY_POINTS_BASE,
  ABILITY_POINTS_AFTER_GOAL,
  WALL_ABILITY_PLAYERS,
  SHIELD_ABILITY_PLAYERS,
  FIRE_ABILITY_PLAYERS,
  AIR_ABILITY_PLAYERS
};
