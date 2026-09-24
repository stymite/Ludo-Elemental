import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function TutorialTooltip({
  resultMessage,
  actionText,
  tint = '#FFB300',
  triangleOffset = 0,
  style,
  minWidth = 140,
  maxWidth = 260,
  onPress,
}) {
  const hasResult = typeof resultMessage === 'string' && resultMessage.trim().length > 0;
  const hasAction = typeof actionText === 'string' && actionText.trim().length > 0;
  if (!hasResult && !hasAction) {
    return null;
  }

  const content = (
    <View style={[styles.box, { borderColor: tint }]}>
      {Boolean(resultMessage) && (
        <Text style={styles.resultText}>
          {resultMessage}
        </Text>
      )}
      {Boolean(actionText) && (
        <Text style={styles.actionText}>
          {actionText}
        </Text>
      )}
    </View>
  );

  return (
    <View
      pointerEvents={onPress ? 'auto' : 'none'}
      style={[styles.container, { minWidth, maxWidth }, style]}
    >
      {/* Triangle top pointing up */}
      <View style={[styles.triangleWrapper, { transform: [{ translateX: triangleOffset }] }]}>
        <Svg width="14" height="7" viewBox="0 0 14 7">
          <Path d="M7 1 L13 7 L1 7 Z" fill="#000000" opacity="1" />
          <Path d="M1 7 L7 1.5 L13 7" fill="none" stroke={tint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>

      {/* Speech bubble box: 100% solid background opacity, highest z-index */}
      {onPress ? (
        <Pressable onPress={onPress} style={{ width: '100%' }}>
          {content}
        </Pressable>
      ) : content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    elevation: 999999,
    opacity: 1,
  },
  triangleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -1,
    zIndex: 999999,
    elevation: 999999,
    opacity: 1,
  },
  box: {
    width: '100%',
    backgroundColor: '#000000',
    opacity: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 999999,
    zIndex: 999999,
  },
  resultText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#A0A0AE',
    textAlign: 'center',
    fontWeight: '500',
  },
  actionText: {
    color: '#F2F2F5',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

