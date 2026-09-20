const {
  BOARD_ORDER, OPPOSITE_PAIRS, MODES, requiredPlayers, assignSeats, buildMatch, isActionAllowed,
  FORMATIONS, teamsFor
} = require('./online.js');
const {
  createGame: createRawGame, rollDice, getLegalMoves, getMoveValuesForPiece, movePiece,
  skipAbilityWindow, areAllies, placeWall, raiseShield, igniteFire,
  resolveDestination
} = require('./engine.js');
const assert = require('assert');

// Who moves first is drawn at random in a real game. Pinning the draw here is
// what lets every assertion below still say GREEN and mean it.
const createGame = (numPlayers, bots, options = {}) =>
  createRawGame(numPlayers, bots, { ...options, rng: () => 0 });

const members = n => Array.from({ length: n }, (_, i) => ({
  id: 'p' + i, name: 'Player ' + i, joinedAt: i + 1
}));

// ---------------------------------------------------------------- seating ---

function seatingDemo() {
  console.log('Running Online Seating Demo...');

  const three = [
    { id: 'carol', joinedAt: 300 },
    { id: 'alice', joinedAt: 100 },
    { id: 'bob', joinedAt: 200 }
  ];

  const seats = assignSeats(three);
  assert.deepStrictEqual(seats.map(s => s.id), ['alice', 'bob', 'carol'],
    'seats go in join order, not the order presence happened to report');

  assert.deepStrictEqual(assignSeats([three[1], three[2], three[0]]), seats,
    'seating must not depend on input order');

  assert.deepStrictEqual(
    assignSeats([{ id: 'zoe', joinedAt: 500 }, { id: 'adam', joinedAt: 500 }]).map(s => s.id),
    ['adam', 'zoe'],
    'identical join times break on id so peers cannot disagree');

  assert.strictEqual(assignSeats(members(5)).length, 4, 'a room seats at most four');

  assert.strictEqual(requiredPlayers('FFA'), 4);
  assert.strictEqual(requiredPlayers('DUEL'), 2);
  assert.strictEqual(requiredPlayers('TEAM'), 4);

  // MODES is the only place a mode's name and player count are written down —
  // the lobby chip and the mode picker both read from it. A mode added here
  // without a label, or with a count the seating cannot satisfy, breaks those
  // screens at render rather than here, so check the shape at the source.
  Object.keys(MODES).forEach(key => {
    assert.ok(MODES[key].label, `${key} needs a label for the UI to show`);
    assert.strictEqual(requiredPlayers(key), MODES[key].players,
      `requiredPlayers disagrees with MODES for ${key}`);
    assert.ok(MODES[key].players >= 2 && MODES[key].players <= 4,
      `${key} wants ${MODES[key].players} players, but a board seats 2 to 4`);
    assert.strictEqual(buildMatch(members(MODES[key].players), key).assignments.length,
      MODES[key].players, `${key} cannot actually seat the count it advertises`);
  });

  console.log('All seating tests passed!');
}

// ------------------------------------------------------------- match setup ---

function matchDemo() {
  console.log('Running Match Setup Demo...');

  // --- FFA
  const ffa = buildMatch(members(4), 'FFA');
  assert.deepStrictEqual(ffa.players, BOARD_ORDER, 'FFA plays all four, in board order');
  assert.strictEqual(ffa.teams, null, 'FFA has no teams');
  assert.strictEqual(ffa.bots.length, 0, 'a full FFA room has no bots');
  assert.strictEqual(new Set(ffa.assignments.map(a => a.colour)).size, 4,
    'no two people may be handed the same colour');

  // --- FFA with empty seats
  const short = buildMatch(members(2), 'FFA');
  assert.strictEqual(short.assignments.length, 2);
  assert.strictEqual(short.bots.length, 2, 'unclaimed colours become bots');
  short.bots.forEach(b => assert.ok(
    !short.assignments.some(a => a.colour === b), 'a bot colour cannot also be a human'));

  // --- DUEL must be seated opposite, or one player walks further to goal
  for (let i = 0; i < 40; i++) {
    const duel = buildMatch(members(2), 'DUEL');
    assert.strictEqual(duel.players.length, 2);
    const isFacing = OPPOSITE_PAIRS.some(pair =>
      pair.every(c => duel.players.includes(c)));
    assert.ok(isFacing, 'a duel must use a facing pair, got ' + duel.players.join('+'));
    assert.strictEqual(duel.bots.length, 0);
  }

  // --- TEAM: four colours, two sides, partners facing each other
  const team = buildMatch(members(4), 'TEAM');
  assert.deepStrictEqual(team.players, BOARD_ORDER);
  assert.ok(team.teams, '2v2 must carry a teams map');
  OPPOSITE_PAIRS.forEach(([a, b]) => {
    assert.strictEqual(team.teams[a], team.teams[b],
      `${a} and ${b} sit opposite so they must be allies`);
  });
  assert.notStrictEqual(team.teams.GREEN, team.teams.YELLOW,
    'adjacent colours must be opponents');
  assert.strictEqual(new Set(Object.values(team.teams)).size, 2, 'exactly two sides');

  // --- Colour really is random, not just shuffled once
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    seen.add(buildMatch(members(4), 'FFA').assignments.find(a => a.id === 'p0').colour);
  }
  assert.strictEqual(seen.size, 4, 'the same person should be able to draw any colour');

  // --- An injected rng must actually drive it, or the shuffle is untestable
  const fixed = buildMatch(members(4), 'FFA', () => 0);
  const fixedAgain = buildMatch(members(4), 'FFA', () => 0);
  assert.deepStrictEqual(fixed.assignments, fixedAgain.assignments,
    'the same rng must produce the same table');

  console.log('All match setup tests passed!');
}

