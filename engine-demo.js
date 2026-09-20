const {
  createGame: createRawGame,
  rollDice,
  getLegalMoves,
  getMoveValuesForPiece,
  movePiece,
  placeWall,
  canPlaceWall,
  raiseShield,
  canRaiseShield,
  igniteFire,
  canIgniteFire,
  hasFire,
  summonGust,
  canSummonGust,
  hasGust,
  canUseAbility,
  skipAbilityWindow,
  ABILITY_POINTS_BASE,
  ABILITY_POINTS_AFTER_GOAL
} = require('./engine.js');
const assert = require('assert');

// A colour's bar stays dead until it rolls its first six of the game. Nearly
// every suite below is about what happens once the bar is live, so this helper
// starts them all. The first-six rule itself is tested with createRawGame.
function createGame(numPlayers, bots, options = {}) {
  const state = createRawGame(numPlayers, bots, { ...options, rng: () => 0 });
  Object.keys(state.players).forEach(colour => {
    state.players[colour].chargeStarted = true;
  });
  return state;
}

// GREEN is seat 0 (offset 0) and YELLOW is seat 1 (offset 13), so YELLOW's own
// relative position r sits on global tile (13 + r) % 52.
function chargedGame() {
  const state = createGame(4);
  state.players['GREEN'].points = ABILITY_POINTS_BASE;
  state.players['GREEN'].abilityReady = true;
  return state;
}

function runAbilityTimingDemo() {
  console.log('Running Ability Timing Window Demo...');

  // The window is identical for all four elements, not just Earth.
  ['GREEN', 'YELLOW', 'BLUE', 'RED'].forEach(player => {
    const state = createGame(4);
    state.activePlayer = player;
    const p = state.players[player];

    // Uncharged: no ability, whatever the phase.
    assert.strictEqual(canUseAbility(state, player), false, `${player} locked while uncharged`);

    p.points = ABILITY_POINTS_BASE;
    p.abilityReady = true;

    // Before rolling.
    state.turnPhase = 'WAITING_FOR_ROLL';
    assert.strictEqual(canUseAbility(state, player), true, `${player} may fire before rolling`);

    // After rolling, before moving the token.
    state.turnPhase = 'WAITING_FOR_MOVE';
    assert.strictEqual(canUseAbility(state, player), true, `${player} may fire after rolling`);

    // Never outside their own turn.
    state.turnPhase = 'WAITING_FOR_ROLL';
    state.activePlayer = player === 'GREEN' ? 'RED' : 'GREEN';
    assert.strictEqual(canUseAbility(state, player), false, `${player} cannot fire off-turn`);

    // Never once the game is done.
    state.activePlayer = player;
    state.gameOver = true;
    assert.strictEqual(canUseAbility(state, player), false, `${player} cannot fire after game over`);
  });

  // Firing never eats the dice roll: the phase is untouched by placing a wall.
  let state = chargedGame();
  state.turnPhase = 'WAITING_FOR_MOVE';
  state.diceValue = 4;
  state.pendingRolls = [4];
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 0;
  state = placeWall(state, { kind: 'RING', globalPos: 30 });
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_MOVE', 'Still owes a token move after firing');
  assert.strictEqual(state.diceValue, 4, 'The rolled value survives firing the power');

  // A bar that fills on THIS roll must still get its window, even when the roll
  // leaves nothing to play. Previously the turn passed instantly and the charge
  // sat unused for a whole lap.
  state = createGame(4);
  state.players['GREEN'].points = 38;
  state = rollDice(state, 5); // 38 -> capped at 40, but nothing is deployable
  assert.strictEqual(state.players['GREEN'].abilityReady, true, 'The bar filled on this roll');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ABILITY', 'Turn held open for it');
  assert.strictEqual(state.activePlayer, 'GREEN', 'Still GREEN');
  assert.strictEqual(canUseAbility(state, 'GREEN'), true, 'And the power is usable');

  // Using it in that window then ends the turn.
  state = placeWall(state, { kind: 'RING', globalPos: 20 });
  assert.ok(state.wall, 'Wall went up inside the window');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Turn ended after spending it');

  // Declining ends the turn with the charge intact.
  state = createGame(4);
  state.players['GREEN'].points = 38;
  state = rollDice(state, 5);
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ABILITY', 'Window opened');
  state = skipAbilityWindow(state);
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Turn ended');
  assert.strictEqual(state.players['GREEN'].abilityReady, true, 'Charge kept');

  // No charge, no window — the turn passes as it always did.
  state = createGame(4);
  state.players['GREEN'].points = 10;
  state = rollDice(state, 5);
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Uncharged turns still pass straight on');

  // Bots never get the window, or they would hang waiting on a button press.
  state = createGame(4, ['GREEN']);
  state.players['GREEN'].points = ABILITY_POINTS_BASE;
  state.players['GREEN'].abilityReady = true;
  state = rollDice(state, 5);
  assert.strictEqual(state.activePlayer, 'YELLOW', 'A bot just passes');

  console.log('All ability timing tests passed!');
}

// BLUE sits at offset 26, RED at 39, GREEN at 0.
function shieldedGame() {
  const state = createGame(4);
  state.activePlayer = 'BLUE';
  state.players['BLUE'].points = ABILITY_POINTS_BASE;
  state.players['BLUE'].abilityReady = true;
  return raiseShield(state);
}

