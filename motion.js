import { ReduceMotion } from 'react-native-reanimated';

// Dice spins, token hops and the charge ring are how the game communicates what
// just happened — they are gameplay feedback, not decoration. So they opt out of
// the OS / browser "reduce motion" accessibility setting, which would otherwise
// make Reanimated skip straight to each animation's final value.
export const NO_REDUCE = ReduceMotion.Never;

// withTiming(value, timing({ duration: 400 }))
//
// Both helpers are worklets because they get called inside useAnimatedStyle,
// which runs on the UI thread on a device. A plain function there works on web
// and kills the app on Android the moment it mounts — that is exactly how the
// first APK died on launch. scripts/check-worklets.js keeps it from coming back.
export const timing = (config = {}) => {
  'worklet';
  return { ...config, reduceMotion: NO_REDUCE };
};

// The counterpart, for anything that is decoration rather than information:
// drifting dice on the menus, button squash, screen fades. None of it tells you
// anything about the game, so it honours the OS setting instead of overriding
// it. Use this for chrome and NO_REDUCE for gameplay feedback.
export const DECORATIVE = ReduceMotion.System;
export const decorative = (config = {}) => {
  'worklet';
  return { ...config, reduceMotion: DECORATIVE };
};

// Springs the UI shares, so every press and every screen transition feels like
// the same product. Physics rather than duration: an interrupted spring
// retargets from wherever it is instead of snapping.
export const SPRING = { damping: 18, stiffness: 220, mass: 0.7, reduceMotion: DECORATIVE };
export const SPRING_SOFT = { damping: 22, stiffness: 140, mass: 0.9, reduceMotion: DECORATIVE };
