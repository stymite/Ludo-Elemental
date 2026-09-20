import React from 'react';
import { StyleSheet, View, Image, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, SEAT, SEAT_ORDER } from '../theme';

const BG_IMAGE = require('../assets/auth-page/background.webp');
const BOARD = require('../assets/Board.webp');

// Memoised, and every style below is a StyleSheet entry rather than an inline
// array. This sits behind the board, so it was being reconciled on every single
// game state change — each roll, each move, each capture — rebuilding the style
// objects for a full-screen blurred image that had not changed since launch.
// `board` and `focus` are plain values, so the default shallow compare is enough.
export const Backdrop = React.memo(function Backdrop({ board = false, focus = 0.4 }) {
  return (
    <View style={s.fill} pointerEvents="none">
      <Image
        source={BG_IMAGE}
        style={s.bg}
        resizeMode="cover"
        blurRadius={Platform.OS === 'android' ? 5 : 6}
      />
      <View style={s.scrim} />

      {board ? (
        <Image source={BOARD} style={s.board} resizeMode="contain" />
      ) : null}
    </View>
  );
});

// The four seat colours as a single hairline. Used under the wordmark, where it says
// "four players" without a word or an illustration. Purely a brand mark, so it is
// hidden from screen readers rather than described.
export function SeatSpectrum({ width = 132, height = 3 }) {
  return (
    <View
      style={[s.spectrum, { width, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {SEAT_ORDER.map(seat => (
        <View key={seat} style={[s.spectrumBar, { backgroundColor: SEAT[seat] }]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: COLORS.bg },
  bg: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.58)' },
  // Whole board, never cropped: a complete object reads as intentional texture, a
  // cropped one reads as a mistake. Opacity is low enough that the four quadrant
  // colours register as a tint rather than as a grid competing with the wordmark.
  board: {
    position: 'absolute',
    alignSelf: 'center',
    // Centred on the wordmark rather than floating above or below it, so the title
    // lands on the board's own centre cross instead of near its edge.
    top: '20%',
    width: '86%',
    aspectRatio: 1,
    opacity: 0.05
  },
  spectrum: { flexDirection: 'row', borderRadius: 2, overflow: 'hidden' },
  spectrumBar: { flex: 1 }
});

export default Backdrop;