function runShieldDemo() {
  console.log('Running Water Ice Shield Demo...');

  // Instant, untargeted, costs the charge, keeps the dice roll.
  let state = shieldedGame();
  assert.strictEqual(state.shield.owner, 'BLUE', 'BLUE is sheathed');
  assert.strictEqual(state.players['BLUE'].points, 0, 'Charge spent');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'Still free to roll');

  let earth = createGame(4);
  earth.players['GREEN'].points = ABILITY_POINTS_BASE;
  earth.players['GREEN'].abilityReady = true;
  assert.strictEqual(canRaiseShield(earth, 'GREEN'), false, 'Only Water has the shield');

  // The tide also pulls one token back out of the base, onto BLUE's start.
  state = shieldedGame(); // every BLUE token starts stranded in the base
  const revived = state.pieces.filter(p => p.player === 'BLUE' && p.relativePosition === 0);
  assert.strictEqual(revived.length, 1, 'Exactly one token is revived');
  assert.strictEqual(
    state.pieces.filter(p => p.player === 'BLUE' && p.relativePosition === -1).length,
    3,
    'The other three stay in the base'
  );

  // The revived token is covered by the shield like the rest.
  state.activePlayer = 'RED';
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 39; // global 26 == BLUE start
  assert.strictEqual(
    state.pieces.find(p => p.id === revived[0].id).relativePosition,
    0,
    'Revived token is on the start tile'
  );

  // With nothing in the base the shield still goes up, reviving nobody.
  state = createGame(4);
  state.activePlayer = 'BLUE';
  state.players['BLUE'].points = ABILITY_POINTS_BASE;
  state.players['BLUE'].abilityReady = true;
  state.pieces.forEach(p => {
    if (p.player === 'BLUE') p.relativePosition = 10;
  });
  state = raiseShield(state);
  assert.ok(state.shield, 'Shield still goes up on an empty base');
  assert.strictEqual(
    state.pieces.filter(p => p.player === 'BLUE' && p.relativePosition === 10).length,
    4,
    'Nothing was moved when there was nobody to revive'
  );

  // Landing exactly on a shielded token impales the attacker.
  // BLUE_0 at relative 0 == global 26. RED is at offset 39, so RED reaches
  // global 26 at its own relative 39.
  state = shieldedGame();
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 0;
  state.activePlayer = 'RED';
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 36;
  state = rollDice(state, 3);
  state = movePiece(state, 'RED_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'RED_0').relativePosition,
    -1,
    'The attacker is sent back to base by the spikes'
  );
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    0,
    'The shielded token holds its ground'
  );

  // Enemies are NOT blocked — enough pips and they walk right past.
  state = shieldedGame();
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 0; // global 26
  state.activePlayer = 'RED';
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 36;
  state = rollDice(state, 5); // past global 26, landing on RED relative 41
  state = movePiece(state, 'RED_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'RED_0').relativePosition,
    41,
    'A big enough roll sails straight past the shield'
  );
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    0,
    'Passing leaves the shielded token untouched'
  );

  // Spikes bite on safe tiles too.
  // Global 34 is a safe tile; BLUE reaches it at its own relative 8.
  state = shieldedGame();
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 8;
  state.activePlayer = 'RED';
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 43; // global 30
  state = rollDice(state, 4); // -> RED relative 47 == global 34
  state = movePiece(state, 'RED_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'RED_0').relativePosition,
    -1,
    'A safe tile does not blunt the spikes'
  );

  // The owner is immune to its own spikes — BLUE stacks on BLUE freely.
  state = shieldedGame();
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 5;
  state.pieces.find(p => p.id === 'BLUE_1').relativePosition = 2;
  state = rollDice(state, 3);
  state = movePiece(state, 'BLUE_1');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_1').relativePosition,
    5,
    'BLUE stacks onto its own shielded token'
  );
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    5,
    'And the shielded token it landed on is unharmed'
  );

  // A shielded player still captures normally — the shield is defence only.
  state = shieldedGame();
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 4; // global 43
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 14; // global 40
  state = rollDice(state, 3); // BLUE -> relative 17 == global 43
  state = movePiece(state, 'BLUE_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'RED_0').relativePosition,
    -1,
    'BLUE still captures while shielded'
  );

  // Extra rolls from a six do not burn the duration; a full lap does.
  state = shieldedGame();
  state = rollDice(state, 6); // banked — the six hands the dice straight back
  assert.strictEqual(state.activePlayer, 'BLUE', 'Still BLUE after a six');
  assert.ok(state.shield, 'A six does not count as a table turn');

  // Roll the 2, then spend both banked values to finish the turn.
  state = rollDice(state, 2);
  state = movePiece(state, 'BLUE_0', 6);
  state = movePiece(state, 'BLUE_0', 2);
  assert.strictEqual(state.activePlayer, 'RED', 'Turn finally passes');
  assert.ok(state.shield, 'Shield survives RED');
  state = rollDice(state, 3);
  assert.strictEqual(state.activePlayer, 'GREEN');
  assert.ok(state.shield, 'Shield survives GREEN');
  state = rollDice(state, 3);
  assert.strictEqual(state.activePlayer, 'YELLOW');
  assert.ok(state.shield, 'Shield survives YELLOW');
  state = rollDice(state, 3);
  assert.strictEqual(state.activePlayer, 'BLUE', 'Back around to the owner');
  assert.strictEqual(state.shield, null, 'Shield melts when its owner plays again');

  console.log('All ice shield tests passed!');
}

function firedGame() {
  const state = createGame(4);
  state.activePlayer = 'RED';
  state.players['RED'].points = ABILITY_POINTS_BASE;
  state.players['RED'].abilityReady = true;
  return state;
}

