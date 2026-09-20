import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Svg, { Circle, Polygon, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

const SPIKE_COUNT = 12;
const INNER_R = 33;
const OUTER_R = 48;

// Star ring: alternates outer spike tips with inner valleys, so the token ends
// up sheathed in a ring of ice shards.
const buildSpikes = (cx, cy, innerR, outerR, spikes) => {
  const points = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(' ');
};

const SPIKE_POINTS = buildSpikes(50, 50, INNER_R, OUTER_R, SPIKE_COUNT);

/**
 * Translucent spiked ice sheath drawn over a token. Purely decorative — the
 * engine decides who gets impaled. Animation intentionally left out.
 */
const IceShield = () => (
  <View style={styles.wrapper} pointerEvents="none">
    <Image 
      source={require('../assets/water_ability.png')} 
      style={{ width: '100%', height: '100%', resizeMode: 'contain', opacity: 0.92 }} 
    />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: '124%',
    height: '124%',
    left: '-12%',
    top: '-12%',
    zIndex: 50,
    elevation: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IceShield;
