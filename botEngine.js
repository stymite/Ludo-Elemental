import { SAFE_TILES, BASE_OFFSETS } from './constants';
import {
  getLegalMoves,
  getMoveValuesForPiece,
  resolveDestination,
  isShielded,
} from './engine';

// Returns { pieceId, value } — the bot has to pick which banked roll to spend
// as well as which token to spend it on, so every piece is scored once per
// value it can actually use. Returns null when nothing is playable.
export function getBestBotMove(state) {
  const legalMoves = getLegalMoves(state);

  if (legalMoves.length === 0) {
    return null;
  }

  let bestMove = null;
  let maxScore = -Infinity;

  legalMoves.forEach(piece => {
    getMoveValuesForPiece(state, piece.id).forEach(value => {
      const score = scoreMove(state, piece, value);
      if (score === null) return;
      if (score > maxScore) {
        maxScore = score;
        bestMove = { pieceId: piece.id, value };
      }
    });
  });

  return bestMove;
}

// Scores one (piece, value) pairing. null means that value can't move that
// piece at all.
function scoreMove(state, piece, diceValue) {
  let score = 0;
  const isDeploying = piece.relativePosition === -1;
  // Ask the engine where the piece really ends up — a wall can cut the move
  // short, so the raw position + dice sum would be wrong.
  const newRelativePosition = resolveDestination(state, piece, diceValue);
  if (newRelativePosition === null) return null;

  // Deploying a piece from the yard
  if (isDeploying) {
    score += 15;
  }

  // Being stopped short by a wall is a wasted move
  if (!isDeploying && newRelativePosition < piece.relativePosition + diceValue) {
    score -= 10;
  }

  // Reaching the destination
  if (newRelativePosition === 56) {
    score += 40;
  }
  
  // Entering the home path (safe from captures)
  if (newRelativePosition >= 51 && piece.relativePosition < 51) {
    score += 30;
  }
  
  // Only calculate global position if it's on the main track (0-50)
  if (newRelativePosition >= 0 && newRelativePosition <= 50) {
    const newGlobalPos = (BASE_OFFSETS[piece.player] + newRelativePosition) % 52;
    
    // Moving to a safe tile
    if (SAFE_TILES.has(newGlobalPos)) {
      score += 20;
    }
    
    const enemies = state.pieces.filter(p => {
      if (p.player === piece.player) return false;
      if (p.relativePosition < 0 || p.relativePosition > 50) return false;
      const enemyGlobalPos = (BASE_OFFSETS[p.player] + p.relativePosition) % 52;
      return enemyGlobalPos === newGlobalPos;
    });

    if (enemies.some(e => isShielded(state, e))) {
      // Landing on ice spikes kills us, not them — never walk into that.
      score -= 200;
    } else if (!SAFE_TILES.has(newGlobalPos) && enemies.length > 0) {
      // Capturing an enemy
      score += 50;
    }
  }
  
  // Progress tie-breaker (prefer moving pieces that are further along)
  score += newRelativePosition * 0.1;

  return score;
}