// RED sits at offset 39, so its relative r is global (39 + r) % 52.
// GREEN sits at offset 0, so its relative r IS global r.
function runFireDemo() {
  console.log('Running Fire Blaze Demo...');

  let earth = createGame(4);
  earth.players['GREEN'].points = ABILITY_POINTS_BASE;
  earth.players['GREEN'].abilityReady = true;
  assert.strictEqual(canIgniteFire(earth, 'GREEN'), false, 'Only Fire may ignite');

  // Armable before the roll, with the dice still to throw...
  let state = firedGame();
  assert.strictEqual(canIgniteFire(state, 'RED'), true, 'Offered before the roll');
  state = igniteFire(state);
  assert.ok(hasFire(state, 'RED'), 'The blaze is armed');
  assert.strictEqual(state.players['RED'].points, 0, 'Arming emptied the bar');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'Still free to roll');

  // ...and after it, with the roll already on the table.
  state = firedGame();
  state = rollDice(state, 3);
  assert.strictEqual(canIgniteFire(state, 'RED'), true, 'And offered after the roll');

  state = firedGame();
  state = rollDice(state, 6); // banked, and the dice comes straight back
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'A six re-opens the roll');
  assert.strictEqual(canIgniteFire(state, 'RED'), true, 'Still offered with a six banked');

  // The cost is that it rides ONE move, not the turn. Three values banked, two
  // tokens with an enemy on each run: only the run actually spent it burns.
  // RED rel 0 is global 39, so a five crosses 40..44 (GREEN's own 41 is in it).
  // RED rel 10 is global 49, so a six crosses 50, 51, 0, 1, 2, 3 (GREEN's 2).
  state = firedGame();
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 0;
  state.pieces.find(p => p.id === 'RED_1').relativePosition = 10;
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 41;
  state.pieces.find(p => p.id === 'GREEN_1').relativePosition = 2;
  state = rollDice(state, 6);
  state = rollDice(state, 6);
  state = rollDice(state, 5);
  assert.deepStrictEqual(state.pendingRolls, [6, 6, 5], 'Three values on the table');
  state = igniteFire(state); // armed with all three already known
  state = movePiece(state, 'RED_0', 5);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    -1,
    'The move it was spent on burns'
  );
  assert.strictEqual(state.fire, null, 'And that spends the blaze');
  state = movePiece(state, 'RED_1', 6);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_1').relativePosition,
    2,
    'The rest of the turn walks its paths cold'
  );

  // The move burns every enemy on the tiles crossed, landing tile included.
  // RED rel 0 -> 5 crosses globals 40..44.
  state = firedGame();
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 0;
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 41; // crossed
  state.pieces.find(p => p.id === 'GREEN_1').relativePosition = 44; // landing tile
  state.pieces.find(p => p.id === 'GREEN_2').relativePosition = 45; // one past
  state.pieces.find(p => p.id === 'GREEN_3').relativePosition = 39; // behind the start
  state = igniteFire(state);
  state = rollDice(state, 5);
  state = movePiece(state, 'RED_0', 5);
  assert.strictEqual(state.pieces.find(p => p.id === 'GREEN_0').relativePosition, -1, 'Burned in passing');
  assert.strictEqual(state.pieces.find(p => p.id === 'GREEN_1').relativePosition, -1, 'Landing tile burns too');
  assert.strictEqual(state.pieces.find(p => p.id === 'GREEN_2').relativePosition, 45, 'Beyond the run is safe');
  assert.strictEqual(state.pieces.find(p => p.id === 'GREEN_3').relativePosition, 39, 'And so is behind it');
  assert.strictEqual(state.pieces.find(p => p.id === 'RED_0').relativePosition, 5, 'The blaze adds no distance');
  assert.strictEqual(state.fire, null, 'The move spent the blaze');
  assert.strictEqual(state.activePlayer, 'RED', 'A catch earns the extra roll');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'Taken straight away');

  // Stop signs shelter their occupants. Global 47 is one, and RED crosses it
  // at its own relative 8.
  state = firedGame();
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 4;
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 47; // safe tile
  state.pieces.find(p => p.id === 'GREEN_1').relativePosition = 46; // not
  state = igniteFire(state);
  state = rollDice(state, 5);
  state = movePiece(state, 'RED_0', 5);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    47,
    'An enemy on a stop sign rides it out'
  );
  assert.strictEqual(state.pieces.find(p => p.id === 'GREEN_1').relativePosition, -1, 'Its neighbour does not');

  // Water's ice does not burn. BLUE sits at offset 26, so its relative 15 is
  // global 41.
  state = createGame(4);
  state.activePlayer = 'BLUE';
  state.players['BLUE'].points = ABILITY_POINTS_BASE;
  state.players['BLUE'].abilityReady = true;
  state = raiseShield(state);
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 15; // global 41
  state.activePlayer = 'RED';
  state.players['RED'].points = ABILITY_POINTS_BASE;
  state.players['RED'].abilityReady = true;
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 0;
  state = igniteFire(state);
  state = rollDice(state, 5);
  state = movePiece(state, 'RED_0', 5);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    15,
    'A shielded token stands in the flames unharmed'
  );

  // In 2v2 a partner is never caught.
  state = createGame(4, [], {
    mode: 'TEAM',
    teams: { RED: 'A', BLUE: 'A', GREEN: 'B', YELLOW: 'B' }
  });
  Object.keys(state.players).forEach(colour => { state.players[colour].chargeStarted = true; });
  state.activePlayer = 'RED';
  state.players['RED'].points = ABILITY_POINTS_BASE;
  state.players['RED'].abilityReady = true;
  state.pieces.find(p => p.id === 'RED_0').relativePosition = 0;
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 15; // global 41, ally
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 42; // global 42, enemy
  state = igniteFire(state);
  state = rollDice(state, 5);
  state = movePiece(state, 'RED_0', 5);
  assert.strictEqual(state.pieces.find(p => p.id === 'BLUE_0').relativePosition, 15, 'A partner does not burn');
  assert.strictEqual(state.pieces.find(p => p.id === 'GREEN_0').relativePosition, -1, 'The enemy between them does');

  // Coming out of the yard crosses nothing, so there is nothing to catch — but
  // the blaze is still spent by the move, exactly like the gust.
  state = firedGame();
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 39; // RED's own start tile
  state = igniteFire(state);
  state = rollDice(state, 6);
  state = rollDice(state, 1);
  state = movePiece(state, 'RED_0', 6);
  assert.strictEqual(state.pieces.find(p => p.id === 'RED_0').relativePosition, 0, 'Deployed');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    39,
    'A stop sign shelters it from the deploy, blaze or no blaze'
  );
  assert.strictEqual(state.fire, null, 'And the blaze went with the move');

  // A turn with nothing to play must not waste it.
  state = firedGame();
  state = igniteFire(state);
  state = rollDice(state, 3); // every token still in the yard -> turn passes
  assert.strictEqual(state.activePlayer, 'GREEN', 'Turn passed without a move');
  assert.ok(hasFire(state, 'RED'), 'The blaze keeps until a move actually happens');

  // A charged RED gets the same post-roll window as everyone else now that it
  // has something to press there — the roll below leaves nothing playable.
  state = firedGame();
  state = rollDice(state, 3);
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ABILITY', 'Turn held open for the blaze');
  assert.strictEqual(state.activePlayer, 'RED', 'Still RED');
  assert.strictEqual(canIgniteFire(state, 'RED'), true, 'And it can be armed from there');
  state = igniteFire(state);
  assert.ok(hasFire(state, 'RED'), 'Armed inside the window');
  assert.strictEqual(state.activePlayer, 'GREEN', 'Which then closes the turn');

  console.log('All fire blaze tests passed!');
}

