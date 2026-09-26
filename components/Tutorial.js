import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import Dice from './Dice';
import LudoBoard from './LudoBoard';
import Tokens, { travelMs, TOKENS_LAYER } from './Tokens';
import { WallMarker } from './Wall';
import StymiteFace from './StymiteFace';
import { LESSONS, createLesson, advanceLesson } from '../tutorial';
import { COLORS, SEAT, TYPE } from '../theme';

export function TutorialButton({ onPress, style }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open tutorial"
      style={({ pressed }) => [s.help, style, pressed ? s.pressed : null]}>
      <Ionicons name="help-circle-outline" size={20} color={COLORS.textHi} />
      <Text style={s.helpText}>TUTORIAL</Text>
    </Pressable>
  );
}

const BASES = [require('../assets/earth1.webp'), require('../assets/earth2.webp')];
const isTopSeat = player => player === 'GREEN' || player === 'YELLOW';
const isRightSeat = player => player === 'YELLOW' || player === 'BLUE';

function PlayerDice({ lesson, game, playerKey, enabled, moving, onRoll, powerAction, onUsePower, boardSize, resultMessage, actionText }) {
  const pKey = playerKey || lesson.player;
  const playerState = game.players[pKey];
  const rightSeat = isRightSeat(pKey);
  const diceValue = enabled ? null : (playerState.lastRoll ?? null);
  const isRedWaterTurn = lesson.id === 'water' && pKey === 'RED';
  const hasTooltip = !isRedWaterTurn && Boolean((resultMessage && resultMessage.trim?.()) || (actionText && actionText.trim?.()));
  return (
    <View style={[s.diceSeatRow, { width: boardSize, justifyContent: rightSeat ? 'flex-end' : 'flex-start' }]}>
      <Dice
        player={pKey}
        value={diceValue}
        rollSeq={game.rollSeq}
        isActive
        awaitingRoll={enabled && !moving}
        onRoll={onRoll}
        disabled={!enabled || moving}
        showPower={true}
        showPointer={enabled && !moving}
        forcePointerAbove={true}
        showPowerPointer={powerAction && !moving}
        showPowerTooltip={powerAction && !moving && hasTooltip}
        showDiceTooltip={enabled && !moving && hasTooltip}
        tooltipResult={isRedWaterTurn ? null : resultMessage}
        tooltipAction={isRedWaterTurn ? null : actionText}
        forcePointer={false}
        points={playerState.points}
        threshold={playerState.abilityThreshold}
        abilityReady={playerState.abilityReady}
        canUsePower={powerAction && !moving}
        onUsePower={onUsePower}
        accessibilityLabel="Roll the tutorial dice"
      />
    </View>
  );
}

function renderLessonTitle(title, tint, baseStyle) {
  const match = title ? title.match(/^(.*?)\s*(\(.*?\))$/) : null;
  if (!match) {
    return <Text accessibilityRole="header" style={baseStyle}>{title}</Text>;
  }
  return (
    <Text accessibilityRole="header" style={baseStyle}>
      {match[1]}
      {' '}
      <Text style={{ color: tint, opacity: 0.82 }}>{match[2]}</Text>
    </Text>
  );
}

function renderSummarySubtitle(title, tint, baseStyle) {
  const match = title ? title.match(/^(.*?)\s*(\(.*?\))$/) : null;
  if (!match) {
    return <Text style={[baseStyle, { color: tint }]}>{title}</Text>;
  }
  return (
    <Text style={baseStyle}>
      <Text style={{ color: COLORS.textHi }}>{match[1]}</Text>
      {' '}
      <Text style={{ color: tint, opacity: 0.82 }}>{match[2]}</Text>
    </Text>
  );
}

