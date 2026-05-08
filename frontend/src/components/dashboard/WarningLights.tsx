import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G, Ellipse, Rect } from 'react-native-svg';

interface Props {
  mechanicalWarnings: number;
  compact?: boolean; // Patagonie: voyants réduits
}

const warningColors = ['#4CAF50', '#FF9800', '#FF5722', '#F44336'];

// Single warning light rendered in SVG
const WarningLight: React.FC<{
  size: number;
  color: string;
  isLit: boolean;
  blinkOpacity: number;
  isBlinking: boolean;
}> = ({ size, color, isLit, blinkOpacity, isBlinking }) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const glassR = outerR - 7;

  // For the blinking light, apply opacity only to the glass lens
  const lensOpacity = isBlinking ? blinkOpacity : 1;

  return (
    <Svg width={size} height={size}>
      {/* Brass outer ring with laiton reflections */}
      <Circle cx={cx} cy={cy} r={outerR} fill="#A08040" />
      <Circle cx={cx} cy={cy} r={outerR - 1} fill="#8B7030" />
      {/* Strong laiton highlight - top arc */}
      <Ellipse cx={cx - outerR * 0.10} cy={cy - outerR * 0.40} rx={outerR * 0.68} ry={outerR * 0.14} fill="rgba(255,230,160,0.28)" />
      <Ellipse cx={cx + outerR * 0.12} cy={cy - outerR * 0.46} rx={outerR * 0.38} ry={outerR * 0.07} fill="rgba(255,240,180,0.20)" />
      {/* Bottom softer reflection */}
      <Ellipse cx={cx + outerR * 0.15} cy={cy + outerR * 0.38} rx={outerR * 0.42} ry={outerR * 0.09} fill="rgba(200,170,100,0.14)" />
      
      {/* Inner bezel - dark recessed ring */}
      <Circle cx={cx} cy={cy} r={outerR - 3} fill="#1a1a1a" />
      <Circle cx={cx} cy={cy} r={outerR - 4.5} fill="#222" />
      
      {/* Glass lens - only this blinks for the red light */}
      <Circle
        cx={cx}
        cy={cy}
        r={glassR}
        fill={isLit ? color : '#2a2a2a'}
        opacity={isLit ? lensOpacity : 0.9}
      />
      
      {/* Glass border bevel */}
      <Circle cx={cx} cy={cy} r={glassR} fill="none" stroke={isLit ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'} strokeWidth={0.8} />
      
      {/* Inner glow when lit */}
      {isLit && (
        <Circle cx={cx} cy={cy} r={glassR * 0.65} fill={color} opacity={0.5 * lensOpacity} />
      )}
      
      {/* Glass dome reflection */}
      <Ellipse cx={cx - glassR * 0.2} cy={cy - glassR * 0.25} rx={glassR * 0.55} ry={glassR * 0.3} fill={`rgba(255,255,255,${isLit ? 0.35 : 0.12})`} />
      <Ellipse cx={cx + glassR * 0.2} cy={cy + glassR * 0.3} rx={glassR * 0.15} ry={glassR * 0.08} fill="rgba(255,255,255,0.08)" />
    </Svg>
  );
};

export const WarningLights: React.FC<Props> = ({ mechanicalWarnings, compact }) => {
  // State-driven blink for the red light only
  const [blinkOpacity, setBlinkOpacity] = useState(1);

  useEffect(() => {
    if (mechanicalWarnings >= 4) {
      let frame = 0;
      const interval = setInterval(() => {
        frame++;
        // Oscillate between 0.15 and 1
        setBlinkOpacity(0.15 + 0.85 * (0.5 + 0.5 * Math.sin(frame * 0.25)));
      }, 40);
      return () => clearInterval(interval);
    } else {
      setBlinkOpacity(1);
    }
  }, [mechanicalWarnings]);

  const lightSize = compact ? 30 : 56;

  return (
    <View style={[styles.row, compact && { paddingHorizontal: 2, gap: 2 }]}>
      {warningColors.map((color, index) => {
        const isLit = index < mechanicalWarnings;
        const isBlinking = index === 3 && mechanicalWarnings >= 4;

        return (
          <View key={`warning-${index}`} style={[styles.lightWrapper, compact && { marginHorizontal: 0 }]}>
            <WarningLight
              size={lightSize}
              color={color}
              isLit={isLit}
              blinkOpacity={isBlinking ? blinkOpacity : 1}
              isBlinking={isBlinking}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  lightWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
