import React, { useEffect, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop, Ellipse, Line } from 'react-native-svg';
import { NO_REDUCE, timing } from '../motion';
import IceShield from './IceShield';
import BouncingArrow from './BouncingArrow';
import TutorialTooltip from './TutorialTooltip';
// Bitmaps for the same reason the four element emblems below are: air-ability
// is 238 <path> elements and fire-ability 46, and both are drawn at 18px inside
// a coin. A YELLOW side that has spent its gust showed the tornado on all four
// of its tokens — ~950 vector nodes parked on the board for the rest of the
// match. The `fill="#FFFFFF"` these were rendered with was always a no-op:
// every path in both files carries its own fill, which wins over the root.
// Re-export at 128px from the .svg of the same name if the art changes.
import { COLORS, GLOBAL_PATH, HOME_PATHS, YARD_POSITIONS, YARD_PIXEL_POSITIONS, BASE_OFFSETS, getCellRect } from '../constants';
// Bitmaps rather than the source SVGs: earth.svg is 369 <path> elements and
// this emblem is drawn at 18px inside the coin. Sixteen tokens meant ~3,900
// vector nodes on the board for four thumbnails.
// Re-export at that size from the .svg of the same name if the art changes.
import AirPng from '../assets/air.png';
import WaterPng from '../assets/water.png';
import FirePng from '../assets/fire.png';
import EarthPng from '../assets/earth.png';
import AirAbilityPng from '../assets/air-ability.png';
import FireAbilityPng from '../assets/fire-ability.png';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'ludo-token-spin-css';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @keyframes ludo-token-spin-kf {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .ludo-rotating-ring {
        animation: ludo-token-spin-kf 3s linear infinite !important;
        transform-origin: 50% 50% !important;
        will-change: transform !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

const COIN_THEMES = {
  RED: {
    rimTop: '#FF6B81',
    rimMid: '#E60026',
    rimBot: '#54000B',
    innerTop: '#D90429',
    innerBot: '#380006',
    glow: '#FF0038',
    darkGlow: '#B30027',
    symbolColor: '#FFFFFF',
  },
  GREEN: {
    rimTop: '#B9F6CA',
    rimMid: '#00D060',
    rimBot: '#004818',
    innerTop: '#00A344',
    innerBot: '#003810',
    glow: '#00D060',
    darkGlow: '#009946',
    symbolColor: '#FFFFFF',
  },
  YELLOW: {
    rimTop: '#FFF59D',
    rimMid: '#FFB300',
    rimBot: '#7C3F00',
    innerTop: '#FFA000',
    innerBot: '#5E2A00',
    glow: '#FFB300',
    darkGlow: '#CC8F00',
    symbolColor: '#FFFFFF',
  },
  BLUE: {
    rimTop: '#80D8FF',
    rimMid: '#0099FF',
    rimBot: '#003380',
    innerTop: '#0077E6',
    innerBot: '#002566',
    glow: '#0099FF',
    darkGlow: '#007ACC',
    symbolColor: '#FFFFFF',
  }
};

const TOKEN_SYMBOLS = {
  RED: FirePng,
  YELLOW: AirPng,
  BLUE: WaterPng,
  GREEN: EarthPng,
};

// The mark on the coin. A seat that has spent its ability wears the spent mark
// instead: a greyed tornado is how the table knows YELLOW has used its gust.
//
// 90%, matching the box the SVGs occupied: the overlay centres its child, so
// a contained image in a 90% box lands exactly where the 90% viewBox did.
const getTokenSymbol = (player, fireUsed = false, gustUsed = false) => {
  if (player === 'YELLOW' && gustUsed) {
    return <Image source={AirAbilityPng} style={styles.symbolImageInset} resizeMode="contain" />;
  }
  if (player === 'RED' && fireUsed) {
    return <Image source={FireAbilityPng} style={styles.symbolImageInset} resizeMode="contain" />;
  }
  const source = TOKEN_SYMBOLS[player];
  if (!source) return null;
  return <Image source={source} style={styles.symbolImage} resizeMode="contain" />;
};

const getTileCoords = (player, relativePosition, pieceIndex, goalIndex = 0, totalGoaled = 1) => {
  if (relativePosition === -1) {
    const pos = YARD_PIXEL_POSITIONS[player][pieceIndex];
    return { left: pos.left - 3.3, top: pos.top - 3.3 };
  } else if (relativePosition >= 0 && relativePosition <= 50) {
    const globalPos = (BASE_OFFSETS[player] + relativePosition) % 52;
    const [col, row] = GLOBAL_PATH[globalPos];
    const rect = getCellRect(col, row);
    return { left: rect.left, top: rect.top };
  } else if (relativePosition >= 51 && relativePosition <= 55) {
    const [col, row] = HOME_PATHS[player][relativePosition - 51];
    const rect = getCellRect(col, row);
    return { left: rect.left, top: rect.top };
  } else if (relativePosition === 56) {
    const spacing = 4.0;
    const groupCenter = 46.7; // Centers exactly around 50% (since token center is +3.3)
    const totalWidth = (totalGoaled - 1) * spacing;
    const start = groupCenter - (totalWidth / 2);
    const pos = start + goalIndex * spacing;
    
    switch(player) {
      case 'GREEN': return { left: 37.5, top: pos };
      case 'YELLOW': return { top: 37.5, left: pos };
      case 'BLUE': return { left: 55.9, top: pos };
      case 'RED': return { top: 55.9, left: pos };
    }
  }
  return { left: 0, top: 0 };
};

const getSymbolOffsetStyle = (player) => {
  switch (player) {
    case 'YELLOW': // AIR: shifted left by 1.25px
      return { transform: [{ translateX: -0.5 }, { translateY: 0.75 }] };
    case 'GREEN': // EARTH: little bit above (up) and right (halved, nudged left)
      return { transform: [{ translateX: 0.2 }, { translateY: -1.0 }] };
    case 'RED': // FIRE: zoomed in and adjusted to make the phoenix bird visible
      return { transform: [{ scale: 1.2 }, { translateY: -0.5 }] };
    case 'BLUE': // WATER: tiny bit right (halved)
      return { transform: [{ translateX: 0.5 }] };
    default:
      return {};
  }
};

// The expensive part of a token: 3 SVG gradients + 5 shapes. `player` never
// changes for a given piece, so memoizing here means a token re-rendering
// for an unrelated reason (a new onPress closure, a stack-offset tweak)
// doesn't force this whole SVG tree to rebuild every time.
const CoinMedallion = memo(({ player, fireUsed, gustUsed }) => {
  const theme = COIN_THEMES[player] || COIN_THEMES.RED;
  const rimGradId = `rim_${player}`;
  const innerGradId = `inner_${player}`;
  const glossGradId = `gloss_${player}`;

  return (
    <View style={styles.coinWrapper}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Metallic Rim Gradient */}
          <LinearGradient id={rimGradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.rimTop} />
            <Stop offset="35%" stopColor={theme.rimMid} />
            <Stop offset="100%" stopColor={theme.rimBot} />
          </LinearGradient>

          {/* Inner Glossy Glass Disc Gradient */}
          <LinearGradient id={innerGradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.innerTop} />
            <Stop offset="100%" stopColor={theme.innerBot} />
          </LinearGradient>

          {/* Top Glass Specular Arc Reflection */}
          <LinearGradient id={glossGradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Outer Metallic Bezel */}
        <Circle cx="50" cy="50" r="48" fill={`url(#${rimGradId})`} />

        {/* Specular Edge Highlight */}
        <Circle cx="50" cy="50" r="47.5" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1" />

        {/* Inner Groove Drop Shadow */}
        <Circle cx="50" cy="50" r="38" fill="rgba(0,0,0,0.4)" />

        {/* Inner Colored Glass Disc */}
        <Circle cx="50" cy="50" r="36.5" fill={`url(#${innerGradId})`} />

        {/* Top Gloss Arc Sheen */}
        <Ellipse cx="50" cy="27" rx="27" ry="14" fill={`url(#${glossGradId})`} />
      </Svg>

      {/* Center White Element Emblem */}
      <View style={[styles.symbolOverlay, getSymbolOffsetStyle(player)]}>
        {getTokenSymbol(player, fireUsed, gustUsed)}
      </View>
    </View>
  );
});

// Half a token box, in board % — turns a token's top-left into its centre,
// which is the point the mask's eyes should actually aim at.
const TOKEN_HALF = 3.3;

// How long a token takes to cross one square, and how long the trip back to
// the yard takes after a capture.
const STEP_MS = 150;
const HOME_MS = 400;

// The squares a piece crosses on its way from one position to the next. The hop
// sequence below walks exactly this list and travelMs times exactly this list,
// so the animation and the pause it earns cannot drift apart.
const stepsBetween = (from, to) => {
  const steps = [];
  for (let pos = (from === -1 ? 0 : from + 1); pos <= to; pos++) steps.push(pos);
  return steps;
};

// How long the hops this state change just started will run for. React is done
// the instant the state lands, but the board is not: a token crossing six
// squares is still moving most of a second later. App.js holds the turn
// handoff open for exactly this long — the clock, the next player's dice, the
// bots and the board's own dimming all wait on it.
export function travelMs(before, after) {
  if (!before || !after) return 0;
  const was = new Map(before.map(p => [p.id, p.relativePosition]));
  let longest = 0;
  after.forEach(p => {
    const from = was.get(p.id);
    if (from === undefined || from === p.relativePosition) return;
    const ms = p.relativePosition === -1
      ? HOME_MS
      : stepsBetween(from, p.relativePosition).length * STEP_MS;
    if (ms > longest) longest = ms;
  });
  return longest;
}

// Deliberately not handed the piece object. commit() in App.js replaces all
// sixteen of them on every action — that is what makes a move visible at all —
// so a Token memoized on the object would re-render sixteen times a roll, glow
// SVG and all. Position, player and eligibility are what it actually draws.
const Token = memo(({
  id, player, position, eligible, dimmed, onPress, offsetDx, offsetDy,
  boardSize, shielded, fireUsed, gustUsed, gaze, activePlayer, turnPhase, goalIndex, totalGoaled, stackCount = 1, stackIndex = 0,
  hasPointer = false,
}) => {
  const pieceIndex = parseInt(id.split('_')[1]);
  const currentCoords = getTileCoords(player, position, pieceIndex, goalIndex, totalGoaled);

  const left = useSharedValue(currentCoords.left);
  const top = useSharedValue(currentCoords.top);
  const glowOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  // stackOffset arrives as a plain prop, recomputed fresh every render from
  // who else shares this piece's tile — it has no animation of its own. The
  // clicked piece leaves its old tile's group the instant its position
  // updates (same render the hop starts in), so if it had been nudged aside
  // for a stack-mate a moment ago, that nudge would otherwise snap straight
  // to 0 in the very same frame the hop bounce kicks in — another "pop
  // before it visibly moves". Mirror it into shared values and tween
  // between old and new instead of applying it raw.
  const offsetX = useSharedValue(offsetDx);
  const offsetY = useSharedValue(offsetDy);
  const scale = useSharedValue(position === 56 ? 0.68 : 1);
  const prevPosition = useRef(position);
  // Set the instant a hop starts, cleared once it finishes. Lets the
  // eligibility effect below tell "this piece just got tapped and is
  // moving" apart from "some other piece got tapped, so this one's glow
  // just turns off" — the two need different pulse treatment (see below).
  const movingRef = useRef(false);
  // The handle for the timer that clears movingRef. Kept so a move that is
  // interrupted — captured mid-walk, or moved again on a second banked value —
  // cancels its predecessor. Untracked, the FIRST walk's timer would still fire
  // on the ORIGINAL duration and drop movingRef while the second walk was still
  // running, which let the goal-arrival reshuffle above run mid-animation.
  const moveTimer = useRef(null);

  useEffect(() => {
    // Only reposition if we are already sitting at the goal and another token arrives.
    if (position === 56 && !movingRef.current) {
      const coords = getTileCoords(player, 56, pieceIndex, goalIndex, totalGoaled);
      left.value = withTiming(coords.left, timing({ duration: 300 }));
      top.value = withTiming(coords.top, timing({ duration: 300 }));
    }
  }, [goalIndex, totalGoaled]);

  useEffect(() => {
    if (eligible) {
      glowOpacity.value = withTiming(1, timing({ duration: 150 }));
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear, reduceMotion: NO_REDUCE }),
        -1,
        false
      );
    } else {
      glowOpacity.value = withTiming(0, timing({ duration: 150 }));
      cancelAnimation(rotation);
    }
  }, [eligible]);

  useEffect(() => {
    offsetX.value = withTiming(offsetDx, timing({ duration: 200 }));
    offsetY.value = withTiming(offsetDy, timing({ duration: 200 }));
  }, [offsetDx, offsetDy]);

  useEffect(() => {
    // One pending timer at a time, always the current move's.
    const endMoveAfter = (ms) => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => {
        moveTimer.current = null;
        movingRef.current = false;
      }, ms);
    };

    if (prevPosition.current !== position) {
      const oldPos = prevPosition.current;
      const newPos = position;

      // before the bounce below gets a chance to run.
      movingRef.current = true;

      // Hand the mask at the centre of the board this piece's position using
      // the SAME tween the piece itself is running — same target, same
      // duration — so the eyes and the token are driven by one clock and the
      // gaze tracks it continuously, frame for frame, rather than snapping to
      // wherever it happened to land.
      const focus = (l, t, duration) => {
        if (!gaze) return;
        gaze.x.value = withTiming(l + TOKEN_HALF, timing({ duration }));
        gaze.y.value = withTiming(t + TOKEN_HALF, timing({ duration }));
      };

      if (newPos === -1) {
        // Tell App.js's "look at whoever's next" glance to hold off until
        // this hop is actually done — otherwise it fires the instant the
        // turn passes (same state update as this move) and the eyes flick
        // away mid-animation, then snap back. See gazeBusyUntil in App.js.
        if (gaze) gaze.busyUntil.value = Date.now() + HOME_MS;

        const target = getTileCoords(player, -1, pieceIndex);
        left.value = withTiming(target.left, timing({ duration: HOME_MS }));
        top.value = withTiming(target.top, timing({ duration: HOME_MS }));
        scale.value = withTiming(1, timing({ duration: HOME_MS }));
        // Watch it get sent home too.
        focus(target.left, target.top, HOME_MS);
        endMoveAfter(HOME_MS);
      } else if (newPos < oldPos || (oldPos === -1 && newPos > 0)) {
        if (gaze) gaze.busyUntil.value = Date.now() + 220;
        const target = getTileCoords(player, newPos, pieceIndex, goalIndex, totalGoaled);
        left.value = withTiming(target.left, timing({ duration: 220 }));
        top.value = withTiming(target.top, timing({ duration: 220 }));
        scale.value = withTiming(newPos === 56 ? 0.68 : 1, timing({ duration: 220 }));
        focus(target.left, target.top, 220);
        endMoveAfter(220);
      } else {
        const steps = stepsBetween(oldPos, newPos)
          .map(pos => getTileCoords(player, pos, pieceIndex));

        if (gaze) gaze.busyUntil.value = Date.now() + steps.length * STEP_MS;

        // The whole walk is handed over as one sequence per value, so it runs
        // on the UI thread start to finish. It used to be a JS loop awaiting a
        // setTimeout per square, which meant every hop was re-issued from the
        // JS thread — the one busy re-rendering the board — and any hitch
        // there landed as a stutter between squares.
        const hop = (v) => withTiming(v, timing({ duration: STEP_MS }));
        left.value = withSequence(NO_REDUCE, ...steps.map(st => hop(st.left)));
        top.value = withSequence(NO_REDUCE, ...steps.map(st => hop(st.top)));
        scale.value = withTiming(newPos === 56 ? 0.68 : 1, timing({ duration: steps.length * STEP_MS }));
        if (gaze) {
          gaze.x.value = withSequence(NO_REDUCE, ...steps.map(st => hop(st.left + TOKEN_HALF)));
          gaze.y.value = withSequence(NO_REDUCE, ...steps.map(st => hop(st.top + TOKEN_HALF)));
        }
        endMoveAfter(steps.length * STEP_MS);
      }
      prevPosition.current = position;
    }
  }, [position]);

  // Nothing should be left ticking against a token that has gone away — a
  // finished game, a rematch, or an exit unmounts all sixteen at once.
  useEffect(() => () => {
    if (moveTimer.current) clearTimeout(moveTimer.current);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // No scale here on purpose. A token used to pop to 130% and back on every
    // square it crossed, which read as the board zooming rather than as a
    // piece moving. Crossing the square is the feedback.
    const transform = [];
    if (offsetX.value !== 0) {
      transform.push({ translateX: offsetX.value });
    }
    if (offsetY.value !== 0) {
      transform.push({ translateY: offsetY.value });
    }
    if (scale.value !== 1) {
      transform.push({ scale: scale.value });
    }

    return {
      left: (left.value / 100) * boardSize,
      top: (top.value / 100) * boardSize,
      transform: transform.length > 0 ? transform : undefined
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ rotate: `${rotation.value}deg` }]
  }));

  const theme = COIN_THEMES[player] || COIN_THEMES.RED;

  const handlePress = () => {
    movingRef.current = true;
    onPress(id);
  };

  const isTurnPiece = !activePlayer || (player === activePlayer && turnPhase !== 'WAITING_FOR_ROLL');

  return (
    // Tokens sharing a tile overlap almost completely — a 4px nudge apart on a
    // token several times that wide — so whichever paints last swallows taps
    // over nearly the whole square. Lifting the movable ones above the rest
    // means the token the player is actually allowed to move is the one under
    // their finger, instead of an opponent that happens to sit on top.
    <Animated.View
      pointerEvents={eligible ? 'auto' : 'none'}
      style={[
        styles.tokenContainer,
        { zIndex: position === 56 ? 100 : ((eligible ? 30 : 10) + stackIndex) },
        dimmed ? styles.tokenDimmed : null,
        animatedStyle
      ]}
    >
      {hasPointer && (
        <BouncingArrow
          color={theme.glow || '#FFB300'}
          style={styles.tokenPointerTop}
        />
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!eligible}
        onPress={handlePress}
        style={styles.tokenTouchable}
        accessibilityRole="button"
        accessibilityLabel={`Move ${player.toLowerCase()} token`}
        accessibilityState={{ disabled: !eligible }}
      >

        {eligible && (
          <Animated.View
            pointerEvents="none"
            // @ts-ignore
            className={Platform.OS === 'web' ? 'ludo-rotating-ring' : undefined}
            style={[
              styles.glowRingContainer,
              Platform.OS === 'web'
                ? { opacity: 1, animation: 'ludo-token-spin-kf 3s linear infinite', transformOrigin: '50% 50%' }
                : animatedGlowStyle,
              {
                shadowColor: theme.darkGlow,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 10,
              }
            ]}
          >
          <Svg width="100%" height="100%" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
            {/* Soft white outer glow */}
            <Circle cx="50" cy="50" r="46" stroke="#FFFFFF" strokeWidth="4" opacity="0.35" fill="none" />
            <Circle cx="50" cy="50" r="46" stroke="#FFFFFF" strokeWidth="2" opacity="0.75" fill="none" />

            {/* Colored Base Glow */}
            <Circle cx="50" cy="50" r="46" stroke={theme.darkGlow} strokeWidth="8" opacity="0.6" fill="none" />

            {/* The main base-colored circular ring */}
            <Circle cx="50" cy="50" r="46" stroke={theme.darkGlow} strokeWidth="3" opacity="1" fill="none" />

            {/* Colored Base Glow for ticks (NEW) */}
            <Line x1="50" y1="1" x2="50" y2="7" stroke={theme.darkGlow} strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <Line x1="50" y1="93" x2="50" y2="99" stroke={theme.darkGlow} strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <Line x1="1" y1="50" x2="7" y2="50" stroke={theme.darkGlow} strokeWidth="8" opacity="0.6" strokeLinecap="round" />
            <Line x1="93" y1="50" x2="99" y2="50" stroke={theme.darkGlow} strokeWidth="8" opacity="0.6" strokeLinecap="round" />

            {/* 4 small lines (ticks) matching the base color with soft white glow */}
            <Line x1="50" y1="1" x2="50" y2="7" stroke="#FFFFFF" strokeWidth="4" opacity="0.45" strokeLinecap="round" />
            <Line x1="50" y1="93" x2="50" y2="99" stroke="#FFFFFF" strokeWidth="4" opacity="0.45" strokeLinecap="round" />
            <Line x1="1" y1="50" x2="7" y2="50" stroke="#FFFFFF" strokeWidth="4" opacity="0.45" strokeLinecap="round" />
            <Line x1="93" y1="50" x2="99" y2="50" stroke="#FFFFFF" strokeWidth="4" opacity="0.45" strokeLinecap="round" />

            <Line x1="50" y1="1" x2="50" y2="7" stroke={theme.darkGlow} strokeWidth="2.5" opacity="1" strokeLinecap="round" />
            <Line x1="50" y1="93" x2="50" y2="99" stroke={theme.darkGlow} strokeWidth="2.5" opacity="1" strokeLinecap="round" />
            <Line x1="1" y1="50" x2="7" y2="50" stroke={theme.darkGlow} strokeWidth="2.5" opacity="1" strokeLinecap="round" />
            <Line x1="93" y1="50" x2="99" y2="50" stroke={theme.darkGlow} strokeWidth="2.5" opacity="1" strokeLinecap="round" />

            <Line x1="50" y1="2" x2="50" y2="6" stroke="#FFFFFF" strokeWidth="1" opacity="0.9" strokeLinecap="round" />
            <Line x1="50" y1="94" x2="50" y2="98" stroke="#FFFFFF" strokeWidth="1" opacity="0.9" strokeLinecap="round" />
            <Line x1="2" y1="50" x2="6" y2="50" stroke="#FFFFFF" strokeWidth="1" opacity="0.9" strokeLinecap="round" />
            <Line x1="94" y1="50" x2="98" y2="50" stroke="#FFFFFF" strokeWidth="1" opacity="0.9" strokeLinecap="round" />
          </Svg>
        </Animated.View>
        )}
        <CoinMedallion player={player} fireUsed={fireUsed} gustUsed={gustUsed} />

        {shielded && <IceShield />}
      </TouchableOpacity>
    </Animated.View>
  );
});

