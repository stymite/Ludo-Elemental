const assert = require('assert');
const { LESSONS, createLesson, advanceLesson } = require('./tutorial');
const { resolveDestination, placeWall, rollDice, movePiece } = require('./engine');
const position = (state, id) => state.pieces.find(piece => piece.id === id).relativePosition;

function play(id) {
  const lesson = LESSONS.find(item => item.id === id);
  let state = createLesson(id);
  return lesson.actions.map((_, action) => {
    const before = JSON.stringify(state);
    const next = advanceLesson(state, id, action);
    assert.equal(JSON.stringify(state), before, 'Practice transitions preserve the previous animation state');
    state = next;
    return state;
  });
}

const airPlays = play('air');
assert.equal(airPlays[0].players.YELLOW.points, 40);
assert.equal(airPlays[0].players.YELLOW.abilityReady, true);
assert.equal(airPlays[1].players.YELLOW.points, 0);
const air = airPlays[2];
assert.equal(position(air, 'YELLOW_0'), 13);
assert.equal(air.gust, null);

const [upgrade] = play('upgrade');
assert.equal(position(upgrade, 'GREEN_0'), 56);
assert.equal(upgrade.players.GREEN.abilityThreshold, 30);
assert.equal(upgrade.triggerFirstScoreAnimation, 'GREEN');
const firePlays = play('fire');
assert.equal(firePlays[1].players.RED.lastRoll, 5);
const fire = firePlays[2];
assert.equal(position(fire, 'RED_0'), 19);
assert.equal(position(fire, 'GREEN_0'), -1);
assert.equal(position(fire, 'BLUE_0'), -1);
assert.equal(fire.fire, null);

const water = play('water');
assert.equal(position(water[0], 'BLUE_1'), 0, 'Water spawns one token');
assert.equal(position(water[0], 'BLUE_2'), -1, 'Water does not spawn extra tokens');
assert.equal(position(water[2], 'RED_0'), -1, 'Attacker dies on shield');
assert.equal(position(water[2], 'BLUE_0'), 3);
assert.equal(position(water[5], 'BLUE_0'), 3, 'Fire cannot burn shield');
assert.equal(position(water[5], 'RED_1'), 43, 'Fire actually crosses the shield');
assert.equal(position(water[6], 'BLUE_0'), 6, 'Shielded token passes through enemy wall');
assert.equal(water[6].wall?.globalPos, 31, 'GREEN wall stands on board');

const earth = play('earth');
assert.equal(position(earth[1], 'RED_0'), 22, 'STOP occupant is pushed one tile');
assert.equal(position(earth[3], 'BLUE_0'), 33, 'Enemy stops before wall at global 8');
assert.equal(position(earth[5], 'GREEN_0'), 11, 'Wall owner walks through');

// Shield immunity applies to ring tiles, home lanes, and base exits. Removing
// the shield restores normal wall blocking; neither case changes the wall.
const shield = water[5];
shield.wall = { owner: 'GREEN', kind: 'RING', globalPos: 30 };
const blue = shield.pieces.find(piece => piece.id === 'BLUE_0');
assert.equal(resolveDestination(shield, blue, 3), 6);
shield.shield = null;
assert.equal(resolveDestination(shield, blue, 3), null);
shield.shield = { owner: 'BLUE' };
shield.wall = { owner: 'GREEN', kind: 'HOME', player: 'BLUE', index: 2 };
blue.relativePosition = 51;
assert.equal(resolveDestination(shield, blue, 4), 55);
shield.shield = null;
assert.equal(resolveDestination(shield, blue, 4), 52);
shield.wall = { owner: 'GREEN', kind: 'RING', globalPos: 26 };
blue.relativePosition = -1;
assert.equal(resolveDestination(shield, blue, 6), null);
shield.shield = { owner: 'BLUE' };
assert.equal(resolveDestination(shield, blue, 6), 0);

const safe = createLesson('earth');
safe.shield = { owner: 'RED' };
placeWall(safe, { kind: 'RING', globalPos: 8 });
assert.equal(position(safe, 'RED_0'), 21, 'Shield prevents STOP shove');

// Natural turn progression still expires Water on its owner's next turn.
const expiry = water[0];
expiry.activePlayer = 'YELLOW';
expiry.turnPhase = 'WAITING_FOR_ROLL';
expiry.pieces.find(piece => piece.id === 'YELLOW_0').relativePosition = 0;
rollDice(expiry, 1);
movePiece(expiry, 'YELLOW_0', 1);
assert.equal(expiry.activePlayer, 'BLUE');
assert.equal(expiry.shield, null);
assert.equal(createLesson('water').shield, null, 'Replay starts fresh');

LESSONS.forEach(lesson => {
  assert(Array.isArray(lesson.bullets) && lesson.bullets.length > 0, `Lesson ${lesson.id} must have summary bullets`);
  lesson.bullets.forEach(b => {
    assert(b.title && b.desc, `Bullet in ${lesson.id} must have title and desc`);
  });
});

console.log('All tutorial scenarios, Water wall immunity checks, and lesson summary bullets passed!');

