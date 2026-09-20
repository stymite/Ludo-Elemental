import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function Water({ size = "100%", color = "#0000FF" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="50" cy="50" r="40" />
      <Path d="M15,60 Q 30,75 50,60 T 85,60" />
      <Path d="M22,75 Q 35,90 50,75 T 78,75" />
      <Path d="M25,45 a12,12 0 1,1 20,10" />
      <Path d="M75,45 a12,12 0 1,0 -20,10" />
    </Svg>
  );
}
