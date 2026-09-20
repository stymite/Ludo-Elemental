import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import {
  ELEMENTS,
  SAFE_TILES,
  getWallCellRect,
  getWallPlaceableCells,
  wallCellKey
} from '../constants';
// Bitmap, not the 443-path source SVG — a wall is drawn one board cell wide.
// Re-export at that size from the .svg of the same name if the art changes.
import RipPng from '../assets/RIP.png';

const percentStyle = (rect) => ({
  position: 'absolute',
  left: `${rect.left}%`,
  top: `${rect.top}%`,
  width: `${rect.width}%`,
  height: `${rect.height}%`,
});

/**
 * The wall itself, sitting on its tile. Animation is intentionally left out —
 * it drops in as a plain marker.
 */
export const WallMarker = ({ wall }) => {
  if (!wall) return null;
  const rect = getWallCellRect(wall);
  if (!rect) return null;

  const el = ELEMENTS[wall.owner] || ELEMENTS.GREEN;

  return (
    <View style={[percentStyle(rect), styles.wallCell]} pointerEvents="none">
      <Image source={RipPng} style={styles.wallArt} resizeMode="contain" />
    </View>
  );
};

/**
 * Tap targets shown while the Earth player is choosing where to drop the wall.
 * Sits above the tokens so a stray tap cannot move a piece by accident.
 */
export const WallPlacementLayer = ({ players, onSelect, onCancel }) => {
  const cells = getWallPlaceableCells(players);

  return (
    <View style={styles.placementLayer}>
      {/* Tapping the board outside a valid tile backs out of placement mode */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onCancel}
      />
      {cells.map(cell => {
        const rect = getWallCellRect(cell);
        if (!rect) return null;
        // Stop signs also shove their occupants; home lanes lock a rival out of
        // their own run-in. Both are worth calling out before you commit.
        const shoves = cell.kind === 'RING' && SAFE_TILES.has(cell.globalPos);
        const isHomeLane = cell.kind === 'HOME';
        return (
          <TouchableOpacity
            key={wallCellKey(cell)}
            style={[
              percentStyle(rect),
              styles.candidate,
              shoves && styles.candidateShove,
              isHomeLane && styles.candidateHome
            ]}
            activeOpacity={0.6}
            onPress={() => onSelect(cell)}
          />
        );
      })}
    </View>
  );
};

/**
 * Small banner telling the Earth player what the game is waiting for.
 */
export const WallPlacementHint = ({ owner }) => {
  const el = ELEMENTS[owner] || ELEMENTS.GREEN;
  return (
    <View style={[styles.hint, { borderColor: el.color }]} pointerEvents="none">
      <Text style={[styles.hintText, { color: el.color }]}>
        Tap a tile to raise your wall
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wallArt: {
    width: '140%',
    height: '140%',
  },
  wallCell: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
    elevation: 20,
    overflow: 'visible',
  },
  placementLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
  },
  candidate: {
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 208, 96, 0.9)',
    backgroundColor: 'rgba(0, 208, 96, 0.28)',
  },
  candidateShove: {
    borderColor: 'rgba(255, 179, 0, 0.95)',
    backgroundColor: 'rgba(255, 179, 0, 0.34)',
  },
  candidateHome: {
    borderColor: 'rgba(224, 64, 251, 0.95)',
    backgroundColor: 'rgba(224, 64, 251, 0.30)',
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 40,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default WallMarker;
