import React, { useEffect } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Platform
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, Easing
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import Backdrop from './Backdrop';
import {
  COLORS, SPACE, RADIUS, TYPE, SCREEN_PAD, MAX_CONTENT, ELEVATION, TARGET, CHROME_SCALE
} from '../theme';
import { SPRING, DECORATIVE, decorative } from '../motion';

// The shell's primitives. Everything here reads from theme.js; nothing below contains a
// literal colour. See MOBILE-DESIGN.md.

// One icon family, one size scale. Ionicons throughout; the only exception in the app is
// the Google mark on the auth and settings screens, because Ionicons has no Google
// glyph and the alternative was the letter "G".
export const ICON = { sm: 16, md: 20, lg: 24 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Press feedback for every touchable, no exceptions. A spring rather than a duration, so
// tapping repeatedly retargets instead of queueing. Android also gets a ripple, which is
// what that platform expects on top of the scale.
function useSquash(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => { scale.value = withSpring(to, SPRING); },
    onPressOut: () => { scale.value = withSpring(1, SPRING); }
  };
}

const ripple = Platform.OS === 'android'
  ? { color: 'rgba(255,255,255,0.10)', borderless: false }
  : undefined;

// Anything visually smaller than the platform floor gets the difference back as hitSlop.
const slopTo = (h) => {
  const pad = Math.max(0, (TARGET.min - h) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
};

// ---------------------------------------------------------------------- layout ---

/**
 * Owns the background, the safe areas and the content column.
 *
 * There is no native navigator in this app, so the top inset is this component's
 * responsibility rather than a header's, and every scrollable pays the bottom inset so
 * content never sits under the home indicator or the Android nav bar.
 */
export function Screen({ children, scroll = false, footer = null, floating = null, board = false, focus }) {
  const insets = useSafeAreaInsets();

  // `flex: 1` only when the column is not inside the ScrollView. There it is
  // flexBasis 0 in a container with no fixed height — a browser still sizes it
  // to its content, but Yoga on Android can collapse it to nothing.
  const body = (
    <View style={[s.column, !scroll && s.flexOne]}>{children}</View>
  );

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <Backdrop board={board} focus={focus} />

      {scroll ? (
        <ScrollView          style={s.flex}
          contentContainerStyle={[
            s.scrollBody,
            { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom + SPACE.xl }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[s.flex, { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom + SPACE.xl }]}>
          {body}
        </View>
      )}

      {footer ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACE.lg }]}>
          <View style={s.column}>{footer}</View>
        </View>
      ) : null}

      {floating}
    </View>
  );
}

/**
 * Slides a block up into place as it mounts — the menus' entrance animation.
 *
 * Deliberately not Reanimated's `entering` / `layout` animations. On Android
 * those left the content inside them invisible and untouchable: the home screen
 * came up as nothing but its backdrop, which web never showed. This moves the
 * transform only, never opacity, so if the animation fails to run the content
 * is still on screen, sitting where it belongs.
 */
export function Rise({ delay = 0, distance = 14, duration = 360, style, children, ...rest }) {
  const offset = useSharedValue(distance);
  useEffect(() => {
    offset.value = withDelay(
      delay,
      withTiming(0, decorative({ duration, easing: Easing.out(Easing.cubic) })),
      DECORATIVE
    );
  }, []);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return <Animated.View style={[style, lift]} {...rest}>{children}</Animated.View>;
}

/**
 * This shell has no native header, so this is the header. It is not the duplicated
 * "< Back" text tell: there is no navigator back to duplicate, and without this there
 * would be no way out of the screen at all.
 */
export function ScreenHeader({ title, onBack, right = null, titleStyle = null }) {
  const squash = useSquash(0.9);
  return (
    <View style={s.header}>
      <View style={s.headerSide}>
        {onBack ? (
          <AnimatedPressable
            onPress={onBack}
            onPressIn={squash.onPressIn}
            onPressOut={squash.onPressOut}
            style={[squash.style, s.iconBtn]}
            android_ripple={ripple}
            hitSlop={slopTo(44)}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textHi} />
          </AnimatedPressable>
        ) : null}
      </View>

      <Text
        style={[s.headerTitle, titleStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={CHROME_SCALE}
        accessibilityRole="header"
      >
        {title}
      </Text>

      <View style={[s.headerSide, s.headerRight]}>{right}</View>
    </View>
  );
}

export function SectionLabel({ children }) {
  return <Text style={s.section} maxFontSizeMultiplier={CHROME_SCALE}>{children}</Text>;
}

// Grouping tool of last resort. Whitespace and hairlines come first; a card means a
// discrete, self-contained object.
export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={s.divider} />;
}

