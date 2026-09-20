import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, SEAT, RADIUS } from '../theme';

// The shell's signature element: a small four-cell figure showing who sits where.
//
// It is here instead of an icon on every mode card, which is what keeps this app clear
// of both the emoji-icon tell and the icon-chip-row tell at once. It also does real
// work an icon could not: 1v1 and 2v2 seat players opposite each other, and the diagram
// is the only place that rule is visible before you are in a game.
//
// Grid reads top-left, top-right, bottom-left, bottom-right. Diagonals are partners.
//
//   layout: array of 4, each either null (nobody sits here) or
//           { seat: 'GREEN', team?: 'A' }

const PRESETS = {
  // Everyone plays, nobody is allied.
  FFA: [{ seat: 'GREEN' }, { seat: 'YELLOW' }, { seat: 'RED' }, { seat: 'BLUE' }],
  // Two players, facing. The empty diagonal is the point.
  DUEL: [{ seat: 'GREEN' }, null, null, { seat: 'BLUE' }],
  // Four players, allies on the diagonals.
  TEAM: [
    { seat: 'GREEN', team: 'A' }, { seat: 'YELLOW', team: 'B' },
    { seat: 'RED', team: 'B' }, { seat: 'BLUE', team: 'A' }
  ]
};

// `layout` is the escape hatch for a pairing the presets do not name — the
// Pass'n'Play formation picker draws one cell per seat with only the side it is
// offering filled in, which is the same figure with a different four slots.
export default function SeatDiagram({ mode, layout: given, size = 44, label }) {
  const layout = given || PRESETS[mode] || PRESETS.FFA;
  const cell = Math.floor((size - 6) / 2);

  return (
    <View
      style={[s.grid, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={label || `${mode} seating`}
    >
      {layout.map((slot, i) => (
        <View
          key={i}
          style={[
            s.cell,
            { width: cell, height: cell },
            slot
              ? { backgroundColor: SEAT[slot.seat] }
              : s.empty
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignContent: 'center'
  },
  cell: { borderRadius: RADIUS.sm - 3 },
  // An unused seat is a hole in the board, not a disabled control, so it reads as an
  // outline rather than a greyed-out fill. The border is lifted well above the hairline
  // token because at 22px a `line`-coloured edge disappeared into the card entirely and
  // the empty cells read as dark tiles.
  empty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.textLow
  }
});
