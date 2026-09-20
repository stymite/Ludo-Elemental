import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Image, Platform, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { COLORS, TYPE } from '../theme';

import Dice0 from '../assets/r0.png';
import Dice1 from '../assets/r1.png';
import Dice2 from '../assets/r2.png';
import Dice3 from '../assets/r3.png';
import Dice4 from '../assets/r4.png';
import Dice5 from '../assets/r5.png';
import Dice6 from '../assets/r6.png';

import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

const DICE_FACES = {
  0: Dice0,
  1: Dice1,
  2: Dice2,
  3: Dice3,
  4: Dice4,
  5: Dice5,
  6: Dice6,
};

const CENTER_ART = require('../assets/auth-page/center.webp');

// The loading roll: three spin segments, then the die is held so the face is
// readable before the screen either leaves or rolls again. SPIN_MS is derived
// from the segments so the timer below cannot drift from the animation.
const SPIN = [350, 350, 300];
const SPIN_MS = SPIN[0] + SPIN[1] + SPIN[2];
const HOLD_MS = 850;
const REROLL_GAP_MS = 500;
// A loading screen is not reporting a result, so this one always lands the same
// way — a six, because it is the face worth landing on.
const LANDS_ON = 6;

export default function SplashScreen({ isReady = true, onFinish }) {
  const [diceFace, setDiceFace] = useState(0);
  const [dots, setDots] = useState('...');
  const isMounted = useRef(true);
  const finishCalled = useRef(false);
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;
  // A ref, not an effect dependency: App passes a fresh arrow on every render,
  // and as a dependency it restarted the whole dice loop each time the boot
  // updated state — enough updates in a row and the splash never finished.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Dice rolling animation
  const diceRotate = useSharedValue(0);
  const diceScale = useSharedValue(1);

  // Fade out when finishing
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    isMounted.current = true;

    // Immediately hide the native OS splash screen so this in-app screen appears
    ExpoSplashScreen.hideAsync().catch(() => {});

    // Connecting dots animation
    const dotInterval = setInterval(() => {
      if (!isMounted.current) return;
      setDots(prev => (prev.length >= 3 ? '.' : prev + '.'));
    }, 450);

    // Dice rolling loop:
    // 1. Spins for SPIN_MS showing the face it lands on
    // 2. Holds that face for HOLD_MS so it is readable
    // 3. Then if isReady -> transitions out; else back to r0 and rolls again
    let cycleTimeout = null;

    const startRollCycle = () => {
      if (!isMounted.current) return;

      // Spin & pop dice
      diceRotate.value = 0;
      diceRotate.value = withSequence(
        withTiming(360, { duration: SPIN[0], easing: Easing.linear }),
        withTiming(720, { duration: SPIN[1], easing: Easing.linear }),
        withTiming(1080, { duration: SPIN[2], easing: Easing.out(Easing.cubic) })
      );

      diceScale.value = withSequence(
        withTiming(1.35, { duration: 250, easing: Easing.out(Easing.ease) }),
        withTiming(1.15, { duration: 450 }),
        withTiming(1.0, { duration: 300, easing: Easing.out(Easing.back(1.4)) })
      );

      // Set once, to the face it lands on. This used to swap in a fresh random
      // face every 50ms for the whole second — nineteen state updates and
      // nineteen bitmap swaps riding on top of the spin — which reads as a die
      // flickering through numbers rather than one die turning over. The spin
      // is the motion; the face only has to be legible when it stops.
      setDiceFace(LANDS_ON);

      cycleTimeout = setTimeout(() => {
        if (!isMounted.current) return;
        if (isReadyRef.current && onFinishRef.current && !finishCalled.current) {
          finishCalled.current = true;
          screenOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
          setTimeout(() => {
            if (isMounted.current && onFinishRef.current) onFinishRef.current();
          }, 320);
        } else {
          // Still loading: back to the blank face and roll again.
          setDiceFace(0);
          cycleTimeout = setTimeout(() => {
            if (isMounted.current) startRollCycle();
          }, REROLL_GAP_MS);
        }
      }, SPIN_MS + HOLD_MS);
    };

    startRollCycle();

    return () => {
      isMounted.current = false;
      clearInterval(dotInterval);
      if (cycleTimeout) clearTimeout(cycleTimeout);
    };
  }, [diceRotate, diceScale, screenOpacity]);

  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const diceStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${diceRotate.value}deg` },
      { scale: diceScale.value },
    ],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  return (
    <Animated.View style={[s.root, { width: winWidth, height: winHeight }, containerStyle]}>
      <StatusBar style="light" backgroundColor="#08080C" translucent />
      <View style={s.centerStage}>
        {/* Center Avatar - static and prominent */}
        <View style={s.avatarContainer}>
          <Image
            source={CENTER_ART}
            style={s.avatarImage}
            resizeMode="contain"
          />
        </View>

        {/* Connecting status row */}
        <View style={s.statusRow}>
          <Animated.View style={[s.diceWrapper, diceStyle]}>
            <Image
              source={DICE_FACES[diceFace] || Dice0}
              style={s.diceImg}
              resizeMode="contain"
            />
          </Animated.View>

          <Text style={s.connectingText}>
            Loading<Text style={s.dotsText}>{dots}</Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#08080C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  avatarContainer: {
    width: '92%',
    maxWidth: 350,
    aspectRatio: 1152 / 840,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  diceWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceImg: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  connectingText: {
    ...TYPE.label,
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'Nunito-Bold', android: 'Nunito-Bold', default: 'sans-serif' }),
    fontWeight: '700',
    color: COLORS.textHi,
    letterSpacing: 0.8,
  },
  dotsText: {
    color: '#FFB300',
    fontWeight: '900',
  },
});