// ---------------------------------------------------------------------- buttons ---

/**
 * tone: 'primary' | 'secondary' | 'ghost' | 'danger'
 *
 * Disabled buttons stay mounted so screen-reader order is stable, and carry
 * accessibilityState so the reason is announced rather than inferred from grey.
 */
export function Button({
  label, onPress, tone = 'primary', disabled = false, loading = false,
  icon = null, iconRight = null, style, contentStyle, textStyle, accessibilityHint, full = false
}) {
  const squash = useSquash();
  const inert = disabled || loading;
  const ink = tone === 'primary' ? COLORS.accent
    : tone === 'danger' ? COLORS.danger
      : tone === 'ghost' ? COLORS.textMid : COLORS.textHi;

  return (
    <AnimatedPressable
      onPress={inert ? undefined : onPress}
      onPressIn={inert ? undefined : squash.onPressIn}
      onPressOut={inert ? undefined : squash.onPressOut}
      android_ripple={inert ? undefined : ripple}
      style={[squash.style, full && s.flexOne, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
    >
      <View style={[s.btn, s['btn_' + tone], inert && s.inert, contentStyle]}>
        {loading ? (
          <ActivityIndicator size="small" color={ink} />
        ) : icon ? (
          <Ionicons name={icon} size={ICON.md} color={ink} />
        ) : null}

        <Text
          style={[s.btnText, { color: ink }, textStyle]}
          numberOfLines={1}
          maxFontSizeMultiplier={CHROME_SCALE}
        >
          {label}
        </Text>

        {iconRight && !loading ? (
          <Ionicons name={iconRight} size={ICON.md} color={ink} />
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

/**
 * A big choice. Opaque surface, one hairline, and a leading slot for the seat diagram
 * rather than an icon chip.
 *
 * `dimmed` marks a choice that exists but is unavailable right now. It stays pressable
 * so it can explain itself, which is the difference between "unavailable" and "broken".
 */
export function ChoiceCard({
  title, subtitle, leading = null, meta = null, onPress, dimmed = false, accent
}) {
  const squash = useSquash(0.98);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={squash.onPressIn}
      onPressOut={squash.onPressOut}
      android_ripple={ripple}
      style={squash.style}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: !!dimmed }}
    >
      <View style={[s.choice, dimmed && s.choiceDim]}>
        {/* A 2pt edge in the mode's own colour: enough to tell the four cards apart at a
            glance without painting a whole card in a saturated hue. */}
        {accent ? <View style={[s.choiceEdge, { backgroundColor: accent }]} /> : null}

        {leading ? <View style={s.choiceLeading}>{leading}</View> : null}

        <View style={s.choiceText}>
          <Text style={s.choiceTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={s.choiceSubtitle} numberOfLines={2}>{subtitle}</Text>
          ) : null}
        </View>

        {meta ? <View style={s.choiceMeta}>{meta}</View> : null}
      </View>
    </AnimatedPressable>
  );
}

export function Chip({ children, tone = 'neutral' }) {
  return (
    <View style={[s.chip, tone === 'accent' && s.chipAccent]}>
      <Text
        style={[s.chipText, tone === 'accent' && s.chipTextAccent]}
        maxFontSizeMultiplier={CHROME_SCALE}
      >
        {children}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------------ state ---

// Loading, empty and waiting share one shape, so no screen invents its own version of
// "nothing here yet". Centred is correct here and only here.
export function StateBlock({ icon, title, detail, action = null, busy = false }) {
  return (
    <View style={s.state}>
      {busy ? (
        <ActivityIndicator color={COLORS.accent} />
      ) : icon ? (
        <Ionicons name={icon} size={28} color={COLORS.textLow} />
      ) : null}
      <Text style={s.stateTitle}>{title}</Text>
      {detail ? <Text style={s.stateDetail}>{detail}</Text> : null}
      {action}
    </View>
  );
}

/**
 * Shown against every kind of background in the app — a plain sheet here, blurred
 * board art on the shop, a busy game screen in App.js — so it carries its own
 * elevation rather than trusting a hairline border to read on all of them. Slides
 * in with Rise so an error landing mid-interaction (a failed purchase, a rejected
 * move) doesn't just snap into existence above whatever the player was looking at.
 *
 * The close button is explicit rather than "tap anywhere to dismiss": a banner
 * with real content invites a read, and a body-wide tap target dismisses it on
 * the same touch someone meant to use for reading. Screens that pass no
 * onDismiss (the in-game online-status banner in App.js) get no close button —
 * that one is a standing state, not a dismissable alert.
 */
export function ErrorBanner({ children, onDismiss }) {
  if (!children) return null;
  return (
    <Rise distance={10} style={[s.error, ELEVATION.raised]}>
      <View accessibilityRole="alert" accessibilityLabel={String(children)} style={s.errorRow}>
        <Ionicons name="alert-circle" size={ICON.md} color={COLORS.danger} />
        <Text style={s.errorText}>{children}</Text>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={TARGET.min}
            style={({ pressed }) => [s.errorClose, pressed && s.errorClosePressed]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={ICON.sm} color={COLORS.textMid} />
          </Pressable>
        ) : null}
      </View>
    </Rise>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  flexOne: { flex: 1 },
  column: {
    width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center',
    paddingHorizontal: SCREEN_PAD, paddingVertical: SPACE.sm
  },
  scrollBody: { flexGrow: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line,
    backgroundColor: COLORS.bg, paddingTop: SPACE.lg
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: TARGET.min, marginTop: SPACE.sm, marginBottom: SPACE.xl
  },
  headerSide: { minWidth: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: { ...TYPE.title, color: COLORS.textHi, flex: 1, textAlign: 'center' },

  section: {
    ...TYPE.caption, fontFamily: 'Nunito-Bold', color: COLORS.textLow,
    marginTop: SPACE.xl, marginBottom: SPACE.sm
  },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line,
    paddingHorizontal: SPACE.lg, ...ELEVATION.raised
  },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: COLORS.line,
    marginVertical: SPACE.xs
  },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, minHeight: TARGET.comfortable,
    paddingHorizontal: SPACE.xl, borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth
  },
  btn_primary: { backgroundColor: 'rgba(63, 208, 201, 0.15)', borderColor: 'rgba(63, 208, 201, 0.6)', borderWidth: 1.5 },
  btn_secondary: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.3)', borderWidth: 1.5 },
  btn_ghost: { backgroundColor: 'transparent', borderColor: 'transparent', minHeight: TARGET.min },
  btn_danger: { backgroundColor: COLORS.dangerDim, borderColor: COLORS.danger },
  inert: { opacity: 0.38 },
  btnText: { ...TYPE.label, fontFamily: 'Nunito-Bold', fontSize: 14 },

  choice: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line,
    paddingVertical: SPACE.lg, paddingLeft: SPACE.xl, paddingRight: SPACE.lg,
    minHeight: 76, overflow: 'hidden', ...ELEVATION.raised
  },
  choiceDim: { opacity: 0.45 },
  choiceEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  choiceLeading: { alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { ...TYPE.heading, color: COLORS.textHi },
  choiceSubtitle: { ...TYPE.body, fontSize: 13, color: COLORS.textMid },
  choiceMeta: { alignItems: 'flex-end' },

  chip: {
    paddingHorizontal: SPACE.sm, paddingVertical: 5,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line
  },
  chipAccent: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  chipText: { ...TYPE.caption, color: COLORS.textMid },
  chipTextAccent: { color: COLORS.accent },

  state: { alignItems: 'center', justifyContent: 'center', gap: SPACE.md, paddingVertical: SPACE.xxl },
  stateTitle: { ...TYPE.heading, fontFamily: 'Nunito-Bold', color: COLORS.textHi, textAlign: 'center' },
  stateDetail: { ...TYPE.body, color: COLORS.textMid, textAlign: 'center', maxWidth: 300 },

  error: {
    backgroundColor: COLORS.surfaceHi, borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.danger,
    marginBottom: SPACE.lg, overflow: 'hidden'
  },
  errorRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    // Left edge in the danger colour rather than tinting the whole fill: enough to
    // read as urgent without competing with the accent-red seat colour elsewhere.
    borderLeftWidth: 3, borderLeftColor: COLORS.danger,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md
  },
  errorIcon: { marginTop: 1 },
  errorText: { ...TYPE.body, fontSize: 13, color: COLORS.textHi, flex: 1, lineHeight: 18 },
  errorClose: {
    width: TARGET.min - 12, height: TARGET.min - 12, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center', marginRight: -SPACE.xs, marginTop: -2
  },
  errorClosePressed: { backgroundColor: COLORS.line }
});

export { SPACE, RADIUS, TYPE, COLORS, SCREEN_PAD };
