import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function Flame({ size = "100%", color = "#FF0000" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M50,90 C20,90 20,50 35,45 C30,60 40,65 45,55 C40,30 50,10 50,10 C50,10 60,30 55,55 C60,65 70,60 65,45 C80,50 80,90 50,90 Z" />
      <Path d="M50,80 C40,80 40,70 50,70 C55,70 55,75 50,75" strokeWidth="5" />
    </Svg>
  );
}
