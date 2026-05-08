import React from 'react';
import Svg, {
  Path,
  Rect,
  Ellipse,
  G,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
} from 'react-native-svg';

interface Props {
  width: number;
  height: number;
  dashboardTopY: number;
  dashboardCurveAmount: number;
  windshieldSideHeight: number;
  windshieldCenterHeight: number;
}

export const WoodBackground: React.FC<Props> = ({
  width,
  height,
  dashboardTopY,
  dashboardCurveAmount,
  windshieldSideHeight,
  windshieldCenterHeight,
}) => {
  return (
    <>
      {/* Windshield glass - curved, twice as tall in center as on sides */}
      <Path
        d={`M 0 ${dashboardTopY} 
            Q ${width * 0.5} ${dashboardTopY - dashboardCurveAmount} ${width} ${dashboardTopY}
            L ${width} ${windshieldSideHeight}
            Q ${width * 0.5} ${windshieldSideHeight - windshieldCenterHeight} 0 ${windshieldSideHeight}
            Z`}
        fill="url(#glassGradient)"
      />
      
      {/* Glass reflection on windshield */}
      <Path
        d={`M ${width * 0.1} ${dashboardTopY * 0.5} 
            Q ${width * 0.4} ${windshieldSideHeight - windshieldCenterHeight * 0.5} ${width * 0.7} ${dashboardTopY * 0.4}`}
        stroke="#FFFFFF"
        strokeWidth={2}
        opacity={0.4}
        fill="none"
      />
      
      {/* Main wooden dashboard with more curved top */}
      <Path
        d={`M 0 ${dashboardTopY} 
            Q ${width * 0.5} ${dashboardTopY - dashboardCurveAmount} ${width} ${dashboardTopY}
            L ${width} ${height}
            L 0 ${height}
            Z`}
        fill="url(#oakWoodGradient)"
      />
      
      {/* Varnish shine overlay */}
      <Path
        d={`M 0 ${dashboardTopY} 
            Q ${width * 0.5} ${dashboardTopY - dashboardCurveAmount} ${width} ${dashboardTopY}
            L ${width} ${height}
            L 0 ${height}
            Z`}
        fill="url(#varnishShine)"
      />
      
      {/* Base wood texture - subtle color variations for darker wood */}
      {Array.from({ length: 10 }, (_, i) => {
        const xPos = (width / 10) * i;
        const widthVar = width / 10 + Math.sin(i * 2.3) * 12;
        const color = i % 3 === 0 ? "#3C230F" : 
                      i % 3 === 1 ? "#503219" : "#321E0C";
        const opacity = i % 3 === 0 ? 0.08 : i % 3 === 1 ? 0.06 : 0.07;
        return (
          <Rect
            key={`wood-var-${i}`}
            x={xPos}
            y={dashboardTopY}
            width={widthVar}
            height={height - dashboardTopY}
            fill={color}
            opacity={opacity}
          />
        );
      })}
      
      {/* Natural horizontal wood grain - primary lines with more organic waviness */}
      {Array.from({ length: 65 }, (_, i) => {
        const yPos = dashboardTopY + ((height - dashboardTopY) / 65) * i;
        const seed = i * 17 + 3;
        const waveAmp = 1.5 + Math.sin(seed * 0.12) * 1.0 + Math.cos(seed * 0.07) * 0.7;
        const phase = seed * 0.22;
        const isPrimary = i % 6 === 0;
        const isSecondary = i % 3 === 0;
        const thickness = isPrimary ? 2.5 : (isSecondary ? 1.4 : 0.6);
        const opacity = isPrimary ? 0.22 : (isSecondary ? 0.12 : 0.05);
        const color = isPrimary ? "#281408" : (isSecondary ? "#37200F" : "#412814");
        
        // Create more organic paths with varying control points
        const cp1y = yPos + waveAmp * Math.sin(phase);
        const cp2y = yPos + waveAmp * Math.cos(phase + 0.9);
        const cp3y = yPos + waveAmp * Math.sin(phase + 1.5);
        const cp4y = yPos + waveAmp * Math.cos(phase + 2.1);
        const cp5y = yPos + waveAmp * Math.sin(phase + 0.4);
        const cp6y = yPos + waveAmp * Math.cos(phase + 2.6);
        const cp7y = yPos + waveAmp * Math.sin(phase + 1.2);
        
        return (
          <Path
            key={`grain-h-${i}`}
            d={`M 0 ${yPos} 
                C ${width * 0.07} ${cp1y},
                ${width * 0.14} ${cp2y},
                ${width * 0.22} ${cp3y}
                C ${width * 0.32} ${cp4y},
                ${width * 0.42} ${cp5y},
                ${width * 0.52} ${cp6y}
                C ${width * 0.62} ${cp7y},
                ${width * 0.72} ${cp1y + waveAmp * 0.5},
                ${width * 0.82} ${cp3y - waveAmp * 0.3}
                C ${width * 0.90} ${cp5y + waveAmp * 0.2},
                ${width * 0.95} ${cp2y},
                ${width} ${cp4y}`}
            stroke={color}
            strokeWidth={thickness}
            opacity={opacity}
            fill="none"
          />
        );
      })}
      
      {/* Darker grain accents - thicker, flowing lines */}
      {Array.from({ length: 18 }, (_, i) => {
        const yPos = dashboardTopY + ((height - dashboardTopY) / 18) * i + 4;
        const offset = Math.sin(i * 1.5 + 0.3) * 3.5;
        const opacity = 0.09 + Math.sin(i * 0.8) * 0.04;
        return (
          <Path
            key={`grain-dark-${i}`}
            d={`M 0 ${yPos + offset} 
                Q ${width * 0.25} ${yPos + offset + 2.5 + Math.sin(i) * 1.5},
                ${width * 0.5} ${yPos + offset - 1 + Math.cos(i * 0.7) * 2}
                T ${width} ${yPos + offset + 1.5}`}
            stroke="#2D190C"
            strokeWidth={3.5}
            opacity={opacity}
            fill="none"
          />
        );
      })}
      
      {/* Wood knot 1 - left side with more realistic asymmetric rings */}
      <G>
        <Ellipse cx={width * 0.12} cy={dashboardTopY + height * 0.23} rx={16} ry={11} fill="#371E0F" opacity={0.22} />
        <Ellipse cx={width * 0.12 + 1} cy={dashboardTopY + height * 0.23 - 0.5} rx={13} ry={8.5} fill="#412614" opacity={0.18} />
        <Ellipse cx={width * 0.12 + 1.5} cy={dashboardTopY + height * 0.23} rx={10} ry={6.5} fill="#321C0E" opacity={0.25} />
        <Ellipse cx={width * 0.12 + 0.5} cy={dashboardTopY + height * 0.23 + 0.5} rx={7} ry={4} fill="#2A160A" opacity={0.3} />
        <Ellipse cx={width * 0.12} cy={dashboardTopY + height * 0.23} rx={3.5} ry={2} fill="#231208" opacity={0.38} />
        <Circle cx={width * 0.12 + 0.5} cy={dashboardTopY + height * 0.23} r={1.2} fill="#1C0E06" opacity={0.45} />
        {/* Ring lines emanating from knot */}
        <Ellipse cx={width * 0.12} cy={dashboardTopY + height * 0.23} rx={19} ry={14} stroke="#412816" strokeWidth={1.2} opacity={0.10} fill="none" />
        <Ellipse cx={width * 0.12 - 1} cy={dashboardTopY + height * 0.23} rx={24} ry={17} stroke="#412816" strokeWidth={1} opacity={0.06} fill="none" />
        <Ellipse cx={width * 0.12 - 2} cy={dashboardTopY + height * 0.23 + 1} rx={30} ry={20} stroke="#412816" strokeWidth={0.8} opacity={0.04} fill="none" />
      </G>
      
      {/* Wood knot 2 - right side, smaller and tighter */}
      <G>
        <Ellipse cx={width * 0.87} cy={dashboardTopY + height * 0.36} rx={12} ry={9} fill="#3A2010" opacity={0.20} />
        <Ellipse cx={width * 0.87 - 0.5} cy={dashboardTopY + height * 0.36 + 0.5} rx={9} ry={6} fill="#341E0F" opacity={0.24} />
        <Ellipse cx={width * 0.87} cy={dashboardTopY + height * 0.36} rx={5.5} ry={3.5} fill="#2A180B" opacity={0.30} />
        <Circle cx={width * 0.87} cy={dashboardTopY + height * 0.36} r={2} fill="#201007" opacity={0.38} />
        <Ellipse cx={width * 0.87 + 1} cy={dashboardTopY + height * 0.36} rx={16} ry={12} stroke="#412816" strokeWidth={1} opacity={0.08} fill="none" />
        <Ellipse cx={width * 0.87 + 2} cy={dashboardTopY + height * 0.36 - 1} rx={22} ry={15} stroke="#412816" strokeWidth={0.8} opacity={0.05} fill="none" />
      </G>
      
      {/* Wood knot 3 - bottom left, elongated */}
      <G>
        <Ellipse cx={width * 0.24} cy={dashboardTopY + height * 0.60} rx={11} ry={7.5} fill="#371E0F" opacity={0.18} />
        <Ellipse cx={width * 0.24 + 0.8} cy={dashboardTopY + height * 0.60 - 0.3} rx={7.5} ry={4.5} fill="#301A0C" opacity={0.23} />
        <Ellipse cx={width * 0.24} cy={dashboardTopY + height * 0.60} rx={4} ry={2.5} fill="#261409" opacity={0.30} />
        <Circle cx={width * 0.24 + 0.3} cy={dashboardTopY + height * 0.60} r={1.5} fill="#1E0F06" opacity={0.36} />
        <Ellipse cx={width * 0.24 - 1} cy={dashboardTopY + height * 0.60} rx={15} ry={10} stroke="#412816" strokeWidth={1} opacity={0.07} fill="none" />
      </G>
      
      {/* Wood knot 4 - bottom right, subtle */}
      <G>
        <Ellipse cx={width * 0.76} cy={dashboardTopY + height * 0.56} rx={13} ry={9} fill="#371E0F" opacity={0.16} />
        <Ellipse cx={width * 0.76 + 1} cy={dashboardTopY + height * 0.56 + 0.5} rx={9} ry={6} fill="#321C0E" opacity={0.22} />
        <Ellipse cx={width * 0.76} cy={dashboardTopY + height * 0.56} rx={5} ry={3} fill="#2A160A" opacity={0.28} />
        <Ellipse cx={width * 0.76 - 0.5} cy={dashboardTopY + height * 0.56} rx={2.5} ry={1.5} fill="#201007" opacity={0.34} />
        <Ellipse cx={width * 0.76 + 1.5} cy={dashboardTopY + height * 0.56 - 0.5} rx={17} ry={12} stroke="#412816" strokeWidth={0.8} opacity={0.06} fill="none" />
      </G>
      
      {/* Small micro-knot near center for realism */}
      <G>
        <Ellipse cx={width * 0.48} cy={dashboardTopY + height * 0.72} rx={6} ry={4} fill="#321C0E" opacity={0.14} />
        <Ellipse cx={width * 0.48} cy={dashboardTopY + height * 0.72} rx={3.5} ry={2.5} fill="#28160A" opacity={0.20} />
        <Circle cx={width * 0.48} cy={dashboardTopY + height * 0.72} r={1.5} fill="#1E1007" opacity={0.28} />
      </G>
      
      {/* Varnish glossy highlights - broader, more natural */}
      <Path
        d={`M ${width * 0.03} ${dashboardTopY + 14}
            Q ${width * 0.20} ${dashboardTopY + 9} ${width * 0.38} ${dashboardTopY + 16}
            Q ${width * 0.50} ${dashboardTopY + 20} ${width * 0.60} ${dashboardTopY + 14}`}
        stroke="#FFFFFF"
        strokeWidth={10}
        opacity={0.07}
        fill="none"
      />
      <Path
        d={`M ${width * 0.50} ${dashboardTopY + 11}
            Q ${width * 0.68} ${dashboardTopY + 7} ${width * 0.82} ${dashboardTopY + 13}
            Q ${width * 0.92} ${dashboardTopY + 17} ${width * 0.98} ${dashboardTopY + 12}`}
        stroke="#FFFFFF"
        strokeWidth={8}
        opacity={0.05}
        fill="none"
      />
      {/* Additional subtle varnish streak across middle */}
      <Path
        d={`M ${width * 0.10} ${dashboardTopY + height * 0.35}
            Q ${width * 0.35} ${dashboardTopY + height * 0.33} ${width * 0.65} ${dashboardTopY + height * 0.36}
            Q ${width * 0.85} ${dashboardTopY + height * 0.34} ${width * 0.95} ${dashboardTopY + height * 0.37}`}
        stroke="#FFFFFF"
        strokeWidth={12}
        opacity={0.04}
        fill="none"
      />
      
      {/* Top edge of windshield frame (bord haut du pare-brise uniquement) */}
      <Path
        d={`M 0 ${windshieldSideHeight}
            Q ${width * 0.5} ${windshieldSideHeight - windshieldCenterHeight} ${width} ${windshieldSideHeight}`}
        stroke="#4A3828"
        strokeWidth={3}
        fill="none"
      />
    </>
  );
};