// ------------------------------------------------------------- team rules ---

// Global tile 10 is not a safe square, and three colours can all reach it:
// GREEN at rel 10, BLUE at rel 36 ((26+36)%52), YELLOW at rel 49 ((13+49)%52).
function landOn(mode, teams, victimColour, victimRel) {
  const state = createGame(4, [], { mode, teams });
  state.activePlayer = 'GREEN';
  state.turnPhase = 'WAITING_FOR_MOVE';
  state.pendingRolls = [2];

  const mover = state.pieces.find(p => p.id === 'GREEN_0');
  mover.relativePosition = 8;
  const victim = state.pieces.find(p => p.id === victimColour + '_0');
  victim.relativePosition = victimRel;

  movePiece(state, 'GREEN_0', 2);
  return { mover, victim };
}

function teamRulesDemo() {
  console.log('Running 2v2 Team Rules Demo...');

  const teams = { GREEN: 'A', BLUE: 'A', YELLOW: 'B', RED: 'B' };

  const s = createGame(4, [], { mode: 'TEAM', teams });
  assert.ok(areAllies(s, 'GREEN', 'BLUE'), 'facing colours are allies');
  assert.ok(!areAllies(s, 'GREEN', 'YELLOW'), 'adjacent colours are not');
  assert.ok(!areAllies(createGame(4), 'GREEN', 'BLUE'), 'FFA has no allies at all');

  // Ally on the destination tile: both survive and share it.
  const ally = landOn('TEAM', teams, 'BLUE', 36);
  assert.strictEqual(ally.mover.relativePosition, 10, 'the mover still lands');
  assert.strictEqual(ally.victim.relativePosition, 36,
    'an ally must NOT be sent home — partners share tiles');

  // Same tile, same board, but an opponent: normal capture.
  const foe = landOn('TEAM', teams, 'YELLOW', 49);
  assert.strictEqual(foe.victim.relativePosition, -1, 'an opponent is still captured');

  // Control: without teams, that same BLUE token IS captured.
  const ffa = landOn('FFA', null, 'BLUE', 36);
  assert.strictEqual(ffa.victim.relativePosition, -1,
    'outside 2v2 BLUE is just another opponent');


  // --- Abilities never land on your own side -------------------------------
  //
  // Every power in the game is aimed at "not me", and in 2v2 that has to mean
  // "not us". Offsets: GREEN 0, YELLOW 13, BLUE 26, RED 39 — so a colour's own
  // relative r sits on global (offset + r) % 52.

  const charged = (colour) => {
    const state = createGame(4, [], { mode: 'TEAM', teams });
    state.activePlayer = colour;
    state.players[colour].points = 40;
    state.players[colour].abilityReady = true;
    return state;
  };

  // Earth's wall lets a partner walk through it, exactly like the owner.
  // The wall sits on global 30: BLUE's own relative 4, YELLOW's relative 17.
  const walled = charged('GREEN');
  placeWall(walled, { kind: 'RING', globalPos: 30 });
  assert.strictEqual(
    resolveDestination(walled, { player: 'BLUE', relativePosition: 1 }, 5),
    6,
    'a partner is not stopped by the wall'
  );
  assert.strictEqual(
    resolveDestination(walled, { player: 'YELLOW', relativePosition: 14 }, 5),
    16,
    'an opponent still stops short of it'
  );

  // And dropping it on a stop sign does not shove a partner off.
  // Global 34 is a stop sign: BLUE's relative 8, YELLOW's relative 21.
  const shoved = charged('GREEN');
  shoved.pieces.find(p => p.id === 'BLUE_0').relativePosition = 8;
  shoved.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 21;
  placeWall(shoved, { kind: 'RING', globalPos: 34 });
  assert.strictEqual(
    shoved.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    8,
    'a partner holds its ground when the wall lands on it'
  );
  assert.strictEqual(
    shoved.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    22,
    'an opponent is still shoved one step on'
  );

  // Water's spikes do not impale a partner that lands on a shielded token.
  // BLUE's relative 10 is global 36, which GREEN reaches from its relative 34.
  const spikes = charged('BLUE');
  raiseShield(spikes);
  spikes.pieces.find(p => p.id === 'BLUE_0').relativePosition = 10;
  spikes.pieces.find(p => p.id === 'GREEN_0').relativePosition = 34;
  spikes.activePlayer = 'GREEN';
  spikes.turnPhase = 'WAITING_FOR_MOVE';
  spikes.pendingRolls = [2];
  movePiece(spikes, 'GREEN_0', 2);
  assert.strictEqual(
    spikes.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    36,
    'a partner lands on the ice unharmed'
  );
  assert.strictEqual(
    spikes.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    10,
    'and the shielded partner keeps its tile'
  );

  // Fire burns the run it crosses, minus the partner standing in it.
  // RED's relative 0 is global 39; a five crosses globals 40..44. YELLOW's
  // relative 29 is global 42, GREEN's relative 41 is global 41.
  const blaze = charged('RED');
  blaze.pieces.find(p => p.id === 'RED_0').relativePosition = 0;
  blaze.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 29;
  blaze.pieces.find(p => p.id === 'GREEN_0').relativePosition = 41;
  igniteFire(blaze);
  rollDice(blaze, 5);
  movePiece(blaze, 'RED_0', 5);
  assert.strictEqual(
    blaze.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    29,
    'fire does not burn your partner'
  );
  assert.strictEqual(
    blaze.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    -1,
    'it burns the opponent beside them'
  );

  // A side wins only when BOTH partners are home.
  const win = createGame(4, [], { mode: 'TEAM', teams });
  win.players.GREEN.status = 'FINISHED';
  win.players.GREEN.completedPieces = 4;
  win.activePlayer = 'BLUE';
  win.turnPhase = 'WAITING_FOR_MOVE';
  win.pendingRolls = [1];
  const last = win.pieces.find(p => p.id === 'BLUE_0');
  last.relativePosition = 55;
  win.pieces.filter(p => p.player === 'BLUE' && p.id !== 'BLUE_0')
    .forEach(p => { p.relativePosition = 56; });
  win.players.BLUE.completedPieces = 3;

  movePiece(win, 'BLUE_0', 1);
  assert.ok(win.gameOver, 'the game ends when a whole side is home');
  assert.strictEqual(win.winningTeam, 'A', 'and it records which side won');

  console.log('All team rules tests passed!');
}

