import React, { memo, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line, Rect, Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { getColBounds, getRowBounds } from '../constants';

import EyeballSvg from '../assets/eyeball.svg';
// Measured straight off updated-stymite.webp's alpha channel rather than
// eyeballed: the mask's eye sockets are genuine transparent cut-outs, so
// these bounds are exact (flood-filled from the canvas border to isolate the
// two interior holes from the transparent background around the head, then
// took each hole's bounding box). Art is 664 x 664.
//   left  socket  x[183,280]  y[316,370]  centre (231.5, 343)
//   right socket  x[372,468]  y[316,370]  centre (420.0, 343)
//
// Because the sockets are holes, the eyes are drawn UNDERNEATH the image and
// show through them. The artwork is never modified or cropped — and it clips
// each pupil into the exact almond shape for free, which is what makes the
// pupils slide behind the eyelid edges instead of ending at a hard rectangle.
const ART_W = 664;
const ART_H = 664;

// True hole height (unpadded) — also used below to size the iris itself, so
// the pupil is scaled off the real cut-out rather than the padded socket.
const HOLE_H = 54;

// Socket rects are the real holes above, padded out ~15-20%: sized to fully
// backstop the hole (including its soft anti-aliased edge) so the mask's own
// opaque paint — not a gap of raw background — is what defines the visible
// edge, exactly as it did for the old art.
const SOCKETS = [
  { key: 'L', cx: 231.5 / ART_W, cy: 343 / ART_H, w: 112 / ART_W, h: 65 / ART_H },
  { key: 'R', cx: 420.0 / ART_W, cy: 343 / ART_H, w: 112 / ART_W, h: 65 / ART_H },
];

// --- Placement ------------------------------------------------------------
// The centre square is the block bounded by GreenH5 (left), YellowH5 (top),
// BlueH5 (right) and RedH5 (bottom) — cols 6-8 / rows 6-8. No more measuring
// pixels off Board.webp to guess at this: it's computed with the exact same
// getColBounds/getRowBounds every ring and home-path tile already uses, so
// it's exact by construction and can never drift out of sync with the real
// grid the way a hand-measured number could.
const CENTER_COL_LEFT = getColBounds(6);
const CENTER_COL_RIGHT = getColBounds(8);
const CENTER_ROW_TOP = getRowBounds(6);
const CENTER_ROW_BOTTOM = getRowBounds(8);

const BLOCK_LEFT = CENTER_COL_LEFT.left;
const BLOCK_RIGHT = CENTER_COL_RIGHT.left + CENTER_COL_RIGHT.width;
const BLOCK_TOP = CENTER_ROW_TOP.top;
const BLOCK_BOTTOM = CENTER_ROW_BOTTOM.top + CENTER_ROW_BOTTOM.height;

// Full bleed: the art fills the ENTIRE centre block on both axes, corner to
// corner — no aspect-preserving fit, no margin. resizeMode 'stretch' below
// does the actual stretching; these are just the block's own bounds, so any
// squash is whatever the art's aspect vs. the block's aspect demands.
export const FACE_W_PCT = BLOCK_RIGHT - BLOCK_LEFT;
export const FACE_H_PCT = BLOCK_BOTTOM - BLOCK_TOP;
export const FACE_LEFT_PCT = BLOCK_LEFT;
export const FACE_TOP_PCT = BLOCK_TOP;

// How far away (in board %) a target has to be before the eye is fully
// deflected toward it. Anything past this reads as "looking right at it",
// which is how a real eye behaves — the deflection saturates with distance.
const SATURATION = 12;

/**
 * One eye. The pupil is offset toward the gaze target, and because each eye
 * aims from its OWN position rather than from a shared face centre, the two
 * converge slightly on near targets — the detail that sells it as looking at
 * the piece instead of staring blankly in its general direction.
 */
const Eye = ({ socket, gaze, faceW, faceH, glowProgress }) => {
  // Sized off the cut-out's own height rather than socket.h, so the pupil
  // looks proportional to what's visible, not to the padded cavity behind it.
  const irisD = (HOLE_H / ART_H) * faceH * 1.5;

  // Max travel: calibrated against the cut-out so the pupil hugs the eyelid
  // at full deflection without the glint falling out into the void.
  const maxX = irisD * 0.48;
  const maxY = irisD * 0.40;

  // This eye's own centre, in board %.
  const eyeX = FACE_LEFT_PCT + socket.cx * FACE_W_PCT;
  const eyeY = FACE_TOP_PCT + socket.cy * FACE_H_PCT;

  const pupilStyle = useAnimatedStyle(() => {
    const dx = gaze.x.value - eyeX;
    const dy = gaze.y.value - eyeY;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 0.0001) {
      return { transform: [{ translateX: 0 }, { translateY: 0 }] };
    }

    const response = Math.min(1, len / SATURATION);
    return {
      transform: [
        { translateX: (dx / len) * maxX * response },
        { translateY: (dy / len) * maxY * response },
      ],
    };
  });

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: glowProgress.value > 0.05 ? '#FFFFFF' : '#000000',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowProgress.value,
    shadowRadius: glowProgress.value * 20,
    elevation: 0,
  }));

  const eyeballStyle = useAnimatedStyle(() => ({
    opacity: 1 - glowProgress.value,
  }));

  const EyeComponent = EyeballSvg;

  return (
    <Animated.View
      style={[
        styles.socket,
        {
          left: `${(socket.cx - socket.w / 2) * 100}%`,
          top: `${(socket.cy - socket.h / 2) * 100}%`,
          width: `${socket.w * 100}%`,
          height: `${socket.h * 100}%`,
        },
        bgStyle,
      ]}
    >
      <Animated.View
        style={[
          { width: irisD, height: irisD, alignItems: 'center', justifyContent: 'center' },
          pupilStyle,
          eyeballStyle,
        ]}
      >
        <EyeComponent width="100%" height="100%" />
      </Animated.View>
    </Animated.View>
  );
};

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BASE_CENTERS_PCT = {
  GREEN: { x: 212 / 1080, y: 225.5 / 1080 },
  YELLOW: { x: 870 / 1080, y: 225.5 / 1080 },
  BLUE: { x: 870 / 1080, y: 868.5 / 1080 },
  RED: { x: 211.5 / 1080, y: 872 / 1080 },
};