// YELLOW sits at offset 13, so its relative r is global (13 + r) % 52.
function chargedAirGame() {
  const state = createGame(4);
  state.activePlayer = 'YELLOW';
  state.players['YELLOW'].points = ABILITY_POINTS_BASE;
  state.players['YELLOW'].abilityReady = true;
  return state;
}

function runGustDemo() {
  console.log('Running Air Gust Demo...');

  // Armable before the dice is even known.
  let state = chargedAirGame();
  assert.strictEqual(canSummonGust(state, 'YELLOW'), true, 'Offered before the roll');
  state = summonGust(state);
  assert.ok(hasGust(state, 'YELLOW'), 'Armed');
  assert.strictEqual(state.players['YELLOW'].points, 0, 'Arming emptied the bar');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'Still free to roll');

  let water = createGame(4);
  water.activePlayer = 'BLUE';
  water.players['BLUE'].points = ABILITY_POINTS_BASE;
  water.players['BLUE'].abilityReady = true;
  assert.strictEqual(canSummonGust(water, 'BLUE'), false, 'Only Air has the gust');

  // ...and after the roll too, which is the half Fire does not get.
  state = chargedAirGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 2;
  state = rollDice(state, 3);
  assert.strictEqual(canSummonGust(state, 'YELLOW'), true, 'Offered with the roll in hand');
  state = summonGust(state);
  state = movePiece(state, 'YELLOW_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    14,
    'A three carries twelve steps'
  );
  assert.strictEqual(state.gust, null, 'The move cleared the gust');

  // ...and a six carries fifteen.
  state = chargedAirGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 2;
  state = summonGust(state);
  state = rollDice(state, 6);
  state = rollDice(state, 1); // settles the turn; the 6 is still banked
  state = movePiece(state, 'YELLOW_0', 6);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    17,
    'A six carries fifteen steps'
  );

  // The wind will not carry a token out of the yard.
  state = chargedAirGame();
  state = summonGust(state);
  state = rollDice(state, 6);
  assert.strictEqual(getLegalMoves(state).length, 0, 'A six deploys nothing while the gust is up');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'The six still hands the dice back');
  state = rollDice(state, 2);
  assert.strictEqual(state.activePlayer, 'BLUE', 'And with nothing playable the turn passes');
  assert.ok(hasGust(state, 'YELLOW'), 'The gust keeps until a move actually happens');

  // Which is why arming after the roll is refused when it would take the last
  // move off the table — otherwise pressing the button would end the turn.
  state = chargedAirGame();
  state = rollDice(state, 6);
  state = rollDice(state, 2);
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_MOVE', 'The six is playable as a deploy');
  assert.strictEqual(
    canSummonGust(state, 'YELLOW'),
    false,
    'So the gust is refused: it would leave nothing to play'
  );

  // With one token already running there is something for it to carry.
  state = chargedAirGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 4;
  state = rollDice(state, 6);
  state = rollDice(state, 2);
  assert.strictEqual(canSummonGust(state, 'YELLOW'), true, 'Offered again');
  state = summonGust(state);
  state = movePiece(state, 'YELLOW_0', 2);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    15,
    'Four plus eleven'
  );

  // It captures normally where it lands, and touches nothing on the way.
  // YELLOW rel 2 + 15 = rel 17 == global 30. GREEN reaches global 30 at rel 30.
  state = chargedAirGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 2;
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 30; // landing tile
  state.pieces.find(p => p.id === 'GREEN_1').relativePosition = 25; // merely passed
  state = summonGust(state);
  state = rollDice(state, 6);
  state = rollDice(state, 1);
  state = movePiece(state, 'YELLOW_0', 6);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    -1,
    'Captures where it lands, like any other move'
  );
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_1').relativePosition,
    25,
    'And blows nothing off the tiles it crossed'
  );

  // Nine extra steps can overshoot the goal, which is a real cost near home.
  state = chargedAirGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 50;
  state = rollDice(state, 4);
  assert.strictEqual(
    canSummonGust(state, 'YELLOW'),
    false,
    'A token four off the goal cannot be carried thirteen'
  );

  console.log('All air gust tests passed!');
}

