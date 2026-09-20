import React from 'react';
import Svg, { Path, Polygon, Line } from 'react-native-svg';

export default function Leaf({ size = "100%", color = "#00FF00" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="30,15 70,15 90,85 10,85" />
      <Line x1="10" y1="70" x2="45" y2="70" />
      <Line x1="55" y1="70" x2="90" y2="70" />
      <Line x1="50" y1="70" x2="50" y2="85" />
      <Path d="M50,55 C35,55 35,35 50,35 C65,35 65,50 50,50 C42,50 42,42 50,42" />
    </Svg>
  );
}