const BASE_RECTS = {
  GREEN: { x: 63, y: 76, width: 298, height: 299, rx: 21 },
  YELLOW: { x: 721, y: 75, width: 298, height: 301, rx: 22 },
  BLUE: { x: 722, y: 719, width: 296, height: 299, rx: 20 },
  RED: { x: 63, y: 719, width: 297, height: 306, rx: 21 },
};

/**
 * The mask at the centre of the board, watching whichever token is moving.
 *
 * Layer order matters and is the whole trick:
 *   1. eye cavities + pupils  (drawn first, so they sit behind)
 *   2. the untouched artwork  (drawn on top, clipping them through its holes)
 */
const StymiteFace = ({ gaze, boardSize, scoringAnimation = null }) => {
  const faceW = (FACE_W_PCT / 100) * boardSize;
  const faceH = (FACE_H_PCT / 100) * boardSize;

  const isGlowing = Boolean(scoringAnimation);
  const glowProgress = useSharedValue(0);
  const rayProgress = useSharedValue(0);
  const baseGlowProgress = useSharedValue(0);

  useEffect(() => {
    if (isGlowing) {
      glowProgress.value = withTiming(1, { duration: 250 });
      rayProgress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
      baseGlowProgress.value = withDelay(300, withTiming(1, { duration: 200 }));
    } else {
      glowProgress.value = withTiming(0, { duration: 200 });
      rayProgress.value = 0;
      baseGlowProgress.value = 0;
    }
  }, [isGlowing, glowProgress, rayProgress, baseGlowProgress]);

  const glowOpacity = useAnimatedStyle(() => ({
    opacity: glowProgress.value,
  }));

  const eyeLeftX = (FACE_LEFT_PCT / 100) * 1080 + (SOCKETS[0].cx) * (FACE_W_PCT / 100) * 1080;
  const eyeLeftY = (FACE_TOP_PCT / 100) * 1080 + (SOCKETS[0].cy) * (FACE_H_PCT / 100) * 1080;
  const eyeRightX = (FACE_LEFT_PCT / 100) * 1080 + (SOCKETS[1].cx) * (FACE_W_PCT / 100) * 1080;
  const eyeRightY = (FACE_TOP_PCT / 100) * 1080 + (SOCKETS[1].cy) * (FACE_H_PCT / 100) * 1080;

  const activeBase = (scoringAnimation && BASE_CENTERS_PCT[scoringAnimation]) || { x: 0, y: 0 };
  const targetX = activeBase.x * 1080;
  const targetY = activeBase.y * 1080;

  const leftRayProps = useAnimatedProps(() => ({
    x2: eyeLeftX + (targetX - eyeLeftX) * rayProgress.value,
    y2: eyeLeftY + (targetY - eyeLeftY) * rayProgress.value,
  }));

  const rightRayProps = useAnimatedProps(() => ({
    x2: eyeRightX + (targetX - eyeRightX) * rayProgress.value,
    y2: eyeRightY + (targetY - eyeRightY) * rayProgress.value,
  }));

  const baseGlowProps = useAnimatedProps(() => ({
    opacity: baseGlowProgress.value,
  }));

  const baseRect = scoringAnimation ? BASE_RECTS[scoringAnimation] : null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.face,
        {
          left: `${FACE_LEFT_PCT}%`,
          top: `${FACE_TOP_PCT}%`,
          width: `${FACE_W_PCT}%`,
          height: `${FACE_H_PCT}%`,
        },
      ]}
    >
      {isGlowing && baseRect && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -(FACE_LEFT_PCT / 100) * boardSize,
              top: -(FACE_TOP_PCT / 100) * boardSize,
              width: boardSize,
              height: boardSize,
              zIndex: 10,
            }
          ]}
          pointerEvents="none"
        >
          <Svg viewBox="0 0 1080 1080" width="100%" height="100%">
            <AnimatedRect
              x={baseRect.x}
              y={baseRect.y}
              width={baseRect.width}
              height={baseRect.height}
              rx={baseRect.rx}
              ry={baseRect.rx}
              fill="#FFFFFF"
              animatedProps={baseGlowProps}
            />

            <AnimatedLine
              x1={eyeLeftX}
              y1={eyeLeftY}
              animatedProps={leftRayProps}
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeLinecap="round"
            />

            <AnimatedLine
              x1={eyeRightX}
              y1={eyeRightY}
              animatedProps={rightRayProps}
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      )}

      {SOCKETS.map(socket => (
        <Eye
          key={socket.key}
          socket={socket}
          gaze={gaze}
          faceW={faceW}
          faceH={faceH}
          glowProgress={glowProgress}
        />
      ))}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowBackdrop,
          glowOpacity
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="stymiteAura" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <Stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.6" />
              <Stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="100" cy="100" r="98" fill="url(#stymiteAura)" />
        </Svg>
      </Animated.View>

      <Image
        source={require('../assets/updated-stymite.webp')}
        style={styles.faceImage}
        resizeMode="stretch"
        fadeDuration={0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    // Below the tokens (zIndex 10) so a piece that reaches the goal still
    // draws over the mask rather than disappearing behind it.
    zIndex: 5,
    overflow: 'visible',
  },
  glowBackdrop: {
    position: 'absolute',
    left: '-40%',
    top: '-40%',
    width: '180%',
    height: '180%',
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Explicit width/height rather than StyleSheet.absoluteFill — with only
  // top/left/right/bottom set, the width and height stay `auto` and the
  // artwork falls back to its intrinsic 1224x1947, which is enormous next to
  // a ~47px face box. Still absolutely positioned (and above the sockets by
  // zIndex) so it keeps painting ON TOP of the eyes and clipping them.
  faceImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    zIndex: 5,
    elevation: 2,
  },
  socket: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 0,
    // The cavity behind the cut-out. Its rectangular corners are hidden by
    // the opaque mask on top, so only the almond shows.
    backgroundColor: '#000000',
  },
});

export default memo(StymiteFace);
