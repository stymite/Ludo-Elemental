import React, { useEffect, useState, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSequence,
  withRepeat,
  Easing
} from 'react-native-reanimated';
import Svg, { Rect, Path } from 'react-native-svg';
// Ionicons, not FontAwesome5, for the one skull on a burned die: pulling in the
// FontAwesome5 family shipped 359 KB of .ttf (solid + regular + brands) to draw a
// single 20px glyph that Ionicons already has.
import Ionicons from '@expo/vector-icons/Ionicons';
import { NO_REDUCE, timing } from '../motion';
import { PowerRing, ChargeReadout, PowerButton, PowerBadge } from './ElementPower';
import BouncingArrow from './BouncingArrow';
import TutorialTooltip from './TutorialTooltip';

// Bitmaps, not the source SVGs. Every one of those faces is traced artwork —
// r6 alone is 1,292 <path> elements — and a die is drawn at 38px, where none of
// that detail survives. Four dice on screen meant ~4,000 vector nodes for four
// thumbnails. These are the same drawings rendered once at 128px.
// Re-export at that size from the .svg of the same name if the art changes.
import Dice0 from '../assets/r0.png';
import Dice1 from '../assets/r1.png';
import Dice2 from '../assets/r2.png';
import Dice3 from '../assets/r3.png';
import Dice4 from '../assets/r4.png';
import Dice5 from '../assets/r5.png';
import Dice6 from '../assets/r6.png';

const DiceFaces = {
  1: Dice1,
  2: Dice2,
  3: Dice3,
  4: Dice4,
  5: Dice5,
  6: Dice6,
};

const PLAYER_COLORS = {
  GREEN: '#4CAF50',
  YELLOW: '#FFB300', // Golden/orangey for better visibility on white
  RED: '#E60026',
  BLUE: '#2196F3',
};

const DICE_SIZE = 38;

// The tumble, in three segments: two constant-speed revolutions and a settle.
// The scale pop below splits the same total differently, and the timer that
// clears the "rolling" flag reads ROLL_MS, so all three stay in step.
const SPIN = [110, 140, 210];
const ROLL_MS = SPIN[0] + SPIN[1] + SPIN[2];

// The outline around a die doubles as that seat's shot clock. It was decoration
// before; making it the timer means the countdown lives exactly where the
// player is already looking instead of somewhere else on screen.
const RING_PAD = 6;      // gap between die and ring
const RING_STROKE = 3;
const RING_SIZE = DICE_SIZE + RING_PAD * 2;
const RING_RADIUS = 12;

// Perimeter of a rounded rect: the four straight runs plus one full circle
// worth of corners. Used as the dash length so a full stroke is exactly 100%.
const RING_LENGTH =
  2 * (RING_SIZE - RING_STROKE - 2 * RING_RADIUS) * 2 +
  2 * Math.PI * RING_RADIUS;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// The arrow over the active seat bobs forever. On web an endless Reanimated
