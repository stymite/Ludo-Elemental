export const CELL_SIZE = 40;
export const BOARD_SIZE = CELL_SIZE * 15; // 600

export const COLORS = {
  RED: '#E60026',
  GREEN: '#2E7D32',
  YELLOW: '#F59E0B',
  BLUE: '#1E88E5',
  BOARD_BG: '#FFFFFF',
  PATH_BG: '#F5F5F5',
  SAFE_SPOT: '#E0E0E0',
  BORDER: '#BDBDBD',
  TEXT: '#212121',
};

// Elemental identity per seat, used by the ability charge ring / power button.
export const ELEMENTS = {
  RED: { element: 'FIRE', label: 'Flame', color: '#E60026', deep: '#54000B' },
  BLUE: { element: 'WATER', label: 'Ice', color: '#0099FF', deep: '#003380' },
  GREEN: { element: 'EARTH', label: 'Nature', color: '#00D060', deep: '#004818' },
  YELLOW: { element: 'AIR', label: 'Air', color: '#FFB300', deep: '#7C3F00' },
};

// Map global relative positions (0-51) to [col, row]
export const GLOBAL_PATH = [
  // GREEN start (Top-Left) to YELLOW start (0 - 12)
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  // YELLOW start (Top-Right) to BLUE start (13 - 25)
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  // BLUE start (Bottom-Right) to RED start (26 - 38)
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  // RED start (Bottom-Left) back to GREEN start (39 - 51)
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6]
];

// Map private home stretches (relative positions 51-55)
export const HOME_PATHS = {
  GREEN: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  YELLOW: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  BLUE: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  RED: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
};

// Yard positions for tokens that haven't entered the board
export const YARD_POSITIONS = {
  GREEN: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]], // Top-Left (Earth Kingdom)
  YELLOW: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]], // Top-Right (Air Temple)
  BLUE: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]], // Bottom-Right (Water Tribe)
  RED: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]], // Bottom-Left (Fire Nation)
};

export const YARD_PIXEL_POSITIONS = {
  GREEN: [
    { left: 14.55, top: 15.90 },
    { left: 24.55, top: 15.90 },
    { left: 14.55, top: 25.90 },
    { left: 24.55, top: 25.90 }
  ],
  YELLOW: [
    { left: 75.45, top: 15.90 },
    { left: 85.45, top: 15.90 },
    { left: 75.45, top: 25.90 },
    { left: 85.45, top: 25.90 }
  ],
  BLUE: [
    { left: 75.45, top: 75.30 },
    { left: 85.45, top: 75.30 },
    { left: 75.45, top: 85.30 },
    { left: 85.45, top: 85.30 }
  ],
  RED: [
    { left: 14.55, top: 75.30 },
    { left: 24.55, top: 75.30 },
    { left: 14.55, top: 85.30 },
    { left: 24.55, top: 85.30 }
  ]
};

export const BASE_OFFSETS = {
  GREEN: 0,
  YELLOW: 13,
  BLUE: 26,
  RED: 39,
};

export const SAFE_TILES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Exact 15x15 board geometry measured directly from updated.jpg image pixels
export const getColBounds = (col) => {
  if (col < 6) {
    const w = 39.60 / 6;
    return { left: col * w, width: w };
  } else if (col < 9) {
    const w = (60.60 - 39.60) / 3;
    return { left: 39.60 + (col - 6) * w, width: w };
  } else {
    const w = (100 - 60.60) / 6;
    return { left: 60.60 + (col - 9) * w, width: w };
  }
};

export const getRowBounds = (row) => {
  if (row < 6) {
    const h = 40.55 / 6;
    return { top: row * h, height: h };
  } else if (row < 9) {
    const h = (60.45 - 40.55) / 3;
    return { top: 40.55 + (row - 6) * h, height: h };
  } else {
    const h = (100 - 60.45) / 6;
    return { top: 60.45 + (row - 9) * h, height: h };
  }
};

export const getCellRect = (col, row) => {
  const colB = getColBounds(col);
  const rowB = getRowBounds(row);
  return {
    left: colB.left,
    top: rowB.top,
    width: colB.width,
    height: rowB.height,
  };
};

export const getCellCenter = (col, row) => {
  const rect = getCellRect(col, row);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

// --- Earth wall placement -------------------------------------------------

export const wallCellKey = (cell) =>
  cell.kind === 'RING' ? `RING_${cell.globalPos}` : `HOME_${cell.player}_${cell.index}`;

export const getRingCellRect = (globalPos) => {
  const coords = GLOBAL_PATH[globalPos];
  return coords ? getCellRect(coords[0], coords[1]) : null;
};

export const getWallCellRect = (cell) => {
  if (!cell) return null;
  if (cell.kind === 'RING') {
    const coords = GLOBAL_PATH[cell.globalPos];
    return coords ? getCellRect(coords[0], coords[1]) : null;
  }
  if (cell.kind === 'HOME') {
    const path = HOME_PATHS[cell.player];
    const coords = path && path[cell.index];
    return coords ? getCellRect(coords[0], coords[1]) : null;
  }
  return null;
};

// Every tile the wall may be dropped on: the whole 52-tile ring plus each
// player's private home stretch. Safe tiles are fair game; the centre goal is
// the only thing excluded.
export const getWallPlaceableCells = (players) => {
  const cells = GLOBAL_PATH.map((_, globalPos) => ({ kind: 'RING', globalPos }));
  players.forEach(player => {
    (HOME_PATHS[player] || []).forEach((_, index) => {
      cells.push({ kind: 'HOME', player, index });
    });
  });
  return cells;
};
