import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Image as RNImage,
  StyleSheet,
  TouchableOpacity,
  Text,
  Pressable,
} from 'react-native';
import { Asset } from 'expo-asset';
import Svg, { Path, Circle, G, Rect, Line, Ellipse, Text as SvgText, Defs, LinearGradient, Stop, RadialGradient, Image as SvgImage, Polygon } from 'react-native-svg';
import { useGameStore, MapPoint, CargoOption, Flight } from '../../src/store/gameStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WRENCH_BASE64 } from '../../src/assets/wrenchBase64';
import { useI18n } from '../i18n';

// Préchargement de TOUTES les cartes au premier import du module
const ALL_MAP_ASSETS = [
  require('../../assets/images/europe-map-vintage-new.png'),
  require('../../assets/images/gibraltar-map.png'),
  require('../../assets/images/mauritanie-map.png'),
  require('../../assets/images/atlantique-map.png'),
  require('../../assets/images/amazonie-map.png'),
  require('../../assets/images/buenosaires-map.png'),
  require('../../assets/images/patagonie.png'),
  require('../../assets/images/andes-map-v3.png'),
  require('../../assets/images/paraguay-map.png'),
  require('../../assets/images/africa-again-map.png'),
  require('../../assets/images/sahel-map.png'),
  require('../../assets/images/scandinavie-map.png'),
  require('../../assets/images/ouragan.png'),
  require('../../assets/images/tempete-sable.png'),
];

// Lancer le préchargement immédiatement
Asset.loadAsync(ALL_MAP_ASSETS).catch(() => {});

interface Props {
  width: number;
  height: number;
}

// Check if two line segments intersect
const doSegmentsIntersect = (
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean => {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 0.0001) return false;
  
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  
  const epsilon = 0.02;
  return ua > epsilon && ua < (1 - epsilon) && ub > epsilon && ub < (1 - epsilon);
};

// Sample points along a quadratic bezier curve
const sampleCurvePoints = (
  x1: number, y1: number,
  ctrlX: number, ctrlY: number,
  x2: number, y2: number,
  numSamples: number = 10
): Array<{x: number, y: number}> => {
  const points = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * ctrlX + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * ctrlY + t * t * y2;
    points.push({ x, y });
  }
  return points;
};

// Count intersections between a curve and existing flights
const countCurveIntersections = (
  curvePoints: Array<{x: number, y: number}>,
  existingFlights: Array<{from: {x: number, y: number}, to: {x: number, y: number}, ctrlX: number, ctrlY: number}>
): number => {
  let count = 0;
  
  // Check each segment of the new curve against each segment of existing flights
  for (let i = 0; i < curvePoints.length - 1; i++) {
    const p1 = curvePoints[i];
    const p2 = curvePoints[i + 1];
    
    for (const flight of existingFlights) {
      const flightPoints = sampleCurvePoints(
        flight.from.x, flight.from.y,
        flight.ctrlX, flight.ctrlY,
        flight.to.x, flight.to.y,
        10
      );
      
      for (let j = 0; j < flightPoints.length - 1; j++) {
        const f1 = flightPoints[j];
        const f2 = flightPoints[j + 1];
        
        if (doSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, f1.x, f1.y, f2.x, f2.y)) {
          count++;
          break; // Count one intersection per existing flight segment max
        }
      }
    }
  }
  
  return count;
};