function runWallDemo() {
  console.log('Running Earth Wall Demo...');

  // The wall costs the charge, and firing it does not consume the dice roll.
  let state = chargedGame();
  assert.strictEqual(canPlaceWall(state, 'GREEN'), true, 'Charged GREEN may place before rolling');
  assert.strictEqual(canPlaceWall(state, 'YELLOW'), false, 'Only the active player may place');
  state = placeWall(state, { kind: 'RING', globalPos: 18 });
  assert.strictEqual(state.wall.globalPos, 18, 'Wall stands on global tile 18');
  assert.strictEqual(state.wall.owner, 'GREEN', 'GREEN owns the wall');
  assert.strictEqual(state.players['GREEN'].points, 0, 'Charge was spent');
  assert.strictEqual(state.players['GREEN'].abilityReady, false, 'Bar reset after use');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'Still free to roll this turn');

  // Only Earth has a wall for now.
  let other = createGame(4);
  other.activePlayer = 'RED';
  other.players['RED'].points = ABILITY_POINTS_BASE;
  other.players['RED'].abilityReady = true;
  assert.strictEqual(canPlaceWall(other, 'RED'), false, 'Fire has no wall ability yet');

  // A piece is clamped to the tile one short of the wall, no matter the roll.
  // Wall on global 18 == YELLOW relative 5, so YELLOW may reach relative 4.
  state = chargedGame();
  state = placeWall(state, { kind: 'RING', globalPos: 18 });
  state.activePlayer = 'YELLOW';
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 0;
  state = rollDice(state, 6);
  state = rollDice(state, 1); // settles the turn; the banked 6 is still owed
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_MOVE', 'YELLOW has a move');
  state = movePiece(state, 'YELLOW_0', 6);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    4,
    'A 6 from relative 0 stops at 4, one short of the wall'
  );

  // Sitting right behind the wall, no roll frees the piece.
  state = chargedGame();
  state = placeWall(state, { kind: 'RING', globalPos: 18 });
  state.activePlayer = 'YELLOW';
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 4;
  [1, 2, 3, 4, 5, 6].forEach(roll => {
    const probe = JSON.parse(JSON.stringify(state));
    probe.pendingRolls = [roll];
    const moves = getLegalMoves(probe).map(p => p.id);
    assert.ok(!moves.includes('YELLOW_0'), `Roll ${roll} cannot carry YELLOW_0 past the wall`);
  });

  // The owner walks straight through their own wall.
  state = chargedGame();
  state = placeWall(state, { kind: 'RING', globalPos: 3 });
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 0;
  state = rollDice(state, 5);
  state = movePiece(state, 'GREEN_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_0').relativePosition,
    5,
    'GREEN passes its own wall untouched'
  );

  // A wall on the entry tile keeps pieces locked in the yard.
  state = chargedGame();
  state = placeWall(state, { kind: 'RING', globalPos: 13 }); // YELLOW's entry
  state.activePlayer = 'YELLOW';
  state.pendingRolls = [6];
  assert.strictEqual(getLegalMoves(state).length, 0, 'YELLOW cannot deploy onto a walled entry');

  // Walls may stand on safe tiles — and doing so shoves everyone sheltering
  // there one step along their own path. GREEN's own tokens hold their ground.
  // Global 8 is a stop sign: GREEN reaches it at relative 8, YELLOW at 47,
  // BLUE at 34, RED at 21.
  state = chargedGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 47;
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 34;
  state.pieces.find(p => p.id === 'GREEN_1').relativePosition = 8;
  state = placeWall(state, { kind: 'RING', globalPos: 8 });
  assert.ok(state.wall, 'Safe tiles are valid wall ground');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    48,
    'YELLOW was shoved off the stop sign'
  );
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_0').relativePosition,
    35,
    'BLUE was shoved too'
  );
  assert.strictEqual(
    state.pieces.find(p => p.id === 'GREEN_1').relativePosition,
    8,
    "The wall owner's own token holds its ground"
  );

  // The shove carries them past the very wall that displaced them.
  state.activePlayer = 'YELLOW';
  state.turnPhase = 'WAITING_FOR_ROLL';
  state = rollDice(state, 3);
  state = movePiece(state, 'YELLOW_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    51,
    'Being shoved through means the wall no longer holds them'
  );

  // A shielded token does not budge from a stop sign either.
  state = createGame(4);
  state.activePlayer = 'BLUE';
  state.players['BLUE'].points = ABILITY_POINTS_BASE;
  state.players['BLUE'].abilityReady = true;
  state = raiseShield(state);
  state.pieces.find(p => p.id === 'BLUE_1').relativePosition = 34; // global 8, a stop sign
  state.activePlayer = 'GREEN';
  state.players['GREEN'].points = ABILITY_POINTS_BASE;
  state.players['GREEN'].abilityReady = true;
  state = placeWall(state, { kind: 'RING', globalPos: 8 });
  assert.strictEqual(
    state.pieces.find(p => p.id === 'BLUE_1').relativePosition,
    34,
    'Ice holds its stop sign against the wall'
  );

  // An ordinary tile shoves nobody.
  state = chargedGame();
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 46; // global 7
  state = placeWall(state, { kind: 'RING', globalPos: 7 });
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    46,
    'No shove on a plain tile'
  );

  // Locking a rival out of their own run-in: BLUE sits at 24 and GREEN walls
  // BLUE's H1, so BLUE can crawl to 50 and no further.
  state = chargedGame();
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 24;
  state = placeWall(state, { kind: 'HOME', player: 'BLUE', index: 0 }); // relative 51
  state.activePlayer = 'BLUE';
  state.turnPhase = 'WAITING_FOR_ROLL';
  state.pieces.find(p => p.id === 'BLUE_0').relativePosition = 50;
  [1, 2, 3, 4, 5, 6].forEach(roll => {
    const probe = JSON.parse(JSON.stringify(state));
    probe.pendingRolls = [roll];
    const moves = getLegalMoves(probe).map(p => p.id);
    assert.ok(!moves.includes('BLUE_0'), `BLUE cannot enter its own home lane on a ${roll}`);
  });

  // A wall in a home stretch blocks only that player's run-in.
  state = chargedGame();
  state = placeWall(state, { kind: 'HOME', player: 'YELLOW', index: 2 }); // relative 53
  state.activePlayer = 'YELLOW';
  state.pieces.find(p => p.id === 'YELLOW_0').relativePosition = 51;
  state = rollDice(state, 4);
  state = movePiece(state, 'YELLOW_0');
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    52,
    'YELLOW stops one short of the wall inside its own home stretch'
  );

  // The wall lasts exactly one lap: gone when GREEN's turn comes back.
  state = chargedGame();
  state = placeWall(state, { kind: 'RING', globalPos: 20 });
  assert.ok(state.wall, 'Wall is up during GREEN turn');
  state = rollDice(state, 3); // nothing deployable -> turn passes to YELLOW
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Turn moved on');
  assert.ok(state.wall, 'Wall survives YELLOW');
  state = rollDice(state, 3);
  assert.strictEqual(state.activePlayer, 'BLUE');
  assert.ok(state.wall, 'Wall survives BLUE');
  state = rollDice(state, 3);
  assert.strictEqual(state.activePlayer, 'RED');
  assert.ok(state.wall, 'Wall survives RED');
  state = rollDice(state, 3);
  assert.strictEqual(state.activePlayer, 'GREEN', 'Back around to the owner');
  assert.strictEqual(state.wall, null, 'Wall crumbles when its owner plays again');

  console.log('All wall tests passed!');
}

