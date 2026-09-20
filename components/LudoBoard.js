import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import Svg, { Rect, Defs, ClipPath, Image as SvgImage } from 'react-native-svg';
import { GLOBAL_PATH, HOME_PATHS, YARD_POSITIONS, YARD_PIXEL_POSITIONS, getCellRect, getWallCellRect } from '../constants';

// Reference grid overlay (path index / home lane / yard slot per tile).
// Built exactly ONCE at module load — not per render, not per dice roll —
// since none of it depends on props or game state. Toggled on screen with
// the Grid button in the header (see App.js); LudoBoard itself only
// re-renders when that toggle flips, never on gameplay ticks.
const GRID_TILES = (() => {
  const tiles = [];

  // 1. Global Path (0 - 51)
  GLOBAL_PATH.forEach(([col, row], idx) => {
    const rect = getCellRect(col, row);
    let label = '';
    if (idx >= 0 && idx <= 12) label = `G${idx}`;
    else if (idx >= 13 && idx <= 25) label = `Y${idx - 13}`;
    else if (idx >= 26 && idx <= 38) label = `B${idx - 26}`;
    else if (idx >= 39 && idx <= 51) label = `R${idx - 39}`;
    
    tiles.push({ key: `global_${idx}`, ...rect, label });
  });

  // 2. Home Paths (51 - 55)
  ['GREEN', 'YELLOW', 'BLUE', 'RED'].forEach(player => {
    HOME_PATHS[player].forEach(([col, row], idx) => {
      const rect = getCellRect(col, row);
      const prefix = player.charAt(0).repeat(2); // GG, YY, BB, RR
      tiles.push({ key: `home_${player}_${idx}`, ...rect, label: `${prefix}${idx + 1}` });
    });
  });

  // 3. Yard Positions
  ['GREEN', 'YELLOW', 'BLUE', 'RED'].forEach(player => {
    YARD_POSITIONS[player].forEach((_, idx) => {
      const pos = YARD_PIXEL_POSITIONS[player][idx];
      tiles.push({
        key: `yard_${player}_${idx}`,
        left: pos.left - 3.3,
        top: pos.top - 3.3,
        width: 6.6,
        height: 6.6,
        label: player.charAt(0) // G, Y, B, R
      });
    });
  });

  // 4. Centre square — cols 6-8 / rows 6-8, the one block the grid above
  // never covered (it's not part of the ring, a home path, or a yard). Drawn
  // as a single tile spanning all 3x3 cells so its true boundary — the same
  // one StymiteFace.js fills — is visible when the grid is toggled on.
  {
    const left = getCellRect(6, 6);
    const right = getCellRect(8, 8);
    tiles.push({
      key: 'center',
      left: left.left,
      top: left.top,
      width: (right.left + right.width) - left.left,
      height: (right.top + right.height) - left.top,
      label: 'O',
    });
  }

  // Style objects precomputed too, once, so a render with the grid on is
  // just mapping ready-made objects straight into <View>s — no per-render
  // object allocation, no per-render layout math.
  return tiles.map(({ key, left, top, width, height, label }) => ({
    key,
    label,
    style: {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    },
  }));
})();

const BASE_CONFIGS = {
  GREEN: { x: 63, y: 76, width: 298, height: 299, rx: 21, ry: 21, zoom: 1.0, offsetX: 0, offsetY: 0, defaultImg: require('../assets/earth1.webp'), upgradeImg: require('../assets/earth2.webp') },
  YELLOW: { x: 721, y: 75, width: 298, height: 301, rx: 22, ry: 22, zoom: 1.28, offsetX: 0, offsetY: 18, defaultImg: require('../assets/air1.webp'), upgradeImg: require('../assets/air2.webp') },
  BLUE: { x: 722, y: 719, width: 296, height: 299, rx: 20, ry: 20, zoom: 1.08, offsetX: 14, offsetY: 0, defaultImg: require('../assets/water1.webp'), upgradeImg: require('../assets/water2.webp') },
  RED: { x: 63, y: 719, width: 297, height: 306, rx: 21, ry: 21, zoom: 1.18, offsetX: 0, offsetY: -18, defaultImg: require('../assets/fire1.webp'), upgradeImg: require('../assets/fire2.webp') },
};