function SummaryCard({ lesson, tint, maxHeight, onClose }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [anim]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - anim.value) * 480 }
    ],
    opacity: Math.min(1, 0.2 + 0.8 * anim.value),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
  }));

  const handleClose = () => {
    anim.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(onClose)();
    });
  };

  return (
    <View style={s.summaryBackdrop} pointerEvents="box-none">
      <Animated.View style={[s.summaryDim, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss summary backdrop"
        />
      </Animated.View>

      <Animated.View style={[s.summaryCard, cardStyle, { maxHeight }]}>
        <View style={s.summaryHeader}>
          <View style={s.summaryTitleCol}>
            <Text style={s.summaryTitle}>Power Summary</Text>
            {renderSummarySubtitle(lesson.title, tint, s.summarySubtitle)}
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={({ pressed }) => [s.summaryCloseBtn, pressed ? s.summaryClosePressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Close power summary"
          >
            <Ionicons name="close" size={20} color={COLORS.textHi} />
          </Pressable>
        </View>

        <View style={s.summaryDivider} />

        <ScrollView
          style={s.summaryScroll}
          contentContainerStyle={s.summaryListContent}
          showsVerticalScrollIndicator={false}
        >
          {lesson.bullets.map((b, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={[s.bulletDot, { backgroundColor: tint }]}>
                <Ionicons name="checkmark" size={11} color={lesson.player === 'YELLOW' ? '#1B1B23' : '#FFFFFF'} />
              </View>
              <View style={s.bulletTextContainer}>
                <Text style={s.bulletText}>
                  <Text style={[s.bulletTitle, { color: COLORS.textHi }]}>{b.title}: </Text>
                  <Text style={s.bulletDesc}>{b.desc}</Text>
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default function Tutorial({ onClose }) {
  const [index, setIndex] = useState(0);
  const [timeline, setTimeline] = useState(() => [createLesson(LESSONS[0].id)]);
  const [cursor, setCursor] = useState(0);
  const [boardRevision, setBoardRevision] = useState(0);
  const [moving, setMoving] = useState(false);
  const [scoringAnimation, setScoringAnimation] = useState(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const locked = useRef(false);
  const timer = useRef(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const gazeX = useSharedValue(50);
  const gazeY = useSharedValue(50);
  const gazeBusyUntil = useSharedValue(0);
  const gaze = React.useMemo(() => ({ x: gazeX, y: gazeY, busyUntil: gazeBusyUntil }), []);
  const lesson = LESSONS[index];
  const game = timeline[cursor];
  const action = cursor;
  const done = action === lesson.actions.length;
  const player = game.players[lesson.player];
  const token = !done ? lesson.tokens?.[action] : null;
  const diceAction = !done && !token && lesson.actions[action].toLowerCase().includes('roll');
  const powerAction = !done && !token && lesson.actions[action].toLowerCase().includes('power');
  const nextRequired = done && !moving;
  const focus = moving ? 'watch' : done ? 'none' : token ? 'token' : diceAction ? 'dice' : powerAction ? 'power' : 'action';
  const tint = SEAT[lesson.player];

  const activeDicePlayer = game.activePlayer || lesson.player;
  const isDiceTop = isTopSeat(activeDicePlayer);

  useEffect(() => () => clearTimeout(timer.current), []);

  const readyForSummary = nextRequired && !scoringAnimation && Boolean(lesson.bullets?.length);

  useEffect(() => {
    if (readyForSummary) {
      setSummaryVisible(true);
    } else {
      setSummaryVisible(false);
    }
  }, [readyForSummary]);

  const isCompact = height < 780;
  const isVeryCompact = height < 680;

  const isSummaryActive = summaryVisible && readyForSummary;
  const overhead = isVeryCompact ? 280 : isCompact ? 310 : 335;
  const maxAvailableBoardH = Math.max(160, height - insets.top - insets.bottom - overhead);
  const maxBoardDim = isVeryCompact ? 245 : isCompact ? 270 : 300;
  const boardSize = Math.max(160, Math.min(width - 32, maxAvailableBoardH, maxBoardDim));
  const summaryMaxHeight = Math.min(Math.round(height * (isVeryCompact ? 0.58 : isCompact ? 0.62 : 0.66)), 480);

  function act() {
    if (locked.current || done) return;
    setSummaryVisible(false);
    locked.current = true;
    const isRoll = diceAction;
    const next = advanceLesson(game, lesson.id, action);
    const duration = travelMs(game.pieces, next.pieces);
    setMoving(true);
    setTimeline(previous => [...previous.slice(0, cursor + 1), next]);
    setCursor(action + 1);

    if (lesson.id === 'upgrade' && action === 0) {
      setScoringAnimation(lesson.player);
      setTimeout(() => setScoringAnimation(null), 2500);
    }

    const delay = duration ? Math.max(900, duration) + 200 : (isRoll ? 600 : 250);
    timer.current = setTimeout(() => {
      locked.current = false;
      setMoving(false);
    }, delay);
  }

  function resetLesson(nextIndex = index) {
    if (locked.current) return;
    setSummaryVisible(false);
    const nextLesson = LESSONS[nextIndex];
    setIndex(nextIndex);
    setTimeline([createLesson(nextLesson.id)]);
    setCursor(0);
    setBoardRevision(revision => revision + 1);
  }

  const resultMessage = action > 0 && lesson.results[action - 1] ? lesson.results[action - 1] : null;
  let actionText = !done ? lesson.actions[action] : '';
  // isBlueEarthDice went with the dimming it used to switch off.
  const isRedWaterDice = lesson.id === 'water' && activeDicePlayer === 'RED' && diceAction;
  if (isRedWaterDice) {
    actionText = '';
  }

  const isDiceStageFocused = focus === 'dice' || focus === 'power';
  const dice = (
    <View style={[s.diceStage, isDiceStageFocused ? s.focused : null]}>
      <PlayerDice
        lesson={lesson}
        game={game}
        playerKey={activeDicePlayer}
        enabled={diceAction}
        moving={moving}
        onRoll={act}
        powerAction={powerAction}
        onUsePower={act}
        boardSize={boardSize}
        resultMessage={diceAction || powerAction ? resultMessage : null}
        actionText={diceAction || powerAction ? actionText : null}
      />
    </View>
  );

  const handleNextLesson = () => {
    if (index === LESSONS.length - 1) onClose();
    else resetLesson(index + 1);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.root, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityViewIsModal>
        <View style={[s.header, isCompact && { marginTop: 4, minHeight: 32 }]}>
          <Text style={s.headerTitle}>How to Play</Text>
          <Pressable onPress={onClose} accessibilityRole="button"
            style={({ pressed }) => [s.skip, pressed ? s.pressed : null]}>
            <Text style={s.skipText}>Skip tutorial</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.textHi} />
          </Pressable>
        </View>

        <View style={[s.intro, { marginTop: isVeryCompact ? 18 : isCompact ? 26 : 32 }]}>
          {renderLessonTitle(lesson.title, tint, s.title)}
          <Text style={s.body}>{lesson.text}</Text>
          {lesson.id === 'upgrade' ? (
            <View style={s.baseRow}>
              <Image source={BASES[action > 0 ? 1 : 0]} style={s.baseArt} />
              <Text style={s.secondaryText}>{action > 0 ? 'LEVEL 2 (30 points)' : 'LEVEL 1 · 40 points'}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.stage} pointerEvents="box-none">
          <View style={[
            s.boardContainer,
            { width: boardSize, height: boardSize },
            // Constant, never conditional. This used to shrink to ~24 whenever the
            // rolling seat sat below the board, so the board jumped up and down
            // between lessons. The clearance is always reserved now, exactly as
            // the bottom dice slot below is always 66px whether or not it holds
            // anything — the board is the one thing on this screen that must not
            // move while you are being taught on it.
            { marginTop: isVeryCompact ? 76 : isCompact ? 84 : 90 }
          ]}>
            <View key={`${lesson.id}-${boardRevision}`} style={[
              s.board, { width: boardSize, height: boardSize },
              focus === 'token' ? s.focused : null
            ]}>
              <LudoBoard activatedBases={player.completedPieces > 0 || scoringAnimation !== null ? [lesson.player] : []}
                activePlayer={lesson.player} fireTrail={game.fireTrail} gustTrail={game.gustTrail} />
              <WallMarker wall={game.wall} />
              <StymiteFace gaze={gaze} boardSize={boardSize} scoringAnimation={scoringAnimation} />
              {focus === 'token' && lesson.id !== 'earth' && lesson.id !== 'water' && !(lesson.id === 'fire' && action === 2) ? <View pointerEvents="none" style={s.boardVeil} /> : null}
              <Tokens pieces={game.pieces} eligiblePieces={token && !moving && !scoringAnimation ? [token] : []}
                onPiecePress={act} boardSize={boardSize} shieldOwner={game.shield?.owner}
                gustOwner={game.gust?.owner} fireTrail={game.fireTrail} gustTrail={game.gustTrail} gaze={gaze}
                spotlightPiece={focus === 'token' && !scoringAnimation ? token : null}
                dimOtherTokens={false}
                tokenTooltip={token && !moving && !scoringAnimation ? { result: resultMessage, action: actionText } : null} />
            </View>

            {/* After the board on purpose — see DICE_LAYER. */}
            {isDiceTop ? (
              <View style={[s.topDiceContainer, { width: boardSize }]}>
                {dice}
              </View>
            ) : null}
          </View>

          <View style={[s.bottomDiceSlot, { width: boardSize }]}>
            {!isDiceTop ? dice : null}
          </View>
        </View>

        {isSummaryActive ? (
          <SummaryCard
            lesson={lesson}
            tint={tint}
            maxHeight={summaryMaxHeight}
            onClose={() => setSummaryVisible(false)}
          />
        ) : null}

        <View
          style={[
            s.footer,
            isSummaryActive ? s.footerOverSummary : null
          ]}
          pointerEvents="box-none"
        >
          <View style={s.dots}>
            {LESSONS.map((item, i) => <View key={item.id} style={[s.dot, i <= index ? { backgroundColor: tint } : null]} />)}
          </View>
          <Text style={s.stepIndicator}>{index + 1} / {LESSONS.length}</Text>
          <View style={s.navigation}>
            <View style={s.historyControls}>
              <Pressable
                disabled={!!(index === 0 || moving || scoringAnimation)}
                onPress={() => {
                  if (index > 0) resetLesson(index - 1);
                }}
                accessibilityRole="button"
                accessibilityLabel="Previous"
                accessibilityState={{ disabled: !!(index === 0 || moving || scoringAnimation) }}
                style={({ pressed }) => [
                  s.navButton,
                  s.navButtonPrev,
                  (index === 0 || moving || scoringAnimation) ? s.disabled : null,
                  pressed ? s.pressed : null
                ]}
              >
                <Ionicons name="arrow-back" size={16} color="#FF6B81" />
                <Text style={[s.navButtonText, s.navButtonTextPrev]}>Previous</Text>
              </Pressable>

              <Pressable
                disabled={!!(moving || scoringAnimation)}
                onPress={handleNextLesson}
                accessibilityRole="button"
                accessibilityLabel={index === LESSONS.length - 1 ? 'Finish' : 'Next Lesson'}
                accessibilityState={{ disabled: !!(moving || scoringAnimation) }}
                style={({ pressed }) => [
                  s.navButton,
                  s.navButtonNext,
                  nextRequired && !scoringAnimation ? s.navButtonNextActive : null,
                  (moving || scoringAnimation) ? s.disabled : null,
                  pressed ? s.pressed : null
                ]}
              >
                <Text style={[s.navButtonText, s.navButtonTextNext]}>
                  {index === LESSONS.length - 1 ? 'Finish' : 'Next Lesson'}
                </Text>
                <Ionicons name={index === LESSONS.length - 1 ? 'checkmark' : 'arrow-forward'} size={16} color="#81C784" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// The dice box carries the "Power is ready!" tooltip, which hangs down over the
// board and its tokens. It used to be 99999, exactly the tokens' own layer, and
// on Android an exact tie is settled by draw order — tokens last — so a token
// showed straight through the tooltip text. Derived from the tokens' layer so
// the two can never be made equal again by editing one number.
const DICE_LAYER = TOKENS_LAYER + 1;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, overflow: 'hidden' },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  helpText: {
    color: COLORS.textHi,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.7 },
  header: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 2,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  headerTitle: { fontFamily: 'Nunito-Bold', color: COLORS.textHi, fontSize: 18, letterSpacing: 0.3 },
  skip: {
    minHeight: 32,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  skipText: { ...TYPE.label, fontSize: 12, color: COLORS.textHi },
  intro: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 2,
    marginTop: 28,
    marginBottom: 4,
    // Fixed, not a 52-88 range: the stage below is flex:1 and centres its
    // contents, so a longer lesson text used to push the board down a little.
    // 88 was already the cap, so nothing clips that did not clip before.
    height: 88,
    zIndex: 1,
    elevation: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    overflow: 'visible',
    zIndex: 500,
    elevation: 500,
  },
  stageSummary: {
    justifyContent: 'space-evenly',
  },
  dots: { flexDirection: 'row', gap: 5, width: 140, marginBottom: 4, alignItems: 'center' },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.line },
  title: { ...TYPE.title, fontSize: 18, color: COLORS.textHi, textAlign: 'center' },
  body: { ...TYPE.body, fontSize: 13, lineHeight: 17, color: COLORS.textMid, textAlign: 'center' },
  focused: { zIndex: 20, elevation: 20, opacity: 1 },
  boardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  board: { position: 'relative', backgroundColor: '#4E342E', borderRadius: 12 },
  topDiceContainer: {
    position: 'absolute',
    top: -72,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: DICE_LAYER,
    elevation: DICE_LAYER,
    overflow: 'visible',
  },
  bottomDiceSlot: {
    width: '100%',
    height: 66,
    minHeight: 66,
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: DICE_LAYER,
    elevation: DICE_LAYER,
    overflow: 'visible',
  },
  diceStage: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'visible', zIndex: 99999, elevation: 99999 },
  diceSeatRow: { flexDirection: 'row', overflow: 'visible', zIndex: 99999, elevation: 99999 },
  boardVeil: { ...StyleSheet.absoluteFill, zIndex: 15, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12 },
  baseRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2, marginBottom: 0 },
  baseArt: { width: 38, height: 26, borderRadius: 5 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    marginBottom: 4,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    borderTopWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    zIndex: 50,
    elevation: 50,
  },
  footerOverSummary: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    zIndex: 2500,
    elevation: 2500,
  },
  stepIndicator: { ...TYPE.caption, color: COLORS.textMid, textAlign: 'center', letterSpacing: 2, marginBottom: 6, fontSize: 12, fontWeight: '600' },
  disabled: { opacity: 0.28 },
  navigation: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  historyControls: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  navButton: { minHeight: 38, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  navButtonPrev: { backgroundColor: 'rgba(230, 40, 60, 0.16)', borderWidth: 1, borderColor: 'rgba(230, 40, 60, 0.35)' },
  navButtonTextPrev: { color: '#FF6B81', fontWeight: '700' },
  navButtonNext: { backgroundColor: 'rgba(76, 175, 80, 0.16)', borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.35)' },
  navButtonNextActive: { backgroundColor: 'rgba(76, 175, 80, 0.28)', borderColor: 'rgba(76, 175, 80, 0.65)' },
  navButtonTextNext: { color: '#81C784', fontWeight: '700' },
  navButtonText: { ...TYPE.label, fontSize: 13 },
  secondaryText: { ...TYPE.label, color: COLORS.textHi },
  summaryBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 2000,
    elevation: 2000,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  summaryDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  summaryCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#141220',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 144,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 2001,
    zIndex: 2001,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 38,
  },
  summaryTitleCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 36,
  },
  summaryTitle: {
    fontFamily: 'Nunito-Bold',
    color: COLORS.textHi,
    fontSize: 17,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  summarySubtitle: {
    ...TYPE.label,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryCloseBtn: {
    position: 'absolute',
    top: -2,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryClosePressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 0.94 }],
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 6,
  },
  summaryScroll: {
    flexShrink: 1,
  },
  summaryListContent: {
    gap: 6,
    paddingVertical: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1.5,
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletText: {
    ...TYPE.body,
    fontSize: 12,
    lineHeight: 15,
  },
  bulletTitle: {
    fontWeight: '700',
  },
  bulletDesc: {
    color: COLORS.textMid,
    fontWeight: '500',
  },
});