function runAbilityDemo() {
  console.log('Running Elemental Ability Charge Demo...');
  let state = createGame(2); // GREEN and YELLOW

  // Fresh players start uncharged and need the full base cost.
  assert.strictEqual(state.players['GREEN'].points, 0, 'GREEN starts at 0 points');
  assert.strictEqual(state.players['GREEN'].abilityThreshold, ABILITY_POINTS_BASE, 'Base cost is 40');
  assert.strictEqual(state.players['GREEN'].abilityReady, false, 'Ability starts locked');

  // A roll that produces no legal move still banks its pips, and the points
  // survive the turn passing around the table.
  state = rollDice(state, 4);
  assert.strictEqual(state.players['GREEN'].points, 4, 'GREEN banks 4 pips');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Turn passed to YELLOW');

  state = rollDice(state, 3);
  assert.strictEqual(state.players['YELLOW'].points, 3, 'YELLOW banks its own 3 pips');
  assert.strictEqual(state.players['GREEN'].points, 4, 'GREEN keeps its points after the turn passed');

  // Three sixes forfeits the turn, and the voided third six banks nothing:
  // the most a player can bank in one turn is 6 + 6 + 5 = 17.
  state = createGame(2);
  state = rollDice(state, 6);
  state = movePiece(state, 'GREEN_0');
  state = rollDice(state, 6);
  state = movePiece(state, 'GREEN_0');
  assert.strictEqual(state.players['GREEN'].points, 12, 'Two sixes bank 12');
  state = rollDice(state, 6);
  assert.strictEqual(state.players['GREEN'].points, 12, 'Third six banks nothing');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Third six forfeits the turn');

  // Below the base cost the ability stays locked...
  state = createGame(2);
  state.players['GREEN'].points = 35;
  state = rollDice(state, 1); // 36 total, no legal move -> turn passes
  assert.strictEqual(state.players['GREEN'].points, 36, 'GREEN sits at 36 points');
  assert.strictEqual(state.players['GREEN'].abilityReady, false, '36 < 40 so still locked');

  // ...until a token is goaled, which lowers this player's cost to 30 and
  // unlocks the ability immediately with the points already banked.
  state.activePlayer = 'GREEN';
  state.turnPhase = 'WAITING_FOR_ROLL';
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 55;
  state = rollDice(state, 1);
  state = movePiece(state, 'GREEN_0');
  assert.strictEqual(state.players['GREEN'].completedPieces, 1, 'GREEN goaled a token');
  assert.strictEqual(state.players['GREEN'].abilityThreshold, ABILITY_POINTS_AFTER_GOAL, 'Cost drops to 30');
  assert.strictEqual(state.players['GREEN'].abilityReady, true, 'Ability unlocks at the lower cost');
  assert.strictEqual(state.players['YELLOW'].abilityThreshold, ABILITY_POINTS_BASE, 'YELLOW still pays 40');

  // A full bar stops dead: it holds on the threshold and banks nothing more
  // until the power is actually spent.
  state = createGame(4);
  state.players['GREEN'].points = 38;
  state = rollDice(state, 6);
  state = movePiece(state, 'GREEN_0');
  assert.strictEqual(state.players['GREEN'].points, ABILITY_POINTS_BASE, 'Bar tops out at 40');
  assert.strictEqual(state.players['GREEN'].abilityReady, true, 'And is ready');
  state = rollDice(state, 5);
  assert.strictEqual(state.players['GREEN'].points, ABILITY_POINTS_BASE, 'Further rolls bank nothing');

  // Spending it drops the bar to zero, not to the overflow.
  state = createGame(4);
  state.players['GREEN'].points = ABILITY_POINTS_BASE;
  state.players['GREEN'].abilityReady = true;
  state = rollDice(state, 6); // would have overflowed to 46 under the old rule
  assert.strictEqual(state.players['GREEN'].points, ABILITY_POINTS_BASE, 'Still pinned at 40');
  state = placeWall(state, { kind: 'RING', globalPos: 10 });
  assert.strictEqual(state.players['GREEN'].points, 0, 'Spending empties the bar to zero');
  assert.strictEqual(state.players['GREEN'].abilityReady, false, 'And it must recharge from scratch');

  // Dropping to the level-2 threshold pins a fuller bar down to the new cap.
  state = createGame(4);
  state.players['GREEN'].points = 38;
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 55;
  state = rollDice(state, 1);
  state = movePiece(state, 'GREEN_0'); // goals a token -> threshold 40 becomes 30
  assert.strictEqual(state.players['GREEN'].abilityThreshold, ABILITY_POINTS_AFTER_GOAL, 'Now level 2');
  assert.strictEqual(state.players['GREEN'].points, ABILITY_POINTS_AFTER_GOAL, 'Bar pinned to the new cap');
  assert.strictEqual(state.players['GREEN'].abilityReady, true, 'And it is ready');

  // Points bank immediately from the first roll of the game.
  const backToGreen = (s) => {
    s.activePlayer = 'GREEN';
    s.turnPhase = 'WAITING_FOR_ROLL';
    return s;
  };

  state = createRawGame(4, [], { rng: () => 0 });
  state = rollDice(state, 4);
  assert.strictEqual(state.players['GREEN'].points, 4, 'A four on the first roll banks 4 pips');

  state = rollDice(backToGreen(state), 6);
  assert.strictEqual(state.players['GREEN'].points, 10, 'A six adds 6 to the banked total');

  // Everything after it counts too.
  state = movePiece(state, 'GREEN_0'); // deploys; the six grants another roll
  state = rollDice(state, 4);
  assert.strictEqual(state.players['GREEN'].points, 14, 'The roll after deploys counts as well');

  console.log('All ability charge tests passed!');
}