// The four base images, and nothing that changes turn to turn. Four <SvgImage>
// nodes with clip paths are the most expensive thing on the board, and they
// depend on one rarely-changing prop: which bases have been lit by a token
// getting home. Kept apart from the dimming below so a dice roll cannot drag
// the artwork through a re-render with it — which is what had the temples
// visibly re-drawing on every single roll.
const BaseArt = React.memo(({ activatedBases }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1080 1080">
      <Defs>
        {Object.entries(BASE_CONFIGS).map(([player, config]) => (
          <ClipPath id={`clip-${player}`} key={player}>
            <Rect x={config.x} y={config.y} width={config.width} height={config.height} rx={config.rx} ry={config.ry} />
          </ClipPath>
        ))}
      </Defs>
      {Object.entries(BASE_CONFIGS).map(([player, config]) => {
        const source = activatedBases.includes(player) ? config.upgradeImg : config.defaultImg;
        const imgZoom = config.zoom || 1.0;
        const imgW = config.width * imgZoom;
        const imgH = config.height * imgZoom;
        const imgX = config.x - (imgW - config.width) / 2 + (config.offsetX || 0);
        const imgY = config.y - (imgH - config.height) / 2 + (config.offsetY || 0);

        return (
          <SvgImage
            key={player}
            href={source}
            x={imgX}
            y={imgY}
            width={imgW}
            height={imgH}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#clip-${player})`}
          />
        );
      })}
    </Svg>
  </View>
));

// Everyone except whoever is up sits in shadow. This is the half that does
// change every turn, so it is four rectangles on their own — no images, no clip
// paths, nothing to re-upload.
const BaseShade = React.memo(({ activePlayer }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1080 1080">
      {Object.entries(BASE_CONFIGS).map(([player, config]) => (
        activePlayer && activePlayer !== player ? (
          <Rect
            key={player}
            x={config.x} y={config.y} width={config.width} height={config.height} rx={config.rx} ry={config.ry}
            fill="rgba(0, 0, 0, 0.48)"
          />
        ) : null
      ))}
    </Svg>
  </View>
));

const FireTrailLayer = React.memo(({ fireTrail }) => {
  if (!fireTrail || !fireTrail.path || fireTrail.path.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
        {fireTrail.path.map((cell, idx) => {
          const rect = getWallCellRect(cell);
          if (!rect) return null;
          return (
            <Rect
              key={`fire_${idx}`}
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              fill="rgba(140, 10, 10, 0.65)"
            />
          );
        })}
      </Svg>
    </View>
  );
});

const GustTrailLayer = React.memo(({ gustTrail }) => {
  if (!gustTrail || !gustTrail.path || gustTrail.path.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
        {gustTrail.path.map((cell, idx) => {
          const rect = getWallCellRect(cell);
          if (!rect) return null;
          return (
            <Rect
              key={`gust_${idx}`}
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              fill="rgba(255, 204, 0, 0.45)"
            />
          );
        })}
      </Svg>
    </View>
  );
});

const BOARD_SKINS = {
  ludo_board_classic: require('../assets/Board.webp'),
  ludo_board_anime: require('../assets/Board-Anime.webp'),
  ludo_board_astra: require('../assets/Board-Astra.webp'),
  ludo_board_future: require('../assets/Board-Future.webp'),
  ludo_board_gear: require('../assets/Board-Gear.webp'),
  ludo_board_spirit: require('../assets/Board-Spirit.webp'),
  ludo_board_sport: require('../assets/Board-Sport.webp'),
};

// A permanent slight dim over the board art, so it sits back behind the tokens.
const WASH = 'rgba(0, 0, 0, 0.35)';

const LudoBoard = ({ showGrid = false, activatedBases = [], activePlayer = null, turnPhase = null, fireTrail = null, gustTrail = null, skin = 'ludo_board_classic' }) => {
  const boardSource = (skin && BOARD_SKINS[skin]) || require('../assets/Board.webp');
  return (
    <View style={styles.container}>
      <Image
        source={boardSource}
        style={styles.boardImage}
        resizeMode="contain"
      />
      
      {/* Permanent slight dim to reduce default board brightness. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH }]} pointerEvents="none" />
      
      {/* Dim the entire board while waiting for the active player to roll the dice */}
      {turnPhase === 'WAITING_FOR_ROLL' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.45)' }]} pointerEvents="none" />
      )}
      
      {/* Dynamic Base Upgrades (covers inner palace boxes) perfectly aligned using exact SVG coordinates */}
      <BaseArt activatedBases={activatedBases} />
      <BaseShade activePlayer={activePlayer} />
      {/* The trailing paths */}
      <FireTrailLayer fireTrail={fireTrail} />
      <GustTrailLayer gustTrail={gustTrail} />

      {/* Reference grid — off by default, toggled from the header button.
          Tiles were built once at module load (above), so flipping this on
          is just mounting pre-built views, not recomputing anything. */}
      {showGrid && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {GRID_TILES.map(({ key, label, style }) => (
            <View key={key} style={[style, styles.gridTile]}>
              <Text style={styles.gridLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  boardImage: {
    width: '100%',
    height: '100%',
  },
  gridTile: {
    backgroundColor: 'rgba(255, 0, 0, 0.20)', // Pure RED 20% opacity
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLabel: {
    color: 'rgba(255, 0, 0, 0.95)',
    fontSize: 7,
    fontWeight: '900',
  },
});

// The board itself is four cheap Views plus two memoized SVG layers, so a turn
// change costs the four dimming rects and nothing else. Both the board image
// and the base artwork sit behind their own memo and stay put.
export default React.memo(LudoBoard);
