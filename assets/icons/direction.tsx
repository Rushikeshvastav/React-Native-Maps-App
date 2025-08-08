import Svg, { Path } from "react-native-svg";
import React from "react";

export function Direction({ color }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <Path
        d="M14.25 9H3.75"
        stroke={color ? color : "#fff"}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <Path
        d="M9 3.75L14.25 9L9 14.25"
        stroke={color ? color : "#fff"}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}