// --------------------------------------------------------------- authority ---

function authorityDemo() {
  console.log('Running Online Authority Demo...');

  const state = createGame(4);
  assert.strictEqual(state.activePlayer, 'GREEN');

  assert.ok(isActionAllowed(state, { type: 'roll' }, 'GREEN'));
  assert.ok(!isActionAllowed(state, { type: 'roll' }, 'YELLOW'), 'no acting out of turn');
  assert.ok(!isActionAllowed(state, { type: 'move', pieceId: 'GREEN_0', value: 6 }, 'GREEN'),
    'cannot move before rolling');
  assert.ok(isActionAllowed(state, { type: 'roll' }, null),
    'the host as referee is not bound to the turn');
  assert.ok(!isActionAllowed(state, { type: 'give_me_a_six' }, 'GREEN'), 'junk is refused');
  assert.ok(!isActionAllowed(state, { type: 'roll' }, 'PURPLE'));
  assert.ok(!isActionAllowed({ ...state, gameOver: true }, { type: 'roll' }, null));

  console.log('All authority tests passed!');
}

// ------------------------------------------------------------ no divergence ---

function syncDemo() {
  console.log('Running Online Sync Demo...');

  const match = buildMatch(members(3), 'FFA');
  let host = createGame(4, match.bots, { mode: match.mode, teams: match.teams, players: match.players });
  let guestA = JSON.parse(JSON.stringify(host));
  let guestB = JSON.parse(JSON.stringify(host));

  const broadcast = () => {
    const wire = JSON.stringify(host);
    guestA = JSON.parse(wire);
    guestB = JSON.parse(wire);
  };

  const colourOf = id => match.assignments.find(a => a.id === id).colour;

  const submit = (fromId, action) => {
    if (!isActionAllowed(host, action, colourOf(fromId))) return false;
    if (action.type === 'roll') host = rollDice({ ...host });
    else if (action.type === 'move') host = movePiece({ ...host }, action.pieceId, action.value);
    broadcast();
    return true;
  };

  let applied = 0, refused = 0;

  for (let turn = 0; turn < 500 && !host.gameOver; turn++) {
    const owner = match.assignments.find(a => a.colour === host.activePlayer);

    if (!owner) {
      if (host.turnPhase === 'WAITING_FOR_ROLL') host = rollDice({ ...host });
      else if (host.turnPhase === 'WAITING_FOR_MOVE') {
        const moves = getLegalMoves(host);
        if (!moves.length) break;
        host = movePiece({ ...host }, moves[0].id, getMoveValuesForPiece(host, moves[0].id)[0]);
      } else if (host.turnPhase === 'WAITING_FOR_ABILITY') host = skipAbilityWindow({ ...host });
      else break;
      broadcast();
    } else {
      const impostor = match.assignments.find(a => a.id !== owner.id);
      const before = JSON.stringify(host);
      assert.ok(!submit(impostor.id, { type: 'roll' }), 'out-of-turn intent must be refused');
      assert.strictEqual(JSON.stringify(host), before, 'a refused intent must not touch the game');
      refused++;

      if (host.turnPhase === 'WAITING_FOR_ROLL') {
        assert.ok(submit(owner.id, { type: 'roll' })); applied++;
      } else if (host.turnPhase === 'WAITING_FOR_MOVE') {
        const moves = getLegalMoves(host);
        if (!moves.length) break;
        const value = getMoveValuesForPiece(host, moves[0].id)[0];
        assert.ok(submit(owner.id, { type: 'move', pieceId: moves[0].id, value })); applied++;
      } else if (host.turnPhase === 'WAITING_FOR_ABILITY') {
        host = skipAbilityWindow({ ...host }); broadcast();
      } else break;
    }

    assert.strictEqual(JSON.stringify(guestA), JSON.stringify(host), 'guestA drifted');
    assert.strictEqual(JSON.stringify(guestB), JSON.stringify(host), 'guestB drifted');
  }

  assert.ok(applied > 20, 'expected the simulated match to progress');
  assert.ok(refused > 20, 'expected the cheat attempts to run');
  console.log(`  ${applied} intents applied, ${refused} out-of-turn attempts refused`);
  console.log('All sync tests passed!');
}

