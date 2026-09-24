import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing
} from 'react-native-reanimated';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { NO_REDUCE, timing } from '../motion';
import { ELEMENTS } from '../constants';

// Bitmaps rather than the source SVGs — see the note in Tokens.js. This button
// draws the emblem at 46px, where 369 <path> elements of rock detail are
// indistinguishable from a picture of one.
import FirePng from '../assets/fire.png';
import WaterPng from '../assets/water.png';
import EarthPng from '../assets/earth.png';
import AirPng from '../assets/air.png';

const ELEMENT_SYMBOLS = {
  RED: { type: 'image', source: FirePng },
  BLUE: { type: 'image', source: WaterPng },
  GREEN: { type: 'image', source: EarthPng },
  YELLOW: { type: 'image', source: AirPng },
};

const READY_FONT = Platform.select({
  android: 'sans-serif-condensed',
  ios: 'Impact',
  default: 'Impact, Arial Black, sans-serif-condensed, sans-serif',
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Computes the SVG arc path with a bottom center gap.
 * Traces clockwise from bottom-left (128°), over the top (270°), to bottom-right (52°).
 */
const getArcGeometry = (size, strokeWidth, gapDeg = 76) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const halfGap = (gapDeg / 2) * (Math.PI / 180);

  const startAngle = Math.PI / 2 + halfGap;
  const endAngle = Math.PI / 2 - halfGap;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  const arcDeg = 360 - gapDeg;
  const length = 2 * Math.PI * r * (arcDeg / 360);
  const path = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;

  return { path, length, cx, cy, r };
};

/**
 * Charge arc outline drawn around the elemental ability button with a gap at bottom center.
 * `progress` is 0..1 and fills clockwise starting from bottom-left up to bottom-right.
 */
export const PowerRing = ({
  player,
  progress = 0,
  ready = false,
  enabled = false,
  points = 0,
  threshold = 40,
  showCounter = true,
  size = 48,
  strokeWidth = 3.5,
  children
}) => {
  const el = ELEMENTS[player] || ELEMENTS.RED;
  const { path, length } = getArcGeometry(size, strokeWidth, 76);
  const offset = length * (1 - clamp01(progress));

  const readyPulse = useSharedValue(0);

  useEffect(() => {
    if (ready && enabled) {
      readyPulse.value = withRepeat(
        withSequence(
          NO_REDUCE,
          withTiming(1, timing({ duration: 750, easing: Easing.inOut(Easing.ease) })),
          withTiming(0, timing({ duration: 750, easing: Easing.inOut(Easing.ease) }))
        ),
        -1,
        true,
        undefined,
        NO_REDUCE
      );
    } else {
      readyPulse.value = withTiming(0, timing({ duration: 200 }));
    }
  }, [ready, enabled]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (ready && enabled) ? (0.2 + readyPulse.value * 0.5) : 0,
  }));

  return (
    <View style={[styles.ringContainer, { width: size, height: size }]}>
      {/* Static groove track with bottom gap */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        {ready ? (
          <Circle cx={size/2} cy={size/2} r={(size - strokeWidth)/2} fill="none" stroke="rgba(0, 0, 0, 0.18)" strokeWidth={strokeWidth} />
        ) : (
          <Path d={path} fill="none" stroke="rgba(0, 0, 0, 0.18)" strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
      </Svg>

      {/* Soft pulsing halo once the ability is charged and ready */}
      {ready && enabled && (
        <Animated.View style={[StyleSheet.absoluteFill, haloStyle, { overflow: 'visible' }]} pointerEvents="none">
          <Svg width={size + 24} height={size + 24} style={{ position: 'absolute', top: -12, left: -12, overflow: 'visible' }}>
            <Circle cx={(size + 24) / 2} cy={(size + 24) / 2} r={(size - strokeWidth) / 2} fill="none" stroke={el.color} strokeWidth={strokeWidth * 2.0} />
          </Svg>
        </Animated.View>
      )}

      {/* Active charge progress */}
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { overflow: 'visible' }]} pointerEvents="none">
        {ready ? (
          <Circle cx={size/2} cy={size/2} r={(size - strokeWidth)/2} fill="none" stroke={el.color} strokeWidth={strokeWidth} />
        ) : (
          <Path
            d={path}
            fill="none"
            stroke={el.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${length} ${length}`}
            strokeDashoffset={offset}
          />
        )}
      </Svg>

      {/* Inner Ability Button */}
      <View style={styles.ringContent}>{children}</View>

      {/* Inline 1-Row Counter at the Bottom Center of the Outline (disappears when activated/ready) */}
      {showCounter && !ready && (
        <View style={styles.inlineCounter}>
          <View style={styles.inlineRow}>
            <Text style={styles.inlinePoints}>{points}</Text>
            <Text style={styles.inlineSlash}>/</Text>
            <Text style={styles.inlineThresh}>{threshold}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * Optional standalone readout (preserved for backwards compatibility).
 */
export const ChargeReadout = ({ player, points, threshold, ready }) => {
  const el = ELEMENTS[player] || ELEMENTS.RED;

  return (
    <View style={styles.readout}>
      <Text style={[styles.readoutValue, ready && { color: el.color }]} numberOfLines={1}>
        {points}
      </Text>
      {ready ? (
        <Text style={[styles.readoutReady, { color: el.color }]} numberOfLines={1}>
          READY
        </Text>
      ) : (
        <Text style={styles.readoutMax} numberOfLines={1}>
          /{threshold}
        </Text>
      )}
    </View>
  );
};

// What is hanging over this seat's next move. Both are one-shots armed ahead of
// the move they apply to, so the badge is the only thing on screen saying so.
const BADGE_LABELS = {
  ARMED: 'ARMED',
  GUST: '+9',
  BLAZE: 'BURN',
};

/**
 * Tells the player what the button is about to do.
 */
export const PowerBadge = ({ player, mode }) => {
  if (!mode) return null;
  const el = ELEMENTS[player] || ELEMENTS.YELLOW;

  return (
    <View style={[styles.powerBadge, { borderColor: el.color, backgroundColor: el.deep }]}>
      <Text style={[styles.powerBadgeText, { color: el.color }]} numberOfLines={1}>
        {BADGE_LABELS[mode] || BADGE_LABELS.ARMED}
      </Text>
    </View>
  );
};

/**
 * Elemental power button with circular charge loading ring and inline counter at bottom center.
 * - When charging (!ready): brightness is low (subdued, dimmed), loading ring shows progress.
 * - When ready (ready): brightness becomes normal (full vibrant color, pulsing halo/glow).
 */
export const PowerButton = ({
  player,
  points = 0,
  threshold = 40,
  progress = 0,
  ready = false,
  enabled = false,
  armed = false,
  boostIcon = false,
  showCounter = true,
  onPress,
  size = 48,
  avatarUrl = null,
  // Stands in for the picture when a player has none (online seats only).
  name = null,
  accessibilityLabel = null,
}) => {
  const el = ELEMENTS[player] || ELEMENTS.RED;
  const pulse = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    if (enabled && ready) {
      pulse.value = withRepeat(
        withSequence(
          NO_REDUCE,
          withTiming(1, timing({ duration: 600, easing: Easing.inOut(Easing.ease) })),
          withTiming(0, timing({ duration: 600, easing: Easing.inOut(Easing.ease) }))
        ),
        -1,
        true,
        undefined,
        NO_REDUCE
      );
    } else {
      pulse.value = withTiming(0, timing({ duration: 200 }));
    }
  }, [enabled, ready]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * (enabled && ready ? (1 + pulse.value * 0.08) : 1) }],
    shadowOpacity: (ready && enabled) ? 0.6 : 0,
  }));

  const handlePress = () => {
    if (!ready || !enabled) return;
    press.value = withSequence(
      NO_REDUCE,
      withTiming(0.86, timing({ duration: 90 })),
      withTiming(1, timing({ duration: 140 }))
    );
    if (onPress) onPress(player);
  };

  const innerSize = size - 12;
  const symbolSource = ELEMENT_SYMBOLS[player];
  const showName = !ready && !avatarUrl && Boolean(name);
  const badgeDim = size + 20;
  const readyFontSize = Math.max(11, Math.min(14, Math.round(size * 0.23) + 1));
  const readyStrokeWidth = Math.max(2.4, Math.min(3.0, Number((readyFontSize * 0.19).toFixed(1))));
  const c = badgeDim / 2;

  return (
    <PowerRing
      player={player}
      progress={progress}
      ready={ready}
      enabled={enabled}
      points={points}
      threshold={threshold}
      showCounter={showCounter}
      size={size}
      strokeWidth={3.5}
    >
      <Animated.View
        style={[
          styles.powerButton,
          {
            width: innerSize,
            height: innerSize,
            borderColor: ready ? (armed ? '#FFFFFF' : el.color) : 'rgba(255, 255, 255, 0.22)',
            borderWidth: armed ? 2.5 : (ready ? 2 : 1),
            backgroundColor: ready ? (armed ? el.color : el.deep) : 'rgba(20, 20, 20, 0.65)',
            shadowColor: el.color,
            zIndex: ready ? 50 : 1,
            elevation: ready ? 25 : 6,
          },
          animatedStyle
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={!ready || !enabled}
          onPress={handlePress}
          style={styles.powerTouchable}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || `${player.toLowerCase()} power`}
          accessibilityState={{ disabled: !ready || !enabled }}
        >
          {(!ready && avatarUrl) ? (
            <View style={[styles.powerSymbolContainer, { width: '100%', height: '100%' }]}>
              <Image source={{ uri: avatarUrl }} style={[styles.powerSymbolImage, { borderRadius: 9999 }]} resizeMode="cover" />
            </View>
          ) : showName ? (
            // No picture: the name sits in the same spot for the same stretch,
            // until the charge is full. The zero-width space after an
            // underscore lets "Guest_1234" wrap onto two lines.
            <View style={styles.nameFill}>
              <Text style={styles.nameText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
                {String(name).replace(/_/g, '_\u200B')}
              </Text>
            </View>
          ) : symbolSource && symbolSource.type === 'svg' ? (
            <View
              style={[
                styles.powerSymbolContainer,
                { opacity: ready ? 0.35 : 0.6 }
              ]}
            >
              <symbolSource.Component width="85%" height="85%" />
            </View>
          ) : symbolSource && symbolSource.type === 'image' ? (
            <View
              style={[
                styles.powerSymbolContainer,
                { opacity: ready ? 0.35 : 0.6 }
              ]}
            >
              <Image 
                source={symbolSource.source} 
                style={[
                  styles.powerSymbolImage,
                  player === 'RED' && { transform: [{ scale: 1.15 }, { translateY: -0.5 }] }
                ]} 
                resizeMode="contain" 
              />
            </View>
          ) : null}

          {boostIcon && !ready && !showName && (
            <View style={styles.airBoostOverlay} pointerEvents="none">
              <Svg width={innerSize} height={innerSize} viewBox={`0 0 ${innerSize} ${innerSize}`} style={{ overflow: 'visible' }}>
                <SvgText
                  x={innerSize / 2 + 1.5}
                  y={innerSize / 2 + 6}
                  fontSize="17"
                  fontWeight="900"
                  fontStyle="italic"
                  fontFamily="Impact, Arial Black, sans-serif-condensed, sans-serif"
                  fill="#000000"
                  stroke="#000000"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  textAnchor="middle"
                  transform={`rotate(-5, ${innerSize / 2}, ${innerSize / 2}) skewX(-10)`}
                >
                  +9
                </SvgText>
                <SvgText
                  x={innerSize / 2 + 1.5}
                  y={innerSize / 2 + 6}
                  fontSize="17"
                  fontWeight="900"
                  fontStyle="italic"
                  fontFamily="Impact, Arial Black, sans-serif-condensed, sans-serif"
                  fill={el.color}
                  textAnchor="middle"
                  transform={`rotate(-5, ${innerSize / 2}, ${innerSize / 2}) skewX(-10)`}
                >
                  +9
                </SvgText>
              </Svg>
            </View>
          )}

        </TouchableOpacity>
      </Animated.View>

      {/* Floating READY Banner: highest z-index, tilted -12° (straighter), perfectly centered */}
      {ready && (
        <Animated.View
          style={[
            styles.readyFloatingBadge,
            animatedStyle
          ]}
          pointerEvents="none"
        >
          <Svg width={badgeDim} height={badgeDim} viewBox={`0 0 ${badgeDim} ${badgeDim}`} style={{ overflow: 'visible' }}>
            <SvgText
              x={c}
              y={c + Math.round(readyFontSize * 0.35)}
              fontSize={readyFontSize}
              fontWeight="900"
              fontFamily={READY_FONT}
              fill="#000000"
              stroke="#000000"
              strokeWidth={readyStrokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              textAnchor="middle"
              transform={`rotate(-12, ${c}, ${c})`}
            >
              READY
            </SvgText>
            <SvgText
              x={c}
              y={c + Math.round(readyFontSize * 0.35)}
              fontSize={readyFontSize}
              fontWeight="900"
              fontFamily={READY_FONT}
              fill="#FFFFFF"
              textAnchor="middle"
              transform={`rotate(-12, ${c}, ${c})`}
            >
              READY
            </SvgText>
          </Svg>
        </Animated.View>
      )}
    </PowerRing>
  );
};

const styles = StyleSheet.create({
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative',
    overflow: 'visible',
  },
  ringContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCounter: {
    position: 'absolute',
    bottom: -3,
    alignSelf: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: '#000000',
    opacity: 1,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  inlineCounterReady: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlinePoints: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ECEFF1',
    lineHeight: 11,
  },
  inlineSlash: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#90A4AE',
    marginHorizontal: 1,
    lineHeight: 11,
  },
  inlineThresh: {
    fontSize: 8,
    fontWeight: '700',
    color: '#90A4AE',
    lineHeight: 11,
  },
  inlineReadyText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 10,
  },
  readout: {
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  readoutValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#37474F',
    lineHeight: 16,
  },
  readoutMax: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#90A4AE',
    lineHeight: 11,
  },
  readoutReady: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    lineHeight: 11,
  },
  powerBadge: {
    marginBottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1.5,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  powerButton: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 7,
    elevation: 6,
  },
  powerTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  powerSymbolImage: {
    width: '100%',
    height: '100%',
  },
  powerSymbolContainer: {
    width: '68%',
    height: '68%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameFill: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 9,
    lineHeight: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  boostTag: {
    position: 'absolute',
    bottom: -3,
    alignSelf: 'center',
    paddingHorizontal: 3,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  boostTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  airBoostOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  readyFloatingBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
    overflow: 'visible',
  },
});

export default PowerRing;

