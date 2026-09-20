import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function Star({ size = "100%", color = "#FFFF00" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M50,45 C75,45 75,15 50,15 C25,15 25,35 40,40" />
      <Path d="M30,85 C10,85 10,60 30,60 C45,60 45,75 35,80" />
      <Path d="M70,85 C90,85 90,60 70,60 C55,60 55,75 65,80" />
    </Svg>
  );
}
