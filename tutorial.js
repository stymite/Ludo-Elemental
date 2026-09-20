// Small, deterministic practice games. All outcomes use the real game engine;
// these states never enter a match, account, or multiplayer connection.
const { createGame, rollDice, movePiece, summonGust, igniteFire, raiseShield,
  placeWall, ABILITY_POINTS_BASE } = require('./engine');

const LESSONS = [
  {
    id: 'air', player: 'YELLOW', title: 'Air (Extra Distance)',
    text: 'Air power adds +9 steps to your move.',
    actions: ['Roll the dice', 'Tap Air power', 'Move your token'],
    tokens: [null, null, 'YELLOW_0'],
    results: [
      'Power is ready!',
      '+9 extra steps added!',
      'Token moved!'
    ],
    bullets: [
      { title: '+9 Extra Steps', desc: 'Adds 9 extra steps to your dice roll.' },
      { title: 'One Move', desc: 'Works for one move. You can turn it on before or after rolling.' },
      { title: 'Board Pieces Only', desc: 'Works only on pieces already on the board, not in your base.' }
    ]
  },
  {
    id: 'fire', player: 'RED', title: 'Fire (Burn enemies in path)',
    text: 'Burn enemies along your path and send them back to base.',
    actions: ['Tap Fire power', 'Roll the dice', 'Move to burn enemies in path'],
    tokens: [null, null, 'RED_0'],
    results: [
      'Fire power activated!',
      'You rolled 5!',
      'Enemies burned!'
    ],
    bullets: [
      { title: 'Burn Enemies', desc: 'Burns all enemy pieces in your path and where you land.' },
      { title: 'Send to Base', desc: 'Burned enemies go straight back to their home base.' },
      { title: 'Safe Star Tiles', desc: 'Enemies on safe star tiles cannot be burned.' },
      { title: 'Water Shields', desc: 'Pieces with water shields cannot be burned.' },
      { title: 'One Move', desc: 'Works for one move. You can turn it on before or after rolling.' }
    ]
  },
  {
    id: 'earth', player: 'GREEN', title: 'Earth (Place Wall)',
    text: 'Place a wall to block enemies. You can pass through your own wall.',
    actions: [
      'Tap Earth power to place wall anywhere on the board',
      'Place wall on the STOP sign to push enemies',
      'Roll the dice for BLUE',
      'Move enemy token',
      'Roll your dice',
      'Move through your wall'
    ],
    tokens: [null, 'RED_0', null, 'BLUE_0', null, 'GREEN_0'],
    results: [
      'Earth power activated!',
      null,
      'BLUE rolled 5!',
      'Wall blocked the enemy!',
      'You rolled 5!',
      'You passed through your wall!'
    ],
    bullets: [
      { title: 'Place a Wall', desc: 'Place a wall on any track tile or home lane.' },
      { title: 'Blocks Enemies', desc: 'Enemies cannot pass and must stop right before the wall.' },
      { title: 'You Can Pass', desc: 'You and your teammate can walk through your wall anytime.' },
      { title: 'Push Safe Enemies', desc: 'Placing a wall on a safe star tile pushes enemies off it.' },
      { title: 'Wall Time', desc: 'The wall stays until your next turn begins.' }
    ]
  },
  {
    id: 'water', player: 'BLUE', title: 'Water (Protection & Resurrection)',
    text: 'Spawn a token and shield all your tokens from attacks.',
    actions: [
      'Tap Water power to SPAWN token and activate SHIELD',
      'Roll the dice',
      'Move RED to attack',
      'Tap RED power',
      'Roll the dice',
      'Move RED to use Fire',
      'Move through GREEN wall'
    ],
    tokens: [null, null, 'RED_0', null, null, 'RED_1', 'BLUE_0'],
    results: [
      null,
      'RED rolled 2!',
      'Shield protected you! Attacker eliminated.',
      'Fire power activated!',
      'RED rolled 5!',
      'Shield protects against Fire.',
      'Shielded tokens pass through enemy walls!'
    ],
    bullets: [
      { title: 'Bring Out Token', desc: 'Brings one token out of your base to the start tile.' },
      { title: 'Ice Shield', desc: 'Puts an ice shield on all your tokens.' },
      { title: 'Destroy Attackers', desc: 'If an enemy tries to land on your shielded token, the enemy dies!' },
      { title: 'Immunity', desc: 'Shielded tokens cannot be burned, pushed, or blocked by walls.' },
      { title: 'Shield Time', desc: 'The shield protects all your tokens until your next turn begins.' }
    ]
  },
  {
    id: 'upgrade', player: 'GREEN', title: 'Upgrade Base',
    text: 'Finish a token to upgrade your base and reduce power cost.',
    actions: ['Move token to finish'],
    tokens: ['GREEN_0'],
    results: ['Base upgraded! Power cost reduced from 40 to 30.'],
    bullets: [
      { title: 'Score a Goal', desc: 'Moving a piece into the center finishes it.' },
      { title: 'Level 2 Base', desc: 'Your base upgrades to Level 2.' },
      { title: 'Cheaper Power', desc: 'Power points needed drops from 40 down to 30 points!' }
    ]
  },
];