// The 6-or-4 prompt. Only ever shown for a token that can genuinely spend more
// than one of the banked values — with a single option there is nothing to ask,
// so the tap just moves it. Sits above the token in the parent rather than
// inside it, so the token's own pulse/hop transforms don't drag it around.
const TOKEN_SIZE_PCT = 6.6;

const ValueChooser = ({ piece, values, boardSize, onChoose, onCancel, gustActive = false }) => {
  const pieceIndex = parseInt(piece.id.split('_')[1]);
  const { left, top } = getTileCoords(piece.player, piece.relativePosition, pieceIndex);
  const theme = COIN_THEMES[piece.player] || COIN_THEMES.RED;

  const tokenSize = (TOKEN_SIZE_PCT / 100) * boardSize;
  const halfToken = tokenSize / 2;
  const centerX = (left / 100) * boardSize + halfToken;
  const tokenTop = (top / 100) * boardSize;

  const chipW = gustActive ? 42 : 28;
  const width = values.length * chipW + (values.length - 1) * 4 + 12;

  // Smart placement: if token is too close to top edge, flip below token
  const chooserTop = tokenTop < 38 ? tokenTop + tokenSize + 8 : tokenTop - 36;
  const chooserLeft = Math.max(4, Math.min(boardSize - width - 4, centerX - width / 2));

  return (
    <>
      {/* Tap anywhere else to back out of the choice. */}
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, { zIndex: 99998 }]}
        activeOpacity={1}
        onPress={onCancel}
      />
      <View
        style={[
          styles.chooser,
          {
            width,
            top: chooserTop,
            left: chooserLeft,
            backgroundColor: theme.chooserBg || 'rgba(20, 20, 20, 0.94)',
            borderColor: theme.darkGlow,
            shadowColor: theme.darkGlow,
          }
        ]}
      >
        {values.map(v => (
          <TouchableOpacity
            key={v}
            style={[
              styles.chooserChip,
              {
                width: chipW,
                backgroundColor: theme.primary,
                borderColor: '#FFFFFF',
              }
            ]}
            activeOpacity={0.8}
            onPress={() => onChoose(v)}
          >
            <Text style={styles.chooserChipText}>{gustActive ? `${v}+9` : v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
};

const getStackOffset = (stackIndex, stackCount, offsetAmt) => {
  if (stackCount <= 1) return { dx: 0, dy: 0 };
  if (stackCount === 2) {
    // Upper token (index 1) is up and left (-dx, -dy); below token (index 0) is down and right (+dx, +dy)
    return stackIndex === 1
      ? { dx: -offsetAmt, dy: -offsetAmt }
      : { dx: offsetAmt, dy: offsetAmt };
  }
  // 3 or more: distribute across corners with upper-most at top-left (-dx, -dy)
  const positions = [
    { dx: offsetAmt, dy: offsetAmt },    // bottom-right
    { dx: -offsetAmt, dy: offsetAmt },   // bottom-left
    { dx: offsetAmt, dy: -offsetAmt },   // top-right
    { dx: -offsetAmt, dy: -offsetAmt },  // top-left
  ];
  if (stackCount === 3) {
    if (stackIndex === 0) return positions[0];
    if (stackIndex === 1) return positions[1];
    return positions[3];
  }
  return positions[stackIndex % positions.length];
};

const Tokens = ({
  pieces,
  eligiblePieces,
  onPiecePress,
  boardSize,
  shieldOwner = null,
  gustOwner = null,
  gaze = null,
  choicePiece = null,
  choiceValues = [],
  onChooseValue = null,
  onCancelChoice = null,
  activePlayer = null,
  turnPhase = null,
  fireTrail = null,
  gustTrail = null,
  spotlightPiece = null,
  tokenTooltip = null,
  dimOtherTokens = true,
}) => {
  const tileGroups = {};
  const goaledPieces = { GREEN: [], YELLOW: [], BLUE: [], RED: [] };

  pieces.forEach(piece => {
    if (piece.relativePosition === 56) {
      goaledPieces[piece.player].push(piece.id);
      return;
    }
    if (piece.relativePosition === -1) return;
    const pieceIndex = parseInt(piece.id.split('_')[1]);
    const { left, top } = getTileCoords(piece.player, piece.relativePosition, pieceIndex);
    const key = `${left.toFixed(1)},${top.toFixed(1)}`;
    if (!tileGroups[key]) tileGroups[key] = [];
    tileGroups[key].push(piece.id);
  });

  Object.keys(goaledPieces).forEach(p => goaledPieces[p].sort());

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20, elevation: 20 }]} pointerEvents="box-none">
      {pieces.map((piece) => {
        const isEligible = eligiblePieces.includes(piece.id);

        let goalIndex = 0;
        let totalGoaled = 1;
        if (piece.relativePosition === 56) {
          goalIndex = goaledPieces[piece.player].indexOf(piece.id);
          totalGoaled = goaledPieces[piece.player].length;
        }

        let stackOffset = { dx: 0, dy: 0 };
        let stackCount = 1;
        let stackIndex = 0;
        if (piece.relativePosition >= 0 && piece.relativePosition < 56) {
          const pieceIndex = parseInt(piece.id.split('_')[1]);
          const { left, top } = getTileCoords(piece.player, piece.relativePosition, pieceIndex);
          const key = `${left.toFixed(1)},${top.toFixed(1)}`;
          const group = tileGroups[key];

          if (group && group.length > 1) {
            stackCount = group.length;
            stackIndex = group.indexOf(piece.id);
            const offsetAmt = Math.max(3.5, Math.round((boardSize || 360) * 0.011));
            stackOffset = getStackOffset(stackIndex, stackCount, offsetAmt);
          }
        }

        const isGustActive = gustOwner === piece.player &&
          piece.relativePosition >= 0 &&
          piece.relativePosition < 56 &&
          (choicePiece ? choicePiece.id === piece.id : (isEligible || eligiblePieces.length === 0));

        return (
          <Token
            key={piece.id}
            id={piece.id}
            player={piece.player}
            position={piece.relativePosition}
            eligible={isEligible}
            dimmed={dimOtherTokens && Boolean(spotlightPiece) && spotlightPiece !== piece.id}
            hasPointer={Boolean(spotlightPiece) && spotlightPiece === piece.id && isEligible}
            onPress={onPiecePress}
            offsetDx={stackOffset.dx}
            offsetDy={stackOffset.dy}
            boardSize={boardSize}
            shielded={shieldOwner === piece.player && piece.relativePosition !== 56}
            fireUsed={fireTrail && fireTrail.pieceId === piece.id}
            gustUsed={gustTrail && gustTrail.pieceId === piece.id}
            gaze={gaze}
            activePlayer={activePlayer}
            turnPhase={turnPhase}
            goalIndex={goalIndex}
            totalGoaled={totalGoaled}
            stackCount={stackCount}
            stackIndex={stackIndex}
          />
        );
      })}

      {choicePiece && choiceValues.length > 1 && (
        <ValueChooser
          piece={choicePiece}
          values={choiceValues}
          boardSize={boardSize}
          onChoose={onChooseValue}
          onCancel={onCancelChoice}
          gustActive={gustOwner === choicePiece.player}
        />
      )}

      {spotlightPiece && tokenTooltip && (() => {
        const piece = pieces.find(p => p.id === spotlightPiece);
        if (!piece) return null;
        const pieceIndex = parseInt(piece.id.split('_')[1]);
        const { left, top } = getTileCoords(piece.player, piece.relativePosition, pieceIndex);
        const tokenSize = (TOKEN_SIZE_PCT / 100) * boardSize;
        const halfToken = tokenSize / 2;
        const centerX = (left / 100) * boardSize + halfToken;
        const tokenTop = (top / 100) * boardSize;
        const tokenBottom = tokenTop + tokenSize;
        const tooltipW = 210;
        const tooltipLeft = Math.max(8, Math.min(boardSize - tooltipW - 8, centerX - tooltipW / 2));
        const triangleOffset = Math.max(-tooltipW / 2 + 16, Math.min(tooltipW / 2 - 16, centerX - (tooltipLeft + tooltipW / 2)));
        const theme = COIN_THEMES[piece.player] || COIN_THEMES.RED;

        return (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: tokenBottom + 4,
              left: tooltipLeft,
              width: tooltipW,
              zIndex: 99999,
              elevation: 99999,
            }}
          >
            <TutorialTooltip
              resultMessage={tokenTooltip.result}
              actionText={tokenTooltip.action}
              tint={theme.glow || '#FFB300'}
              triangleOffset={triangleOffset}
              maxWidth={tooltipW}
              onPress={() => onPiecePress && onPiecePress(piece.id)}
            />
          </View>
        );
      })()}
    </View>
  );
};

