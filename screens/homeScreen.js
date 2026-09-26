import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Image, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Button, Rise } from '../components/ui';
import BouncingArrow from '../components/BouncingArrow';
import { COLORS, TYPE, SPACE, RADIUS, SEAT } from '../theme';
// needsAuth is separate from needsNet on purpose: playing offline by choice and
// having no signal are different states, and a card that says OFFLINE at
// somebody who deliberately skipped signing in is just wrong.
const MODES = [
  {
    key: 'MATCH',
    title: 'Play Online',
    icon: 'globe-outline',
    needsNet: true,
    needsAuth: true,
  },
  {
    key: 'ROOM',
    title: 'Party Code',
    icon: 'key-outline',
    needsNet: true,
    needsAuth: true,
  },
  {
    // One entry, not two: the table you set up next is where you say who is a
    // person and who is the computer, so asking here as well was asking twice.
    key: 'LOCAL',
    title: 'Pass N Play',
    icon: 'game-controller-outline',
    needsNet: false
  }
];


const GlassModeCard = ({ title, icon, onPress, blocked, badge, delay = 0, style, compact = false, highlighted = false, paddingVertical }) => (
  <Rise delay={delay} style={style}>
    <Pressable
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [
        s.glassCard,
        paddingVertical !== undefined && { paddingVertical },
        compact && s.glassCardCompact,
        blocked && s.cardDimmed,
        highlighted && s.tutorialHighlight,
        pressed && s.cardPressed
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!blocked }}
    >
      <View style={[s.iconWrapper, compact && s.iconWrapperCompact]}>
        <Ionicons
          name={icon}
          size={compact ? 27 : 32}
          color={blocked ? COLORS.textLow : '#FFFFFF'}
        />
      </View>

      <Text style={[s.cardTitle, compact && s.cardTitleCompact, blocked && s.cardTitleBlocked]} numberOfLines={1}>
        {title}
      </Text>

      {blocked ? (
        <View style={s.offlineBadge}>
          <Text style={s.offlineText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={compact ? 17 : 20} color="rgba(255, 255, 255, 0.25)" />
      )}
    </Pressable>
  </Rise>
);

// Static prismatic rainbow gradient backdrop for the shop button, mixed with glassmorphism
const PrismaticBackground = ({ radius = 24 }) => (
  <View style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: radius, overflow: 'hidden' }]}>
    <Svg width="100%" height="100%" viewBox="0 0 96 96">
      <Defs>
        <LinearGradient id="prismaticGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#A61543" />
          <Stop offset="18%" stopColor="#A34600" />
          <Stop offset="36%" stopColor="#946C00" />
          <Stop offset="52%" stopColor="#007D54" />
          <Stop offset="70%" stopColor="#005F9E" />
          <Stop offset="86%" stopColor="#4B2187" />
          <Stop offset="100%" stopColor="#8F0D60" />
        </LinearGradient>
        <LinearGradient id="holoSheen" x1="0%" y1="0%" x2="75%" y2="75%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.03" />
          <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="85%" stopColor="#FFFFFF" stopOpacity="0.05" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={96} height={96} rx={radius} fill="#0A0E17" opacity={0.6} />
      <Rect x={0} y={0} width={96} height={96} rx={radius} fill="url(#prismaticGrad)" opacity={0.3} />
      <Rect x={0} y={0} width={96} height={96} rx={radius} fill="#000000" opacity={0.3} />
      <Rect x={0} y={0} width={96} height={96} rx={radius} fill="url(#holoSheen)" />
    </Svg>
  </View>
);