function prepareTurn(state, player, roll) {
  state.activePlayer = player;
  state.turnPhase = 'WAITING_FOR_ROLL';
  state.pendingRolls = [];
  state.consecutiveSixes = 0;
  state.sixThisTurn = false;
  if (roll) rollDice(state, roll);
}

function charge(state, player, points = ABILITY_POINTS_BASE) {
  Object.assign(state.players[player], { points, abilityReady: points >= ABILITY_POINTS_BASE });
}

function createLesson(id) {
  const lesson = LESSONS.find(item => item.id === id);
  const bots = ['GREEN', 'YELLOW', 'BLUE', 'RED'].filter(player => player !== lesson.player);
  const state = createGame(4, bots, { rng: () => 0 });
  prepareTurn(state, lesson.player);
  const positions = {
    upgrade: { GREEN_0: 55 }, air: { YELLOW_0: 0 },
    fire: { RED_0: 14, GREEN_0: 3, BLUE_0: 31 },
    earth: { GREEN_0: 6, BLUE_0: 30, RED_0: 21 },
    water: { BLUE_0: 3, RED_0: 40, RED_1: 38 },
  }[id];
  state.pieces.forEach(piece => { piece.relativePosition = positions[piece.id] ?? -1; });
  charge(state, lesson.player, id === 'air' ? 36 : id === 'upgrade' ? 29 : 40);
  if (id === 'earth') charge(state, 'BLUE', 18);
  if (id === 'upgrade') rollDice(state, 1);
  if (id === 'water') state.wall = { owner: 'GREEN', kind: 'RING', globalPos: 31 };
  return state;
}

function advanceLesson(previous, id, action) {
  const state = JSON.parse(JSON.stringify(previous));
  if (id === 'air') {
    if (action === 0) rollDice(state, 4);
    else if (action === 1) summonGust(state);
    else if (action === 2) movePiece(state, 'YELLOW_0', 4);
  } else if (id === 'upgrade') movePiece(state, 'GREEN_0', 1); else if (id === 'fire') {
    if (action === 0) igniteFire(state);
    else if (action === 1) rollDice(state, 5);
    else movePiece(state, 'RED_0', 5);
  } else if (id === 'water') {
    if (action === 0) {
      raiseShield(state);
      prepareTurn(state, 'RED');
    }
    if (action === 1) {
      rollDice(state, 2);
    }
    if (action === 2) {
      movePiece(state, 'RED_0', 2);
      charge(state, 'RED');
      prepareTurn(state, 'RED');
      state.wall = { owner: 'GREEN', kind: 'RING', globalPos: 31 };
    }
    if (action === 3) {
      igniteFire(state);
    }
    if (action === 4) {
      rollDice(state, 5);
    }
    if (action === 5) {
      movePiece(state, 'RED_1', 5);
      prepareTurn(state, 'BLUE', 3);
      state.wall = { owner: 'GREEN', kind: 'RING', globalPos: 31 };
    }
    if (action === 6) {
      movePiece(state, 'BLUE_0', 3);
      state.wall = { owner: 'GREEN', kind: 'RING', globalPos: 31 };
    }
  } else if (id === 'earth') {
    if (action === 0) {
      // Just tapping the power, no engine state change
    } else if (action === 1) {
      placeWall(state, { kind: 'RING', globalPos: 8 });
      prepareTurn(state, 'BLUE');
    } else if (action === 2) {
      rollDice(state, 5);
    } else if (action === 3) {
      movePiece(state, 'BLUE_0', 5);
      prepareTurn(state, 'GREEN');
    } else if (action === 4) {
      rollDice(state, 5);
    } else if (action === 5) {
      movePiece(state, 'GREEN_0', 5);
    }
  }
  return state;
}

module.exports = { LESSONS, createLesson, advanceLesson };
