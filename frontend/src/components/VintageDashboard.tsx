import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  G,
  Path,
} from 'react-native-svg';
import { useGameStore } from '../../src/store/gameStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WoodBackground } from './dashboard/WoodBackground';
import { FuelGauge } from './dashboard/FuelGauge';
import { WarningLights } from './dashboard/WarningLights';
import { HangarModal } from './HangarModal';
import { MailCounter } from './dashboard/MailCounter';
import { SettingsModal } from './SettingsModal';
import { useI18n } from '../i18n';

interface Props {
  width: number;
  height: number;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  overrideFuelLevel?: number;
  tutorialHighlight?: 'mail' | 'miles' | 'warning' | 'hangar' | 'fuel' | null;
  tutorialBlinkCount?: number;
}

export const VintageDashboard: React.FC<Props> = ({ width, height, soundEnabled, onToggleSound, overrideFuelLevel, tutorialHighlight, tutorialBlinkCount = 0 }) => {
  const { mailCount, fuelLevel, mechanicalWarnings, resetGame, pauseGame, isFlying, flyingProgress, flightFuelCost, mailTarget, gibraltarPhase, mauritaniaMailCumul, currentLevelId,
    plane2FuelLevel, plane2MechanicalWarnings, plane2IsFlying, plane2FlyingProgress, plane2FlightFuelCost, patagonieSelectionPhase,
    plane1CarriedMail, plane2CarriedMail, totalMiles,
    currentPoint, flyingDestination, plane2CurrentPoint, plane2FlyingDestination,
    freeplayMode, gibraltarMailCollected,
  } = useGameStore();

  // Utiliser overrideFuelLevel pendant le vol pour la jauge en temps réel
  const displayedFuel = overrideFuelLevel !== undefined ? overrideFuelLevel : fuelLevel;
  const [showSettings, setShowSettings] = useState(false);
  const [showHangar, setShowHangar] = useState(false);
  const { t } = useI18n();

  // Compute visual fuel level: use overrideFuelLevel during flight for real-time gauge
  const visualFuelLevel = overrideFuelLevel !== undefined
    ? overrideFuelLevel
    : (isFlying ? Math.max(0, fuelLevel - flightFuelCost * flyingProgress) : fuelLevel);

  // Calcul des miles en temps réel pendant le vol (vitesse /4)
  let displayMiles = totalMiles;
  if (isFlying && currentPoint && flyingDestination) {
    const dx = flyingDestination.x - currentPoint.x;
    const dy = flyingDestination.y - currentPoint.y;
    const totalFlightDist = Math.sqrt(dx * dx + dy * dy);
    const flightMilesSoFar = Math.round(totalFlightDist * flyingProgress * 2500);
    displayMiles = totalMiles + flightMilesSoFar;
  }
  // Plane 2 miles aussi (pour dual-plane)
  if (plane2IsFlying && plane2CurrentPoint && plane2FlyingDestination) {
    const dx2 = plane2FlyingDestination.x - plane2CurrentPoint.x;
    const dy2 = plane2FlyingDestination.y - plane2CurrentPoint.y;
    const totalP2Dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const p2MilesSoFar = Math.round(totalP2Dist * plane2FlyingProgress * 2500);
    displayMiles += p2MilesSoFar;
  }

  // Windshield and dashboard curves
  const dashboardTopY = height * 0.14;
  const dashboardCurveAmount = 18;
  const windshieldSideHeight = height * 0.07;
  const windshieldCenterHeight = windshieldSideHeight * 2;

  // Fuel gauge dimensions - slightly smaller to prevent cropping
  const gaugeSize = Math.min(width * 0.38, height * 0.50);

  // Calculate layout zones to prevent overlap with gauge
  const isMauritanieLevel = currentLevelId === 'mauritanie' || currentLevelId === 'andes';
  const ELEMENT_MARGIN = 6; // margin between elements and gauge
  const gaugeLeft = (width - gaugeSize) / 2;
  const gaugeRight = gaugeLeft + gaugeSize;

  // Left zone: Mail counters (AVION + CUMUL for Mauritanie)
  const counterLeftOffset = width * 0.02;
  const counterMaxWidth = gaugeLeft - counterLeftOffset - ELEMENT_MARGIN;
  const counterWidth = isMauritanieLevel
    ? Math.min(width * 0.36, counterMaxWidth)
    : Math.min(width * 0.22, counterMaxWidth);

  // Right zone: Logo/Menu + Réglages
  const logoRightOffset = width * 0.02;
  const logoMaxWidth = width - gaugeRight - logoRightOffset - ELEMENT_MARGIN;
  const logoWidth = Math.min(width * 0.22, logoMaxWidth);

  // Position gauge
  const gaugeTopPosition = dashboardTopY + height * 0.03;

  // Warning buttons position
  const buttonsTopPosition = gaugeTopPosition + gaugeSize + 10;

  // Handle logo/menu press - return to start screen
  const handleMenuPress = () => {
    pauseGame(); // Met en pause sans perdre l'état de la mission
  };

  // ===== PATAGONIE / PARAGUAY: Dual dashboard layout =====
  if (currentLevelId === 'patagonie' || currentLevelId === 'paraguay') {
    const isParaguayLevel = currentLevelId === 'paraguay';
    const isSahelLevel = currentLevelId === 'sahel';
    const gap = 4; // Espace entre les deux tableaux
    const halfW = (width - gap) / 2;
    const patGaugeSize = Math.min(halfW * 0.58, height * 0.42);
    const patDashTopY = height * 0.12;
    const curveAmt = 14;
    const wsCenter = height * 0.12;
    const wsSide = height * 0.06;
    
    // Plane 1 real-time fuel
    const p1VisualFuel = overrideFuelLevel !== undefined
      ? overrideFuelLevel
      : (isFlying ? Math.max(0, fuelLevel - flightFuelCost * flyingProgress) : fuelLevel);
    
    // Plane 2 real-time fuel
    const p2VisualFuel = plane2IsFlying
      ? Math.max(0, plane2FuelLevel - plane2FlightFuelCost * plane2FlyingProgress)
      : plane2FuelLevel;
    
    // Positions des deux panneaux
    const leftX = 0;
    const rightX = halfW + gap;
    
    return (
      <View style={[styles.container, { width, height }]}>
        {/* Fallback fond bois OPAQUE pour les 2 panneaux (sous le pare-brise) */}
        <View style={{
          position: 'absolute',
          left: leftX,
          top: patDashTopY,
          width: halfW,
          bottom: 0,
          backgroundColor: '#6B5530',
          borderTopLeftRadius: curveAmt,
          borderTopRightRadius: curveAmt,
        }} />
        <View style={{
          position: 'absolute',
          left: rightX,
          top: patDashTopY,
          width: halfW,
          bottom: 0,
          backgroundColor: '#6B5530',
          borderTopLeftRadius: curveAmt,
          borderTopRightRadius: curveAmt,
        }} />
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Defs>
            <LinearGradient id="oakWoodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#8B7040" stopOpacity={1} />
              <Stop offset="50%" stopColor="#6B5530" stopOpacity={1} />
              <Stop offset="100%" stopColor="#503E20" stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="glassGradientL" x1="0%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#1A3A50" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#3A6A8A" stopOpacity={0.3} />
            </LinearGradient>
            <LinearGradient id="glassGradientR" x1="0%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#1A3A50" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#3A6A8A" stopOpacity={0.3} />
            </LinearGradient>
          </Defs>
          
          {/* ===== PANNEAU GAUCHE (Avion 1) ===== */}
          <G>
            {/* Pare-brise gauche */}
            <Path
              d={`M ${leftX} ${patDashTopY} 
                  Q ${leftX + halfW * 0.5} ${patDashTopY - curveAmt} ${leftX + halfW} ${patDashTopY}
                  L ${leftX + halfW} ${wsSide}
                  Q ${leftX + halfW * 0.5} ${wsSide - wsCenter} ${leftX} ${wsSide}
                  Z`}
              fill="url(#glassGradientL)"
            />
            {/* Reflet */}
            <Path
              d={`M ${leftX + halfW * 0.15} ${patDashTopY * 0.55} 
                  Q ${leftX + halfW * 0.4} ${wsSide - wsCenter * 0.4} ${leftX + halfW * 0.7} ${patDashTopY * 0.45}`}
              stroke="#FFFFFF" strokeWidth={1.5} opacity={0.35} fill="none"
            />
            {/* Bois */}
            <Path
              d={`M ${leftX} ${patDashTopY} 
                  Q ${leftX + halfW * 0.5} ${patDashTopY - curveAmt} ${leftX + halfW} ${patDashTopY}
                  L ${leftX + halfW} ${height}
                  L ${leftX} ${height} Z`}
              fill="url(#oakWoodGradient)"
            />
            {/* Grain simplifié */}
            {Array.from({ length: 15 }, (_, i) => {
              const yPos = patDashTopY + ((height - patDashTopY) / 15) * i;
              const wave = 1.2 + Math.sin(i * 2.1) * 0.8;
              return (
                <Path key={`gL-${i}`}
                  d={`M ${leftX} ${yPos + wave} Q ${leftX + halfW * 0.5} ${yPos - wave} ${leftX + halfW} ${yPos + wave * 0.5}`}
                  stroke="#281408" strokeWidth={i % 4 === 0 ? 1.8 : 0.5} opacity={i % 4 === 0 ? 0.15 : 0.06} fill="none"
                />
              );
            })}
            {/* Cadre pare-brise haut (conserver) */}
            <Path d={`M ${leftX} ${wsSide} Q ${leftX + halfW * 0.5} ${wsSide - wsCenter} ${leftX + halfW} ${wsSide}`}
              stroke="#4A3828" strokeWidth={2.5} fill="none" />
          </G>
          
          {/* ===== PANNEAU DROIT (Avion 2) ===== */}
          <G>
            {/* Pare-brise droit */}
            <Path
              d={`M ${rightX} ${patDashTopY} 
                  Q ${rightX + halfW * 0.5} ${patDashTopY - curveAmt} ${rightX + halfW} ${patDashTopY}
                  L ${rightX + halfW} ${wsSide}
                  Q ${rightX + halfW * 0.5} ${wsSide - wsCenter} ${rightX} ${wsSide}
                  Z`}
              fill="url(#glassGradientR)"
            />
            {/* Reflet */}
            <Path
              d={`M ${rightX + halfW * 0.15} ${patDashTopY * 0.55} 
                  Q ${rightX + halfW * 0.4} ${wsSide - wsCenter * 0.4} ${rightX + halfW * 0.7} ${patDashTopY * 0.45}`}
              stroke="#FFFFFF" strokeWidth={1.5} opacity={0.35} fill="none"
            />
            {/* Bois */}
            <Path
              d={`M ${rightX} ${patDashTopY} 
                  Q ${rightX + halfW * 0.5} ${patDashTopY - curveAmt} ${rightX + halfW} ${patDashTopY}
                  L ${rightX + halfW} ${height}
                  L ${rightX} ${height} Z`}
              fill="url(#oakWoodGradient)"
            />
            {/* Grain simplifié */}
            {Array.from({ length: 15 }, (_, i) => {
              const yPos = patDashTopY + ((height - patDashTopY) / 15) * i;
              const wave = 1.2 + Math.sin(i * 2.1 + 1) * 0.8;
              return (
                <Path key={`gR-${i}`}
                  d={`M ${rightX} ${yPos + wave} Q ${rightX + halfW * 0.5} ${yPos - wave} ${rightX + halfW} ${yPos + wave * 0.5}`}
                  stroke="#281408" strokeWidth={i % 4 === 0 ? 1.8 : 0.5} opacity={i % 4 === 0 ? 0.15 : 0.06} fill="none"
                />
              );
            })}
            {/* Cadre pare-brise haut (conserver) */}
            <Path d={`M ${rightX} ${wsSide} Q ${rightX + halfW * 0.5} ${wsSide - wsCenter} ${rightX + halfW} ${wsSide}`}
              stroke="#4A3828" strokeWidth={2.5} fill="none" />
          </G>
        </Svg>

        <View style={[styles.dashboardContent, { width, height }]}>
          {/* ===== AVION 1 (panneau gauche) ===== */}
          <View style={{ position: 'absolute', left: 0, top: patDashTopY + 2, width: halfW - 38, alignItems: 'center' }}>
            <Text style={{ color: '#C8A55A', fontFamily: 'BigNoodleTitling', fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>{t('AVION_1')}</Text>
            {/* Gauge centrée dans le panneau (alignée avec voyants) */}
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: patGaugeSize, height: patGaugeSize }}>
                <FuelGauge gaugeSize={patGaugeSize} fuelLevel={p1VisualFuel} />
              </View>
              <View style={{ marginTop: 10 }}>
                <WarningLights mechanicalWarnings={mechanicalWarnings} compact />
              </View>
            </View>
          </View>

          {/* ===== AVION 2 (panneau droit) ===== */}
          <View style={{ position: 'absolute', right: 0, top: patDashTopY + 2, width: halfW - 38, alignItems: 'center' }}>
            <Text style={{ color: '#5B9BD5', fontFamily: 'BigNoodleTitling', fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>{t('AVION_2')}</Text>
            {/* Gauge centrée dans le panneau (alignée avec voyants) */}
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: patGaugeSize, height: patGaugeSize }}>
                <FuelGauge gaugeSize={patGaugeSize} fuelLevel={p2VisualFuel} />
              </View>
              <View style={{ marginTop: 10 }}>
                <WarningLights mechanicalWarnings={plane2MechanicalWarnings} compact />
              </View>
            </View>
          </View>

          {/* ===== ZONE CENTRALE ===== */}
          {(isParaguayLevel || isSahelLevel) ? (
            /* Paraguay / SAHEL : Compteurs individuels à la séparation + CUMUL en dessous */
            <View style={{ position: 'absolute', left: halfW - 38, top: patDashTopY + 14, width: gap + 76, alignItems: 'center', zIndex: 10 }}>
              {/* Compteurs individuels côte à côte à la limite */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' }}>
                {/* Compteur AVION 1 : bord droit touche le centre (+30%) */}
                <View style={{ backgroundColor: '#1A1A1A', borderRadius: 4, borderWidth: 2, borderColor: '#4A3828', paddingHorizontal: 4, paddingVertical: 3, alignItems: 'center', marginRight: 1 }}>
                  <Text style={{ color: '#C8A55A', fontFamily: 'BigNoodleTitling', fontSize: 7, fontWeight: 'bold', marginBottom: 1 }}>✉</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ backgroundColor: '#0A0A0A', borderRadius: 2, borderWidth: 0.5, borderColor: '#333', paddingHorizontal: 3, paddingVertical: 2, marginHorizontal: 0.5 }}>
                      <Text style={{ color: '#E8D5B0', fontFamily: 'BigNoodleTitling', fontSize: 14, fontWeight: 'bold' }}>{String(plane1CarriedMail).padStart(2, '0')[0]}</Text>
                    </View>
                    <View style={{ backgroundColor: '#0A0A0A', borderRadius: 2, borderWidth: 0.5, borderColor: '#333', paddingHorizontal: 3, paddingVertical: 2, marginHorizontal: 0.5 }}>
                      <Text style={{ color: '#E8D5B0', fontFamily: 'BigNoodleTitling', fontSize: 14, fontWeight: 'bold' }}>{String(plane1CarriedMail).padStart(2, '0')[1]}</Text>
                    </View>
                  </View>
                </View>
                {/* Compteur AVION 2 : bord gauche touche le centre (+30%) */}
                <View style={{ backgroundColor: '#1A1A1A', borderRadius: 4, borderWidth: 2, borderColor: '#4A3828', paddingHorizontal: 4, paddingVertical: 3, alignItems: 'center', marginLeft: 1 }}>
                  <Text style={{ color: '#5B9BD5', fontFamily: 'BigNoodleTitling', fontSize: 7, fontWeight: 'bold', marginBottom: 1 }}>✉</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ backgroundColor: '#0A0A0A', borderRadius: 2, borderWidth: 0.5, borderColor: '#333', paddingHorizontal: 3, paddingVertical: 2, marginHorizontal: 0.5 }}>
                      <Text style={{ color: '#E8D5B0', fontFamily: 'BigNoodleTitling', fontSize: 14, fontWeight: 'bold' }}>{String(plane2CarriedMail).padStart(2, '0')[0]}</Text>
                    </View>
                    <View style={{ backgroundColor: '#0A0A0A', borderRadius: 2, borderWidth: 0.5, borderColor: '#333', paddingHorizontal: 3, paddingVertical: 2, marginHorizontal: 0.5 }}>
                      <Text style={{ color: '#E8D5B0', fontFamily: 'BigNoodleTitling', fontSize: 14, fontWeight: 'bold' }}>{String(plane2CarriedMail).padStart(2, '0')[1]}</Text>
                    </View>
                  </View>
                </View>
              </View>
              {/* CUMUL en dessous (double des compteurs individuels) */}
              <View style={{ backgroundColor: '#1A1A1A', borderRadius: 5, borderWidth: 2, borderColor: '#8B6914', paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>{freeplayMode ? t('SCORE') : t('CUMUL')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#0A0A0A', borderRadius: 3, borderWidth: 1, borderColor: '#555', paddingHorizontal: 5, paddingVertical: 2, marginHorizontal: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 28, fontWeight: 'bold' }}>{String(mauritaniaMailCumul).padStart(2, '0')[0]}</Text>
                  </View>
                  <View style={{ backgroundColor: '#0A0A0A', borderRadius: 3, borderWidth: 1, borderColor: '#555', paddingHorizontal: 5, paddingVertical: 2, marginHorizontal: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 28, fontWeight: 'bold' }}>{String(mauritaniaMailCumul).padStart(2, '0')[1]}</Text>
                  </View>
                </View>
                <Text style={{ color: '#8B6914', fontFamily: 'BigNoodleTitling', fontSize: 10, marginTop: 2 }}>{freeplayMode ? '' : `/${mailTarget}`}</Text>
              </View>
            </View>
          ) : (
            /* Patagonie : compteur COURRIER classique */
            <View style={{ position: 'absolute', left: halfW - 36, top: patDashTopY + 14, width: gap + 72, alignItems: 'center', zIndex: 10 }}>
              <MailCounter mailCount={mailCount} mailTarget={mailTarget} counterWidth={72} gibraltarPhase={null} mauritaniaCumul={0} isMauritanie={false} isFreeplay={!!freeplayMode} />
            </View>
          )}

          {/* COMPTEUR MILES commun aux 2 avions - au-dessus de MENU/HANGAR */}
          <View style={{ position: 'absolute', left: width / 2 - 90, bottom: 100, width: 180, alignItems: 'center', zIndex: 10 }}>
            <View style={{ backgroundColor: '#0D0D0D', borderRadius: 5, borderWidth: 1.5, borderColor: '#8B6914', paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.07)', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              <Text style={{ color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 7, fontWeight: 'bold', letterSpacing: 2, marginBottom: 2 }}>{t('MILES')}</Text>
              <View style={{ flexDirection: 'row' }}>
                {String(displayMiles).padStart(6, '0').split('').map((digit, i) => (
                  <View key={i} style={{ backgroundColor: '#1A1A1A', borderRadius: 2, borderWidth: 1, borderTopColor: '#222', borderLeftColor: '#222', borderRightColor: '#555', borderBottomColor: '#555', paddingHorizontal: 3, paddingVertical: 1, marginHorizontal: 0.5 }}>
                    <Text style={{ color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 12, fontWeight: 'bold' }}>{digit}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* LOGO + MENU + HANGAR centré en bas - remonté */}
          <View style={{ position: 'absolute', left: width / 2 - 100, bottom: 42, width: 200, alignItems: 'center', zIndex: 10, flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={handleMenuPress} style={[styles.logoFrame, { paddingVertical: 6, paddingHorizontal: 10, flex: 1 }]}>
              <Image
                source={require('../../assets/images/logo-courrier.png')}
                style={{ width: 28, height: 18 }}
                tintColor="#FFFFFF"
                resizeMode="contain"
              />
              <View style={styles.menuDivider} />
              <Text style={[styles.menuText, { fontSize: 8 }]}>MENU</Text>
            </Pressable>
            <Pressable
              onPress={() => !(isFlying || plane2IsFlying) && setShowHangar(true)}
              disabled={isFlying || plane2IsFlying}
              style={[styles.logoFrame, { paddingVertical: 6, paddingHorizontal: 10, flex: 1, opacity: (isFlying || plane2IsFlying) ? 0.4 : 1 }]}
            >
              <MaterialCommunityIcons name="warehouse" size={18} color={(isFlying || plane2IsFlying) ? '#666' : '#FFFFFF'} />
              <View style={styles.menuDivider} />
              <Text style={[styles.menuText, { fontSize: 8, color: (isFlying || plane2IsFlying) ? '#666' : '#FFFFFF' }]}>{t('HANGAR')}</Text>
            </Pressable>
          </View>
        </View>

        <HangarModal
          visible={showHangar}
          onClose={() => setShowHangar(false)}
          inMission={true}
        />

        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
        />
      </View>
    );
  }
  // ===== END PATAGONIE =====

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Fallback: fond bois OPAQUE uniquement sous le pare-brise (arrondi en haut) */}
      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: dashboardTopY,
        bottom: 0,
        backgroundColor: '#6B5530',
        borderTopLeftRadius: dashboardCurveAmount,
        borderTopRightRadius: dashboardCurveAmount,
      }} />
      {/* Background layers - SVG with gradients + wood */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          {/* Darker varnished wood gradient */}
          <LinearGradient id="oakWoodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#8B7040" stopOpacity={1} />
            <Stop offset="15%" stopColor="#7A6035" stopOpacity={1} />
            <Stop offset="50%" stopColor="#6B5530" stopOpacity={1} />
            <Stop offset="85%" stopColor="#5E4A28" stopOpacity={1} />
            <Stop offset="100%" stopColor="#503E20" stopOpacity={1} />
          </LinearGradient>

          {/* Varnish shine overlay - using hex colors with stopOpacity for native compatibility */}
          <LinearGradient id="varnishShine" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.12} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.15} />
          </LinearGradient>

          {/* Glass gradient for windshield */}
          <LinearGradient id="glassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#B4C8D2" stopOpacity={0.5} />
            <Stop offset="30%" stopColor="#A0B4C3" stopOpacity={0.4} />
            <Stop offset="60%" stopColor="#96AAB9" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#8CA0AF" stopOpacity={0.3} />
          </LinearGradient>
        </Defs>

        {/* Wood texture, windshield, frame */}
        <WoodBackground
          width={width}
          height={height}
          dashboardTopY={dashboardTopY}
          dashboardCurveAmount={dashboardCurveAmount}
          windshieldSideHeight={windshieldSideHeight}
          windshieldCenterHeight={windshieldCenterHeight}
        />
      </Svg>

      {/* Dashboard content */}
      <View style={[styles.dashboardContent, { width, height }]}>
        {/* Center: Fuel Gauge */}
        <View
          style={[
            styles.gaugePosition,
            {
              left: (width - gaugeSize) / 2,
              top: gaugeTopPosition,
            },
          ]}
        >
          <FuelGauge gaugeSize={gaugeSize} fuelLevel={visualFuelLevel} />
        </View>

        {/* Left: Vintage Mail Counter */}
        <View
          style={[
            styles.counterPosition,
            {
              left: counterLeftOffset,
              top: gaugeTopPosition + gaugeSize / 2 - 60,
              width: counterWidth,
            },
          ]}
        >
          <MailCounter mailCount={mailCount} mailTarget={mailTarget} counterWidth={counterWidth} gibraltarPhase={gibraltarPhase} mauritaniaCumul={currentLevelId === 'atlantique' ? gibraltarMailCollected : mauritaniaMailCumul} isMauritanie={currentLevelId === 'mauritanie' || currentLevelId === 'andes' || currentLevelId === 'niveau_16' || currentLevelId === 'corsica' || currentLevelId === 'sardegna' || currentLevelId === 'afrique_nord' || currentLevelId === 'retour_france' || currentLevelId === 'atlantique'} isFreeplay={!!freeplayMode} />
          
          {/* Compteur Miles */}
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 4, borderWidth: 1.5, borderColor: '#4A3828', paddingHorizontal: 4, paddingVertical: 3, alignItems: 'center', marginTop: 6 }}>
            <Text style={{ color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 6, fontWeight: 'bold', marginBottom: 2, letterSpacing: 1 }}>{t('MILES')}</Text>
            <View style={{ flexDirection: 'row' }}>
              {String(displayMiles).padStart(6, '0').split('').map((d, i) => (
                <View key={i} style={{ backgroundColor: '#0A0A0A', borderRadius: 2, borderWidth: 0.5, borderColor: '#333', paddingHorizontal: 2, paddingVertical: 1, marginHorizontal: 0.5 }}>
                  <Text style={{ color: '#E8D5B0', fontFamily: 'BigNoodleTitling', fontSize: 9, fontWeight: 'bold' }}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Right: Logo/Menu + Réglages Buttons */}
        <View
          style={[
            styles.logoPosition,
            {
              right: logoRightOffset,
              top: gaugeTopPosition + gaugeSize / 2 - 60,
              width: logoWidth,
            },
          ]}
        >
          <Pressable onPress={handleMenuPress} style={styles.logoFrame}>
            <Image
              source={require('../../assets/images/logo-courrier.png')}
              style={styles.logoImg}
              tintColor="#FFFFFF"
              resizeMode="contain"
            />
            <View style={styles.menuDivider} />
            <Text style={styles.menuText}>MENU</Text>
            {/* Corner screws on logo frame */}
            <View style={[styles.logoScrew, { top: 3, left: 3 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { top: 3, right: 3 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { bottom: 3, left: 3 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { bottom: 3, right: 3 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
          </Pressable>

          {/* Bouton HANGAR - désactivé en vol */}
          <Pressable
            onPress={() => !isFlying && setShowHangar(true)}
            style={[styles.settingsFrame, isFlying && { opacity: 0.4 }]}
            disabled={isFlying}
          >
            <MaterialCommunityIcons name="warehouse" size={14} color={isFlying ? '#666' : '#FFFFFF'} />
            <Text style={[styles.settingsText, { color: isFlying ? '#666' : '#FFFFFF' }]}>{t('HANGAR')}</Text>
            <View style={[styles.logoScrew, { top: 2, left: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { top: 2, right: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { bottom: 2, left: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { bottom: 2, right: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
          </Pressable>

          {/* Bouton RÉGLAGES */}
          <Pressable onPress={() => setShowSettings(true)} style={styles.settingsFrame}>
            <MaterialCommunityIcons name="cog" size={16} color="#FFFFFF" />
            <Text style={styles.settingsText}>{t('REGLAGES')}</Text>
            <View style={[styles.logoScrew, { top: 2, left: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { top: 2, right: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { bottom: 2, left: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
            <View style={[styles.logoScrew, { bottom: 2, right: 2 }]}>
              <View style={styles.logoScrewCrossH} />
              <View style={styles.logoScrewCrossV} />
            </View>
          </Pressable>
        </View>

        {/* Warning lights row */}
        <View
          style={[
            styles.warningPosition,
            {
              top: buttonsTopPosition,
              left: 0,
              right: 0,
            },
          ]}
        >
          <WarningLights mechanicalWarnings={mechanicalWarnings} />
        </View>
      </View>

      {/* Decorative corner screws on wood panel */}
      <View style={[styles.panelScrew, { top: dashboardTopY + 5, left: 10 }]}>
        <View style={styles.screwHead}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
      </View>
      <View style={[styles.panelScrew, { top: dashboardTopY + 5, right: 10 }]}>
        <View style={styles.screwHead}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
      </View>
      <View style={[styles.panelScrew, { bottom: 10, left: 10 }]}>
        <View style={styles.screwHead}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
      </View>
      <View style={[styles.panelScrew, { bottom: 10, right: 10 }]}>
        <View style={styles.screwHead}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
      </View>

      {/* Tutorial highlight circles */}
      {tutorialHighlight && (
        <>
          {/* Carré rouge clignotant autour du compteur de COURRIER - agrandi vers le bas */}
          {tutorialHighlight === 'mail' && (
            <View style={{
              position: 'absolute',
              left: counterLeftOffset - 8,
              top: gaugeTopPosition + gaugeSize / 2 - 68,
              width: counterWidth + 16,
              height: 100,
              borderRadius: 10,
              borderWidth: 3,
              borderColor: tutorialBlinkCount % 2 === 0 ? '#FF0000' : 'transparent',
              zIndex: 50,
            }} pointerEvents="none" />
          )}
          {/* Carré rouge clignotant autour du compteur MILES (sous le compteur courrier) */}
          {tutorialHighlight === 'miles' && (
            <View style={{
              position: 'absolute',
              left: counterLeftOffset - 4,
              top: gaugeTopPosition + gaugeSize / 2 + 16,
              width: counterWidth + 8,
              height: 40,
              borderRadius: 8,
              borderWidth: 3,
              borderColor: tutorialBlinkCount % 2 === 0 ? '#FF0000' : 'transparent',
              zIndex: 50,
            }} pointerEvents="none" />
          )}
          {/* Cercle rouge clignotant autour de la jauge d'essence */}
          {tutorialHighlight === 'fuel' && (
            <View style={{
              position: 'absolute',
              left: (width - gaugeSize) / 2 - 8,
              top: gaugeTopPosition - 8,
              width: gaugeSize + 16,
              height: gaugeSize + 16,
              borderRadius: (gaugeSize + 16) / 2,
              borderWidth: 3,
              borderColor: tutorialBlinkCount % 2 === 0 ? '#FF0000' : 'transparent',
              zIndex: 50,
            }} pointerEvents="none" />
          )}
          {/* Cadre rouge clignotant autour du bouton HANGAR (pas MENU) */}
          {tutorialHighlight === 'hangar' && (
            <View style={{
              position: 'absolute',
              right: logoRightOffset - 4,
              top: gaugeTopPosition + gaugeSize / 2 + 4,
              width: logoWidth + 8,
              height: 30,
              borderRadius: 8,
              borderWidth: 3,
              borderColor: tutorialBlinkCount % 2 === 0 ? '#FF0000' : 'transparent',
              zIndex: 50,
            }} pointerEvents="none" />
          )}
          {/* Cadre rouge clignotant autour des voyants */}
          {tutorialHighlight === 'warning' && (
            <View style={{
              position: 'absolute',
              top: buttonsTopPosition - 6,
              left: width * 0.08,
              right: width * 0.08,
              height: 52,
              borderRadius: 10,
              borderWidth: 3,
              borderColor: tutorialBlinkCount % 2 === 0 ? '#FF0000' : 'transparent',
              zIndex: 50,
            }} pointerEvents="none" />
          )}
        </>
      )}

      {/* Modal Hangar */}
      <HangarModal
        visible={showHangar}
        onClose={() => {
          setShowHangar(false);
          // Signaler au store que le joueur a utilisé le HANGAR pendant le tuto
          const state = useGameStore.getState();
          if (state.tutorialMode && !state.tutorialHangarDone) {
            useGameStore.setState({ tutorialHangarDone: true });
          }
        }}
        inMission={true}
      />

      {/* Modal Réglages */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  dashboardContent: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gaugePosition: {
    position: 'absolute',
  },
  counterPosition: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPosition: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningPosition: {
    position: 'absolute',
  },
  logoFrame: {
    backgroundColor: '#3A2818',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 3,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#2A1A0A',
    borderBottomColor: '#2A1A0A',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 2,
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  logoSubtext: {
    color: '#DAA520',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 1,
  },
  menuDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#8B6914',
    marginVertical: 4,
    opacity: 0.6,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 3,
  },
  settingsFrame: {
    backgroundColor: '#3A2818',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#2A1A0A',
    borderBottomColor: '#2A1A0A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    position: 'relative',
    width: '100%',
    marginTop: 2,
  },
  settingsText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 2,
  },
  logoScrew: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B7B60',
    borderWidth: 0.5,
    borderColor: '#5C4033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoScrewCrossH: {
    position: 'absolute',
    width: 3.5,
    height: 0.8,
    backgroundColor: '#4A3828',
  },
  logoScrewCrossV: {
    position: 'absolute',
    width: 0.8,
    height: 3.5,
    backgroundColor: '#4A3828',
  },
  panelScrew: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7A6A50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: '#9A8A70',
    borderLeftColor: '#9A8A70',
    borderRightColor: '#5A4A38',
    borderBottomColor: '#5A4A38',
  },
  screwHead: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screwCrossH: {
    position: 'absolute',
    width: 8,
    height: 1.5,
    backgroundColor: '#4A3A28',
  },
  screwCrossV: {
    position: 'absolute',
    width: 1.5,
    height: 8,
    backgroundColor: '#4A3A28',
  },
});