// Detailed boutique storefront SVG icon - Rich Vibrant Boutique Edition
const ShopIcon = ({ size = 42 }) => (
  <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    {/* Shadow beneath storefront */}
    <Rect x={3} y={32} width={30} height={2} rx={1} fill="#000000" opacity={0.35} />

    {/* Foundation / Threshold step */}
    <Rect x={2} y={30} width={32} height={2.5} rx={1} fill="#F0EBE1" />
    <Path d="M 3 30.5 L 33 30.5" stroke="#D4AF37" strokeWidth={0.8} opacity={0.9} />

    {/* Left and Right Wall Pillars */}
    <Rect x={3} y={15} width={4} height={15} rx={0.5} fill="#FAF7F2" />
    <Path d="M 3.5 15.5 L 3.5 29.5" stroke="#E2DCD2" strokeWidth={0.6} />
    <Rect x={29} y={15} width={4} height={15} rx={0.5} fill="#FAF7F2" />
    <Path d="M 32.5 15.5 L 32.5 29.5" stroke="#E2DCD2" strokeWidth={0.6} />

    {/* Left Showcase Window */}
    <Rect x={8} y={16} width={11} height={11.5} rx={1.5} fill="#D4AF37" />
    <Rect x={8.8} y={16.8} width={9.4} height={9.9} rx={1} fill="#FFF6D6" />
    <Path d="M 13.5 16.8 L 13.5 26.7" stroke="#E6A817" strokeWidth={0.75} opacity={0.85} />
    <Path d="M 8.8 21.8 L 18.2 21.8" stroke="#E6A817" strokeWidth={0.75} opacity={0.85} />
    <Path d="M 9.5 24 L 14.5 17.5 L 16.5 17.5 L 11.5 24 Z" fill="#FFFFFF" opacity={0.75} />
    <Path d="M 11.2 18.5 L 11.7 19.5 L 12.7 20 L 11.7 20.5 L 11.2 21.5 L 10.7 20.5 L 9.7 20 L 10.7 19.5 Z" fill="#FF8C00" />
    <Circle cx={11.2} cy={20} r={0.8} fill="#FFE600" />

    {/* Right Shop Door */}
    <Rect x={20.5} y={16} width={8} height={14} rx={1.2} fill="#8A4A28" />
    <Rect x={21.2} y={16.7} width={6.6} height={12.6} rx={0.8} fill="#A65D34" />
    <Rect x={22} y={17.5} width={5} height={4.8} rx={0.6} fill="#E0F7FA" />
    <Path d="M 22.5 21 L 25.5 18 L 26.5 18 L 23.5 21 Z" fill="#FFFFFF" opacity={0.8} />
    <Rect x={22} y={23.5} width={5} height={5} rx={0.6} fill="#8A4A28" />
    <Circle cx={22.2} cy={22.8} r={1.1} fill="#FFD54F" />

    {/* Under-awning Shadow */}
    <Path d="M 2.5 14 L 33.5 14 L 33.5 15.8 L 2.5 15.8 Z" fill="#000000" opacity={0.25} />

    {/* Striped Canopy / Awning */}
    <Path d="M 2.5 5.5 L 8.7 5.5 L 8.7 12.8 C 8.7 14.5 2.5 14.5 2.5 12.8 Z" fill="#FF4757" stroke="#D63031" strokeWidth={0.5} />
    <Path d="M 8.7 5.5 L 14.9 5.5 L 14.9 12.8 C 14.9 14.5 8.7 14.5 8.7 12.8 Z" fill="#FFFDF8" stroke="#E8E2D5" strokeWidth={0.5} />
    <Path d="M 14.9 5.5 L 21.1 5.5 L 21.1 12.8 C 21.1 14.5 14.9 14.5 14.9 12.8 Z" fill="#FF4757" stroke="#D63031" strokeWidth={0.5} />
    <Path d="M 21.1 5.5 L 27.3 5.5 L 27.3 12.8 C 27.3 14.5 21.1 14.5 21.1 12.8 Z" fill="#FFFDF8" stroke="#E8E2D5" strokeWidth={0.5} />
    <Path d="M 27.3 5.5 L 33.5 5.5 L 33.5 12.8 C 33.5 14.5 27.3 14.5 27.3 12.8 Z" fill="#FF4757" stroke="#D63031" strokeWidth={0.5} />

    {/* Canopy highlight rib on colored segments */}
    <Path d="M 5.6 6 L 5.6 12.5" stroke="#FFA4AC" strokeWidth={0.6} opacity={0.8} />
    <Path d="M 18 6 L 18 12.5" stroke="#FFA4AC" strokeWidth={0.6} opacity={0.8} />
    <Path d="M 30.4 6 L 30.4 12.5" stroke="#FFA4AC" strokeWidth={0.6} opacity={0.8} />

    {/* Top Roof Eaves Bar */}
    <Path d="M 2 5.5 C 2 4.5 3 3.8 4 3.8 L 32 3.8 C 33 3.8 34 4.5 34 5.5 Z" fill="#F4EFE6" />
    <Path d="M 3 4.5 L 33 4.5" stroke="#FFD54F" strokeWidth={0.8} opacity={0.9} />

    {/* Center Roof Crest / Gem */}
    <Path d="M 18 1.5 L 20 3.8 L 18 6 L 16 3.8 Z" fill="#FFD54F" stroke="#FFF" strokeWidth={0.5} />
    <Circle cx={18} cy={3.8} r={0.8} fill="#FFA000" />
  </Svg>
);