function runDemo() {
  console.log('Running Ludo Engine Demo...');
  // Seats 0 and 1 of PLAYERS, so this is GREEN (offset 0) and YELLOW (offset 13).
  let state = createGame(2);

  // --- A non-six with every token still in the yard leaves nothing to play ---
  state = rollDice(state, 4);
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'Nothing was playable');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'So the turn passed on');
  assert.deepStrictEqual(state.pendingRolls, [], 'and the unusable 4 died with it');

  // --- A six banks itself and hands the dice straight back ---
  state = rollDice(state, 6);
  assert.strictEqual(state.activePlayer, 'YELLOW', 'A six keeps the turn');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'and forces another roll');
  assert.deepStrictEqual(state.pendingRolls, [6], 'with the six held in the bank');
  assert.strictEqual(state.consecutiveSixes, 1, 'Consecutive sixes should be 1');
  // The six is playable in principle — all four yard tokens could deploy with
  // it — but the phase is what refuses the move until another number lands.
  const blocked = movePiece(JSON.parse(JSON.stringify(state)), 'YELLOW_0', 6);
  assert.strictEqual(
    blocked.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    -1,
    'No token may move while the dice is still owed a roll'
  );

  // --- The next roll settles the turn, leaving both values spendable ---
  state = rollDice(state, 3);
  assert.deepStrictEqual(state.pendingRolls, [6, 3], 'Both values are now owed');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_MOVE', 'YELLOW may finally move');

  // A token in the yard can only be deployed by the six, so that is the only
  // choice offered for it — this is what the on-token prompt lists.
  assert.deepStrictEqual(
    getMoveValuesForPiece(state, 'YELLOW_0'),
    [6],
    'A yard token is offered only the six'
  );

  state = movePiece(state, 'YELLOW_0', 6);
  assert.strictEqual(state.pieces.find(p => p.id === 'YELLOW_0').relativePosition, 0, 'Deployed');
  assert.deepStrictEqual(state.pendingRolls, [3], 'The 3 is still owed');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Turn continues until the bank is empty');

  // Now on the board, that same token can spend the 3.
  assert.deepStrictEqual(getMoveValuesForPiece(state, 'YELLOW_0'), [3]);
  state = movePiece(state, 'YELLOW_0', 3);
  assert.strictEqual(state.pieces.find(p => p.id === 'YELLOW_0').relativePosition, 3);
  assert.deepStrictEqual(state.pendingRolls, [], 'Bank emptied');
  assert.strictEqual(state.activePlayer, 'GREEN', 'and the turn passes');

  // --- A capture buys an immediate extra roll ---
  // YELLOW_0 sits at its relative 3 == global 16. GREEN reaches global 16 from
  // its own relative 15 with a 1. Global 16 is not a stop sign.
  state.pieces.find(p => p.id === 'GREEN_0').relativePosition = 15;
  state = rollDice(state, 1);
  state = movePiece(state, 'GREEN_0', 1);
  assert.strictEqual(
    state.pieces.find(p => p.id === 'YELLOW_0').relativePosition,
    -1,
    'YELLOW_0 was captured and sent back to the yard'
  );
  assert.strictEqual(state.activePlayer, 'GREEN', 'GREEN keeps the turn after a capture');
  assert.strictEqual(state.turnPhase, 'WAITING_FOR_ROLL', 'and takes the extra roll straight away');

  // --- Three sixes in a row burn the whole turn, banked sixes included ---
  state = rollDice(state, 6);
  assert.strictEqual(state.consecutiveSixes, 1);
  state = rollDice(state, 6);
  assert.strictEqual(state.consecutiveSixes, 2);
  assert.deepStrictEqual(state.pendingRolls, [6, 6], 'Two sixes banked and unspent');

  // The first two sixes bank their pips as normal; only the third scores
  // nothing, so the comparison has to start from here.
  const pointsBeforeBurn = state.players['GREEN'].points;
  state = rollDice(state, 6);
  assert.strictEqual(state.consecutiveSixes, 0, 'Should reset to 0 upon passing turn');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'Turn passes to YELLOW on 3rd 6');
  assert.deepStrictEqual(state.pendingRolls, [], 'The banked sixes burn with it');
  assert.strictEqual(state.burnedBy, 'GREEN', 'and the burn is reported for the UI');
  assert.strictEqual(
    state.players['GREEN'].points,
    pointsBeforeBurn,
    'The third six banks no points'
  );

  // --- Goaling a token also buys an extra roll ---
  state.pieces.find(p => p.id === 'YELLOW_1').relativePosition = 55;
  state = rollDice(state, 1);
  state = movePiece(state, 'YELLOW_1', 1);
  assert.strictEqual(state.pieces.find(p => p.id === 'YELLOW_1').relativePosition, 56, 'YELLOW_1 home');
  assert.strictEqual(state.players['YELLOW'].completedPieces, 1, 'One piece completed');
  assert.strictEqual(state.activePlayer, 'YELLOW', 'YELLOW gets an extra roll for reaching home');

  // --- Bringing the remaining three home ends the game ---
  ['YELLOW_2', 'YELLOW_3', 'YELLOW_0'].forEach(id => {
    state.pieces.find(p => p.id === id).relativePosition = 55;
    state = rollDice(state, 1);
    state = movePiece(state, id, 1);
  });

  assert.strictEqual(state.players['YELLOW'].status, 'FINISHED');
  assert.strictEqual(state.players['YELLOW'].rank, 1);
  assert.strictEqual(state.gameOver, true);
  assert.strictEqual(state.players['GREEN'].status, 'FINISHED');
  assert.strictEqual(state.players['GREEN'].rank, 2);

  console.log('All tests passed!');
}