export const EuropeMap: React.FC<Props> = ({ width, height }) => {
  const {
    currentPoint,
    visitedPoints,
    completedFlights,
    cargoOptions,
    isFlying,
    flyingProgress,
    flyingDestination,
    selectDestination,
    selectPostOffice,
    gameStatus,
    currentLevelId,
    mailCount,
    gibraltarPhase,
    mauritaniaPostOffice,
    mauritaniaMailCumul,
    sardegnaAerodrome,
    sardegnaAerodromeUsed,
    useAerodrome,
    turbulenceZone,
    turbulenceZone2,
    // Patagonie dual-plane
    patagonieSelectionPhase,
    plane2CurrentPoint,
    plane2VisitedPoints,
    plane2CompletedFlights,
    plane2IsFlying,
    plane2FlyingProgress,
    plane2FlyingDestination,
    selectPatagonieDestination,
    selectedCargo,
    // Andes
    andesCol,
    selectAndesCol,
    // Paraguay
    plane1CarriedMail,
    plane2CarriedMail,
    // Sahel
    sahelPostOfficeMail,
    // Saved curve directions for visual consistency
    flightCurveDirection,
    plane2FlightCurveDirection,
    // Campagne Europe
    isCampaignMode,
    currentQuadrant,
    campaignPoints,
  } = useGameStore();

  // Pulse animation for destination dots - state-based for SVG compatibility
  const [pulse, setPulse] = useState(0);
  const { t } = useI18n();
  // Blinking hand for first level tutorial
  const [handVisible, setHandVisible] = useState(true);
  
  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setPulse(Math.sin(frame * 0.08) * 0.5 + 0.5); // 0 to 1 oscillation
    }, 60);
    return () => clearInterval(interval);
  }, []);

  // Blinking hand animation
  useEffect(() => {
    if (currentLevelId === 'europe_20' && mailCount === 0) {
      const blinkInterval = setInterval(() => {
        setHandVisible(prev => !prev);
      }, 600);
      return () => clearInterval(blinkInterval);
    }
  }, [currentLevelId, mailCount]);

  // Campagne Europe: quadrant offsets for coordinate transformation
  // Full map coords (0-1) → quadrant display coords (0-1) → pixels
  // CORSICA, SARDEGNA and AFRIQUE_NORD use local viewport coordinates (0-1 per sector), so skip quadrant transform
  const quadrantBounds = (isCampaignMode && currentLevelId !== 'corsica' && currentLevelId !== 'sardegna' && currentLevelId !== 'afrique_nord' && currentLevelId !== 'retour_france') ? {
    BL: { minX: 0, maxX: 0.5, minY: 0.5, maxY: 1 },
    BR: { minX: 0.5, maxX: 1, minY: 0.5, maxY: 1 },
    TL: { minX: 0, maxX: 0.5, minY: 0, maxY: 0.5 },
    TR: { minX: 0.5, maxX: 1, minY: 0, maxY: 0.5 },
  }[currentQuadrant] : null;

  // Convert normalized coordinates to pixels (with quadrant transform for campaign)
  const toPixels = (x: number, y: number) => {
    if (quadrantBounds) {
      // Transform from full-map space to quadrant-local space (0-1) then to pixels
      const localX = (x - quadrantBounds.minX) / (quadrantBounds.maxX - quadrantBounds.minX);
      const localY = (y - quadrantBounds.minY) / (quadrantBounds.maxY - quadrantBounds.minY);
      return { px: localX * width, py: localY * height };
    }
    return { px: x * width, py: y * height };
  };

  // Store flight paths with their control points for intersection checking
  const flightPathsWithControls = useMemo(() => {
    return completedFlights.map((flight, index) => {
      const { px: x1, py: y1 } = toPixels(flight.from.x, flight.from.y);
      const { px: x2, py: y2 } = toPixels(flight.to.x, flight.to.y);
      
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const offset = len * 0.15;
      
      // Get the stored direction or default to positive
      const direction = (flight as any).curveDirection || 1;
      const ctrlX = midX - (dy / len) * offset * direction;
      const ctrlY = midY + (dx / len) * offset * direction;
      
      return {
        from: { x: x1, y: y1 },
        to: { x: x2, y: y2 },
        ctrlX,
        ctrlY,
        direction,
      };
    });
  }, [completedFlights, width, height]);

  // Generate curved path between two points, trying to avoid intersections
  const generateCurvedPath = (from: MapPoint, to: MapPoint, forDisplay: boolean = false): { path: string, direction: number } => {
    const { px: x1, py: y1 } = toPixels(from.x, from.y);
    const { px: x2, py: y2 } = toPixels(to.x, to.y);
    
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const offset = len * 0.15;
    
    // Try both curve directions
    const ctrlX1 = midX - (dy / len) * offset; // Direction 1 (default)
    const ctrlY1 = midY + (dx / len) * offset;
    
    const ctrlX2 = midX + (dy / len) * offset; // Direction -1 (opposite)
    const ctrlY2 = midY - (dx / len) * offset;
    
    // Count intersections for both directions
    const points1 = sampleCurvePoints(x1, y1, ctrlX1, ctrlY1, x2, y2, 15);
    const points2 = sampleCurvePoints(x1, y1, ctrlX2, ctrlY2, x2, y2, 15);
    
    const intersections1 = countCurveIntersections(points1, flightPathsWithControls);
    const intersections2 = countCurveIntersections(points2, flightPathsWithControls);
    
    // Choose the direction with fewer intersections
    let ctrlX, ctrlY, direction;
    if (intersections2 < intersections1) {
      ctrlX = ctrlX2;
      ctrlY = ctrlY2;
      direction = -1;
    } else {
      ctrlX = ctrlX1;
      ctrlY = ctrlY1;
      direction = 1;
    }
    
    return {
      path: `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`,
      direction,
    };
  };

  // Generate path for completed flight (using stored direction)
  const generateStoredPath = (flight: Flight, index: number): string => {
    const { px: x1, py: y1 } = toPixels(flight.from.x, flight.from.y);
    const { px: x2, py: y2 } = toPixels(flight.to.x, flight.to.y);
    
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const offset = len * 0.15;
    
    const direction = (flight as any).curveDirection || 1;
    const ctrlX = midX - (dy / len) * offset * direction;
    const ctrlY = midY + (dx / len) * offset * direction;
    
    return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
  };

  // Calculate point on curved path at progress t (0-1)
  // Uses stored direction to match visual path with intersection detection
  const getPointOnCurve = (from: MapPoint, to: MapPoint, t: number, storedDir?: number) => {
    const { px: x1, py: y1 } = toPixels(from.x, from.y);
    const { px: x2, py: y2 } = toPixels(to.x, to.y);
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: x1, y: y1, angle: 0 };
    const offset = len * 0.15;
    
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    // Use stored direction if provided, otherwise fallback to recalculation
    const direction = storedDir !== undefined ? storedDir : generateCurvedPath(from, to, true).direction;
    const ctrlX = midX - (dy / len) * offset * direction;
    const ctrlY = midY + (dx / len) * offset * direction;
    
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * ctrlX + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * ctrlY + t * t * y2;
    
    const dxT = 2 * (1 - t) * (ctrlX - x1) + 2 * t * (x2 - ctrlX);
    const dyT = 2 * (1 - t) * (ctrlY - y1) + 2 * t * (y2 - ctrlY);
    const angle = Math.atan2(dyT, dxT) * (180 / Math.PI);
    
    return { x, y, angle };
  };

  // Get airplane position during flight
  const getAirplanePosition = () => {
    if (!isFlying || !currentPoint || !flyingDestination) return null;
    return getPointOnCurve(currentPoint, flyingDestination, flyingProgress, flightCurveDirection);
  };

  const airplanePos = getAirplanePosition();

  // Get current flight path (for animation) - use STORED direction from gameStore
  // to ensure visual matches intersection detection (prevents ghost warnings)
  const currentFlightPath = useMemo(() => {
    if (!isFlying || !currentPoint || !flyingDestination) return null;
    // Use the saved flightCurveDirection from the store instead of recalculating
    const storedDirection = flightCurveDirection || 1;
    const { px: x1, py: y1 } = toPixels(currentPoint.x, currentPoint.y);
    const { px: x2, py: y2 } = toPixels(flyingDestination.x, flyingDestination.y);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;
    const offset = len * 0.15;
    const ctrlX = midX - (dy / len) * offset * storedDirection;
    const ctrlY = midY + (dx / len) * offset * storedDirection;
    return {
      path: `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`,
      direction: storedDirection,
    };
  }, [isFlying, currentPoint, flyingDestination, flightCurveDirection]);

  // Choisir la bonne carte selon le niveau
  const isGibraltar = currentLevelId === 'gibraltar';
  const isGibraltar2 = currentLevelId === 'gibraltar2';
  const isAtlantique = currentLevelId === 'atlantique';
  const isAtlantique2 = currentLevelId === 'atlantique2';
  const isMauritanie = currentLevelId === 'mauritanie';
  const isAmazonie = currentLevelId === 'amazonie';
  const isBuenosAires = currentLevelId === 'buenos_aires';
  const isPatagonie = currentLevelId === 'patagonie';
  const isAndes = currentLevelId === 'andes';
  const isParaguay = currentLevelId === 'paraguay';
  const isAfricaAgain = currentLevelId === 'africa_again';
  const isSahel = currentLevelId === 'sahel';
  // ANDES: vérifier si l'avion est actuellement au COL
  const isAtAndesCol = isAndes && currentPoint && andesCol && 
    Math.abs(currentPoint.x - andesCol.x) < 0.01 && 
    Math.abs(currentPoint.y - andesCol.y) < 0.01;
  // ANDES: vérifier si l'avion est actuellement au BUREAU DE POSTE
  const isAtAndesPoste = isAndes && currentPoint && mauritaniaPostOffice && 
    Math.abs(currentPoint.x - mauritaniaPostOffice.x) < 0.01 && 
    Math.abs(currentPoint.y - mauritaniaPostOffice.y) < 0.01;
  const mapSource = (isGibraltar || isGibraltar2)
    ? require('../../assets/images/gibraltar-map.png')
    : (isAtlantique || isAtlantique2)
    ? require('../../assets/images/atlantique-map.png')
    : isMauritanie
    ? require('../../assets/images/mauritanie-map.png')
    : isAmazonie
    ? require('../../assets/images/amazonie-map.png')
    : isBuenosAires
    ? require('../../assets/images/buenosaires-map.png')
    : isPatagonie
    ? require('../../assets/images/patagonie.png')
    : isAndes
    ? require('../../assets/images/andes-map-v3.png')
    : isParaguay
    ? require('../../assets/images/paraguay-map.png')
    : isAfricaAgain
    ? require('../../assets/images/africa-again-map.png')
    : isSahel
    ? require('../../assets/images/sahel-map.png')
    : isCampaignMode && currentLevelId === 'niveau_16'
    ? require('../../assets/images/scandinavie-map.png')
    : isCampaignMode && currentLevelId === 'corsica'
    ? require('../../assets/images/corsica-map.png')
    : isCampaignMode && currentLevelId === 'sardegna'
    ? require('../../assets/images/sardegna-map.png')
    : isCampaignMode && currentLevelId === 'afrique_nord'
    ? require('../../assets/images/afnord-map.png')
    : isCampaignMode && currentLevelId === 'retour_france'
    ? require('../../assets/images/retourfrance-map.png')
    : isCampaignMode
    ? require('../../assets/images/campagne-europe-map.png')
    : require('../../assets/images/europe-map-vintage-new.png');

  // Patagonie: plane2 airplane position during flight
  const getPlane2AirplanePosition = () => {
    if (!plane2IsFlying || !plane2CurrentPoint || !plane2FlyingDestination) return null;
    return getPointOnCurve(plane2CurrentPoint, plane2FlyingDestination, plane2FlyingProgress, plane2FlightCurveDirection);
  };
  const plane2AirplanePos = (isPatagonie || isParaguay) ? getPlane2AirplanePosition() : null;

  // Patagonie/Paraguay: plane2 current flight path - use STORED direction
  const plane2FlightPath = useMemo(() => {
    if (!(isPatagonie || isParaguay) || !plane2IsFlying || !plane2CurrentPoint || !plane2FlyingDestination) return null;
    const storedDir = plane2FlightCurveDirection || 1;
    const { px: x1, py: y1 } = toPixels(plane2CurrentPoint.x, plane2CurrentPoint.y);
    const { px: x2, py: y2 } = toPixels(plane2FlyingDestination.x, plane2FlyingDestination.y);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;
    const offset = len * 0.15;
    const ctrlX = midX - (dy / len) * offset * storedDir;
    const ctrlY = midY + (dx / len) * offset * storedDir;
    return {
      path: `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`,
      direction: storedDir,
    };
  }, [isPatagonie, isParaguay, plane2IsFlying, plane2CurrentPoint, plane2FlyingDestination, plane2FlightCurveDirection]);

  // Patagonie/Paraguay: all completed flights from plane2 (for display)
  const plane2FlightPaths = useMemo(() => {
    if (!(isPatagonie || isParaguay)) return [];
    return plane2CompletedFlights.map((flight: Flight, index: number) => {
      return generateStoredPath(flight, index);
    });
  }, [isPatagonie, isParaguay, plane2CompletedFlights, width, height]);

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Map background - vintage parchment style */}
      {isCampaignMode && currentLevelId === 'corsica' ? (
        <View style={{ width, height, overflow: 'hidden' }}>
          <RNImage
            key={`map-corsica-${currentQuadrant}`}
            source={mapSource}
            style={{
              width: width,
              height: height * 2,
              position: 'absolute' as const,
              left: 0,
              top: currentQuadrant === 'BL' ? -height : 0,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      ) : isCampaignMode && currentLevelId === 'retour_france' ? (
        <View style={{ width, height, overflow: 'hidden' }}>
          <RNImage
            key={`map-retourfrance-${currentQuadrant}`}
            source={mapSource}
            style={{
              width: width,
              height: height * 2,
              position: 'absolute' as const,
              left: 0,
              top: currentQuadrant === 'BL' ? -height : 0,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      ) : isCampaignMode && currentLevelId === 'sardegna' ? (
        <View style={{ width, height, overflow: 'hidden' }}>
          <RNImage
            key={`map-sardegna-${currentQuadrant}`}
            source={mapSource}
            style={{
              width: width,
              height: height * 3,
              position: 'absolute' as const,
              left: 0,
              top: currentQuadrant === 'BL' ? -height : currentQuadrant === 'BR' ? -height * 2 : 0,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      ) : isCampaignMode && currentLevelId === 'afrique_nord' ? (
        <View style={{ width, height, overflow: 'hidden' }}>
          <RNImage
            key={`map-afnord-${currentQuadrant}`}
            source={mapSource}
            style={{
              width: width * 3,
              height: height,
              position: 'absolute' as const,
              top: 0,
              left: currentQuadrant === 'TR' ? -width : currentQuadrant === 'BR' ? -width * 2 : 0,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      ) : isCampaignMode ? (
        <View style={{ width, height, overflow: 'hidden' }}>
          <RNImage
            key={`map-campaign-${currentQuadrant}`}
            source={mapSource}
            style={{
              width: width * 2,
              height: height * 2,
              position: 'absolute',
              left: currentQuadrant === 'BR' || currentQuadrant === 'TR' ? -width : 0,
              top: currentQuadrant === 'BL' || currentQuadrant === 'BR' ? -height : 0,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      ) : (
        <RNImage
          key={`map-${currentLevelId}`}
          source={mapSource}
          style={[styles.map, { width, height }]}
          resizeMode="cover"
          fadeDuration={0}
        />
      )}
      {/* Voile blanc pour éclaircir légèrement la carte */}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} pointerEvents="none" />
      
      {/* SVG overlay for paths and points */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          {/* Gradient for vintage badge background */}
          <LinearGradient id="badgeBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#F5E6C8" />
            <Stop offset="100%" stopColor="#E0CBA8" />
          </LinearGradient>
        </Defs>
        
        {/* ANDES: Col (point de passage) - cercle avec label COL */}
        {/* Clignote quand l'avion est au bureau de poste */}
        {isAndes && andesCol && gameStatus === 'playing' && (() => {
          const { px, py } = toPixels(andesCol.x, andesCol.y);
          const blinkOpacity = isAtAndesPoste ? (0.2 + Math.abs(Math.sin(Date.now() / 150)) * 0.8) : 1;
          return (
            <G opacity={blinkOpacity}>
              {/* Cercle vide (style destination) */}
              <Circle cx={px} cy={py} r={13} fill="#E8D5B0" stroke="#8B7355" strokeWidth={1} />
              <Circle cx={px} cy={py} r={11.5} fill="none" stroke="#3A2A1A" strokeWidth={1.5} />
              <Circle cx={px} cy={py} r={9} fill="none" stroke="#8B7355" strokeWidth={2} />
              
              {/* Halo clignotant au bureau de poste */}
              {isAtAndesPoste && (
                <Circle cx={px} cy={py} r={16 + pulse * 6} fill="none" stroke="#FFD700" strokeWidth={2} opacity={0.5 - pulse * 0.4} />
              )}
              
              {/* Label COL à droite */}
              <Rect x={px + 15} y={py - 9} width={26} height={18} rx={3} fill="rgba(74,56,40,0.85)" stroke="#8B7355" strokeWidth={1} />
              <SvgText x={px + 28} y={py + 3} fill="#FFD700" fontSize={9} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling">COL</SvgText>
            </G>
          );
        })()}
        
        {/* Completed flight paths (brown lines) */}
        {completedFlights.map((flight, index) => (
          <Path
            key={`flight-${index}`}
            d={generateStoredPath(flight, index)}
            stroke="#8B4513"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            opacity={0.8}
          />
        ))}
        
        {/* Patagonie: Plane 2 completed flight paths (dark blue lines) */}
        {(isPatagonie || isParaguay) && plane2CompletedFlights.map((flight: Flight, index: number) => (
          <Path
            key={`p2-flight-${index}`}
            d={generateStoredPath(flight, index)}
            stroke="#1B4F72"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            opacity={0.8}
          />
        ))}
        
        {/* Current flight path (animated dashed line) */}
        {currentFlightPath && (
          <Path
            d={currentFlightPath.path}
            stroke="#FF6B00"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="10,5"
          />
        )}
        
        {/* Patagonie: Plane 2 current flight path (blue dashed line) */}
        {(isPatagonie || isParaguay) && plane2FlightPath && (
          <Path
            d={plane2FlightPath.path}
            stroke="#2E86C1"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="10,5"
          />
        )}
        
        {/* Visited points - masqués (disparaissent après avoir été atteints) */}
        
        {/* Patagonie: Plane 2 visited points - masqués aussi */}
        
        {/* Patagonie: Plane 2 position shadow (SVG) */}
        {(isPatagonie || isParaguay) && plane2CurrentPoint && !plane2IsFlying && gameStatus === 'playing' && (
          <G>
            <Ellipse
              cx={toPixels(plane2CurrentPoint.x, plane2CurrentPoint.y).px}
              cy={toPixels(plane2CurrentPoint.x, plane2CurrentPoint.y).py + 4}
              rx={10}
              ry={4}
              fill="#000000"
              opacity={0.2}
            />
          </G>
        )}
        

        {/* Destination options - vintage style markers */}
        {/* ANDES: cacher les destinations quand l'avion est au bureau de poste */}
        {!isFlying && gameStatus === 'playing' && !isAtAndesPoste && cargoOptions.map((option) => {
          const { px, py } = toPixels(option.point.x, option.point.y);
          const outerPulse = 16 + pulse * 3;
          const pulseOpacity = 0.3 + pulse * 0.3;
          
          // Patagonie: point coloré selon l'avion qui l'a sélectionné
          const isSelectedByPlane1 = (isPatagonie || isParaguay) && patagonieSelectionPhase === 'plane2' && selectedCargo?.point.id === option.point.id;
          
          const isMail = option.type === 'mail';
          const isFuel = option.type === 'fuel';
          const isDelivery = option.type === 'delivery';
          const isCustoms = option.type === 'customs';
          const isArrow = option.type === ('arrow' as any);
          
          // Flèches de navigation (Campagne Europe / Scandinavie / Corsica)
          if (isArrow) {
            const arrowDir = option.point.id?.includes('right') ? '→' 
              : option.point.id?.includes('left') ? '←'
              : option.point.id?.includes('up') ? '↑' : '↓';
            return (
              <G key={`arrow-${option.point.id}`}
                onPress={() => selectDestination(option)}
              >
                <Circle cx={px} cy={py} r={28 + pulse * 5} stroke="rgba(200,50,0,0.4)" strokeWidth={3} fill="none" opacity={pulseOpacity} />
                <Circle cx={px} cy={py} r={24} fill="#CC3300" stroke="#881100" strokeWidth={2.5} />
                <SvgText x={px} y={py + 7} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#FFFFFF">{arrowDir}</SvgText>
              </G>
            );
          }
          
          // Couleur du point selon l'état de sélection
          let dotFillColor = (isParaguay && isDelivery) ? "#E65100" : (isParaguay && isMail ? "#2E7D32" : "#CC0000");
          let dotStrokeColor = "#8B7355";
          let dotOuterColor = "#E8D5B0";
          if (isSelectedByPlane1) {
            dotFillColor = "#8B4513"; // Couleur avion 1
            dotStrokeColor = "#6B3410";
            dotOuterColor = "#C49A6C";
          }
          
          // Wider badge to fit icon + number side by side
          const badgeX = px + 14;
          const badgeY = py - 11;
          const badgeW = isCustoms ? 48 : ((isMail || isDelivery) ? 38 : (isFuel ? 32 : 28));
          const badgeH = 22;
          
          return (
            <G key={`option-${option.point.id}`}>
              {isCustoms ? (
                /* Bureau de douane - maison brune avec badge MILES */
                <G>
                  <Circle cx={px} cy={py} r={outerPulse} stroke="rgba(139,105,20,0.5)" strokeWidth={1.5} fill="none" opacity={pulseOpacity} />
                  <Rect x={px - 9} y={py - 3} width={18} height={14} rx={1} fill="#8B4513" stroke="#5D2E0C" strokeWidth={1.5} />
                  <Path d={`M ${px - 12} ${py - 3} L ${px} ${py - 13} L ${px + 12} ${py - 3} Z`} fill="#5D2E0C" stroke="#3E1A00" strokeWidth={1} />
                  <Rect x={px - 3} y={py + 2} width={6} height={9} rx={0.5} fill="#F5E6C8" stroke="#5D2E0C" strokeWidth={0.8} />
                  <Circle cx={px} cy={py - 5} r={4} fill="#FFD700" stroke="#8B6914" strokeWidth={0.8} />
                  <SvgText x={px} y={py - 2.5} fill="#5D2E0C" fontSize={6} fontWeight="bold" textAnchor="middle">D</SvgText>
                  
                  <Rect x={badgeX} y={badgeY} width={badgeW} height={badgeH} rx={3} ry={3} fill="url(#badgeBg)" stroke="#8B6914" strokeWidth={1.2} />
                  <SvgText x={badgeX + badgeW / 2} y={badgeY + 15} fill="#8B4513" fontSize={10} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling">
                    -20000M
                  </SvgText>
                </G>
              ) : isDelivery && !isParaguay ? (
                /* Bureau de poste - petite maison rouge pour les livraisons Gibraltar */
                <G>
                  {/* Pulsing outer ring */}
                  <Circle cx={px} cy={py} r={outerPulse} stroke="rgba(180,30,30,0.4)" strokeWidth={1.5} fill="none" opacity={pulseOpacity} />
                  
                  {/* Maison rouge - corps */}
                  <Rect x={px - 9} y={py - 3} width={18} height={14} rx={1} fill="#CC0000" stroke="#800000" strokeWidth={1.5} />
                  {/* Toit */}
                  <Path d={`M ${px - 12} ${py - 3} L ${px} ${py - 13} L ${px + 12} ${py - 3} Z`} fill="#8B0000" stroke="#600000" strokeWidth={1} />
                  {/* Porte */}
                  <Rect x={px - 3} y={py + 2} width={6} height={9} rx={0.5} fill="#F5E6C8" stroke="#800000" strokeWidth={0.8} />
                  {/* Panneau "P" (Poste) */}
                  <SvgText x={px} y={py + 2} fill="#FFFFFF" fontSize={8} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling">P</SvgText>
                  
                  {/* Badge livraison */}
                  <Rect x={badgeX} y={badgeY} width={badgeW} height={badgeH} rx={3} ry={3} fill="url(#badgeBg)" stroke="#8B7355" strokeWidth={1.2} />
                  <Rect x={badgeX + 1.5} y={badgeY + 1.5} width={badgeW - 3} height={badgeH - 3} rx={2} ry={2} fill="none" stroke="#A89878" strokeWidth={0.5} />
                  
                  {/* Envelope icon + nombre à déduire */}
                  <Rect x={badgeX + 4} y={badgeY + 6} width={13} height={10} rx={1} fill="none" stroke="#CC0000" strokeWidth={1.5} />
                  <Path d={`M ${badgeX + 4} ${badgeY + 6} L ${badgeX + 10.5} ${badgeY + 12} L ${badgeX + 17} ${badgeY + 6}`} stroke="#CC0000" strokeWidth={1.5} fill="none" />
                  <SvgText x={badgeX + 20} y={badgeY + 16} fill="#CC0000" fontSize={12} fontWeight="bold" textAnchor="start" fontFamily="BigNoodleTitling">
                    -{option.amount}
                  </SvgText>
                </G>
              ) : (
                <G>
                  {/* Pulsing outer ring */}
                  {!isSelectedByPlane1 && <Circle cx={px} cy={py} r={outerPulse} stroke="rgba(180,30,30,0.4)" strokeWidth={1.5} fill="none" opacity={pulseOpacity} />}
                  
                  {/* Beige/cream outer border ring */}
                  <Circle cx={px} cy={py} r={13} fill={dotOuterColor} stroke={dotStrokeColor} strokeWidth={1} />
                  
                  {/* Dark inner ring */}
                  <Circle cx={px} cy={py} r={11.5} fill="none" stroke={isSelectedByPlane1 ? "#5A2A0A" : "#3A2A1A"} strokeWidth={1.5} />
                  
                  {/* Red destination dot (colored by plane if selected) */}
                  <Circle cx={px} cy={py} r={10} fill={dotFillColor} opacity={1} />
                  
                  {/* Glass highlight on red dot */}
                  <Ellipse cx={px - 2.5} cy={py - 3} rx={2.5} ry={5} fill="rgba(255,255,255,0.45)" transform={`rotate(-15, ${px - 2.5}, ${py - 3})`} />
                  
                  {/* Vintage cargo badge - wider */}
                  <Rect x={badgeX} y={badgeY} width={badgeW} height={badgeH} rx={3} ry={3} fill="url(#badgeBg)" stroke="#8B7355" strokeWidth={1.2} />
                  <Rect x={badgeX + 1.5} y={badgeY + 1.5} width={badgeW - 3} height={badgeH - 3} rx={2} ry={2} fill="none" stroke="#A89878" strokeWidth={0.5} />
                  
                  {/* Cargo icon + text inside badge */}
                  {isMail ? (
                    <G>
                      {/* Envelope icon - left side */}
                      <Rect x={badgeX + 4} y={badgeY + 6} width={13} height={10} rx={1} fill="none" stroke={isParaguay ? "#2E7D32" : "#3A2A1A"} strokeWidth={1.5} />
                      <Path d={`M ${badgeX + 4} ${badgeY + 6} L ${badgeX + 10.5} ${badgeY + 12} L ${badgeX + 17} ${badgeY + 6}`} stroke={isParaguay ? "#2E7D32" : "#3A2A1A"} strokeWidth={1.5} fill="none" />
                      {/* Number - right side, larger */}
                      <SvgText x={badgeX + 22} y={badgeY + 16} fill={isParaguay ? "#2E7D32" : "#3A2A1A"} fontSize={12} fontWeight="bold" textAnchor="start" fontFamily="BigNoodleTitling">
                        {isParaguay ? `+${option.amount}` : option.amount}
                      </SvgText>
                    </G>
                  ) : isDelivery && isParaguay ? (
                    <G>
                      {/* Paraguay distribution: envelope icon + -N (orange) */}
                      <Rect x={badgeX + 4} y={badgeY + 6} width={13} height={10} rx={1} fill="none" stroke="#E65100" strokeWidth={1.5} />
                      <Path d={`M ${badgeX + 4} ${badgeY + 6} L ${badgeX + 10.5} ${badgeY + 12} L ${badgeX + 17} ${badgeY + 6}`} stroke="#E65100" strokeWidth={1.5} fill="none" />
                      <SvgText x={badgeX + 20} y={badgeY + 16} fill="#E65100" fontSize={12} fontWeight="bold" textAnchor="start" fontFamily="BigNoodleTitling">
                        -{option.amount}
                      </SvgText>
                    </G>
                  ) : isFuel ? (
                    <G>
                      {/* Fuel can icon - centered */}
                      <Rect x={badgeX + 5} y={badgeY + 6} width={9} height={11} rx={1} fill="none" stroke="#3A2A1A" strokeWidth={1.5} />
                      <Rect x={badgeX + 7} y={badgeY + 3.5} width={5} height={3} rx={0.5} fill="none" stroke="#3A2A1A" strokeWidth={1.2} />
                      <Line x1={badgeX + 14} y1={badgeY + 8} x2={badgeX + 17} y2={badgeY + 8} stroke="#3A2A1A" strokeWidth={1.5} />
                      <Line x1={badgeX + 17} y1={badgeY + 8} x2={badgeX + 17} y2={badgeY + 12} stroke="#3A2A1A" strokeWidth={1.5} />
                      {/* + symbol */}
                      <SvgText x={badgeX + 22} y={badgeY + 16} fill="#3A2A1A" fontSize={10} fontWeight="bold" textAnchor="start" fontFamily="BigNoodleTitling">
                        +
                      </SvgText>
                    </G>
                  ) : (
                    <G>
                      {/* Wrench image icon */}
                      <SvgImage
                        x={badgeX + 4}
                        y={badgeY + 2}
                        width={20}
                        height={18}
                        href={WRENCH_BASE64}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </G>
                  )}
                </G>
              )}
            </G>
          );
        })}
        
        {/* Bureau de poste permanent en Mauritanie / Andes - toujours visible */}
        {(isMauritanie || isAndes || (currentLevelId === 'niveau_16' && currentQuadrant === 'TR') || (currentLevelId === 'corsica' && currentQuadrant === 'BL') || (currentLevelId === 'sardegna' && currentQuadrant === 'BR') || (currentLevelId === 'afrique_nord' && currentQuadrant === 'TL')) && mauritaniaPostOffice && gameStatus === 'playing' && (() => {
          const { px, py } = toPixels(mauritaniaPostOffice.x, mauritaniaPostOffice.y);
          const outerPulse = 18 + pulse * 4;
          const pulseOpacity = 0.4 + pulse * 0.4;
          // ANDES: griser le bureau de poste si l'avion n'est PAS au col
          const isPosteActive = isMauritanie || isAtAndesCol || currentLevelId === 'niveau_16' || currentLevelId === 'corsica' || currentLevelId === 'sardegna' || currentLevelId === 'afrique_nord';
          const posteOpacity = isPosteActive ? 1.0 : 0.35;
          const roofColor = isPosteActive ? '#8B0000' : '#777777';
          const wallColor = isPosteActive ? '#CC0000' : '#999999';
          const wallStroke = isPosteActive ? '#800000' : '#777777';
          const roofStroke = isPosteActive ? '#600000' : '#666666';
          const doorFill = isPosteActive ? '#F5E6C8' : '#BBBBBB';
          const textColor = isPosteActive ? '#FFFFFF' : '#CCCCCC';
          const labelBg = isPosteActive ? 'rgba(74,56,40,0.85)' : 'rgba(100,100,100,0.6)';
          const labelText = isPosteActive ? '#FFD700' : '#AAAAAA';
          return (
            <G opacity={posteOpacity}>
              {/* Pulsing outer ring doré - seulement quand actif */}
              {isPosteActive && (
                <Circle cx={px} cy={py} r={outerPulse} stroke="rgba(200,165,90,0.5)" strokeWidth={2} fill="none" opacity={pulseOpacity} />
              )}
              
              {/* Maison bleu foncé/vert - bureau de poste */}
              <Rect x={px - 12} y={py - 4} width={24} height={18} rx={1} fill={isPosteActive ? '#1B4F5C' : '#666'} stroke={isPosteActive ? '#0D3B47' : '#555'} strokeWidth={2} />
              {/* Toit */}
              <Path d={`M ${px - 15} ${py - 4} L ${px} ${py - 16} L ${px + 15} ${py - 4} Z`} fill={isPosteActive ? '#14434E' : '#555'} stroke={isPosteActive ? '#0A2E38' : '#444'} strokeWidth={1.5} />
              
              {/* Label POSTE */}
              <Rect x={px - 20} y={py + 16} width={40} height={14} rx={3} fill={labelBg} />
              <SvgText x={px} y={py + 26} fill={labelText} fontSize={8} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling">{t('POSTE')}</SvgText>
            </G>
          );
        })()}
        
        {/* Aérodrome Sardegna - visible dans le secteur centre (BL) */}
        {currentLevelId === 'sardegna' && currentQuadrant === 'BL' && sardegnaAerodrome && gameStatus === 'playing' && (() => {
          const { px, py } = toPixels(sardegnaAerodrome.x, sardegnaAerodrome.y);
          const isUsed = sardegnaAerodromeUsed;
          const color = isUsed ? '#888888' : '#2E7D32';
          const labelColor = isUsed ? '#AAAAAA' : '#FFD700';
          const labelBg = isUsed ? 'rgba(100,100,100,0.6)' : 'rgba(46,125,50,0.85)';
          return (
            <G opacity={isUsed ? 0.5 : 1.0}>
              {/* Piste d'atterrissage (rectangle horizontal) */}
              <Rect x={px - 18} y={py - 3} width={36} height={6} rx={2} fill={isUsed ? '#777' : '#4A3828'} stroke={isUsed ? '#555' : '#2C1D10'} strokeWidth={1.5} />
              {/* Ligne centrale de piste */}
              <Line x1={px - 14} y1={py} x2={px + 14} y2={py} stroke={isUsed ? '#999' : '#F5E6C8'} strokeWidth={1} strokeDasharray="3,3" />
              {/* Avion 2 (petit avion à côté) */}
              {!isUsed && (
                <G>
                  <Path d={`M ${px + 12} ${py - 10} l -3 -5 l -2 0 l 1 5 l -6 0 l -1.5 -2 l -1.5 0 l 1 2 l -1 2 l 1.5 0 l 1.5 -2 l 6 0 l -1 5 l 2 0 Z`} fill="#C41E3A" stroke="#8B0000" strokeWidth={0.8} />
                  {/* Pulsing indicator */}
                  <Circle cx={px + 12} cy={py - 10} r={8 + pulse * 3} stroke="rgba(46,125,50,0.6)" strokeWidth={1.5} fill="none" opacity={0.4 + pulse * 0.4} />
                </G>
              )}
              {/* Label AERODROME */}
              <Rect x={px - 28} y={py + 6} width={56} height={14} rx={3} fill={labelBg} />
              <SvgText x={px} y={py + 16} fill={labelColor} fontSize={7} fontWeight="bold" textAnchor="middle" fontFamily="BigNoodleTitling">{isUsed ? t('UTILISE') : t('AERODROME')}</SvgText>
            </G>
          );
        })()}
        
        {/* Current point - AIRPLANE ICON instead of green dot */}
        {currentPoint && !isFlying && (
          <G>
            {/* Small shadow under airplane */}
            <Ellipse
              cx={toPixels(currentPoint.x, currentPoint.y).px}
              cy={toPixels(currentPoint.x, currentPoint.y).py + 4}
              rx={10}
              ry={4}
              fill="#000000"
              opacity={0.2}
            />
          </G>
        )}
      </Svg>

      {/* Ouragan / Zone de turbulence - Amazonie (image overlay) */}
      {isAmazonie && turbulenceZone && gameStatus === 'playing' && (() => {
        const { px: cx, py: cy } = toPixels(turbulenceZone.x, turbulenceZone.y);
        const hurricaneSize = Math.max(turbulenceZone.radius * width * 2, turbulenceZone.radius * height * 2) * 0.7 * 0.7;
        return (
          <RNImage
            source={require('../../assets/images/ouragan.png')}
            style={{
              position: 'absolute',
              left: cx - hurricaneSize / 2,
              top: cy - hurricaneSize / 2,
              width: hurricaneSize,
              height: hurricaneSize,
              opacity: 0.55,
            }}
            resizeMode="contain"
          />
        );
      })()}

      {/* Zones de turbulence fixes - Atlantique 2 */}
      {isAtlantique2 && turbulenceZone && gameStatus === 'playing' && (() => {
        const { px: cx, py: cy } = toPixels(turbulenceZone.x, turbulenceZone.y);
        const hurricaneSize = Math.max(turbulenceZone.radius * width * 2, turbulenceZone.radius * height * 2) * 0.7;
        return (
          <RNImage
            source={require('../../assets/images/ouragan.png')}
            style={{
              position: 'absolute',
              left: cx - hurricaneSize / 2,
              top: cy - hurricaneSize / 2,
              width: hurricaneSize,
              height: hurricaneSize,
              opacity: 0.75,
            }}
            resizeMode="contain"
          />
        );
      })()}
      {isAtlantique2 && turbulenceZone2 && gameStatus === 'playing' && (() => {
        const { px: cx, py: cy } = toPixels(turbulenceZone2.x, turbulenceZone2.y);
        const hurricaneSize = Math.max(turbulenceZone2.radius * width * 2, turbulenceZone2.radius * height * 2) * 0.7;
        return (
          <RNImage
            source={require('../../assets/images/ouragan.png')}
            style={{
              position: 'absolute',
              left: cx - hurricaneSize / 2,
              top: cy - hurricaneSize / 2,
              width: hurricaneSize,
              height: hurricaneSize,
              opacity: 0.75,
            }}
            resizeMode="contain"
          />
        );
      })()}

      {/* AFRICA AGAIN : Tempête de sable (phase 2 uniquement) */}
      {isAfricaAgain && turbulenceZone && gibraltarPhase === 2 && gameStatus === 'playing' && (() => {
        const { px: cx, py: cy } = toPixels(turbulenceZone.x, turbulenceZone.y);
        const sandstormSize = Math.max(turbulenceZone.radius * width * 2, turbulenceZone.radius * height * 2) * 0.85;
        return (
          <RNImage
            source={require('../../assets/images/tempete-sable.png')}
            style={{
              position: 'absolute',
              left: cx - sandstormSize / 2,
              top: cy - sandstormSize / 2,
              width: sandstormSize,
              height: sandstormSize,
              opacity: 0.65,
            }}
            resizeMode="contain"
          />
        );
      })()}

      {/* GIBRALTAR II : Bureau de douane (visible en phase 1) */}
      {isGibraltar2 && gibraltarPhase === 1 && gameStatus === 'playing' && (() => {
        const customsX = 0.50;
        const customsY = 0.46;
        const { px: cx, py: cy } = toPixels(customsX, customsY);
        return (
          <View pointerEvents="none" style={{ position: 'absolute', left: cx - 20, top: cy - 20, alignItems: 'center', zIndex: 40 }}>
            <Svg width={40} height={40} viewBox="0 0 40 40">
              <Rect x={5} y={16} width={30} height={20} fill="#8B4513" stroke="#5D2E0C" strokeWidth={1.5} rx={2} />
              <Polygon points="20,4 2,18 38,18" fill="#5D2E0C" stroke="#3E1A00" strokeWidth={1} />
              <Rect x={15} y={24} width={10} height={12} fill="#3E1A00" rx={1} />
              <Circle cx={20} cy={13} r={5} fill="#FFD700" stroke="#8B6914" strokeWidth={1} />
              <SvgText x={20} y={16} fill="#5D2E0C" fontSize={8} fontWeight="bold" textAnchor="middle">D</SvgText>
            </Svg>
          </View>
        );
      })()}

      {/* Airplane icon at current position (non-SVG overlay for crisp icon) */}
      {currentPoint && !isFlying && gameStatus === 'playing' && (
        <View
          style={[
            styles.currentAirplane,
            {
              left: toPixels(currentPoint.x, currentPoint.y).px - 18,
              top: toPixels(currentPoint.x, currentPoint.y).py - 18,
            },
          ]}
        >
          {/* Cercle de sélection Avion 1 (marron) en mode 2 avions */}
          {(isPatagonie || isParaguay) && patagonieSelectionPhase === 'plane1' && (
            <View style={[styles.selectionCircle, { borderColor: '#8B4513' }]} />
          )}
          <MaterialCommunityIcons name="airplane" size={36} color={(isPatagonie || isParaguay) ? '#8B4513' : '#2C2C2C'} style={{ transform: [{ rotate: '-45deg' }] }} />
        </View>
      )}

      {/* Blinking hand for first level tutorial - only on mail destination */}
      {!isFlying && gameStatus === 'playing' && currentLevelId === 'europe_20' && mailCount === 0 && handVisible && (() => {
        // Find first mail destination (not fuel, not repair)
        const mailOption = cargoOptions.find(o => o.type === 'mail');
        if (!mailOption) return null;
        const { px, py } = toPixels(mailOption.point.x, mailOption.point.y);
        return (
          <View
            style={[
              styles.tutorialHand,
              {
                left: px + 18,
                top: py + 10,
                pointerEvents: 'none',
              },
            ]}
          >
            <MaterialCommunityIcons name="hand-pointing-up" size={48} color="#000000" />
          </View>
        );
      })()}

      {/* Bureau de poste clickable overlay pour Mauritanie - toujours visible */}
      {/* Touchable post office button for Mauritanie / Andes */}
      {/* ANDES: uniquement cliquable quand l'avion est au COL */}
      {(isMauritanie || (isAndes && isAtAndesCol) || (currentLevelId === 'niveau_16' && currentQuadrant === 'TR') || (currentLevelId === 'corsica' && currentQuadrant === 'BL') || (currentLevelId === 'sardegna' && currentQuadrant === 'BR') || (currentLevelId === 'afrique_nord' && currentQuadrant === 'TL')) && mauritaniaPostOffice && gameStatus === 'playing' && mailCount > 0 && !isFlying && (() => {
        const { px, py } = toPixels(mauritaniaPostOffice.x, mauritaniaPostOffice.y);
        return (
          <Pressable
            style={[
              styles.postOfficeButton,
              {
                left: px - 20,
                top: py - 20,
              },
            ]}
            onPress={() => selectPostOffice()}
          >
            <View style={styles.postOfficeButtonInner} />
          </Pressable>
        );
      })()}
      
      {/* SARDEGNA: Bouton aérodrome (changer d'avion) */}
      {currentLevelId === 'sardegna' && currentQuadrant === 'BL' && sardegnaAerodrome && !sardegnaAerodromeUsed && gameStatus === 'playing' && !isFlying && (() => {
        const { px, py } = toPixels(sardegnaAerodrome.x, sardegnaAerodrome.y);
        return (
          <Pressable
            testID="aerodrome-btn"
            accessibilityRole="button"
            style={[
              styles.postOfficeButton,
              {
                left: px - 25,
                top: py - 20,
                width: 50,
                height: 40,
              },
            ]}
            onPress={() => useAerodrome()}
          >
            <View style={styles.postOfficeButtonInner} />
          </Pressable>
        );
      })()}
      
      {/* ANDES: Touchable Col (point de passage) */}
      {isAndes && andesCol && gameStatus === 'playing' && !isFlying && (() => {
        const { px, py } = toPixels(andesCol.x, andesCol.y);
        return (
          <Pressable
            style={[
              styles.postOfficeButton,
              {
                left: px - 20,
                top: py - 20,
              },
            ]}
            onPress={() => selectAndesCol()}
          >
            <View style={styles.postOfficeButtonInner} />
          </Pressable>
        );
      })()}
      
      {/* Touchable destination options */}
      {/* ANDES: cacher les destinations quand l'avion est au bureau de poste */}
      {!isFlying && gameStatus === 'playing' && !isAtAndesPoste && cargoOptions.map((option) => {
        const { px, py } = toPixels(option.point.x, option.point.y);
        
        // Patagonie: déterminer la couleur du point
        const isSelectedByPlane1 = (isPatagonie || isParaguay) && patagonieSelectionPhase === 'plane2' && selectedCargo?.point.id === option.point.id;
        
        // En phase plane2, permettre de cliquer sur le point de l'avion 1 pour désélectionner
        // Ne plus retourner null, on le rend cliquable
        
        return (
          <TouchableOpacity
            key={`touch-${option.point.id}`}
            style={[
              styles.pointTouchable,
              {
                left: px - 25,
                top: py - 25,
              },
            ]}
            onPress={() => {
              if (isPatagonie || isParaguay) {
                if (patagonieSelectionPhase === 'plane1') {
                  selectPatagonieDestination(option, 1);
                } else if (patagonieSelectionPhase === 'plane2') {
                  // Si on clique sur le point déjà sélectionné par avion 1, on désélectionne
                  if (isSelectedByPlane1) {
                    selectPatagonieDestination(option, 2); // La logique dans le store gère la désélection
                  } else {
                    selectPatagonieDestination(option, 2);
                  }
                }
              } else {
                selectDestination(option);
              }
            }}
            activeOpacity={0.7}
          >
          </TouchableOpacity>
        );
      })}
      
      {/* Airplane during flight */}
      {airplanePos && (
        <View
          style={[
            styles.airplane,
            {
              left: airplanePos.x - 15,
              top: airplanePos.y - 15,
              transform: [{ rotate: `${airplanePos.angle}deg` }],
            },
          ]}
        >
          {isBuenosAires ? (
            <RNImage
              source={require('../../assets/images/seaplane.png')}
              style={{ width: 30, height: 30, transform: [{ scaleX: -1 }] }}
              resizeMode="contain"
            />
          ) : (
            <MaterialCommunityIcons name="airplane" size={30} color={(isPatagonie || isParaguay) ? '#8B4513' : '#2C2C2C'} />
          )}
        </View>
      )}

      {/* Patagonie: Plane 2 stationary airplane (blue) */}
      {(isPatagonie || isParaguay) && plane2CurrentPoint && !plane2IsFlying && gameStatus === 'playing' && (
        <View
          style={[
            styles.currentAirplane,
            {
              left: toPixels(plane2CurrentPoint.x, plane2CurrentPoint.y).px - 18,
              top: toPixels(plane2CurrentPoint.x, plane2CurrentPoint.y).py - 18,
            },
          ]}
        >
          {/* Cercle de sélection Avion 2 (bleu) */}
          {patagonieSelectionPhase === 'plane2' && (
            <View style={[styles.selectionCircle, { borderColor: '#1B4F72' }]} />
          )}
          <MaterialCommunityIcons name="airplane" size={36} color="#1B4F72" style={{ transform: [{ rotate: '-45deg' }] }} />
          {/* SAHEL: Badge IDLE quand Avion 2 attend au bureau de poste */}
          {isSahel && sahelPostOfficeMail === 0 && plane2CarriedMail === 0 && (
            <View style={{ position: 'absolute', bottom: -14, left: -4, backgroundColor: '#555', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
              <Text style={{ color: '#FFD700', fontFamily: 'BigNoodleTitling', fontSize: 8, fontWeight: 'bold' }}>IDLE</Text>
            </View>
          )}
        </View>
      )}

      {/* Patagonie: Plane 2 during flight (blue) */}
      {(isPatagonie || isParaguay) && plane2AirplanePos && (
        <View
          style={[
            styles.airplane,
            {
              left: plane2AirplanePos.x - 15,
              top: plane2AirplanePos.y - 15,
              transform: [{ rotate: `${plane2AirplanePos.angle}deg` }],
            },
          ]}
        >
          <MaterialCommunityIcons name="airplane" size={30} color="#1B4F72" />
        </View>
      )}

      {/* Patagonie: Selection phase indicator */}
      {(isPatagonie || isParaguay) && (patagonieSelectionPhase === 'plane1' || patagonieSelectionPhase === 'plane2') && gameStatus === 'playing' && (
        <View style={styles.selectionIndicator}>
          <Text style={[styles.selectionText, { color: patagonieSelectionPhase === 'plane1' ? '#8B4513' : '#1B4F72' }]}>
            {patagonieSelectionPhase === 'plane1' 
              ? (isSahel && sahelPostOfficeMail === 0 && plane2CarriedMail === 0 
                ? '✈ AVION 1 : Vol solo (Avion 2 en attente)' 
                : '✈ AVION 1 : Choisir destination') 
              : '✈ AVION 2 : Choisir destination'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  pointTouchable: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  cargoContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  airplane: {
    position: 'absolute',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentAirplane: {
    position: 'absolute',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  selectionCircle: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    backgroundColor: 'transparent',
    zIndex: -1,
  },
  tutorialHand: {
    position: 'absolute',
    zIndex: 60,
  },
  postOfficeButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    zIndex: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postOfficeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  // Trainée d'eau pour l'hydravion Buenos Aires
  waterWake: {
    position: 'absolute',
    width: 60,
    height: 25,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  wakeLineMain: {
    width: 40,
    height: 2,
    backgroundColor: '#87CEEB',
    borderRadius: 1,
    opacity: 0.7,
    marginTop: 2,
  },
  wakeLineLeft: {
    position: 'absolute',
    left: 5,
    top: 8,
    width: 18,
    height: 1.5,
    backgroundColor: '#ADD8E6',
    borderRadius: 1,
    opacity: 0.5,
    transform: [{ rotate: '15deg' }],
  },
  wakeLineRight: {
    position: 'absolute',
    right: 5,
    top: 8,
    width: 18,
    height: 1.5,
    backgroundColor: '#ADD8E6',
    borderRadius: 1,
    opacity: 0.5,
    transform: [{ rotate: '-15deg' }],
  },
  wakeSpray1: {
    position: 'absolute',
    left: 8,
    top: 14,
    width: 12,
    height: 1,
    backgroundColor: '#B0E0E6',
    borderRadius: 1,
    opacity: 0.4,
    transform: [{ rotate: '25deg' }],
  },
  wakeSpray2: {
    position: 'absolute',
    right: 8,
    top: 14,
    width: 12,
    height: 1,
    backgroundColor: '#B0E0E6',
    borderRadius: 1,
    opacity: 0.4,
    transform: [{ rotate: '-25deg' }],
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  selectionText: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    backgroundColor: 'rgba(245,230,200,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#8B7355',
    overflow: 'hidden',
  },
});