const StoreButton = ({ onPress, count }) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompact = height <= 680;
  const isTall = height >= 800;

  const size = isCompact ? 94 : isTall ? 106 : 100;
  const iconSize = isCompact ? 50 : isTall ? 56 : 53;
  const fontSize = isCompact ? 23 : isTall ? 26 : 25;
  const radius = isCompact ? 24 : 26;
  const bottom = Math.max(isCompact ? 20 : 26, insets.bottom + (isCompact ? 12 : 16));

  return (
    <Rise delay={240} style={[s.storeAnchor, { bottom, right: isCompact ? 18 : 20 }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.storeBtn,
          { width: size, height: size, borderRadius: radius },
          pressed && s.storePressed
        ]}
        accessibilityRole="button"
        accessibilityLabel="Shop. Tokens, dice and boards"
      >
        <PrismaticBackground radius={radius} />
        <ShopIcon size={iconSize} />
        <Text style={[s.storeText, { fontSize }]}>SHOP</Text>

        {count > 0 ? (
          <View style={s.storeBadge}>
            <Text style={s.storeBadgeText}>{count}</Text>
          </View>
        ) : null}
      </Pressable>
    </Rise>
  );
};

const HomeScreen = ({
  username, avatarUrl, isGuest, online, signedIn = true,
  resumable, onResume, onDismissResume,
  ownedCount = 0, onStore,
  onPick, onSettings, onPickAvatar, onTutorial
}) => {
  // Signed out is its own state, not a nameless guest: a guest account is a
  // real account with a real history behind it, and calling both "Guest" hides
  // which one you are looking at.
  const name = signedIn ? (username || (isGuest ? 'Guest' : 'Player')) : 'Offline Player';
  const initial = name.trim().charAt(0).toUpperCase();
  const status = !online ? 'No connection'
    : !signedIn ? 'Offline mode'
    : isGuest ? 'Guest account' : 'Connected';

  // Google accounts wear their provider's picture; everyone
  // else may pick one (see pickAvatar in auth.js).
  const handlePickAvatar = () => {
    if (!isGuest && signedIn) return;
    if (onPickAvatar) onPickAvatar();
  };

  const [spotlight, setSpotlight] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('ludo.tutorial.seen').then(seen => {
      if (alive && !seen) {
        setSpotlight(true);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const handleTutorial = () => {
    if (spotlight) {
      setSpotlight(false);
      AsyncStorage.setItem('ludo.tutorial.seen', '1').catch(() => {});
    }
    if (onTutorial) onTutorial();
  };

  const { height } = useWindowDimensions();
  const isCompact = height <= 680;
  const isTall = height >= 800;

  const heroW = isCompact ? 210 : isTall ? 234 : 222;
  const heroH = Math.round(heroW / 2);
  const topBarMb = isCompact ? 10 : isTall ? 18 : 14;
  const heroMt = isCompact ? 8 : isTall ? 14 : 10;
  const heroMb = isCompact ? 16 : isTall ? 24 : 20;
  const modesGap = isCompact ? 8 : isTall ? 12 : 10;
  const cardPadV = isCompact ? 13 : isTall ? 15 : 14;

  return (
    <Screen
      scroll={false}
      floating={<StoreButton onPress={onStore} count={ownedCount} />}
    >
      {/* Top Bar */}
      <View style={[s.topBar, { marginBottom: topBarMb }]}>
        <View style={s.accountBox}>
          <Pressable 
            onPress={handlePickAvatar}
            style={[s.avatar, { overflow: 'hidden' }]}
            disabled={!isGuest && !!signedIn}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
            ) : signedIn ? (
              <Text style={s.avatarText}>{initial}</Text>
            ) : (
              <Ionicons name="person-outline" size={24} color={COLORS.textMid} />
            )}
          </Pressable>

          <View style={s.who}>
            <Text style={s.username} numberOfLines={1}>{name}</Text>
            <View style={s.statusRow}>
              <View
                style={[
                  s.dot,
                  { backgroundColor: online && signedIn ? COLORS.success : COLORS.textLow }
                ]}
              />
              <Text style={s.status}>{status}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={onSettings}
          style={({ pressed }) => [s.settingsBtnBox, pressed && s.settingsPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${name}. Open settings`}
        >
          <Ionicons name="settings-outline" size={24} color={COLORS.textHi} />
        </Pressable>
      </View>

      <View style={[s.heroImageContainer, { marginTop: heroMt, marginBottom: heroMb }]}>
        <Image 
          source={require('../assets/top-left.png')} 
          style={{ width: heroW, height: heroH }}
          resizeMode="contain" 
        />
      </View>

      {resumable ? (
        <Rise style={s.resume}>
          <View style={s.resumeText}>
            <Text style={s.resumeTitle}>Game in progress</Text>
            <Text style={s.resumeDetail}>Room {resumable.code}</Text>
          </View>
          <Button label="Rejoin" tone="primary" onPress={onResume} />
          <Button
            label="Dismiss"
            tone="ghost"
            onPress={onDismissResume}
            accessibilityHint="Forget this game"
          />
        </Rise>
      ) : null}

      <View style={[s.modes, { gap: modesGap }]}>
        {MODES.map((mode, i) => {
          const noAccount = mode.needsAuth && !signedIn;
          const noSignal = mode.needsNet && !online;
          const blocked = noAccount || noSignal;
          const badge = noSignal ? 'OFFLINE' : noAccount ? 'SIGN IN' : null;
          return (
            <View key={mode.key}>
              <GlassModeCard
                title={mode.title}
                icon={mode.icon}
                blocked={blocked}
                badge={badge}
                delay={60 * i}
                onPress={() => onPick(mode.key)}
                paddingVertical={cardPadV}
              />
            </View>
          );
        })}

        <View style={s.tutorialWrapper}>
          {spotlight ? (
            <View style={s.bouncingArrowWrapper} pointerEvents="none">
              <BouncingArrow color={SEAT.YELLOW} size={1.05} active={spotlight} />
            </View>
          ) : null}
          <GlassModeCard
            title="Tutorial"
            icon="help-circle-outline"
            delay={180}
            onPress={handleTutorial}
            compact
            highlighted={spotlight}
            style={s.tutorialCard}
            paddingVertical={cardPadV - 1}
          />
        </View>
      </View>
    </Screen>
  );
};

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginTop: SPACE.xs,
    marginBottom: 16,
  },
  heroImageContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  heroImage: {
    width: 196,
    height: 98,
  },
  accountBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsBtnBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    transform: [{ scale: 0.96 }]
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63, 208, 201, 0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.accent
  },
  avatarText: { ...TYPE.heading, color: COLORS.accent, fontSize: 18, fontWeight: '800' },
  who: { flex: 1 },
  username: { ...TYPE.body, fontSize: 17, fontWeight: '700', color: COLORS.textHi },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: RADIUS.pill },
  status: { ...TYPE.body, fontSize: 12, color: COLORS.textMid },

  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: COLORS.accentDim,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.accent,
    padding: SPACE.md,
    marginBottom: SPACE.lg
  },
  resumeText: { flex: 1 },
  resumeTitle: { ...TYPE.label, color: COLORS.textHi },
  resumeDetail: { ...TYPE.body, fontSize: 12, color: COLORS.textMid, marginTop: 1 },

  modes: {
    gap: 10,
    paddingBottom: 0,
    position: 'relative',
    zIndex: 25,
    elevation: 25,
  },
  glassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    gap: SPACE.lg,
  },
  glassCardCompact: {
    width: 210,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
    transform: [{ scale: 0.985 }]
  },
  cardDimmed: {
    opacity: 0.45,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  iconWrapperCompact: {
    width: 36,
    height: 36,
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'Nunito-Bold',
    fontSize: 20,
    color: COLORS.textHi,
    letterSpacing: 0.2,
  },
  cardTitleCompact: {
    fontSize: 17,
    letterSpacing: 0.15,
  },
  cardTitleBlocked: {
    color: COLORS.textMid,
  },
  offlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLow,
  },
  spotlightBackdrop: {
    position: 'absolute',
    top: -1000,
    bottom: -1000,
    left: -1000,
    right: -1000,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    zIndex: 10,
    elevation: 10,
  },
  dimmed: {
    opacity: 0.15,
  },
  tutorialWrapper: {
    position: 'relative',
    zIndex: 30,
    elevation: 30,
  },
  tutorialCard: {
    width: 210,
    alignSelf: 'flex-start',
  },
  bouncingArrowWrapper: {
    position: 'absolute',
    top: -42,
    left: 88,
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialHighlight: {
    borderColor: SEAT.YELLOW,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 212, 38, 0.12)',
    shadowColor: SEAT.YELLOW,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    // No elevation: dark rectangle under a see-through fill on Android. Stacking
    // above the dim is tutorialWrapper's job (elevation 30), not this card's.
  },
  storeAnchor: {
    position: 'absolute',
    right: 20,
    zIndex: 50,
    elevation: 20,
  },
  storeBtn: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'visible',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ rotate: '5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  storePressed: {
    transform: [{ rotate: '5deg' }, { scale: 0.94 }],
  },
  storeText: {
    fontFamily: 'Becak',
    fontSize: 22,
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  storeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 5,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  storeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default HomeScreen;