// The die that rolled is the die that spins. A roll with nothing playable ends
// the turn inside rollDice itself, so a per-seat counter is the only thing that
// can still say who rolled once the turn has moved on — the game-wide rollSeq
// cannot, and the UI keyed on it showed no animation at all for those rolls.
function runRollSeqDemo() {
  console.log('Running Roll Counter Demo...');
  const state = createGame(4, [], { players: ['GREEN', 'YELLOW', 'BLUE', 'RED'] });
  state.activePlayer = 'GREEN';

  rollDice(state, 3); // nothing is out of the yard: a 3 plays nothing
  assert.strictEqual(state.activePlayer, 'YELLOW', 'a dead roll passes the turn');
  assert.strictEqual(state.players['GREEN'].rollSeq, 1, 'the roller still counted its roll');
  assert.strictEqual(state.players['GREEN'].lastRoll, 3);
  assert.strictEqual(state.players['YELLOW'].rollSeq, 0, 'nobody else counted it');

  rollDice(state, 6); // YELLOW deploys, keeps the dice
  assert.strictEqual(state.players['YELLOW'].rollSeq, 1);
  assert.strictEqual(state.players['GREEN'].rollSeq, 1, 'an earlier seat is untouched');
  rollDice(state, 2); // the extra roll a six owes
  assert.strictEqual(state.players['YELLOW'].rollSeq, 2, 'a second roll spins the die again');

  console.log('All roll counter tests passed!');
}

// Run each suite independently so one stale assertion cannot mask the others.
let failed = 0;
[
  runDemo,
  runAbilityDemo,
  runAbilityTimingDemo,
  runWallDemo,
  runShieldDemo,
  runFireDemo,
  runGustDemo,
  runRollSeqDemo
].forEach(suite => {
  try {
    suite();
  } catch (err) {
    failed += 1;
    console.error(`FAILED ${suite.name}: ${err.message}`);
  }
});
if (failed > 0) process.exitCode = 1;
