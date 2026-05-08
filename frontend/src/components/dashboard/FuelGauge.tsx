import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Line,
  G,
  Path,
  Text as SvgText,
  Ellipse,
} from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  gaugeSize: number;
  fuelLevel: number;
  labelScale?: number; // Facteur d'échelle pour les chiffres (1 = normal, 0.5 = 50%)
}

// Phillips-head screw SVG sub-component
const PhillipsScrew: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => (
  <G>
    <Circle cx={cx} cy={cy} r={r + 1} fill="#3A2A1A" />
    <Circle cx={cx} cy={cy} r={r} fill="#7A6A50" />
    <Circle cx={cx} cy={cy} r={r - 0.8} fill="#8B7B60" />
    <Line x1={cx - r * 0.55} y1={cy} x2={cx + r * 0.55} y2={cy} stroke="#4A3A28" strokeWidth={1.2} strokeLinecap="round" />
    <Line x1={cx} y1={cy - r * 0.55} x2={cx} y2={cy + r * 0.55} stroke="#4A3A28" strokeWidth={1.2} strokeLinecap="round" />
    <Circle cx={cx - r * 0.2} cy={cy - r * 0.2} r={r * 0.3} fill="rgba(255,255,255,0.15)" />
  </G>
);

export const FuelGauge: React.FC<Props> = ({ gaugeSize, fuelLevel, labelScale = 1 }) => {
  // Add padding around gauge so the bezel isn't cropped
  const padding = 14;
  const svgSize = gaugeSize + padding * 2;
  const gaugeRadius = gaugeSize / 2 - 10;
  const gaugeCenterX = svgSize / 2;
  const gaugeCenterY = svgSize / 2;

  const getNeedleAngle = (value: number) => {
    return -225 + (value / 100) * 270;
  };

  const fuelAngle = getNeedleAngle(fuelLevel);
  const fuelRadians = (fuelAngle * Math.PI) / 180;
  const needleLength = gaugeRadius * 0.65;
  const needleX = gaugeCenterX + Math.cos(fuelRadians) * needleLength;
  const needleY = gaugeCenterY + Math.sin(fuelRadians) * needleLength;

  const counterLength = gaugeRadius * 0.18;
  const counterX = gaugeCenterX - Math.cos(fuelRadians) * counterLength;
  const counterY = gaugeCenterY - Math.sin(fuelRadians) * counterLength;

  return (
    <View style={[styles.gaugeWrapper, { marginLeft: -padding, marginTop: -padding, marginRight: -padding }]}>
      <Svg width={svgSize} height={svgSize}>
        {/* Outer mounting ring - dark industrial */}
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 12} fill="#1E1408" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 11} fill="#3A2A1A" />
        
        {/* Brass bezel with patina and reflections */}
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 9} fill="#8B7355" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 8} fill="#7B6345" />
        
        {/* Brass reflection highlights - strong polished laiton look */}
        <Ellipse
          cx={gaugeCenterX - gaugeRadius * 0.20}
          cy={gaugeCenterY - gaugeRadius * 0.50}
          rx={gaugeRadius * 0.7}
          ry={gaugeRadius * 0.12}
          fill="rgba(255,230,160,0.30)"
        />
        <Ellipse
          cx={gaugeCenterX + gaugeRadius * 0.15}
          cy={gaugeCenterY - gaugeRadius * 0.55}
          rx={gaugeRadius * 0.45}
          ry={gaugeRadius * 0.07}
          fill="rgba(255,240,180,0.22)"
        />
        <Ellipse
          cx={gaugeCenterX + gaugeRadius * 0.25}
          cy={gaugeCenterY + gaugeRadius * 0.50}
          rx={gaugeRadius * 0.5}
          ry={gaugeRadius * 0.09}
          fill="rgba(200,170,100,0.16)"
        />
        {/* Laiton highlight arc on bezel rim */}
        <Path
          d={`M ${gaugeCenterX + Math.cos(-150 * Math.PI / 180) * (gaugeRadius + 7)} 
              ${gaugeCenterY + Math.sin(-150 * Math.PI / 180) * (gaugeRadius + 7)}
              A ${gaugeRadius + 7} ${gaugeRadius + 7} 0 0 1 
              ${gaugeCenterX + Math.cos(-50 * Math.PI / 180) * (gaugeRadius + 7)} 
              ${gaugeCenterY + Math.sin(-50 * Math.PI / 180) * (gaugeRadius + 7)}`}
          stroke="rgba(255,235,170,0.28)"
          strokeWidth={3}
          fill="none"
        />
        
        {/* Patina spots on bezel */}
        <Circle cx={gaugeCenterX - gaugeRadius * 0.6} cy={gaugeCenterY - gaugeRadius * 0.6} r={4} fill="rgba(80,110,80,0.12)" />
        <Circle cx={gaugeCenterX + gaugeRadius * 0.5} cy={gaugeCenterY + gaugeRadius * 0.4} r={3} fill="rgba(75,105,75,0.10)" />
        
        {/* Inner bezel ring with chamfer */}
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 4} fill="#5A4838" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 2} fill="#2A2218" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius + 1} fill="#1a1a1a" />
        
        {/* Aged gauge face - yellowed/sepia */}
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius - 1} fill="#E8DCC8" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius - 3} fill="#F0E6D2" />
        
        {/* Age spots on face */}
        <Circle cx={gaugeCenterX - gaugeRadius * 0.3} cy={gaugeCenterY + gaugeRadius * 0.2} r={gaugeRadius * 0.18} fill="rgba(175,155,115,0.12)" />
        <Circle cx={gaugeCenterX + gaugeRadius * 0.28} cy={gaugeCenterY - gaugeRadius * 0.18} r={gaugeRadius * 0.12} fill="rgba(165,145,105,0.10)" />
        
        {/* Decorative inner ring - double line */}
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius * 0.93} stroke="#8B7355" strokeWidth={0.8} fill="none" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={gaugeRadius * 0.91} stroke="#A08868" strokeWidth={0.5} fill="none" />
        
        {/* Red danger zone arc */}
        <Path
          d={`M ${gaugeCenterX + Math.cos(-225 * Math.PI / 180) * (gaugeRadius * 0.82)} 
              ${gaugeCenterY + Math.sin(-225 * Math.PI / 180) * (gaugeRadius * 0.82)}
              A ${gaugeRadius * 0.82} ${gaugeRadius * 0.82} 0 0 1 
              ${gaugeCenterX + Math.cos((-225 + 54) * Math.PI / 180) * (gaugeRadius * 0.82)} 
              ${gaugeCenterY + Math.sin((-225 + 54) * Math.PI / 180) * (gaugeRadius * 0.82)}`}
          stroke="#8B0000"
          strokeWidth={7}
          fill="none"
          opacity={0.65}
        />
        
        {/* Gauge markings */}
        {[0, 20, 40, 60, 80, 100].map((mark) => {
          const markAngle = getNeedleAngle(mark);
          const markRadians = (markAngle * Math.PI) / 180;
          const innerR = gaugeRadius * 0.63;
          const outerR = gaugeRadius * 0.86;
          const x1 = gaugeCenterX + Math.cos(markRadians) * innerR;
          const y1 = gaugeCenterY + Math.sin(markRadians) * innerR;
          const x2 = gaugeCenterX + Math.cos(markRadians) * outerR;
          const y2 = gaugeCenterY + Math.sin(markRadians) * outerR;
          const labelR = gaugeRadius * 0.46;
          const labelX = gaugeCenterX + Math.cos(markRadians) * labelR;
          const labelY = gaugeCenterY + Math.sin(markRadians) * labelR;
          
          return (
            <G key={`mark-${mark}`}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1a1a1a" strokeWidth={2.5} />
              <SvgText x={labelX} y={labelY + 4} fill="#1a1a1a" fontSize={11 * labelScale} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling">
                {mark}
              </SvgText>
            </G>
          );
        })}
        
        {/* Minor tick marks */}
        {[10, 30, 50, 70, 90].map((mark) => {
          const markAngle = getNeedleAngle(mark);
          const markRadians = (markAngle * Math.PI) / 180;
          const innerR = gaugeRadius * 0.75;
          const outerR = gaugeRadius * 0.86;
          return (
            <Line key={`minor-${mark}`} x1={gaugeCenterX + Math.cos(markRadians) * innerR} y1={gaugeCenterY + Math.sin(markRadians) * innerR} x2={gaugeCenterX + Math.cos(markRadians) * outerR} y2={gaugeCenterY + Math.sin(markRadians) * outerR} stroke="#3A3A3A" strokeWidth={1.5} />
          );
        })}
        
        {/* Micro tick marks */}
        {[5, 15, 25, 35, 45, 55, 65, 75, 85, 95].map((mark) => {
          const markAngle = getNeedleAngle(mark);
          const markRadians = (markAngle * Math.PI) / 180;
          const innerR = gaugeRadius * 0.80;
          const outerR = gaugeRadius * 0.86;
          return (
            <Line key={`micro-${mark}`} x1={gaugeCenterX + Math.cos(markRadians) * innerR} y1={gaugeCenterY + Math.sin(markRadians) * innerR} x2={gaugeCenterX + Math.cos(markRadians) * outerR} y2={gaugeCenterY + Math.sin(markRadians) * outerR} stroke="#5A5A5A" strokeWidth={0.8} />
          );
        })}
        
        {/* ESSENCE label */}
        <SvgText x={gaugeCenterX} y={gaugeCenterY - gaugeRadius * 0.15} fill="#2A2A2A" fontSize={8 * labelScale} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling" letterSpacing={2}>
          ESSENCE
        </SvgText>
        <SvgText x={gaugeCenterX} y={gaugeCenterY - gaugeRadius * 0.05} fill="#5A5A5A" fontSize={5 * labelScale} textAnchor="middle" fontFamily="BigNoodleTitling" letterSpacing={1}>
          LITRES
        </SvgText>
        
        {/* Needle assembly */}
        <G>
          <Line x1={gaugeCenterX + 2} y1={gaugeCenterY + 2} x2={needleX + 2} y2={needleY + 2} stroke="rgba(0,0,0,0.3)" strokeWidth={4} strokeLinecap="round" />
          <Line x1={gaugeCenterX} y1={gaugeCenterY} x2={counterX} y2={counterY} stroke="#1a1a1a" strokeWidth={5} strokeLinecap="round" />
          <Line x1={gaugeCenterX} y1={gaugeCenterY} x2={needleX} y2={needleY} stroke="#1a1a1a" strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={gaugeCenterX} y1={gaugeCenterY} x2={gaugeCenterX + (needleX - gaugeCenterX) * 0.7} y2={gaugeCenterY + (needleY - gaugeCenterY) * 0.7} stroke="#3A3A3A" strokeWidth={1.8} strokeLinecap="round" />
          <Line x1={gaugeCenterX + (needleX - gaugeCenterX) * 0.7} y1={gaugeCenterY + (needleY - gaugeCenterY) * 0.7} x2={needleX} y2={needleY} stroke="#C40000" strokeWidth={2} strokeLinecap="round" />
        </G>
        
        {/* Center cap - layered brass */}
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={14} fill="#3A2A1A" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={12} fill="#5A4838" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={10} fill="#6B5344" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={8} fill="#8B7355" />
        <Circle cx={gaugeCenterX} cy={gaugeCenterY} r={5} fill="#A08868" />
        <Circle cx={gaugeCenterX - 2} cy={gaugeCenterY - 2} r={3} fill="rgba(255,255,255,0.18)" />
        
        {/* Glass dome reflection */}
        <Ellipse cx={gaugeCenterX - gaugeRadius * 0.22} cy={gaugeCenterY - gaugeRadius * 0.28} rx={gaugeRadius * 0.48} ry={gaugeRadius * 0.22} fill="rgba(255,255,255,0.14)" />
        <Ellipse cx={gaugeCenterX + gaugeRadius * 0.25} cy={gaugeCenterY + gaugeRadius * 0.30} rx={gaugeRadius * 0.18} ry={gaugeRadius * 0.08} fill="rgba(255,255,255,0.06)" />
        
        {/* Glass edge shine */}
        <Path
          d={`M ${gaugeCenterX + Math.cos(-60 * Math.PI / 180) * (gaugeRadius - 3)} 
              ${gaugeCenterY + Math.sin(-60 * Math.PI / 180) * (gaugeRadius - 3)}
              A ${gaugeRadius - 3} ${gaugeRadius - 3} 0 0 1 
              ${gaugeCenterX + Math.cos(-120 * Math.PI / 180) * (gaugeRadius - 3)} 
              ${gaugeCenterY + Math.sin(-120 * Math.PI / 180) * (gaugeRadius - 3)}`}
          stroke="rgba(255,255,255,0.20)"
          strokeWidth={1.5}
          fill="none"
        />
        
        {/* Phillips-head fixing screws on bezel */}
        <PhillipsScrew cx={gaugeCenterX} cy={gaugeCenterY - gaugeRadius - 6} r={4} />
        <PhillipsScrew cx={gaugeCenterX} cy={gaugeCenterY + gaugeRadius + 6} r={4} />
        <PhillipsScrew cx={gaugeCenterX - gaugeRadius - 6} cy={gaugeCenterY} r={4} />
        <PhillipsScrew cx={gaugeCenterX + gaugeRadius + 6} cy={gaugeCenterY} r={4} />
      </Svg>
      
      {/* Fuel icon */}
      <View style={[styles.fuelIconContainer, { top: svgSize * 0.56 }]}>
        <MaterialCommunityIcons name="gas-station" size={18} color="#654321" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gaugeWrapper: {
    alignItems: 'center',
  },
  fuelIconContainer: {
    position: 'absolute',
    alignItems: 'center',
    left: 0,
    right: 0,
  },
});
