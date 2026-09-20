import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { NO_REDUCE, timing } from '../motion';

const WEB_BOB = Platform.OS === 'web';
if (WEB_BOB && typeof document !== 'undefined') {
  const styleId = 'ludo-bouncing-arrow-css';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @keyframes ludo-bouncing-arrow-kf {
        from { transform: translateY(0px); }
        to { transform: translateY(6px); }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export default function BouncingArrow({ color = '#FFB300', size = 1, style, active = true }) {
  const pointerOffset = useSharedValue(0);

  useEffect(() => {
    if (WEB_BOB || !active) return;
    pointerOffset.value = withRepeat(
      withSequence(
        withTiming(6, timing({ duration: 400 })),
        withTiming(0, timing({ duration: 400 }))
      ),
      -1,
      true
    );
    return () => {
      pointerOffset.value = 0;
    };
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pointerOffset.value }],
    opacity: active ? 1 : 0,
  }));

  const containerStyle = WEB_BOB
    ? {
        opacity: active ? 1 : 0,
        animation: active ? 'ludo-bouncing-arrow-kf 400ms ease-in-out infinite alternate' : 'none',
      }
    : animatedStyle;

  if (!active) return null;

  const w = 32 * size;
  const h = 38 * size;

  return (
    <Animated.View pointerEvents="none" style={[styles.arrowContainer, containerStyle, style]}>
      <Svg width={w} height={h} viewBox="0 0 32 38">
        <Path
          d="M16 37 C16 37 27 24 29 20 C30 18 28.5 17 26 18 C23.5 19 21.5 19.5 20.5 19.5 L17.5 3 C17.5 1.5 14.5 1.5 14.5 3 L11.5 19.5 C10.5 19.5 8.5 19 6 18 C3.5 17 2 18 3 20 C5 24 16 37 16 37 Z"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});