// animation keeps its frame loop awake, and that loop re-evaluates EVERY
// animated style in the tree on every frame — sixteen tokens and four dice,
// none of which are moving. Handing this one to CSS lets the loop go quiet
// between moves. Same trick, same reason, as the token glow in Tokens.js.
const WEB_BOB = Platform.OS === 'web';
if (WEB_BOB && typeof document !== 'undefined') {
  const styleId = 'ludo-dice-bob-css';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @keyframes ludo-dice-bob-down-kf {
        from { transform: translateY(0px); }
        to { transform: translateY(6px); }
      }
      @keyframes ludo-dice-bob-up-kf {
        from { transform: translateY(0px); }
        to { transform: translateY(-6px); }
      }
      @keyframes ludo-ring-sweep-kf {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: var(--ludo-ring-length); }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

/**
 * Depletes from full to empty over `duration` ms, restarting whenever `runKey`
 * changes — the key is what makes a new turn start a fresh countdown rather
 * than resuming the last one.
 *
 * Deliberately linear: a timer that eases is lying about how much time is left.
 * It also opts out of reduce-motion, because this is information rather than
 * decoration — a player who cannot see the sweep cannot tell they are about to
 * be auto-played.
 */
// Web draws the sweep with a keyframe. It is the same linear depletion, but
// react-native-svg's animated props go through JS on this platform and rewrite
// every attribute of the rect several times a frame — thousands of DOM writes
// for one shrinking dash. CSS does it on the compositor for nothing.
const WebRing = ({ colour, duration }) => (
  <View pointerEvents="none" style={styles.ring}>
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Rect
        x={RING_STROKE / 2}
        y={RING_STROKE / 2}
        width={RING_SIZE - RING_STROKE}
        height={RING_SIZE - RING_STROKE}
        rx={RING_RADIUS}
        ry={RING_RADIUS}
        fill="none"
        stroke={colour}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        style={{
          '--ludo-ring-length': RING_LENGTH,
          animation: `ludo-ring-sweep-kf ${duration}ms linear forwards`
        }}
      />
    </Svg>
  </View>
);

const NativeRing = ({ colour, duration }) => {
  const left = useSharedValue(1);

  // Starts on mount and runs once. The countdown is this component's whole
  // reason to exist, so there is nothing to restart — a new turn mounts a new
  // one (see the key below).
  useEffect(() => {
    left.value = withTiming(0, {
      duration,
      easing: Easing.linear,
      reduceMotion: NO_REDUCE
    });
  }, []);

  // One animated attribute, not two. Opacity sat in here as a constant, and a
  // constant in an animated prop is still written out on every frame.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - left.value)
  }));

  return (
    <View pointerEvents="none" style={styles.ring}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <AnimatedRect
          x={RING_STROKE / 2}
          y={RING_STROKE / 2}
          width={RING_SIZE - RING_STROKE}
          height={RING_SIZE - RING_STROKE}
          rx={RING_RADIUS}
          ry={RING_RADIUS}
          fill="none"
          stroke={colour}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
};

// Unmounted unless a clock is actually running, which is the whole point: an
// animated SVG prop that exists is an animated SVG prop that ticks. Four of
// these sat mounted permanently, rewriting every attribute of their rect over a
// hundred times a second EACH — including in pass-and-play, which has no clock
// at all. Idle, that was ~7,000 DOM writes a second, and the single biggest
// reason the whole game felt heavy.
//
// runKey as the key rather than as a dependency: a fresh countdown is a fresh
// ring, and mounting one is how it starts.
const RunningRing = WEB_BOB ? WebRing : NativeRing;

const TimerRing = ({ colour, duration, runKey, running }) => (
  running && duration
    ? <RunningRing key={runKey} colour={colour} duration={duration} />
    : null
);

// Dice0 is the "?" face: no roll yet, or a value outside 1-6.
const DiceFace = ({ value }) => {
  const source = DiceFaces[value] || Dice0;
  return (
    <View style={styles.diceFace}>
      <Image source={source} style={styles.diceImage} resizeMode="cover" />
    </View>
  );
};

// The values this seat has rolled but not yet spent. A six hands the dice
// straight back, so this is where it waits while the next number is rolled —
// it's the only on-screen record that the 6 in "6 and 4" is still owed.
const BankedRolls = ({ rolls, color, mustRollAgain }) => {
  if (!rolls || rolls.length === 0) return null;
  // "if it is number without any 6, no need to show visibilty tho.."
  // Only hide if it's a single roll that isn't a 6
  if (rolls.length === 1 && rolls[0] !== 6) return null;

  return (
    <View style={styles.bankContainer}>
      <View style={styles.bankChipsRow}>
        {rolls.map((v, i) => (
          <View key={`${v}_${i}`} style={[styles.bankChip, { borderColor: color }]}>
            <Text style={[styles.bankChipText, { color }]}>{v}</Text>
          </View>
        ))}
      </View>
      {mustRollAgain && (
        <Text style={styles.bankHint} numberOfLines={1}>
          ROLL AGAIN
        </Text>
      )}
    </View>
  );
};