// ------------------------------------------------------------- formations ---

// Every formation but CROSS pairs colours that sit NEXT to each other, and every
// ally rule in the engine was written and tested against the facing pair alone.
// This drives all four abilities across a partner for an adjacent pairing, which
// is the case the 2v2 suite above never reaches.
function formationsDemo() {
  console.log('Running Team Formation Demo...');

  // --- the shapes are what they claim to be
  assert.strictEqual(teamsFor('NONE'), null, 'Free for All has no teams map');
  Object.keys(FORMATIONS).filter(k => k !== 'NONE').forEach(key => {
    const teams = teamsFor(key);
    assert.strictEqual(Object.keys(teams).length, 4, key + ' must seat all four colours');
    assert.strictEqual(new Set(Object.values(teams)).size, 2, key + ' must have exactly two sides');
    BOARD_ORDER.forEach(colour => assert.ok(teams[colour], key + ' left ' + colour + ' unpaired'));
    const sizes = {};
    Object.values(teams).forEach(t => { sizes[t] = (sizes[t] || 0) + 1; });
    assert.deepStrictEqual(Object.values(sizes), [2, 2], key + ' must be two even pairs');
  });

  assert.ok(teamsFor('CROSS').GREEN === teamsFor('CROSS').BLUE, 'Cross pairs the diagonal');
  assert.ok(teamsFor('FLANKS').GREEN === teamsFor('FLANKS').RED, 'Flanks pairs the left column');
  assert.ok(teamsFor('FRONTS').GREEN === teamsFor('FRONTS').YELLOW, 'Fronts pairs the top row');

  // No two formations describe the same split, or the picker offers a duplicate.
  const shapes = new Set(['CROSS', 'FLANKS', 'FRONTS'].map(k => {
    const t = teamsFor(k);
    // Normalise on GREEN's side so 'A'/'B' labelling cannot make two equal
    // splits look different.
    return BOARD_ORDER.map(c => (t[c] === t.GREEN ? '1' : '0')).join('');
  }));
  assert.strictEqual(shapes.size, 3, 'the three formations must be three different splits');

  // --- every ability, across an adjacent partner
  const at = (state, id) => state.pieces.find(p => p.id === id);
  const table = (formation, active = 'GREEN') => {
    const state = createRawGame(4, [], { mode: 'TEAM', teams: teamsFor(formation) });
    state.activePlayer = active;
    state.turnPhase = 'WAITING_FOR_MOVE';
    state.pendingRolls = [2];
    state.players[active].points = 999;
    state.players[active].abilityReady = true;
    return state;
  };

  // FRONTS makes GREEN and YELLOW partners. Global tile 10 is not a stop sign
  // and both can stand on it: GREEN at rel 10, YELLOW at rel 49, BLUE at rel 36.
  let state = table('FRONTS');
  at(state, 'GREEN_0').relativePosition = 8;
  at(state, 'YELLOW_0').relativePosition = 49;
  movePiece(state, 'GREEN_0', 2);
  assert.strictEqual(at(state, 'YELLOW_0').relativePosition, 49,
    'landing on an adjacent partner must not capture it');

  // Fire burns the tiles it crosses — the partner on one of them is not caught,
  // the opponent sharing that tile is.
  state = table('FRONTS');
  at(state, 'GREEN_0').relativePosition = 8;
  at(state, 'YELLOW_0').relativePosition = 49;
  at(state, 'BLUE_0').relativePosition = 36;
  igniteFire(state);
  state.turnPhase = 'WAITING_FOR_MOVE';
  state.pendingRolls = [2];
  movePiece(state, 'GREEN_0', 2);
  assert.strictEqual(at(state, 'YELLOW_0').relativePosition, 49, 'fire must not burn a partner');
  assert.strictEqual(at(state, 'BLUE_0').relativePosition, -1, 'fire must still burn an opponent');

  // The wall does not stand in a partner's way, and does stand in an opponent's.
  state = table('FRONTS');
  state.wall = { owner: 'GREEN', kind: 'RING', globalPos: 10 };
  const partner = at(state, 'YELLOW_0'); partner.relativePosition = 45;
  const rival = at(state, 'BLUE_0'); rival.relativePosition = 30;
  assert.strictEqual(resolveDestination(state, partner, 6), 51, 'a partner walks through the wall');
  assert.strictEqual(resolveDestination(state, rival, 6), 35, 'an opponent is stopped short of it');

  // Dropping the wall on a stop sign shoves everyone off it except your own side.
  // Global tile 8 is a stop sign: YELLOW reaches it at rel 47, RED at rel 21.
  state = table('FRONTS');
  at(state, 'YELLOW_0').relativePosition = 47;
  at(state, 'RED_0').relativePosition = 21;
  placeWall(state, { kind: 'RING', globalPos: 8 });
  assert.strictEqual(at(state, 'YELLOW_0').relativePosition, 47, 'the shove must spare a partner');
  assert.strictEqual(at(state, 'RED_0').relativePosition, 22, 'the shove must still move an opponent');

  // Ice spikes impale whoever lands on a shielded token — but not the partner
  // who raised it. FLANKS makes GREEN and RED partners; both reach global 39.
  state = table('FLANKS', 'RED');
  raiseShield(state);
  state.activePlayer = 'GREEN';
  state.turnPhase = 'WAITING_FOR_MOVE';
  state.pendingRolls = [2];
  at(state, 'GREEN_0').relativePosition = 37;
  at(state, 'RED_0').relativePosition = 0;   // (39 + 0) % 52 = 39
  movePiece(state, 'GREEN_0', 2);
  assert.strictEqual(at(state, 'GREEN_0').relativePosition, 39,
    'a partner must not be impaled by the ice its own side raised');
  assert.strictEqual(at(state, 'RED_0').relativePosition, 0, 'and the shielded token holds');

  // The gust is nine extra steps, so it captures further down the track — and
  // still not a partner. GREEN at rel 0 + 2 + 9 lands on rel 11.
  state = table('FRONTS');
  state.gust = { owner: 'GREEN' };
  at(state, 'GREEN_0').relativePosition = 0;
  at(state, 'YELLOW_0').relativePosition = 50; // (13 + 50) % 52 = 11
  movePiece(state, 'GREEN_0', 2);
  assert.strictEqual(at(state, 'GREEN_0').relativePosition, 11, 'the gust carries nine extra steps');
  assert.strictEqual(at(state, 'YELLOW_0').relativePosition, 50, 'the gust must not sweep a partner');

  console.log('All team formation tests passed!');
}


seatingDemo();
matchDemo();
teamRulesDemo();
formationsDemo();
authorityDemo();
syncDemo();
