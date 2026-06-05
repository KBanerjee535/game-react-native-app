import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  SafeAreaView,
  Platform,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Rect, Path, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore } from '../src/store/gameStore';
import { EuropeMap } from '../src/components/EuropeMap';
import { VintageDashboard } from '../src/components/VintageDashboard';
import { GameOverModal } from '../src/components/GameOverModal';
import { VideoBackground } from '../src/components/VideoBackground';
import { useGameAudio } from '../src/hooks/useGameAudio';
import { LEVELS } from '../src/data/levels';
import { MissionTelegram } from '../src/components/MissionTelegram';
import { HangarModal } from '../src/components/HangarModal';
import { SettingsModal } from '../src/components/SettingsModal';
import { AdModal } from '../src/components/AdModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useI18n } from '../src/i18n';

export default function AeropostaleGame() {
  const router = useRouter();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  
  // Calculate map and dashboard dimensions - dashboard overlaps map
  const DASHBOARD_HEIGHT = SCREEN_HEIGHT * 0.42;
  const MAP_HEIGHT = SCREEN_HEIGHT - DASHBOARD_HEIGHT + 50;

  const {
    gameStatus,
    startGame,
    resetGame,
    startLevel,
    isFlying,
    currentPoint,
    flyingDestination,
    updateFlyingProgress,
    completeFlight,
    crashMidFlight,
    mechanicalWarnings,
    mailCount,
    mailTarget,
    currentLevelId,
    currentQuadrant,
    fuelLevel,
    flightFuelCost,
    criticalCountdownActive,
    criticalCountdownEnd,
    checkCriticalTimeout,
    gameOverReason,
    crashPosition,
    gibraltarMailCollected,
    triggerFlightIntersection,
    triggeredFlightIntersections,
    triggerPlane2FlightIntersection,
    // Patagonie dual-plane
    plane2IsFlying,
    plane2CurrentPoint,
    plane2FlyingDestination,
    updatePlane2FlyingProgress,
    completePlane2Flight,
    crashPlane2MidFlight,
    plane2FuelLevel,
    plane2FlightFuelCost,
    plane2FlightIntersectionProgresses,
    plane2CriticalCountdownActive,
    patagonieSelectionPhase,
    resumeGame,
    loadMiles,
    freeplayMode,
    mauritaniaMailCumul,
    newlyCompletedLevel,
    flashMessage,
    tutorialMode,
    tutorialStep,
    tutorialFlightCount,
    tutorialHangarDone,
    startTutorial,
    setMapAspectRatio,
  } = useGameStore();

  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [showCrashExplosion, setShowCrashExplosion] = useState(false);
  const [explosionPhase, setExplosionPhase] = useState(0);
  const [showTelegraph, setShowTelegraph] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMissionTelegram, setShowMissionTelegram] = useState(false);
  const [showHomeHangar, setShowHomeHangar] = useState(false);
  const [showHomeSettings, setShowHomeSettings] = useState(false);
  const [homeSoundEnabled, setHomeSoundEnabled] = useState(true);
  const [showAdModal, setShowAdModal] = useState(false);
  const [showEuropePopup, setShowEuropePopup] = useState(false);
  const [europePopupSeen, setEuropePopupSeen] = useState(false);
  const [showIntersectionDamagePopup, setShowIntersectionDamagePopup] = useState(false);
  const [intersectionDamagePopupSeen, setIntersectionDamagePopupSeen] = useState(false);
  const [missionWasStarted] = [gameStatus === 'idle' && currentPoint !== null];
  const [lastPlayedLevel, setLastPlayedLevel] = useState<typeof LEVELS[0] | null>(null);
  const [pendingNextLevel, setPendingNextLevel] = useState<typeof LEVELS[0] | null>(null);

  const [showCriticalPopup, setShowCriticalPopup] = useState(false);
    const [pendingReplayAction, setPendingReplayAction] = useState<'none' | 'replay'>('none');
  const [displayFuel, setDisplayFuel] = useState(fuelLevel); // Carburant visuel progressif
  const flightAnimationRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const crashTimersRef = useRef<NodeJS.Timeout[]>([]);
  const { t } = useI18n();
  // Patagonie: plane2 refs
  const plane2AnimationRef = useRef<NodeJS.Timeout | null>(null);

  // Tutorial states
  const [tutorialMessage, setTutorialMessage] = useState<string | null>(null);
  const [tutorialHighlight, setTutorialHighlight] = useState<'mail' | 'miles' | 'warning' | 'hangar' | 'fuel' | null>(null);
  const [tutorialBlinkCount, setTutorialBlinkCount] = useState(0);
  const [showTutorialWarningScreen, setShowTutorialWarningScreen] = useState(false);
  const tutorialTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tutorialBlinkRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection popup control
  const firstIntersectionPopupShownRef = useRef(false);

  // Reset first intersection popup when mission starts
  useEffect(() => {
    if (gameStatus === 'playing') {
      firstIntersectionPopupShownRef.current = false;
    }
  }, [gameStatus, currentLevelId]);

  useEffect(() => {
    const isEuropeLevel = ['europe_20', 'europe_30'].includes(currentLevelId);
    if (gameStatus === 'playing' && isEuropeLevel && !europePopupSeen) {
      setShowEuropePopup(true);
    }
  }, [gameStatus, currentLevelId, europePopupSeen]);

  // useEffect(() => {
  //   const isEuropeRouteMode = currentLevelId === 'europe_20' || freeplayMode === 'europe';
  //   if (
  //     !intersectionDamagePopupSeen &&
  //     isEuropeRouteMode &&
  //     gameStatus === 'playing' &&
  //     triggeredFlightIntersections.length === 1
  //   ) {
  //     setShowIntersectionDamagePopup(true);
  //   }
  // }, [currentLevelId, freeplayMode, gameStatus, triggeredFlightIntersections.length, intersectionDamagePopupSeen]);

  // Tutorial blink effect (when highlight is active)
  useEffect(() => {
    if (tutorialHighlight) {
      tutorialBlinkRef.current = setInterval(() => {
        setTutorialBlinkCount(c => c + 1);
      }, 300);
      return () => {
        if (tutorialBlinkRef.current) clearInterval(tutorialBlinkRef.current);
      };
    }
  }, [tutorialHighlight]);

  // Tutorial step logic
  // Steps: 0=start, 1=mail msg, 2=miles msg, 3=fuel msg, 4=hangar msg, 5=crossing msg, 99=done
  useEffect(() => {
    if (!tutorialMode) {
      setTutorialMessage(null);
      setTutorialHighlight(null);
      return;
    }
    
    // === TOUR 1 : Courrier ===
    // Step 0: Début -> "CLIQUEZ SUR UNE DESTINATION"
    if (tutorialStep === 0 && !isFlying && tutorialFlightCount === 0) {
      setTutorialMessage('CLIQUEZ SUR UNE DESTINATION');
      setTutorialHighlight(null);
    }
    // Vol 1 en cours -> masquer
    else if (tutorialStep === 0 && isFlying) {
      setTutorialMessage(null);
      setTutorialHighlight(null);
    }
    // Vol 1 terminé -> avancer
    else if (tutorialStep === 0 && !isFlying && tutorialFlightCount === 1) {
      useGameStore.setState({ tutorialStep: 1 });
    }
    // Step 1: Afficher "VOUS AVEZ COLLECTE 3 COURRIERS" + highlight mail
    else if (tutorialStep === 1 && !isFlying) {
      setTutorialMessage(t('TUTO_COLLECTE'));
      setTutorialHighlight('mail');
      setTutorialBlinkCount(0);
      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
      tutorialTimerRef.current = setTimeout(() => {
        setTutorialHighlight(null);
        setTutorialMessage(null);
        useGameStore.setState({ tutorialStep: 2 });
      }, 3000);
    }
    
    // === TOUR 2 : Miles ===
    // Step 2: En attente 2e clic
    else if (tutorialStep === 2 && !isFlying && tutorialFlightCount === 1) {
      setTutorialMessage('CLIQUEZ SUR UNE DESTINATION');
      setTutorialHighlight(null);
    }
    // Vol 2 en cours -> "VOS MILES S'ACCUMULENT" + highlight miles
    else if (tutorialStep === 2 && isFlying && tutorialFlightCount === 1) {
      setTutorialMessage(t('TUTO_MILES'));
      setTutorialHighlight('miles');
      setTutorialBlinkCount(0);
    }
    // Vol 2 terminé -> afficher miles highlight 3s puis avancer
    else if (tutorialStep === 2 && !isFlying && tutorialFlightCount === 2) {
      setTutorialMessage(t('TUTO_MILES'));
      setTutorialHighlight('miles');
      setTutorialBlinkCount(0);
      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
      tutorialTimerRef.current = setTimeout(() => {
        setTutorialHighlight(null);
        setTutorialMessage(null);
        useGameStore.setState({ tutorialStep: 3 });
      }, 3000);
    }
    
    // === TOUR 3 : Essence ===
    // Step 3: "VOTRE RESERVOIR SE VIDE CLIQUER SUR UNE DESTINATION ESSENCE"
    else if (tutorialStep === 3 && !isFlying && tutorialFlightCount === 2) {
      setTutorialMessage(t('TUTO_RESERVOIR'));
      setTutorialHighlight(null);
    }
    // Vol 3 en cours -> masquer
    else if (tutorialStep === 3 && isFlying) {
      setTutorialMessage(null);
      setTutorialHighlight(null);
    }
    // Vol 3 terminé -> avancer
    else if (tutorialStep === 3 && !isFlying && tutorialFlightCount === 3) {
      useGameStore.setState({ tutorialStep: 4 });
    }
    
    // === HANGAR ===
    // Step 4: "CLIQUER SUR HANGAR..." + highlight hangar
    else if (tutorialStep === 4 && !isFlying && !tutorialHangarDone) {
      setTutorialMessage(t('TUTO_HANGAR'));
      setTutorialHighlight('hangar');
      setTutorialBlinkCount(0);
    }
    // Le joueur a fermé le HANGAR -> avancer
    else if (tutorialStep === 4 && tutorialHangarDone) {
      setTutorialHighlight(null);
      setTutorialMessage(null);
      useGameStore.setState({ tutorialStep: 5 });
    }
    
    // === CROISEMENT ===
    // Step 5: En attente du clic (destinations avec croisement forcé)
    else if (tutorialStep === 5 && !isFlying && tutorialFlightCount === 3) {
      setTutorialMessage('CLIQUEZ SUR UNE DESTINATION');
      setTutorialHighlight(null);
    }
    // Vol 4 en cours -> masquer
    else if (tutorialStep === 5 && isFlying) {
      setTutorialMessage(null);
      setTutorialHighlight(null);
    }
    // Vol 4 terminé + un voyant s'est allumé -> message croisement
    else if (tutorialStep === 5 && !isFlying && tutorialFlightCount === 4) {
      if (mechanicalWarnings > 0) {
        useGameStore.setState({ tutorialStep: 6 });
      } else {
        // Pas de croisement détecté, fin des messages tuto
        useGameStore.setState({ tutorialStep: 99 });
      }
    }
    // Step 6: Message croisement + highlight warning
    else if (tutorialStep === 6 && !isFlying) {
      setTutorialMessage('LORSQUE VOUS CROISEZ UN TRACE EXISTANT UNE PANNE SURVIENT');
      setTutorialHighlight('warning');
      setTutorialBlinkCount(0);
      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
      tutorialTimerRef.current = setTimeout(() => {
        setTutorialHighlight(null);
        setTutorialMessage(null);
        useGameStore.setState({ tutorialStep: 99 });
      }, 4000);
    }
    
  }, [tutorialMode, tutorialStep, isFlying, tutorialFlightCount, tutorialHangarDone, mechanicalWarnings]);

  // Synchroniser displayFuel avec fuelLevel quand on n'est pas en vol
  useEffect(() => {
    if (!isFlying) {
      setDisplayFuel(fuelLevel);
    }
  }, [fuelLevel, isFlying]);

  // Hook audio du moteur
  useGameAudio({
    isFlying,
    mechanicalWarnings,
    fuelLevel,
    gameStatus,
    soundEnabled,
  });

  // Charger la préférence son au démarrage
  useEffect(() => {
    AsyncStorage.getItem('@courrier_sound_enabled').then((val) => {
      if (val !== null) {
        setSoundEnabled(JSON.parse(val));
      }
    }).catch(() => {});
  }, []);

  // Charger les miles persistés au démarrage
  useEffect(() => {
    loadMiles();
  }, []);

  // PANNE CRITIQUE popup - s'affiche 2 secondes puis disparaît
  useEffect(() => {
    if (criticalCountdownActive && gameStatus === 'playing') {
      setShowCriticalPopup(true);
      const timer = setTimeout(() => setShowCriticalPopup(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowCriticalPopup(false);
    }
  }, [criticalCountdownActive]);

  // Clear crash timers
  const clearCrashTimers = useCallback(() => {
    crashTimersRef.current.forEach(t => clearTimeout(t));
    crashTimersRef.current = [];
  }, []);

  // Handle game over - show explosion on map then telegraph
  useEffect(() => {
    if (gameStatus === 'lost' && crashPosition) {
      setShowCrashExplosion(true);
      setExplosionPhase(0);
      setShowTelegraph(false);

      // Explosion sequence on the map - ~1 second
      const t1 = setTimeout(() => setExplosionPhase(1), 50);    // Flash
      const t2 = setTimeout(() => setExplosionPhase(2), 150);   // Fire + debris
      const t3 = setTimeout(() => setExplosionPhase(3), 350);   // Smoke rings
      const t4 = setTimeout(() => setExplosionPhase(4), 550);   // Black smoke
      const t5 = setTimeout(() => setExplosionPhase(5), 750);   // Fading smoke
      // Hide explosion and show telegraph 1 second after explosion ends
      const t6 = setTimeout(() => {
        setShowCrashExplosion(false);
        setExplosionPhase(0);
      }, 1000);
      const t7 = setTimeout(() => setShowTelegraph(true), 2000);

      crashTimersRef.current = [t1, t2, t3, t4, t5, t6, t7];
      return () => clearCrashTimers();
    } else if (gameStatus === 'won') {
      setShowCrashExplosion(false);
      setShowTelegraph(true);
    } else {
      setShowCrashExplosion(false);
      setShowTelegraph(false);
      setExplosionPhase(0);
    }
  }, [gameStatus, crashPosition]);

  // Handle flight animation - constant speed based on distance + fuel check + intersection detection
  useEffect(() => {
    if (isFlying && currentPoint && flyingDestination) {
      let progress = 0;
      
      const distance = Math.sqrt(
        Math.pow(flyingDestination.x - currentPoint.x, 2) +
        Math.pow(flyingDestination.y - currentPoint.y, 2)
      );
      // Constant speed: ~0.30 normalized units per second
      const speed = 0.30;
      const duration = (distance / speed) * 1000;
      const interval = 50; // Update every 50ms
      const increment = interval / duration;

      // Consommation de carburant de base par tick (proportionnelle à la distance)
      const baseFuelPerTick = (Math.round(distance * 40)) * increment;
      let cumulativeFuelUsed = 0;

      flightAnimationRef.current = setInterval(() => {
        progress += increment;
        
        // Calcul de la position actuelle de l'avion
        const currentX = currentPoint.x + (flyingDestination.x - currentPoint.x) * progress;
        const currentY = currentPoint.y + (flyingDestination.y - currentPoint.y) * progress;
        
        // Vérifier si la position actuelle est dans une zone de turbulence (toutes missions)
        const storeState = useGameStore.getState();
        let fuelMultiplier = 1;
        
        // Zone de turbulence 1
        if (storeState.turbulenceZone) {
          const tz = storeState.turbulenceZone;
          const distToTurb = Math.sqrt(
            Math.pow(currentX - tz.x, 2) + Math.pow(currentY - tz.y, 2)
          );
          if (distToTurb <= tz.radius) {
            fuelMultiplier = 3; // Consommation x3 dans la turbulence
          }
        }
        
        // Zone de turbulence 2 (Atlantique 2 etc.)
        if (storeState.turbulenceZone2) {
          const tz2 = storeState.turbulenceZone2;
          const distToTurb2 = Math.sqrt(
            Math.pow(currentX - tz2.x, 2) + Math.pow(currentY - tz2.y, 2)
          );
          if (distToTurb2 <= tz2.radius) {
            fuelMultiplier = 3;
          }
        }
        
        // Déduire le carburant progressivement
        cumulativeFuelUsed += baseFuelPerTick * fuelMultiplier;
        const currentVisualFuel = fuelLevel - cumulativeFuelUsed;
        setDisplayFuel(Math.max(0, Math.round(currentVisualFuel)));
        // Stocker le carburant réel consommé (avec turbulence) dans le store
        useGameStore.setState({ flightActualFuelUsed: Math.round(cumulativeFuelUsed) });
        
        // Check fuel depletion mid-flight
        if (currentVisualFuel <= 0 && progress < 1) {
          if (flightAnimationRef.current) {
            clearInterval(flightAnimationRef.current);
          }
          crashMidFlight(progress, 'fuel');
          return;
        }
        
        // Check for intersection crossings in real-time
        // ATOMIC: triggerFlightIntersection in the store handles dedup
        // Un voyant par tracé croisé : chaque intersection déclenche un voyant distinct
        const currentIntersections = storeState.flightIntersectionProgresses;
        for (let i = 0; i < currentIntersections.length; i++) {
          if (progress >= currentIntersections[i]) {
            // Check if already triggered (read fresh state for dedup)
            const freshState = useGameStore.getState();
            if (freshState.triggeredFlightIntersections.includes(i)) continue;
            
            // If critical countdown is active and we cross a path -> instant crash
            if (freshState.criticalCountdownActive) {
              if (flightAnimationRef.current) {
                clearInterval(flightAnimationRef.current);
              }
              crashMidFlight(progress, 'mechanical');
              return;
            }
            
            // Atomic trigger: checks + increments in one store action
triggerFlightIntersection(i);

// SHOW POPUP IMMEDIATELY ON FIRST INTERSECTION
const isEuropeRouteMode =
  currentLevelId === 'europe_20' ||
  currentLevelId === 'europe_30';

if (
  isEuropeRouteMode &&
  !tutorialMode &&
  !intersectionDamagePopupSeen &&
  !firstIntersectionPopupShownRef.current
) {
  firstIntersectionPopupShownRef.current = true;

  requestAnimationFrame(() => {
    setShowIntersectionDamagePopup(true);
  });
}
          }
        }
        
        if (progress >= 1) {
          progress = 1;
          if (flightAnimationRef.current) {
            clearInterval(flightAnimationRef.current);
          }
          completeFlight();
        }
        updateFlyingProgress(progress);
      }, interval);

      return () => {
        if (flightAnimationRef.current) {
          clearInterval(flightAnimationRef.current);
        }
      };
    }
  }, [isFlying, currentPoint, flyingDestination]);

  // Patagonie: Plane 2 flight animation
  useEffect(() => {
    if (plane2IsFlying && plane2CurrentPoint && plane2FlyingDestination && (currentLevelId === 'patagonie' || currentLevelId === 'paraguay')) {
      let p2progress = 0;
      
      const distance = Math.sqrt(
        Math.pow(plane2FlyingDestination.x - plane2CurrentPoint.x, 2) +
        Math.pow(plane2FlyingDestination.y - plane2CurrentPoint.y, 2)
      );
      const speed = 0.15;
      const duration = (distance / speed) * 1000;
      const interval = 50;
      const increment = interval / duration;
      const baseFuelPerTick = (Math.round(distance * 40)) * increment;
      let p2CumulativeFuel = 0;
      
      plane2AnimationRef.current = setInterval(() => {
        p2progress += increment;
        
        p2CumulativeFuel += baseFuelPerTick;
        const p2CurrentFuel = plane2FuelLevel - p2CumulativeFuel;
        
        // Check fuel depletion
        if (p2CurrentFuel <= 0 && p2progress < 1) {
          if (plane2AnimationRef.current) clearInterval(plane2AnimationRef.current);
          crashPlane2MidFlight(p2progress, 'fuel');
          return;
        }
        
        // Check intersection crossings - ATOMIC via store
        const storeState = useGameStore.getState();
        const p2Intersections = storeState.plane2FlightIntersectionProgresses;
        for (let i = 0; i < p2Intersections.length; i++) {
          if (p2progress >= p2Intersections[i]) {
            const freshState = useGameStore.getState();
            if (freshState.plane2TriggeredFlightIntersections.includes(i)) continue;
            
            if (freshState.plane2CriticalCountdownActive) {
              if (plane2AnimationRef.current) clearInterval(plane2AnimationRef.current);
              crashPlane2MidFlight(p2progress, 'mechanical');
              return;
            }
            triggerPlane2FlightIntersection(i);

            // SHOW POPUP IMMEDIATELY ON FIRST INTERSECTION
            const isEuropeRouteMode =
              currentLevelId === 'europe_20' ||
              currentLevelId === 'europe_30';

            if (
              isEuropeRouteMode &&
              !tutorialMode &&
              !intersectionDamagePopupSeen &&
              !firstIntersectionPopupShownRef.current
            ) {
              firstIntersectionPopupShownRef.current = true;

              requestAnimationFrame(() => {
                setShowIntersectionDamagePopup(true);
              });
            }
          }
        }
        
        if (p2progress >= 1) {
          p2progress = 1;
          if (plane2AnimationRef.current) clearInterval(plane2AnimationRef.current);
          completePlane2Flight();
        }
        updatePlane2FlyingProgress(p2progress);
      }, interval);
      
      return () => {
        if (plane2AnimationRef.current) clearInterval(plane2AnimationRef.current);
      };
    }
  }, [plane2IsFlying, plane2CurrentPoint, plane2FlyingDestination]);

  // Critical countdown timer - checks every second
  useEffect(() => {
    if (gameStatus === 'playing' && criticalCountdownActive) {
      countdownTimerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((criticalCountdownEnd - Date.now()) / 1000));
        setCountdownSeconds(remaining);
        checkCriticalTimeout();
      }, 500);

      return () => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      };
    } else {
      setCountdownSeconds(0);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }
  }, [gameStatus, criticalCountdownActive]);

  const handleRestart = useCallback(() => {
    clearCrashTimers();
    setShowCrashExplosion(false);
    setShowTelegraph(false);
    setExplosionPhase(0);
    resetGame();
    startGame();
  }, [clearCrashTimers]);

  // Rejouer la même mission
  // Rejouer la même mission - show ad first
  const handleReplayMission = useCallback(() => {
    setPendingReplayAction('replay');
    setShowTelegraph(false);
    setShowAdModal(true);
  }, []);

  // Handle ad close - restart game
  const handleAdModalClose = useCallback(() => {
    setShowAdModal(false);
    if (pendingReplayAction === 'replay') {
      setPendingReplayAction('none');
      clearCrashTimers();
      setShowCrashExplosion(false);
      setShowTelegraph(false);
      setExplosionPhase(0);
    
      const currentFreeplay = useGameStore.getState().freeplayMode;
      resetGame();
      // Si on est en mode jeu libre, relancer le même mode
      if (currentFreeplay) {
        const freeplayMap: Record<string, string> = {
          'europe': 'europe_20',
          'andes': 'andes',
          'patagonie_ii': 'patagonie',
        };
        const baseLevelId = freeplayMap[currentFreeplay] || 'europe_20';
        useGameStore.setState({ freeplayMode: currentFreeplay });
        startLevel(baseLevelId, 99999);
      } else {
        // Relancer le même niveau normal
        const level = LEVELS.find(l => l.id === currentLevelId);
        if (level) {
          startLevel(level.id, level.mailTarget);
        } else {
          startGame();
        }
      }
    }
  }, [pendingReplayAction, clearCrashTimers, currentLevelId]);

  // Mission suivante - affiche le télégramme avant de démarrer
  const handleNextMission = useCallback(() => {
    clearCrashTimers();
    setShowCrashExplosion(false);
    setShowTelegraph(false);
    setExplosionPhase(0);
    resetGame();
    // Trouver le niveau suivant
    const currentIndex = LEVELS.findIndex(l => l.id === currentLevelId);
    const nextLevel = currentIndex >= 0 && currentIndex < LEVELS.length - 1
      ? LEVELS[currentIndex + 1]
      : LEVELS[0]; // Retour au premier si dernier niveau
    // Stocker le niveau en attente et afficher le télégramme
    setPendingNextLevel(nextLevel);
    setShowMissionTelegram(true);
  }, [clearCrashTimers, currentLevelId]);

  // Retour au menu
  const handleMenuFromGame = useCallback(() => {
    clearCrashTimers();
    setShowCrashExplosion(false);
    setShowTelegraph(false);
    setExplosionPhase(0);
    resetGame();
  }, [clearCrashTimers]);

  // Trouver le nom du niveau actuel
  const freeplayNames: Record<string, string> = { 'europe': 'EUROPE', 'andes': 'ANDES', 'patagonie_ii': 'PATAGONIE II' };
  const currentLevelName = freeplayMode 
    ? freeplayNames[freeplayMode] || 'JEU LIBRE'
    : LEVELS.find(l => l.id === currentLevelId)?.name || 'EUROPE 20';

  // Start screen
  if (gameStatus === 'idle') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <View style={styles.startScreen}>
          {/* Background video - loops silently */}
          <VideoBackground />

          {/* Top third - Title */}
          <View style={styles.topSection}>
            <View style={styles.titleContainer}>
              <View style={styles.titleBar} />
              <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>COURRIER</Text>
              <View style={styles.titleBar} />
              <Image
                source={require('../assets/images/logo-courrier.png')}
                style={styles.logoImage}
              />
            </View>
          </View>

          {/* Settings icon - top right */}
          <Pressable
            style={styles.settingsTopRight}
            onPress={() => setShowHomeSettings(true)}
            hitSlop={10}
          >
            <MaterialCommunityIcons name="cog" size={36} color="#FFFFFF" />
          </Pressable>

          {/* Bouton retour à la mission en cours */}
          <View style={styles.middleSection} />

          {/* Bottom third - Buttons */}
          <View style={styles.bottomSection}>
            <Pressable 
              style={styles.startButton} 
              onPress={() => {
                console.log('MISSION pressed - navigating to /level');
                router.push('/level');
              }}
              role="button"
            >
              <MaterialCommunityIcons
                name="map"
                size={30}
                color="#FFF"
              />
              <Text style={styles.startButtonText}>{t('DECOLLER')}</Text>
            </Pressable>

            {/* Bouton retour mission - uniquement si une mission a été démarrée */}
            {missionWasStarted && (
              <Pressable 
                style={styles.missionReturnButton}
                onPress={() => {
                  resumeGame(); // Reprend la partie directement là où on en était
                }}
              >
                <MaterialCommunityIcons name="arrow-right-circle" size={14} color="#FFD700" />
                <Text style={styles.missionReturnText}>RETOUR À LA MISSION {currentLevelName}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Hangar Modal - accessible depuis l'écran d'accueil */}
        <HangarModal
          visible={showHomeHangar}
          onClose={() => setShowHomeHangar(false)}
          inMission={false}
        />

        <SettingsModal
          visible={showHomeSettings}
          onClose={() => setShowHomeSettings(false)}
          soundEnabled={homeSoundEnabled}
          onToggleSound={setHomeSoundEnabled}
        />

        {/* Télégramme de mission - affiché quand DÉCOLLER est pressé ou mission suivante */}
        <MissionTelegram
          visible={showMissionTelegram}
          level={pendingNextLevel || lastPlayedLevel || LEVELS[0]}
          onStart={() => {
            const levelToStart = pendingNextLevel || lastPlayedLevel || LEVELS[0];
            setShowMissionTelegram(false);
            setLastPlayedLevel(levelToStart);
            setPendingNextLevel(null);
            startLevel(levelToStart.id, levelToStart.mailTarget);
          }}
          onCancel={() => {
            setShowMissionTelegram(false);
            setPendingNextLevel(null);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Map area (2/3 of screen) */}
      <View style={[styles.mapContainer, { height: MAP_HEIGHT, width: SCREEN_WIDTH }]}>
        <EuropeMap width={SCREEN_WIDTH} height={MAP_HEIGHT} />
        
        {/* Crash explosion overlay on the map */}
        {showCrashExplosion && crashPosition && (() => {
          // Transformer les coordonnées pour les modes campagne (4 quadrants)
          const isCampaignQuadrant = ['campagne_europe', 'niveau_16'].includes(currentLevelId);
          const qBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number }> = {
            BL: { minX: 0, maxX: 0.5, minY: 0.5, maxY: 1 },
            BR: { minX: 0.5, maxX: 1, minY: 0.5, maxY: 1 },
            TL: { minX: 0, maxX: 0.5, minY: 0, maxY: 0.5 },
            TR: { minX: 0.5, maxX: 1, minY: 0, maxY: 0.5 },
          };
          let crashLeft: number, crashTop: number;
          if (isCampaignQuadrant && qBounds[currentQuadrant]) {
            const b = qBounds[currentQuadrant];
            crashLeft = ((crashPosition.x - b.minX) / (b.maxX - b.minX)) * SCREEN_WIDTH - 60;
            crashTop = ((crashPosition.y - b.minY) / (b.maxY - b.minY)) * MAP_HEIGHT - 60;
          } else {
            crashLeft = crashPosition.x * SCREEN_WIDTH - 60;
            crashTop = crashPosition.y * MAP_HEIGHT - 60;
          }
          return (
          <View
            style={[
              styles.crashExplosion,
              {
                left: crashLeft,
                top: crashTop,
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={120} height={120}>
              {/* Phase 1: Initial white flash */}
              {explosionPhase >= 1 && explosionPhase < 3 && (
                <Circle cx={60} cy={60} r={15} fill="#FFFFFF" opacity={0.95} />
              )}
              {/* Phase 1-3: Fireball */}
              {explosionPhase >= 1 && explosionPhase < 5 && (
                <Circle cx={60} cy={60} r={explosionPhase >= 3 ? 45 : (explosionPhase >= 2 ? 32 : 22)} fill="#FF6600" opacity={explosionPhase >= 4 ? 0.35 : 0.85} />
              )}
              {/* Phase 1-4: Fire core */}
              {explosionPhase >= 1 && explosionPhase < 5 && (
                <Circle cx={60} cy={60} r={explosionPhase >= 3 ? 28 : 16} fill="#FF0000" opacity={explosionPhase >= 4 ? 0.4 : 0.8} />
              )}
              {/* Phase 1-3: Bright center */}
              {explosionPhase >= 1 && explosionPhase < 4 && (
                <Circle cx={60} cy={60} r={10} fill="#FFFF00" opacity={explosionPhase >= 3 ? 0.4 : 0.95} />
              )}
              {/* Phase 2-4: Debris rays */}
              {explosionPhase >= 2 && explosionPhase < 5 && (
                <>
                  {Array.from({ length: 10 }, (_, i) => {
                    const angle = (i * 36) * Math.PI / 180;
                    const len = explosionPhase >= 3 ? 52 : 35;
                    return (
                      <Line
                        key={`ray-${i}`}
                        x1={60 + Math.cos(angle) * 12}
                        y1={60 + Math.sin(angle) * 12}
                        x2={60 + Math.cos(angle) * len}
                        y2={60 + Math.sin(angle) * len}
                        stroke="#FF4400"
                        strokeWidth={2.5}
                        opacity={explosionPhase >= 4 ? 0.2 : 0.65}
                        strokeLinecap="round"
                      />
                    );
                  })}
                </>
              )}
              {/* Phase 3-5: Smoke rings expanding */}
              {explosionPhase >= 3 && (
                <>
                  <Circle cx={60} cy={60} r={explosionPhase >= 5 ? 55 : 40} fill="none" stroke="#555" strokeWidth={explosionPhase >= 5 ? 3 : 5} opacity={explosionPhase >= 5 ? 0.15 : 0.4} />
                  <Circle cx={60} cy={60} r={explosionPhase >= 5 ? 48 : 55} fill="none" stroke="#444" strokeWidth={explosionPhase >= 5 ? 2 : 3} opacity={explosionPhase >= 5 ? 0.1 : 0.25} />
                </>
              )}
              {/* Phase 4-5: Black smoke lingering */}
              {explosionPhase >= 4 && (
                <>
                  <Circle cx={50} cy={45} r={explosionPhase >= 5 ? 20 : 18} fill="#222" opacity={explosionPhase >= 5 ? 0.25 : 0.55} />
                  <Circle cx={70} cy={48} r={explosionPhase >= 5 ? 17 : 15} fill="#333" opacity={explosionPhase >= 5 ? 0.2 : 0.45} />
                  <Circle cx={60} cy={35} r={explosionPhase >= 5 ? 15 : 13} fill="#444" opacity={explosionPhase >= 5 ? 0.15 : 0.35} />
                  <Circle cx={55} cy={55} r={explosionPhase >= 5 ? 12 : 10} fill="#2A2A2A" opacity={explosionPhase >= 5 ? 0.18 : 0.4} />
                </>
              )}
            </Svg>
          </View>
          );
        })()}
      </View>

      {/* Dashboard area (1/3 of screen) */}
      <View style={[styles.dashboardContainer, { height: DASHBOARD_HEIGHT, width: SCREEN_WIDTH }]}>
        <VintageDashboard width={SCREEN_WIDTH} height={DASHBOARD_HEIGHT} soundEnabled={soundEnabled} onToggleSound={setSoundEnabled} overrideFuelLevel={isFlying ? displayFuel : undefined} tutorialHighlight={tutorialHighlight} tutorialBlinkCount={tutorialBlinkCount} />
      </View>

      {/* Critical countdown overlay - s'affiche 2 secondes au milieu de l'écran */}
      {showCriticalPopup && gameStatus === 'playing' && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownBadge}>
            <MaterialCommunityIcons name="alert" size={24} color="#FF0000" />
            <View>
              <Text style={styles.countdownText}>
                PANNE CRITIQUE !
              </Text>
              <Text style={styles.countdownSubtext}>
                Trouvez une réparation !
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Flash message overlay - messages temporaires (douane, etc.) */}
      {flashMessage && (
        <View style={styles.countdownOverlay}>
          <View style={[styles.countdownBadge, { backgroundColor: 'rgba(139, 69, 19, 0.95)', borderColor: '#FFD700', maxWidth: '85%' }]}>
            <MaterialCommunityIcons name="alert-circle" size={24} color="#FFD700" />
            <Text style={[styles.countdownText, { fontSize: 13, flexShrink: 1 }]}>{flashMessage}</Text>
          </View>
        </View>
      )}

      {/* Tutorial message overlay */}
      {/* Bouton Arrêter le tuto — uniquement pendant le TUTO */}
      {tutorialMode && gameStatus === 'playing' && (
        <View style={{ position: 'absolute', top: 50, left: 10, zIndex: 100 }}>
          <Pressable
            onPress={handleMenuFromGame}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 }}
          >
            <Text style={{ color: '#555555', fontSize: 18, marginRight: 4 }}>‹</Text>
            <Text style={{ color: '#555555', fontFamily: 'BigNoodleTitling', fontSize: 14 }}>ARRÊTER LE TUTO</Text>
          </Pressable>
        </View>
      )}

      {tutorialMode && tutorialMessage && (
        <View style={{ position: 'absolute', top: 85, left: 10, right: 10, alignItems: 'center', zIndex: 200 }} pointerEvents="none">
          <View style={[styles.countdownBadge, { backgroundColor: 'rgba(0, 60, 120, 0.92)', borderColor: '#4FC3F7', maxWidth: '90%' }]}>
            <MaterialCommunityIcons name="school" size={22} color="#4FC3F7" />
            <Text style={[styles.countdownText, { fontSize: 13, color: '#FFFFFF', flexShrink: 1 }]}>{tutorialMessage}</Text>
          </View>
        </View>
      )}

      <Modal visible={showIntersectionDamagePopup} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setShowIntersectionDamagePopup(false);
            setIntersectionDamagePopupSeen(true);
          }}
        >
          <View style={styles.modalCard}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => {
                setShowIntersectionDamagePopup(false);
                setIntersectionDamagePopupSeen(true);
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.modalText, { fontSize: 16, color: '#FFFFFF' }]}>
              {t('CROSS_EUROPE_MODAL_DESC')}
            </Text>
          </View>
        </Pressable>
      </Modal>

      {/* Game Over Modal - shows telegraph after explosion */}
      <GameOverModal
        visible={showTelegraph}
        won={gameStatus === 'won'}
        mailCount={mailCount}
        mailTarget={mailTarget}
        currentLevelId={currentLevelId}
        currentLevelName={currentLevelName}
        gibraltarMailCollected={gibraltarMailCollected}
        gameOverReason={gameOverReason}
        freeplayMode={freeplayMode}
        mauritaniaMailCumul={mauritaniaMailCumul}
        newlyCompletedLevel={newlyCompletedLevel}
        onReplayMission={handleReplayMission}
        onNextMission={handleNextMission}
        onMenu={handleMenuFromGame}
      />

      {/* Ad Modal - shows on REJOUER button click */}
      <AdModal
        visible={showAdModal}
          onClose={handleAdModalClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  startScreen: {
    flex: 1,
    backgroundColor: '#1A1208',
  },
  topSection: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  middleSection: {
    flex: 1,
  },
  bottomSection: {
    flex: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  titleContainer: {
    alignItems: 'center',
    zIndex: 1,
    width: '70%',
  },
  titleBar: {
    width: 220,
    height: 2,
    backgroundColor: '#1B4F4A',
    marginVertical: 6,
  },
  title: {
    fontSize: 60,
    fontWeight: '900',
    color: '#1B4F4A',
    letterSpacing: 10,
    fontFamily: 'BigNoodleTitling',
  },
  logoImage: {
    width: 100,
    height: 100,
    marginTop: 8,
    tintColor: '#1B4F4A',
    resizeMode: 'contain',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 20, 10, 0.7)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8B7355',
    zIndex: 1,
    marginTop: 220,
    marginBottom: 12,
    alignSelf: 'center',
    width: 310,
  },
  settingsTopRight: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 20, 10, 0.55)',
    borderWidth: 1.5,
    borderColor: '#8B7355',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  menuButtonsGrid: {
    gap: 12,
    zIndex: 1,
    width: 310,
    alignSelf: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  menuButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  settingsGearButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -22 }, { translateY: -22 }],
    zIndex: 10,
  },
  settingsGearButtonInline: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 115,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 20, 10, 0.7)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8B7355',
    gap: 8,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 2,
    textAlign: 'center',
  },
  mapContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  missionReturnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 20, 10, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8B6914',
    width: 310,
    alignSelf: 'center',
    marginTop: 8,
  },
  missionReturnText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 1,
  },
  crashExplosion: {
    position: 'absolute',
    zIndex: 100,
    width: 120,
    height: 120,
  },
  dashboardContainer: {
    marginTop: -50, // Increased overlap with map
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  countdownBadge: {
    backgroundColor: 'rgba(140, 0, 0, 0.92)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#FF4444',
  },
  countdownText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  countdownSubtext: {
    color: '#FFA0A0',
    fontSize: 11,
    fontFamily: 'BigNoodleTitling',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#081825',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4FC3F7',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'BigNoodleTitling',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalText: {
    color: '#E5E5E5',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'BigNoodleTitling',
  },
  modalBtn: {
    marginTop: 18,
    backgroundColor: '#4FC3F7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  modalBtnText: {
    color: '#031A2B',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
});