const styles = StyleSheet.create({
  chooser: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(10, 10, 14, 0.95)',
    zIndex: 99999,
    elevation: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  chooserChip: {
    width: 28,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserChipText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  tokenContainer: {
    position: 'absolute',
    width: '6.6%',
    height: '6.6%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tokenDimmed: { opacity: 0.18 },
  tokenPointerTop: {
    position: 'absolute',
    top: -44,
    alignSelf: 'center',
    zIndex: 9999,
  },
  tokenEligible: {
    zIndex: 20,
  },
  tokenTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
  },
  glowRingContainer: {
    position: 'absolute',
    width: '112%',
    height: '112%',
    left: '-6%',
    top: '-6%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  coinWrapper: {
    position: 'absolute',
    width: '94%',
    height: '94%',
    left: '3%',
    top: '3%',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 3.5,
    elevation: 6,
    overflow: 'hidden',
  },
  symbolImage: {
    width: '100%',
    height: '100%',
  },
  symbolImageInset: {
    width: '90%',
    height: '90%',
  },
  symbolOverlay: {
    position: 'absolute',
    width: '54%',
    height: '54%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
  }
});

// The pieces array is new on every action — it has to be, or nothing would
// redraw — but the sixteen Tokens inside are memoized on what they actually
// draw, so a roll costs one pass over this list and zero token re-renders.
export default memo(Tokens);