const Dice = ({
  player,
  value,
  // Bumped by the engine on every roll. The value cannot stand in for it — two
  // fours in a row are the same number, and the die used to sit dead still on
  // the second one.
  rollSeq = 0,
  isActive,
  awaitingRoll = false,
  pendingRolls = [],
  mustRollAgain = false,
  onRoll,
  disabled,
  points = 0,
  threshold = 40,
  abilityReady = false,
  canUsePower = false,
  // Shot clock. duration is ms (null = no clock, e.g. pass-and-play), and
  // timerKey restarts the sweep — change it whenever a new countdown begins.
  timerDuration = null,
  timerKey = 0,
  armed = false,
  boostIcon = false,
  badgeMode = null,
  onUsePower,
  avatarUrl = null,
  // Online, a player without a picture shows their name on the power button.
  playerName = null,
  isBurned = false,
  showPower = true,
  showPointer = true,
  showPowerPointer = false,
  showPowerTooltip = false,
  showDiceTooltip = false,
  tooltipResult = null,
  tooltipAction = null,
  forcePointer = false,
  forcePointerAbove = false,
  accessibilityLabel = null,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const pointerOffset = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(value || null);
  // True only while this die is tumbling. A roll that leaves nothing playable
  // ends the turn the instant it lands, so without this the die dimmed to a
  // background seat's 18% halfway through its own animation — the roll was
  // over before it was legible.
  const [rolling, setRolling] = useState(false);

  const isTopRow = player === 'GREEN' || player === 'YELLOW';
  const isPointerAbove = isTopRow || forcePointerAbove;
  const isRightSide = player === 'YELLOW' || player === 'BLUE';
  const playerColor = PLAYER_COLORS[player] || '#FF9800';

  const progress = threshold > 0 ? points / threshold : 0;

  const prevRollRef = useRef(rollSeq);
  const rollSettleRef = useRef(null);

  const playRollAnimation = (targetValue) => {
    if (!targetValue) return;
    if (rollSettleRef.current) clearTimeout(rollSettleRef.current);
    setRolling(true);

    // The face is the rolled number for the whole tumble, set once. It used to
    // cycle eight random faces on a 45ms interval and only then land on the
    // real one — nine state updates and nine bitmap swaps fighting the spin
    // below for the same 460ms. On a phone that reads as a die flickering
    // through numbers and then changing its mind, not a die rolling. The
    // motion is the rotation; the face only has to be legible when it stops.
    setDisplayValue(targetValue);

    // Three full revolutions, then a settle.
    rotation.value = withSequence(
      NO_REDUCE,
      withTiming(0, timing({ duration: 0 })),
      withTiming(360, timing({ duration: SPIN[0], easing: Easing.linear })),
      withTiming(720, timing({ duration: SPIN[1], easing: Easing.linear })),
      withTiming(1080, timing({ duration: SPIN[2], easing: Easing.out(Easing.cubic) }))
    );
    scale.value = withSequence(
      NO_REDUCE,
      withTiming(1.3, timing({ duration: 110 })),
      withTiming(1.15, timing({ duration: 160 })),
      withTiming(1.0, timing({ duration: 190, easing: Easing.out(Easing.back(1.4)) }))
    );

    // Drops the "still tumbling" flag when the sequences above finish, so the
    // die does not dim to a background seat's opacity mid-spin. One timer, one
    // state update per roll.
    rollSettleRef.current = setTimeout(() => {
      rollSettleRef.current = null;
      setRolling(false);
    }, ROLL_MS);
  };

  useEffect(() => {
    return () => {
      if (rollSettleRef.current) clearTimeout(rollSettleRef.current);
    };
  }, []);

  useEffect(() => {
    if (!value) {
      if (rollSettleRef.current) {
        clearTimeout(rollSettleRef.current);
        rollSettleRef.current = null;
      }
      rotation.value = 0;
      scale.value = 1;
      setDisplayValue(null);
      setRolling(false);
      prevRollRef.current = rollSeq;
      return;
    }

    if (rollSeq && rollSeq !== prevRollRef.current) {
      prevRollRef.current = rollSeq;
      playRollAnimation(value);
    } else {
      prevRollRef.current = rollSeq;
      setDisplayValue(value);
    }
  }, [value, rollSeq]);

  useEffect(() => {
    if (WEB_BOB) return; // CSS runs it on web, see WEB_BOB above
    if (isActive && !disabled) {
      pointerOffset.value = withRepeat(
        withSequence(
          NO_REDUCE,
          withTiming(isPointerAbove ? 6 : -6, timing({ duration: 400 })),
          withTiming(0, timing({ duration: 400 }))
        ),
        -1,
        true,
        undefined,
        NO_REDUCE
      );
    } else {
      pointerOffset.value = 0;
    }
  }, [isActive, disabled, isPointerAbove]);


  const handlePress = () => {
    if (disabled || !isActive) return;
    // The spin is not started here: the effect above runs the moment the new
    // roll lands in state, which offline is the very next frame. Starting it
    // here too meant every local roll played the animation twice.
    onRoll();
  };

  const animatedDiceStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value }
      ],
      opacity: isActive || rolling ? 1 : 0.18,
    };
  });

  const pointerLive = showPointer && isActive && (forcePointer || !disabled);
  const animatedPointerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: pointerOffset.value }],
      opacity: pointerLive ? 1 : 0,
    };
  });

  // Web gets the same bob out of a keyframe instead — and no animation at all
  // when it is not this seat's turn, so an idle arrow costs nothing.
  const pointerStyle = WEB_BOB
    ? {
      opacity: pointerLive ? 1 : 0,
      animation: pointerLive
        ? `ludo-dice-bob-${isPointerAbove ? 'down' : 'up'}-kf 400ms ease-in-out infinite alternate`
        : 'none',
    }
    : animatedPointerStyle;


  const renderDiceCol = () => {
    const isRightBank = player === 'RED' || player === 'GREEN';

    return (
      <View style={styles.diceCol}>
        {/* Standalone Dice with roll animation */}
        <View style={styles.diceWrapper}>
          <TimerRing
            colour={playerColor}
            duration={timerDuration}
            runKey={timerKey}
            running={Boolean(timerDuration) && isActive}
          />
          <Animated.View style={animatedDiceStyle}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePress}
              disabled={!!disabled || !isActive}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel || `${player.toLowerCase()} dice`}
              accessibilityState={{ disabled: !!disabled || !isActive }}
            >
              <View>
                <DiceFace value={displayValue} />
                {isBurned && (
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8 }]}>
                    <Ionicons name="skull" size={20} color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Absolute Arrow above for Top Row or forcePointerAbove */}
        {isPointerAbove && (
          <Animated.View style={[styles.pointerTop, pointerStyle]}>
            <Svg width="32" height="38" viewBox="0 0 32 38">
              <Path
                d="M16 37 C16 37 27 24 29 20 C30 18 28.5 17 26 18 C23.5 19 21.5 19.5 20.5 19.5 L17.5 3 C17.5 1.5 14.5 1.5 14.5 3 L11.5 19.5 C10.5 19.5 8.5 19 6 18 C3.5 17 2 18 3 20 C5 24 16 37 16 37 Z"
                fill={playerColor}
              />
            </Svg>
          </Animated.View>
        )}

        {/* Absolute Arrow below for Bottom Row when not forced above */}
        {!isPointerAbove && (
          <Animated.View style={[styles.pointerBottom, pointerStyle]}>
            <Svg width="32" height="38" viewBox="0 0 32 38">
              <Path
                d="M16 1 C16 1 27 14 29 18 C30 20 28.5 21 26 20 C23.5 19 21.5 18.5 20.5 18.5 L17.5 35 C17.5 36.5 14.5 36.5 14.5 35 L11.5 18.5 C10.5 18.5 8.5 19 6 20 C3.5 21 2 20 3 18 C5 14 16 1 16 1 Z"
                fill={playerColor}
              />
            </Svg>
          </Animated.View>
        )}

        {/* Banked numbers directly left or right of the rolling dice */}
        <View style={isRightBank ? styles.bankAbsoluteRight : styles.bankAbsoluteLeft}>
          {renderBank()}
        </View>
      </View>
    );
  };

  // Sits next to the dice. Renders nothing at all when the bank is empty,
  // which is the normal case — no reserved gap, no layout shift.
  // App.js already hands over an empty list for a seat that is not up, so this
  // does not second-guess it — during the beat where a token is still travelling
  // nobody is "active" and the bank would otherwise blink out and back.
  const renderBank = () => (
    <BankedRolls
      rolls={pendingRolls}
      color={playerColor}
      mustRollAgain={mustRollAgain}
    />
  );

  const renderPower = () => (
    <View style={styles.meterColumn}>
      {showPowerPointer && (
        <BouncingArrow color={playerColor} style={styles.powerPointerTop} />
      )}
      <PowerButton
        player={player}
        points={points}
        threshold={threshold}
        progress={progress}
        ready={abilityReady}
        enabled={canUsePower}
        armed={armed}
        boostIcon={boostIcon}
        onPress={onUsePower}
        size={58}
        avatarUrl={avatarUrl}
        name={playerName}
      />
    </View>
  );

  return (
    <View style={styles.seatContainer}>
      <View style={styles.controlsRow}>
        {!isRightSide && showPower ? renderPower() : null}
        {renderDiceCol()}
        {isRightSide && showPower ? renderPower() : null}

        {/* Tutorial tooltip anchored to controlsRow so it NEVER goes off-screen */}
        {(showDiceTooltip || showPowerTooltip) && Boolean(tooltipResult?.trim?.() || tooltipAction?.trim?.()) && (
          <View
            style={[
              styles.tutorialTooltipPos,
              isRightSide ? styles.tutorialTooltipRight : styles.tutorialTooltipLeft,
            ]}
          >
            <TutorialTooltip
              resultMessage={tooltipResult}
              actionText={tooltipAction}
              tint={playerColor}
              triangleOffset={
                showPowerTooltip
                  ? (isRightSide ? 76 : -76)
                  : (isRightSide ? 15 : -15)
              }
              minWidth={160}
              maxWidth={220}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  seatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
    overflow: 'visible',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'visible',
  },
  bankAbsoluteLeft: {
    position: 'absolute',
    right: DICE_SIZE + 10,
    alignSelf: 'center',
    zIndex: 25,
  },
  bankAbsoluteRight: {
    position: 'absolute',
    left: DICE_SIZE + 10,
    alignSelf: 'center',
    zIndex: 25,
  },
  bankContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bankChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },
  bankChip: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 4.5,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  bankChipText: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  bankHint: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FF5252',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  diceCol: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointerTop: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    zIndex: 100,
    elevation: 100,
  },
  pointerBottom: {
    position: 'absolute',
    bottom: -46,
    alignSelf: 'center',
  },
  meterColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  powerPointerTop: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    zIndex: 100,
    elevation: 100,
  },
  tutorialTooltipPos: {
    position: 'absolute',
    top: 60,
    width: 215,
    zIndex: 99999,
    elevation: 99999,
  },
  tutorialTooltipLeft: {
    left: 0,
  },
  tutorialTooltipRight: {
    right: 0,
  },
  diceWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceGlow: {
    position: 'absolute',
    width: DICE_SIZE + 12,
    height: DICE_SIZE + 12,
    borderRadius: 12,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceImage: {
    width: '100%',
    height: '100%',
  },
  diceFace: {
    width: DICE_SIZE,
    height: DICE_SIZE,
    position: 'relative',
    borderRadius: 9,
    overflow: 'hidden',
  },
});

// Four of these on screen, each carrying a timer ring, a pointer and the whole
// power meter in SVG. Without this every one of them rebuilt on every state
// change in the game, including the three belonging to seats nothing had
// happened to.
export default memo(Dice);
