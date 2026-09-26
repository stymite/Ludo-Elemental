import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import LudoBoard from '../components/LudoBoard';
import SeatDiagram from '../components/SeatDiagram';
import { Screen, Button, Rise } from '../components/ui';
import { COLORS, SEAT, SEAT_ORDER, TYPE, SPACE, RADIUS } from '../theme';
import { FORMATIONS } from '../online';

export const SEAT_OFF = 'OFF';
export const SEAT_HUMAN = 'HUMAN';
export const SEAT_BOT = 'BOT';

// Razor-sharp 100% Vector SVG Icons
const QuestionMarkSvg = ({ size = 30, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path
      d="M16 4.5 C11.2 4.5 8 8 8 12 C8 13.1 8.9 14 10 14 C11.1 14 12 13.1 12 12 C12 9.8 13.6 7.8 16 7.8 C18.4 7.8 20 9.2 20 11.2 C20 13.2 18.5 14.8 16.5 16.2 C14.8 17.5 14 19.2 14 21.2 L14 21.5 C14 22.6 14.9 23.5 16 23.5 C17.1 23.5 18 22.6 18 21.5 L18 21.2 C18 20 18.8 19 20 18 C22.2 16.4 24 14.2 24 11.2 C24 7 20.8 4.5 16 4.5 Z"
      fill={color}
    />
    <Circle cx="16" cy="27" r="2.3" fill={color} />
  </Svg>
);

const PlayerSvg = ({ size = 30, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Circle cx="16" cy="9" r="6" fill={color} />
    <Path
      d="M3.5 26.5 C3.5 20 8.5 16.5 16 16.5 C23.5 16.5 28.5 20 28.5 26.5 C28.5 27.5 27.5 28 26 28 L6 28 C4.5 28 3.5 27.5 3.5 26.5 Z"
      fill={color}
    />
  </Svg>
);

const BotSvg = ({ size = 30, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Circle cx="16" cy="4" r="1.8" fill={color} />
    <Rect x="15" y="5.5" width="2" height="3" fill={color} rx="1" />
    <Rect x="4" y="13.5" width="3" height="6" fill={color} rx="1.5" />
    <Rect x="25" y="13.5" width="3" height="6" fill={color} rx="1.5" />
    <Rect x="6" y="8.5" width="20" height="17" rx="4" fill={color} />
    <Circle cx="11.5" cy="15" r="2.2" fill="#0A0A0E" />
    <Circle cx="20.5" cy="15" r="2.2" fill="#0A0A0E" />
    <Rect x="11" y="20" width="10" height="2" rx="1" fill="#0A0A0E" />
  </Svg>
);

const FONT_SIZES = {
  [SEAT_OFF]: 15,
  [SEAT_HUMAN]: 15,
  [SEAT_BOT]: 18,
};

const LETTER_SPACINGS = {
  [SEAT_OFF]: 0.5,
  [SEAT_HUMAN]: 0.8,
  [SEAT_BOT]: 1.5,
};

const OPTIONS = [
  { kind: SEAT_OFF, label: 'None', renderIcon: (size, color) => <QuestionMarkSvg size={size} color={color} /> },
  { kind: SEAT_HUMAN, label: 'Player', renderIcon: (size, color) => <PlayerSvg size={size} color={color} /> },
  { kind: SEAT_BOT, label: 'Bot', renderIcon: (size, color) => <BotSvg size={size} color={color} /> },
];

// One direction, always: none, then player, then bot, then round again.
// There was a back arrow too, and with three states it bought nothing while
// costing a lot — it sat inside the panel's own tap area with 10px of hit slop
// on a box under 100px wide, so a tap anywhere near the left edge ran the cycle
// BACKWARDS and the first press on an empty seat handed you a bot.
const NEXT_MAP = {
  [SEAT_OFF]: SEAT_HUMAN,
  [SEAT_HUMAN]: SEAT_BOT,
  [SEAT_BOT]: SEAT_OFF,
};

// Expanded bounding boxes that 100% cover the inner palace boxes and their outer white borders
const BASE_CONFIGS = {
  GREEN: { left: '5.46%', top: '6.67%', width: '28.33%', height: '28.43%', rx: 24 },
  YELLOW: { left: '66.39%', top: '6.57%', width: '28.33%', height: '28.61%', rx: 24 },
  BLUE: { left: '66.48%', top: '66.20%', width: '28.15%', height: '28.43%', rx: 23 },
  RED: { left: '5.46%', top: '66.20%', width: '28.24%', height: '29.07%', rx: 24 }
};

const QUADRANTS = {
  GREEN: { left: 0, top: 0, width: '50%', height: '50%' },
  YELLOW: { right: 0, top: 0, width: '50%', height: '50%' },
  BLUE: { right: 0, bottom: 0, width: '50%', height: '50%' },
  RED: { left: 0, bottom: 0, width: '50%', height: '50%' }
};

const SeatPanel = ({ colour, kind, size, boardSize, onSetSeat }) => {
  const tint = SEAT[colour];
  const isOff = kind === SEAT_OFF;
  const currentOpt = OPTIONS.find(o => o.kind === kind) || OPTIONS[0];
  const config = BASE_CONFIGS[colour];
  const calculatedRadius = Math.round((config.rx / 1080) * boardSize) + 1;

  const iconColor = isOff ? 'rgba(255,255,255,0.40)' : tint;
  const iconPixelSize = Math.round(size * 0.36);

  return (
    <Pressable
      onPress={() => onSetSeat(colour, NEXT_MAP[kind] || SEAT_HUMAN)}
      style={({ pressed }) => [
        s.seat,
        {
          left: config.left,
          top: config.top,
          width: config.width,
          height: config.height,
          borderRadius: calculatedRadius,
          borderColor: isOff ? 'rgba(255,255,255,0.22)' : tint,
        },
        pressed && { transform: [{ scale: 0.97 }] }
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${colour}: ${currentOpt.label}. Tap to cycle option`}
    >
      {/* Chevrons and label are decoration — the panel itself is the button.
          They used to be Pressables nested inside this one, each calling
          stopPropagation on the way out, which is a no-op across React
          Native's responder system: on a device the panel could take the same
          tap and step the seat twice. pointerEvents none puts it beyond doubt
          on every platform. */}
      <View style={s.seatContent} pointerEvents="none">
        {/* Left chevron. Decorative: it frames the label and says "this
            cycles", which is exactly what it does. */}
        <View style={s.arrowBtn}>
          <Ionicons name="chevron-back" size={15} color="rgba(255, 255, 255, 0.40)" />
        </View>

        {/* Center Display: Crisp Vector SVG Icon + Becak Text */}
        <View style={s.centerDisplay}>
          {currentOpt.renderIcon(iconPixelSize, iconColor)}
          <Text
            style={[
              s.becakText,
              {
                fontSize: FONT_SIZES[currentOpt.kind] || 15,
                letterSpacing: LETTER_SPACINGS[currentOpt.kind] || 0.8,
                color: isOff ? 'rgba(255, 255, 255, 0.65)' : '#FFFFFF',
              }
            ]}
          >
            {currentOpt.label.toUpperCase()}
          </Text>
        </View>

        {/* Right chevron, the direction the tap actually goes. */}
        <View style={s.arrowBtn}>
          <Ionicons name="chevron-forward" size={15} color="rgba(255, 255, 255, 0.40)" />
        </View>
      </View>
    </Pressable>
  );
};

// The picker's grid reads the same way the seat panels on the board do:
// top-left, top-right, bottom-left, bottom-right.
const GRID_ORDER = ['GREEN', 'YELLOW', 'RED', 'BLUE'];
const FORMATION_KEYS = ['NONE', 'CROSS', 'FLANKS', 'FRONTS'];

// One side filled in, the other left as outlines — the picture says "these two
// are together" without needing a second colour for the opposing pair. Free for
// All fills all four, because there nobody is paired with anyone.
const layoutFor = (key) => {
  const pairs = FORMATIONS[key].pairs;
  if (!pairs) return GRID_ORDER.map(seat => ({ seat }));
  return GRID_ORDER.map(seat => (pairs[0].includes(seat) ? { seat } : null));
};

const FormationRow = ({ formationKey, selected, onPress }) => {
  const { label, hint } = FORMATIONS[formationKey];
  return (
    <Pressable
      onPress={() => onPress(formationKey)}
      style={({ pressed }) => [s.menuRow, pressed && s.menuRowPressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${label}. ${hint}`}
    >
      <SeatDiagram layout={layoutFor(formationKey)} size={38} label={label} />
      <View style={s.menuRowText}>
        <Text style={s.menuLabel}>{label}</Text>
        <Text style={s.menuHint}>{hint}</Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={SEAT.GREEN} />
      ) : null}
    </Pressable>
  );
};

const SetupScreen = ({ seats, formation, onSetSeat, onFormation, onStart, onBack }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isCompact = height < 760;
  const isVeryCompact = height < 680;
  const maxAvailableH = height - insets.top - insets.bottom - (isVeryCompact ? 150 : isCompact ? 175 : 205);
  const maxDim = isVeryCompact ? 280 : isCompact ? 315 : 340;
  const boardSize = Math.max(220, Math.min(width - 32, maxAvailableH, maxDim));
  const baseSize = boardSize * 0.276;

  const playing = SEAT_ORDER.filter(c => seats[c] !== SEAT_OFF);
  const humans = SEAT_ORDER.filter(c => seats[c] === SEAT_HUMAN);

  const problem = playing.length < 2
    ? 'Select at least two seats'
    : humans.length === 0
      ? 'At least one seat has to be a Player'
      : null;

  const current = FORMATIONS[formation] || FORMATIONS.NONE;

  // If seats drop below 4 while a team formation is active, revert back to FFA
  useEffect(() => {
    if (playing.length < 4 && formation !== 'NONE') {
      onFormation('NONE');
    }
  }, [playing.length, formation, onFormation]);

  const handleToggleTeam = () => {
    if (playing.length < 4) {
      SEAT_ORDER.forEach(c => {
        if (seats[c] === SEAT_OFF) {
          onSetSeat(c, SEAT_HUMAN);
        }
      });
    }
    setMenuOpen(open => !open);
  };

  const choose = (key) => {
    if (key !== 'NONE' && playing.length < 4) {
      SEAT_ORDER.forEach(c => {
        if (seats[c] === SEAT_OFF) {
          onSetSeat(c, SEAT_HUMAN);
        }
      });
    }
    onFormation(key);
    setMenuOpen(false);
  };

  return (
    <Screen
      contentStyle={s.contentContainer}
      footer={
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {/* Opens upward by floating over the footer buttons */}
          {menuOpen ? (
            <Rise distance={-10} duration={160} style={s.menu} accessibilityRole="radiogroup">
              {FORMATION_KEYS.map((key, i) => (
                <View key={key}>
                  {i > 0 ? <View style={s.menuDivider} /> : null}
                  <FormationRow
                    formationKey={key}
                    selected={key === formation}
                    onPress={choose}
                  />
                </View>
              ))}
            </Rise>
          ) : null}

          {/* Always rendered, with a non-breaking space when there is nothing to
              say. The footer sits in the layout flow and the board is centred in
              whatever height is left above it, so a line that only existed while
              there was a problem made the footer ~26px taller, and the board slid
              up and down as seats were toggled. The slot is the same height either
              way, so the board stays put. */}
          <Text
            style={s.problem}
            importantForAccessibility={problem ? 'auto' : 'no-hide-descendants'}
          >
            {problem || '\u00A0'}
          </Text>

          <View style={s.footerRow}>
            <Pressable
              onPress={handleToggleTeam}
              style={({ pressed }) => [
                s.teamBtn,
                menuOpen && s.teamBtnOpen,
                pressed && { transform: [{ scale: 0.97 }] }
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: !!menuOpen }}
              accessibilityLabel={`Team formation: ${current.label}`}
              accessibilityHint="Choose how the four seats pair up"
            >
              <Ionicons
                name="people"
                size={18}
                color={COLORS.textHi}
              />
              <Text
                style={s.teamBtnText}
                numberOfLines={1}
              >
                {formation === 'NONE' ? 'FFA' : current.label}
              </Text>
              <Ionicons
                name={menuOpen ? 'chevron-down' : 'chevron-up'}
                size={14}
                color={COLORS.textMid}
              />
            </Pressable>

            <Button
              label="Start game"
              tone="primary"
              iconRight="arrow-forward"
              disabled={Boolean(problem)}
              onPress={onStart}
              full
              textStyle={{ fontFamily: 'Nunito-Bold', fontSize: 16 }}
            />
          </View>
        </View>
      }
    >
      {/* Top Bar */}
      <View style={s.topBar}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.textHi} />
        </Pressable>
      </View>

      {/* Board and Title Container perfectly centered */}
      <View style={s.boardWrapper}>
        <Text style={[
          s.headerTitle,
          isCompact && { fontSize: isVeryCompact ? 26 : 30, marginBottom: 10 },
          Platform.OS === 'web' && { WebkitTextStroke: '1.5px #000000' }
        ]}>
          CHOOSE ELEMENTS
        </Text>

        <View style={[s.board, { width: boardSize, height: boardSize }]}>
          <LudoBoard />
          
          {formation !== 'NONE' && current.pairs && (
            <>
              {current.pairs[0].map(c => (
                <View key={`hiA-${c}`} style={[s.highlightA, QUADRANTS[c]]} pointerEvents="none" />
              ))}
              {current.pairs[1].map(c => (
                <View key={`hiB-${c}`} style={[s.highlightB, QUADRANTS[c]]} pointerEvents="none" />
              ))}
            </>
          )}

          {SEAT_ORDER.map(colour => (
            <SeatPanel
              key={colour}
              colour={colour}
              kind={seats[colour]}
              size={baseSize}
              boardSize={boardSize}
              onSetSeat={onSetSeat}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
};

const s = StyleSheet.create({
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: SPACE.md,
    marginTop: SPACE.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  boardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  headerTitle: {
    fontFamily: 'Aligarh',
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  board: {
    alignSelf: 'center',
    position: 'relative',
    borderRadius: RADIUS.md,
    overflow: 'hidden'
  },
  highlightA: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  highlightB: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  seat: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: '#0A0A0E', // 100% solid opaque - never reveals temple art underneath
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
    paddingHorizontal: 1,
  },
  arrowBtn: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.65,
  },
  centerDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  becakText: {
    fontFamily: 'Becak',
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
  },
  footer: { gap: SPACE.sm },
  problem: { ...TYPE.body, fontSize: 12, color: COLORS.textLow, textAlign: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: SPACE.sm },
  teamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  teamBtnOpen: {
    borderColor: SEAT.GREEN,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  teamBtnText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: COLORS.textHi,
  },
  menu: {
    position: 'absolute',
    bottom: 58,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    paddingHorizontal: SPACE.md,
    zIndex: 100,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
  },
  menuRowPressed: { opacity: 0.6 },
  menuRowText: { flex: 1, gap: 1 },
  menuLabel: { fontFamily: 'Nunito-Bold', fontSize: 15, color: COLORS.textHi },
  menuHint: { ...TYPE.body, fontSize: 12, color: COLORS.textLow },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.line
  }
});

export default SetupScreen;
