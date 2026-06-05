import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path, Text as SvgText, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LAND_MASKS } from '../src/data/landMasks';
import { useI18n } from '../src/i18n';
import { AdModal } from '../src/components/AdModal';

const translateLocked = (msg: string | null, t: (k: string) => string): string => {
  if (!msg) return '';
  if (msg === 'CROISEMENT INTERDIT') return t('COMP_CROISEMENT_DESC');
  let m = msg.match(/^Limite de (\d+) lignes atteinte\. Distribuez encore (\d+) courriers/);
  if (m) return t('COMP_LINES_MAX_MSG').replace('{n}', m[1]).replace('{r}', m[2]);
  m = msg.match(/^Limite de (\d+) avions CARGO/);
  if (m) return t('COMP_CARGO_MAX_MSG').replace('{n}', m[1]);
  m = msg.match(/^Limite de (\d+) HUB atteinte/);
  if (m) return t('COMP_HUB_MAX_MSG').replace('{n}', m[1]);
  m = msg.match(/^Limite de (\d+) aéroports/);
  if (m) return t('COMP_INTL_MAX_MSG').replace('{n}', m[1]);
  if (msg.startsWith('Cette destination est déjà reliée')) return t('COMP_DEST_LOCKED_MSG');
  return msg;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// === CONSTANTS ===
const PLANE_SPEED = 75;
const MAIL_INTERVAL_MIN = 2000;
const MAIL_INTERVAL_MAX = 3000;
const NEW_DEST_INTERVAL = 10000;
const PLANE_CAPACITY = 10;
const CARGO_CAPACITY = 20;
const PLANE_PICKUP_PER_STOP = 5;
const CARGO_PICKUP_PER_STOP = 10;
const COST_NEW_LINE = 10000;
const COST_EXTEND = 1000;
const COST_CARGO = 20000;
const COST_HUB = 5000;
const COST_INTL = 50000;
const STARTING_MILES = 15000;
const CITY_LIMIT = 20;
const HUB_LIMIT = 100;
const CARGO_UNLOCK_DELIVERED = 200;
const HUB_UNLOCK_DELIVERED = 100;
const INTL_UNLOCK_COLLECTED = 800;
const COLLISION_DISTANCE = 22;
const LINE_COLORS = ['#C44536', '#3A6B7E', '#D49A26', '#5C8D3F', '#8E5BA5', '#C46B96', '#4A7A4A'];

const MAX_CARGO_GLOBAL = 10;
const MAX_HUB_GLOBAL = 10;
const MAX_INTL_GLOBAL = 10;

// === MAP TYPES ===
type MapKey = 'atlante' | 'pacifikair' | 'airindiana' | 'antartikair';
const MAPS: MapKey[] = ['atlante', 'pacifikair', 'airindiana', 'antartikair'];

const MAP_MASK_KEY: Record<MapKey, string> = {
  atlante: 'compagnie',
  pacifikair: 'pacifikair',
  airindiana: 'airindiana',
  antartikair: 'antartikair',
};

const MAP_IMAGES: Record<MapKey, any> = {
  atlante: require('../assets/images/compagnie-map.png'),
  pacifikair: require('../assets/images/pacifikair-map.png'),
  airindiana: require('../assets/images/airindiana-map.png'),
  antartikair: require('../assets/images/antartikair-map.png'),
};

const MAP_LABELS: Record<MapKey, string> = {
  atlante: 'AIR ATLANTE',
  pacifikair: 'PACIFIKAIR',
  airindiana: 'AIR INDIANA',
  antartikair: 'ANTARTIKAIR',
};

// Navigation: for each map, which arrow leads to which map
// Matches user's requirement:
// ATLANTE: L -> pacifikair, R -> airindiana, B -> antartikair
// PACIFIKAIR: L -> airindiana, R -> atlante, B -> antartikair
// AIRINDIANA: L -> atlante, R -> pacifikair, B -> antartikair
// ANTARTIKAIR: T -> previous map
const NAV_ARROWS: Record<MapKey, { left?: MapKey; right?: MapKey; bottom?: MapKey; top?: MapKey }> = {
  atlante: { left: 'pacifikair', right: 'airindiana', bottom: 'antartikair' },
  pacifikair: { left: 'airindiana', right: 'atlante', bottom: 'antartikair' },
  airindiana: { left: 'atlante', right: 'pacifikair', bottom: 'antartikair' },
  antartikair: {}, // top returns to previous map (dynamic)
};

// === TYPES ===
interface Destination {
  id: string;
  x: number;
  y: number;
  mails: number;
  isHub?: boolean;
  isInternational?: boolean;
  mapKey: MapKey;
}

interface Line {
  id: string;
  destIds: string[];
  color: string;
  isInternational?: boolean;
  // For inter-map intl lines, crossMap=true and destIds are on different maps
  crossMap?: boolean;
}

interface PlaneState {
  id: string;
  lineId: string;
  segIndex: number;
  dir: 1 | -1;
  progress: number;
  mails: number;
  loadingTimer: number;
  isCargo?: boolean;
}

interface MapState {
  destinations: Destination[];
  lines: Line[];
  planes: PlaneState[];
  lastDestSpawn: number;
}

// === HELPERS ===
const isOnLand = (mapKey: MapKey, x_norm: number, y_norm: number): boolean => {
  const mask = LAND_MASKS[MAP_MASK_KEY[mapKey]];
  if (!mask) return false;
  const r = Math.floor(y_norm * mask.length);
  const c = Math.floor(x_norm * mask[0].length);
  if (r < 0 || r >= mask.length || c < 0 || c >= mask[0].length) return false;
  return mask[r][c] === '1';
};

const isCoastal = (mapKey: MapKey, x_norm: number, y_norm: number): boolean => {
  if (isOnLand(mapKey, x_norm, y_norm)) return false;
  const mask = LAND_MASKS[MAP_MASK_KEY[mapKey]];
  if (!mask) return false;
  const r = Math.floor(y_norm * mask.length);
  const c = Math.floor(x_norm * mask[0].length);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < mask.length && nc >= 0 && nc < mask[0].length) {
        if (mask[nr][nc] === '1') return true;
      }
    }
  }
  return false;
};

const generateCoastalDestination = (mapKey: MapKey, existing: Destination[], imgRect: {x:number,y:number,w:number,h:number}, screenH: number, screenW: number): Destination | null => {
  const MARGIN = 0.07;
  const minScreenX = MARGIN * screenW;
  const maxScreenX = (1 - MARGIN) * screenW;
  const minScreenY = MARGIN * screenH;
  const maxScreenY = (1 - MARGIN) * screenH;
  for (let attempt = 0; attempt < 300; attempt++) {
    const x_norm = 0.02 + Math.random() * 0.96;
    const y_norm = 0.02 + Math.random() * 0.96;
    if (!isCoastal(mapKey, x_norm, y_norm)) continue;
    const px = imgRect.x + x_norm * imgRect.w;
    const py = imgRect.y + y_norm * imgRect.h;
    if (px < minScreenX || px > maxScreenX) continue;
    if (py < minScreenY || py > maxScreenY) continue;
    let tooClose = false;
    for (const d of existing) {
      const dx = d.x - px;
      const dy = d.y - py;
      if (Math.sqrt(dx * dx + dy * dy) < 60) { tooClose = true; break; }
    }
    if (tooClose) continue;
    return { id: `dest_${mapKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, x: px, y: py, mails: 0, mapKey };
  }
  return null;
};

const curvePath = (x1: number, y1: number, x2: number, y2: number, dir: number = 1) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const offset = len * 0.15 * dir;
  const cx = mx - (dy / len) * offset;
  const cy = my + (dx / len) * offset;
  return { path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, cx, cy };
};

const pointOnCurve = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) => {
  const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  const tx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
  const ty = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
  const angle = Math.atan2(ty, tx) * 180 / Math.PI;
  return { x, y, angle };
};

const computeLineLength = (line: Line, dests: Destination[]): number => {
  let total = 0;
  for (let i = 0; i < line.destIds.length - 1; i++) {
    const a = dests.find(d => d.id === line.destIds[i]);
    const b = dests.find(d => d.id === line.destIds[i + 1]);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    total += Math.sqrt(dx*dx + dy*dy);
  }
  return total;
};

const segmentsIntersect = (a1: {x:number,y:number}, a2: {x:number,y:number}, b1: {x:number,y:number}, b2: {x:number,y:number}) => {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 0.0001) return false;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
};

// Check only same-map line crossings (inter-map lines don't cross anything visually)
const segmentCrossesAnyLine = (
  fromId: string,
  toId: string,
  existingLines: Line[],
  dests: Destination[],
  mapKey: MapKey,
): boolean => {
  const from = dests.find(d => d.id === fromId);
  const to = dests.find(d => d.id === toId);
  if (!from || !to) return false;
  if (from.mapKey !== mapKey || to.mapKey !== mapKey) return false;
  for (const line of existingLines) {
    if (line.crossMap) continue;
    for (let i = 0; i < line.destIds.length - 1; i++) {
      const segFromId = line.destIds[i];
      const segToId = line.destIds[i + 1];
      if (segFromId === fromId || segFromId === toId || segToId === fromId || segToId === toId) continue;
      const a = dests.find(d => d.id === segFromId);
      const b = dests.find(d => d.id === segToId);
      if (!a || !b) continue;
      if (a.mapKey !== mapKey || b.mapKey !== mapKey) continue;
      if (segmentsIntersect(from, to, a, b)) return true;
    }
  }
  return false;
};

// === COMPONENT ===
export default function WorldwideScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const topOffset = insets.top;
  const [mapW, setMapW] = useState(SCREEN_W);
  const [mapH, setMapH] = useState(SCREEN_H);

  // Per-map state
  const [mapsData, setMapsData] = useState<Record<MapKey, MapState>>({
    atlante: { destinations: [], lines: [], planes: [], lastDestSpawn: Date.now() },
    pacifikair: { destinations: [], lines: [], planes: [], lastDestSpawn: Date.now() },
    airindiana: { destinations: [], lines: [], planes: [], lastDestSpawn: Date.now() },
    antartikair: { destinations: [], lines: [], planes: [], lastDestSpawn: Date.now() },
  });

  // Global state
  const [currentMap, setCurrentMap] = useState<MapKey>('atlante');
  const [visitedMaps, setVisitedMaps] = useState<Set<MapKey>>(new Set(['atlante']));
  const [previousMap, setPreviousMap] = useState<MapKey>('atlante'); // for antartikair "back" arrow

  const [miles, setMiles] = useState(STARTING_MILES);
  const [delivered, setDelivered] = useState(0);
  const [collected, setCollected] = useState(0);
  const [cargoUnlocked, setCargoUnlocked] = useState(false);
  const [hubUnlocked, setHubUnlocked] = useState(false);
  const [showCargoUnlockPopup, setShowCargoUnlockPopup] = useState(false);
  const [showHubUnlockPopup, setShowHubUnlockPopup] = useState(false);
  const [collisionPopup, setCollisionPopup] = useState<string | null>(null);
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<null | 'lost'>(null);
  const [showInsufficientMiles, setShowInsufficientMiles] = useState(false);
  const [lockedDestMsg, setLockedDestMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [uiMode, setUiMode] = useState<'idle' | 'creating_line' | 'extending_pick_line' | 'extending_pick_endpoint' | 'extending_pick_dest' | 'cargo_pick_line' | 'hub_pick_dest' | 'intl_pick_dest' | 'intl_creating_line_to'>('idle');
  const [extendLineId, setExtendLineId] = useState<string | null>(null);
  const [extendEndpointId, setExtendEndpointId] = useState<string | null>(null);
  const [blinkTick, setBlinkTick] = useState(true);
  const [showAdModal, setShowAdModal] = useState(false);

  const lastTickTime = useRef(Date.now());
  const mailNextTimes = useRef<Map<string, number>>(new Map());
  const colorIndex = useRef(0);
  const initRef = useRef(false);

  // === Image layout calculation ===
  const IMG_ASPECT = 1024 / 1536;
  const containerAspect = mapW > 0 ? mapW / mapH : 1;
  let imgRect = { x: 0, y: 0, w: mapW, h: mapH };
  if (containerAspect > IMG_ASPECT) {
    const imgW = mapH * IMG_ASPECT;
    imgRect = { x: (mapW - imgW) / 2, y: 0, w: imgW, h: mapH };
  } else {
    const imgH = mapW / IMG_ASPECT;
    imgRect = { x: 0, y: (mapH - imgH) / 2, w: mapW, h: imgH };
  }

  // Helpers to access current map data
  const cur = mapsData[currentMap];
  const allDestinations = (): Destination[] => {
    return [
      ...mapsData.atlante.destinations,
      ...mapsData.pacifikair.destinations,
      ...mapsData.airindiana.destinations,
      ...mapsData.antartikair.destinations,
    ];
  };
  const allLines = (): Line[] => {
    return [
      ...mapsData.atlante.lines,
      ...mapsData.pacifikair.lines,
      ...mapsData.airindiana.lines,
      ...mapsData.antartikair.lines,
    ];
  };

  const updateMap = (mapKey: MapKey, updater: (ms: MapState) => MapState) => {
    setMapsData(prev => ({ ...prev, [mapKey]: updater(prev[mapKey]) }));
  };

  // === INIT: 2 starting destinations on atlante ===
  useEffect(() => {
    if (initRef.current) return;
    if (mapW === 0 || mapH === 0) return;
    initRef.current = true;
    const initial: Destination[] = [];
    for (let i = 0; i < 2; i++) {
      const d = generateCoastalDestination('atlante', initial, imgRect, mapH, mapW);
      if (d) initial.push(d);
    }
    setMapsData(prev => ({
      ...prev,
      atlante: { ...prev.atlante, destinations: initial, lastDestSpawn: Date.now() },
    }));
    initial.forEach(d => {
      mailNextTimes.current.set(d.id, Date.now() + MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN));
    });
    lastTickTime.current = Date.now();
  }, [mapW, mapH]);

  // === Spawn initial destinations when visiting a new map ===
  const handleNavigate = (target: MapKey) => {
    setPreviousMap(currentMap);
    setCurrentMap(target);
    cancelMode();
    if (!visitedMaps.has(target)) {
      setVisitedMaps(prev => new Set([...prev, target]));
      // Spawn 2 initial destinations on the newly visited map
      setMapsData(prev => {
        const initial: Destination[] = [];
        for (let i = 0; i < 2; i++) {
          const d = generateCoastalDestination(target, initial, imgRect, mapH, mapW);
          if (d) initial.push(d);
        }
        initial.forEach(d => {
          mailNextTimes.current.set(d.id, Date.now() + MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN));
        });
        return { ...prev, [target]: { ...prev[target], destinations: initial, lastDestSpawn: Date.now() } };
      });
    }
  };

  // === GAME LOOP ===
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTickTime.current) / 1000;
      lastTickTime.current = now;

      const productionBoost = collected >= 1000 ? 0.7 : 1.0;

      // Update state across ALL visited maps
      setMapsData(prev => {
        const next: Record<MapKey, MapState> = { ...prev };
        let lostFlag = false;
        let totalDelivered = 0;
        let totalCollected = 0;
        let totalMilesAdded = 0;

        for (const mk of MAPS) {
          if (!visitedMaps.has(mk)) continue;
          const ms = prev[mk];
          let { destinations, lines, planes, lastDestSpawn } = ms;

          // Spawn new destination
          if (now - lastDestSpawn >= NEW_DEST_INTERVAL) {
            const newDest = generateCoastalDestination(mk, destinations, imgRect, mapH, mapW);
            if (newDest) {
              mailNextTimes.current.set(newDest.id, Date.now() + MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN));
              destinations = [...destinations, newDest];
            }
            lastDestSpawn = now;
          }

          // Accumulate mails
          let destsChanged = false;
          destinations = destinations.map(d => {
            const nextTime = mailNextTimes.current.get(d.id) ?? 0;
            if (now >= nextTime) {
              const interval = (MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN)) * productionBoost;
              mailNextTimes.current.set(d.id, now + interval);
              const newMails = d.mails + 1;
              const limit = d.isHub ? HUB_LIMIT : CITY_LIMIT;
              destsChanged = true;
              if (newMails >= limit) lostFlag = true;
              return { ...d, mails: newMails };
            }
            return d;
          });

          // Move planes (only for intra-map lines for now - cross-map handled separately)
          if (planes.length > 0) {
            const allDests = [
              ...prev.atlante.destinations,
              ...prev.pacifikair.destinations,
              ...prev.airindiana.destinations,
              ...prev.antartikair.destinations,
            ];
            const destSnapshot = destinations.length !== prev[mk].destinations.length || destsChanged ? destinations : prev[mk].destinations;
            // merged dests for intl planes that cross
            const effectiveDests = [...allDests.filter(d => d.mapKey !== mk), ...destSnapshot];
            const newDestUpdates = new Map<string, { mailsDelta: number; loaded: number }>();
            planes = planes.map(p => {
              const line = lines.find(l => l.id === p.lineId) || allLinesFromState(prev).find(l => l.id === p.lineId);
              if (!line || line.destIds.length < 2) return p;
              if (p.loadingTimer > 0) {
                return { ...p, loadingTimer: Math.max(0, p.loadingTimer - dt * 1000) };
              }
              const fromId = line.destIds[p.segIndex];
              const toId = line.destIds[p.segIndex + p.dir];
              if (!toId) return { ...p, dir: -p.dir as 1 | -1 };
              const from = effectiveDests.find(d => d.id === fromId);
              const to = effectiveDests.find(d => d.id === toId);
              if (!from || !to) return p;
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              // For cross-map lines, use approximate virtual distance (constant transit)
              const segLen = line.crossMap ? 600 : Math.sqrt(dx * dx + dy * dy);
              const moveDist = PLANE_SPEED * dt;
              const newProg = p.progress + (moveDist / segLen);
              totalMilesAdded += moveDist * 5;

              if (newProg >= 1) {
                const arriveDestId = toId;
                const arriveDest = effectiveDests.find(d => d.id === arriveDestId);
                let deliveredHere = 0;
                let pickedUp = 0;
                const capacity = p.isCargo ? CARGO_CAPACITY : PLANE_CAPACITY;
                const perStopLimit = p.isCargo ? CARGO_PICKUP_PER_STOP : PLANE_PICKUP_PER_STOP;
                if (arriveDest) {
                  deliveredHere = p.mails;
                  const alreadyTaken = newDestUpdates.get(arriveDestId)?.loaded || 0;
                  const availableNow = Math.max(0, arriveDest.mails - alreadyTaken);
                  pickedUp = Math.min(availableNow, perStopLimit, capacity);
                }
                totalDelivered += deliveredHere;
                totalCollected += pickedUp;
                const prevDelta = newDestUpdates.get(arriveDestId) || { mailsDelta: 0, loaded: 0 };
                newDestUpdates.set(arriveDestId, { mailsDelta: prevDelta.mailsDelta - pickedUp, loaded: prevDelta.loaded + pickedUp });

                let newSegIndex = p.segIndex + p.dir;
                let newDir = p.dir;
                if (newSegIndex + p.dir < 0 || newSegIndex + p.dir >= line.destIds.length) {
                  newDir = -p.dir as 1 | -1;
                }
                return {
                  ...p,
                  segIndex: newSegIndex,
                  dir: newDir,
                  progress: 0,
                  mails: pickedUp,
                  loadingTimer: 400,
                };
              }
              return { ...p, progress: newProg };
            });

            // Apply dest updates to CURRENT map only (cross-map destUpdates applied via global sweep below)
            if (newDestUpdates.size > 0) {
              destinations = destinations.map(d => {
                const u = newDestUpdates.get(d.id);
                return u ? { ...d, mails: Math.max(0, d.mails + u.mailsDelta) } : d;
              });
              // Cross-map dest updates: apply to destination's real map
              newDestUpdates.forEach((u, destId) => {
                const realDest = allDests.find(d => d.id === destId);
                if (realDest && realDest.mapKey !== mk) {
                  const rmk = realDest.mapKey;
                  next[rmk] = {
                    ...next[rmk],
                    destinations: next[rmk].destinations.map(d =>
                      d.id === destId ? { ...d, mails: Math.max(0, d.mails + u.mailsDelta) } : d
                    ),
                  };
                }
              });
            }
          }

          next[mk] = { ...ms, destinations, lines, planes, lastDestSpawn };
        }

        if (lostFlag) setGameOver('lost');
        if (totalDelivered > 0) setDelivered(d => d + totalDelivered);
        if (totalCollected > 0) setCollected(c => c + totalCollected);
        if (totalMilesAdded > 0) setMiles(m => m + Math.round(totalMilesAdded));

        return next;
      });

      setTick(x => (x + 1) % 1000);
    }, 50);
    return () => clearInterval(id);
  }, [gameOver, mapW, mapH, visitedMaps, collected]);

  // Helper used inside setMapsData reducer
  function allLinesFromState(state: Record<MapKey, MapState>): Line[] {
    return [
      ...state.atlante.lines,
      ...state.pacifikair.lines,
      ...state.airindiana.lines,
      ...state.antartikair.lines,
    ];
  }

  // Blink
  useEffect(() => {
    if (uiMode !== 'extending_pick_endpoint') return;
    const id = setInterval(() => setBlinkTick(b => !b), 400);
    return () => clearInterval(id);
  }, [uiMode]);

  // Unlock CARGO
  useEffect(() => {
    if (!cargoUnlocked && delivered >= CARGO_UNLOCK_DELIVERED) {
      setCargoUnlocked(true);
      setShowCargoUnlockPopup(true);
    }
  }, [delivered, cargoUnlocked]);

  // Unlock HUB
  useEffect(() => {
    if (!hubUnlocked && delivered >= HUB_UNLOCK_DELIVERED) {
      setHubUnlocked(true);
      setShowHubUnlockPopup(true);
    }
  }, [delivered, hubUnlocked]);

  // Save best score
  useEffect(() => {
    if (delivered <= 0) return;
    (async () => {
      try {
        const prev = await AsyncStorage.getItem('best_worldwide');
        const best = prev ? parseInt(prev, 10) : 0;
        if (delivered > best) {
          await AsyncStorage.setItem('best_worldwide', String(delivered));
        }
      } catch (e) { /* ignore */ }
    })();
  }, [delivered]);

  // Aggregate counts (global)
  const totalCargo = (['atlante','pacifikair','airindiana','antartikair'] as MapKey[])
    .reduce((s, k) => s + mapsData[k].planes.filter(p => p.isCargo).length, 0);
  const totalHubs = (['atlante','pacifikair','airindiana','antartikair'] as MapKey[])
    .reduce((s, k) => s + mapsData[k].destinations.filter(d => d.isHub && !d.isInternational).length, 0);
  const totalIntl = (['atlante','pacifikair','airindiana','antartikair'] as MapKey[])
    .reduce((s, k) => s + mapsData[k].destinations.filter(d => d.isInternational).length, 0);
  const intlUnlocked = collected >= INTL_UNLOCK_COLLECTED;
  const maxLines = 4 + Math.floor(delivered / 300);
  const totalLines = allLines().length;

  // === BUTTON HANDLERS ===
  const handleCreateLineBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (totalLines >= maxLines) {
      setLockedDestMsg(`Limite de ${maxLines} lignes atteinte. Distribuez encore ${300 - (delivered % 300)} courriers pour débloquer une ligne supplémentaire.`);
      return;
    }
    if (miles < COST_NEW_LINE) { setShowInsufficientMiles(true); return; }
    setUiMode('creating_line');
    setSelectedDestId(null);
  };

  const handleExtendLineBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (miles < COST_EXTEND) { setShowInsufficientMiles(true); return; }
    if (cur.lines.length === 0) return;
    setUiMode('extending_pick_line');
  };

  const handleCargoBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (totalCargo >= MAX_CARGO_GLOBAL) {
      setLockedDestMsg(`Limite de ${MAX_CARGO_GLOBAL} avions CARGO atteinte.`);
      return;
    }
    if (miles < COST_CARGO) { setShowInsufficientMiles(true); return; }
    if (cur.lines.length === 0) return;
    setUiMode('cargo_pick_line');
  };

  const handleHubBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (totalHubs >= MAX_HUB_GLOBAL) {
      setLockedDestMsg(`Limite de ${MAX_HUB_GLOBAL} HUB atteinte.`);
      return;
    }
    if (miles < COST_HUB) { setShowInsufficientMiles(true); return; }
    setUiMode('hub_pick_dest');
  };

  const handleIntlAirportBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (totalIntl >= MAX_INTL_GLOBAL) {
      setLockedDestMsg(`Limite de ${MAX_INTL_GLOBAL} aéroports internationaux atteinte.`);
      return;
    }
    if (miles < COST_INTL) { setShowInsufficientMiles(true); return; }
    setUiMode('intl_pick_dest');
  };

  const cancelMode = () => {
    setUiMode('idle');
    setSelectedDestId(null);
    setExtendLineId(null);
    setExtendEndpointId(null);
  };

  // === Destination tap handler ===
  const isDestOnAnyLine = (destId: string): boolean => {
    return allLines().some(l => l.destIds.includes(destId));
  };
  const isDestLocked = (destId: string): boolean => {
    const d = allDestinations().find(x => x.id === destId);
    if (!d) return false;
    if (d.isHub) return false;
    return isDestOnAnyLine(destId);
  };

  const handleDestTap = (destId: string) => {
    if (gameOver) return;
    const tappedDest = allDestinations().find(d => d.id === destId);
    if (!tappedDest) return;

    if (uiMode === 'creating_line') {
      if (tappedDest.mapKey !== currentMap) return; // cannot pick dest on another map
      if (isDestLocked(destId)) {
        setLockedDestMsg('Cette destination est déjà reliée à une ligne. Transformez-la en HUB pour la relier à plusieurs lignes.');
        return;
      }
      if (!selectedDestId) { setSelectedDestId(destId); return; }
      if (selectedDestId === destId) { setSelectedDestId(null); return; }
      const fromId = selectedDestId;
      const toId = destId;
      if (segmentCrossesAnyLine(fromId, toId, allLines(), allDestinations(), currentMap)) {
        setLockedDestMsg('CROISEMENT INTERDIT');
        return;
      }
      if (miles < COST_NEW_LINE) { setShowInsufficientMiles(true); cancelMode(); return; }
      const color = LINE_COLORS[colorIndex.current % LINE_COLORS.length];
      colorIndex.current++;
      const lineId = `line_${currentMap}_${Date.now()}`;
      setMiles(m => m - COST_NEW_LINE);
      updateMap(currentMap, ms => ({
        ...ms,
        lines: [...ms.lines, { id: lineId, destIds: [fromId, toId], color }],
        planes: [...ms.planes, {
          id: `plane_${lineId}`,
          lineId,
          segIndex: 0,
          dir: 1,
          progress: 0,
          mails: 0,
          loadingTimer: 0,
        }],
      }));
      cancelMode();
      return;
    }

    if (uiMode === 'extending_pick_dest') {
      if (!extendLineId) return;
      if (tappedDest.mapKey !== currentMap) return;
      const line = cur.lines.find(l => l.id === extendLineId);
      if (!line) return;
      if (line.destIds.includes(destId)) return;
      if (isDestLocked(destId)) {
        setLockedDestMsg('Cette destination est déjà reliée à une ligne. Transformez-la en HUB pour la relier à plusieurs lignes.');
        return;
      }
      const targetDest = tappedDest;

      type Cand = { id: string; pos: 'start' | 'end' | 'hub'; dist: number };
      const candidates: Cand[] = [];
      const startId = line.destIds[0];
      const endId = line.destIds[line.destIds.length - 1];
      const startD = cur.destinations.find(d => d.id === startId);
      const endD = cur.destinations.find(d => d.id === endId);
      if (startD) candidates.push({ id: startId, pos: 'start', dist: Math.hypot(startD.x - targetDest.x, startD.y - targetDest.y) });
      if (endD) candidates.push({ id: endId, pos: 'end', dist: Math.hypot(endD.x - targetDest.x, endD.y - targetDest.y) });
      for (let i = 1; i < line.destIds.length - 1; i++) {
        const dId = line.destIds[i];
        const dst = cur.destinations.find(d => d.id === dId);
        if (dst && dst.isHub) {
          candidates.push({ id: dId, pos: 'hub', dist: Math.hypot(dst.x - targetDest.x, dst.y - targetDest.y) });
        }
      }
      candidates.sort((a, b) => a.dist - b.dist);

      let chosen: Cand | null = null;
      for (const cand of candidates) {
        if (!segmentCrossesAnyLine(cand.id, destId, allLines(), allDestinations(), currentMap)) {
          chosen = cand;
          break;
        }
      }
      if (!chosen) { setLockedDestMsg('CROISEMENT INTERDIT'); return; }
      if (miles < COST_EXTEND) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_EXTEND);

      if (chosen.pos === 'start') {
        updateMap(currentMap, ms => ({
          ...ms,
          lines: ms.lines.map(l => l.id === extendLineId ? { ...l, destIds: [destId, ...l.destIds] } : l),
        }));
      } else if (chosen.pos === 'end') {
        updateMap(currentMap, ms => ({
          ...ms,
          lines: ms.lines.map(l => l.id === extendLineId ? { ...l, destIds: [...l.destIds, destId] } : l),
        }));
      } else {
        const color = LINE_COLORS[colorIndex.current % LINE_COLORS.length];
        colorIndex.current++;
        const newLineId = `line_${currentMap}_${Date.now()}`;
        updateMap(currentMap, ms => ({
          ...ms,
          lines: [...ms.lines, { id: newLineId, destIds: [chosen!.id, destId], color }],
          planes: [...ms.planes, {
            id: `plane_${newLineId}`,
            lineId: newLineId,
            segIndex: 0,
            dir: 1,
            progress: 0,
            mails: 0,
            loadingTimer: 0,
          }],
        }));
      }
      cancelMode();
      return;
    }

    if (uiMode === 'hub_pick_dest') {
      if (tappedDest.mapKey !== currentMap) return;
      if (tappedDest.isHub) return;
      if (miles < COST_HUB) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_HUB);
      updateMap(currentMap, ms => ({
        ...ms,
        destinations: ms.destinations.map(d => d.id === destId ? { ...d, isHub: true } : d),
      }));
      cancelMode();
      return;
    }

    if (uiMode === 'intl_pick_dest') {
      if (tappedDest.mapKey !== currentMap) return;
      if (tappedDest.isInternational) return;
      if (miles < COST_INTL) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_INTL);
      updateMap(currentMap, ms => ({
        ...ms,
        destinations: ms.destinations.map(d => d.id === destId ? { ...d, isHub: true, isInternational: true } : d),
      }));
      setSelectedDestId(destId);
      setUiMode('intl_creating_line_to');
      return;
    }

    if (uiMode === 'intl_creating_line_to') {
      if (!selectedDestId) { cancelMode(); return; }
      if (destId === selectedDestId) { setSelectedDestId(null); setUiMode('idle'); return; }
      const fromD = allDestinations().find(d => d.id === selectedDestId);
      const toD = allDestinations().find(d => d.id === destId);
      if (!fromD || !toD) { cancelMode(); return; }
      if (miles < COST_EXTEND) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_EXTEND);
      const color = LINE_COLORS[colorIndex.current % LINE_COLORS.length];
      colorIndex.current++;
      const newLineId = `line_intl_${Date.now()}`;
      const isCross = fromD.mapKey !== toD.mapKey;
      // The 'to' destination may need to be upgraded to INTL too (if cross-map and not already)
      if (isCross && !toD.isInternational) {
        updateMap(toD.mapKey, ms => ({
          ...ms,
          destinations: ms.destinations.map(d => d.id === toD.id ? { ...d, isHub: true, isInternational: true } : d),
        }));
      }
      // Store the line on the 'from' map (source)
      updateMap(fromD.mapKey, ms => ({
        ...ms,
        lines: [...ms.lines, {
          id: newLineId,
          destIds: [selectedDestId, destId],
          color,
          isInternational: true,
          crossMap: isCross,
        }],
        planes: [...ms.planes, {
          id: `plane_${newLineId}`,
          lineId: newLineId,
          segIndex: 0,
          dir: 1,
          progress: 0,
          mails: 0,
          loadingTimer: 0,
          isCargo: true,
        }],
      }));
      cancelMode();
      return;
    }
  };

  const handleLineTap = (lineId: string) => {
    if (gameOver) return;
    if (uiMode === 'extending_pick_line') {
      setExtendLineId(lineId);
      setUiMode('extending_pick_dest');
      return;
    }
    if (uiMode === 'cargo_pick_line') {
      if (miles < COST_CARGO) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_CARGO);
      updateMap(currentMap, ms => ({
        ...ms,
        planes: [...ms.planes, {
          id: `cargo_${lineId}_${Date.now()}`,
          lineId,
          segIndex: 0,
          dir: 1,
          progress: 0,
          mails: 0,
          loadingTimer: 0,
          isCargo: true,
        }],
      }));
      cancelMode();
      return;
    }
  };

  // === RENDER ===
  const onLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setMapW(width);
    setMapH(height);
  };

  const nav = NAV_ARROWS[currentMap];
  const showBackArrow = currentMap === 'antartikair';

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Map background */}
      {mapW > 0 && mapH > 0 && (
        <View style={{ position: 'absolute', left: imgRect.x, top: imgRect.y, width: imgRect.w, height: imgRect.h, overflow: 'hidden' }}>
          <Image
            source={MAP_IMAGES[currentMap]}
            style={{ width: imgRect.w, height: imgRect.h }}
          />
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

      {/* SVG layer */}
      <Svg width={mapW} height={mapH} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 5 }]}>
        {/* Lines on current map */}
        {cur.lines.map((line) => {
          if (line.crossMap) return null; // cross-map lines not rendered as curves
          const segments = [];
          for (let i = 0; i < line.destIds.length - 1; i++) {
            const a = cur.destinations.find(d => d.id === line.destIds[i]);
            const b = cur.destinations.find(d => d.id === line.destIds[i + 1]);
            if (!a || !b) continue;
            const { path } = curvePath(a.x, a.y, b.x, b.y, 1);
            const isHighlighted = uiMode === 'extending_pick_line';
            const isIntl = !!line.isInternational;
            segments.push(
              <Path
                key={`${line.id}_seg_${i}`}
                d={path}
                stroke={isIntl ? '#FFD700' : line.color}
                strokeWidth={isIntl ? 6 : (isHighlighted ? 6 : 3)}
                fill="none"
                opacity={isHighlighted ? 1 : 0.9}
              />
            );
          }
          return <G key={line.id}>{segments}</G>;
        })}

        {/* Planes on current map (intra only visualized) */}
        {cur.planes.map((p) => {
          const line = cur.lines.find(l => l.id === p.lineId);
          if (!line) return null;
          if (line.crossMap) return null; // invisible transit for MVP
          const fromId = line.destIds[p.segIndex];
          const toIdx = p.segIndex + p.dir;
          if (toIdx < 0 || toIdx >= line.destIds.length) return null;
          const toId = line.destIds[toIdx];
          const a = cur.destinations.find(d => d.id === fromId);
          const b = cur.destinations.find(d => d.id === toId);
          if (!a || !b) return null;
          const { cx, cy } = curvePath(a.x, a.y, b.x, b.y, 1);
          const pos = pointOnCurve(a.x, a.y, cx, cy, b.x, b.y, p.progress);
          return (
            <G key={p.id} transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.angle + 90})`}>
              {p.isCargo ? (
                <Path d="M -6 -10 L 6 -10 L 7 8 L -7 8 Z" fill="#D49A26" stroke="#000" strokeWidth={1} />
              ) : (
                <Path d="M 0 -8 L 4 6 L 0 4 L -4 6 Z" fill="#1A1A1A" stroke="#000" strokeWidth={0.5} />
              )}
            </G>
          );
        })}

        {/* Destinations on current map */}
        {cur.destinations.map(d => {
          const isSelected = selectedDestId === d.id;
          const limit = d.isHub ? HUB_LIMIT : CITY_LIMIT;
          const ratio = d.mails / limit;
          const ringColor = ratio >= 0.8 ? '#C44536' : ratio >= 0.5 ? '#D49A26' : '#3A6B7E';
          let isEndpointBlink = false;
          if (uiMode === 'extending_pick_endpoint' && extendLineId) {
            const line = cur.lines.find(l => l.id === extendLineId);
            if (line) {
              const endpoints = [line.destIds[0], line.destIds[line.destIds.length - 1]];
              if (endpoints.includes(d.id)) isEndpointBlink = true;
            }
          }
          const baseRadius = d.isHub ? 22 : 16;
          const radius = isSelected || isEndpointBlink ? baseRadius + 4 : baseRadius;
          const shouldHide = isEndpointBlink && !blinkTick;
          if (shouldHide) return null;
          const finalRing = isEndpointBlink ? '#FFD700' : (isSelected ? '#FFD700' : (d.isInternational ? '#FFD700' : (d.isHub ? '#5C8D3F' : ringColor)));
          const fillColor = d.isInternational ? '#FFF3B8' : (d.isHub ? '#E8DCB8' : '#F0E1BE');
          return (
            <G key={d.id}>
              {d.isInternational && (
                <Circle cx={d.x} cy={d.y} r={radius + 6} fill="none" stroke="#FFD700" strokeWidth={2} opacity={0.7} />
              )}
              {d.isHub && !d.isInternational && (
                <Circle cx={d.x} cy={d.y} r={radius + 4} fill="none" stroke="#5C8D3F" strokeWidth={2} opacity={0.6} />
              )}
              <Circle cx={d.x} cy={d.y} r={radius} fill={fillColor} stroke={finalRing} strokeWidth={isEndpointBlink || isSelected ? 4 : 3} />
              <SvgText
                x={d.x}
                y={d.y + 5}
                fontSize={d.isHub ? 17 : 15}
                fontWeight="bold"
                fill="#1A1A1A"
                textAnchor="middle"
              >
                {d.mails}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Touch zones for lines */}
      {(uiMode === 'extending_pick_line' || uiMode === 'cargo_pick_line') && cur.lines.map((line) => {
        if (line.crossMap) return null;
        const segments = [];
        for (let i = 0; i < line.destIds.length - 1; i++) {
          const a = cur.destinations.find(d => d.id === line.destIds[i]);
          const b = cur.destinations.find(d => d.id === line.destIds[i + 1]);
          if (!a || !b) continue;
          const { cx, cy } = curvePath(a.x, a.y, b.x, b.y, 1);
          for (let s = 1; s <= 5; s++) {
            const tt = s / 6;
            const pos = pointOnCurve(a.x, a.y, cx, cy, b.x, b.y, tt);
            segments.push(
              <Pressable
                key={`linetouch_${line.id}_${i}_${s}`}
                style={{ position: 'absolute', left: pos.x - 22, top: pos.y - 22, width: 44, height: 44, zIndex: 8 }}
                onPress={() => handleLineTap(line.id)}
              />
            );
          }
        }
        return segments;
      })}

      {/* Touch overlay for destinations */}
      {cur.destinations.map(d => (
        <Pressable
          key={`touch_${d.id}`}
          style={[styles.destTouch, { left: d.x - 24, top: d.y - 24, zIndex: 7 }]}
          onPress={() => handleDestTap(d.id)}
        />
      ))}

      {/* Navigation arrows */}
      {showBackArrow ? (
        <Pressable
          style={[styles.navArrow, styles.navTop, { top: topOffset + 100 }]}
          onPress={() => handleNavigate(previousMap)}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-up-bold" size={28} color="#FFD700" />
        </Pressable>
      ) : null}

      {nav.left && (
        <Pressable
          style={[styles.navArrow, styles.navLeft]}
          onPress={() => handleNavigate(nav.left!)}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-left-bold" size={28} color="#FFD700" />
        </Pressable>
      )}

      {nav.right && (
        <Pressable
          style={[styles.navArrow, styles.navRight]}
          onPress={() => handleNavigate(nav.right!)}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-right-bold" size={28} color="#FFD700" />
        </Pressable>
      )}

      {nav.bottom && (
        <Pressable
          style={[styles.navArrow, styles.navBottom]}
          onPress={() => handleNavigate(nav.bottom!)}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="arrow-down-bold" size={28} color="#FFD700" />
        </Pressable>
      )}

      {/* Current map label badge - removed per user request */}

      {/* Top bar: counters */}
      <View style={[styles.topBar, { top: topOffset + 10 }]}>
        <View style={styles.counter}>
          <MaterialCommunityIcons name="speedometer" size={14} color="#FFD700" />
          <Text style={styles.counterLabel}>MILES</Text>
          <Text style={styles.counterValue}>{miles.toString().padStart(6, '0')}</Text>
        </View>
        <View style={styles.counter}>
          <MaterialCommunityIcons name="email-check" size={14} color="#4CAF50" />
          <Text style={styles.counterLabel}>{t('COMP_DISTRIBUES')}</Text>
          <Text style={styles.counterValue}>{delivered.toString().padStart(4, '0')}</Text>
        </View>
        <Pressable
          style={styles.exitBtn}
          onPress={() => router.replace('/level')}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Hint */}
      {uiMode !== 'idle' && (
        <View style={[styles.hintBox, { top: topOffset + 54 }]}>
          <Text style={styles.hintText}>
            {uiMode === 'creating_line' && (selectedDestId ? t('COMP_SELECT_2ND_DEST') : t('COMP_SELECT_1ST_DEST'))}
            {uiMode === 'extending_pick_line' && t('COMP_EXTEND_STEP1')}
            {uiMode === 'extending_pick_dest' && t('COMP_EXTEND_STEP2')}
            {uiMode === 'cargo_pick_line' && t('COMP_CARGO_PICK')}
            {uiMode === 'hub_pick_dest' && t('COMP_HUB_PICK')}
            {uiMode === 'intl_pick_dest' && t('COMP_INTL_PICK')}
            {uiMode === 'intl_creating_line_to' && t('COMP_INTL_CREATE')}
          </Text>
          <Pressable style={styles.hintCancel} onPress={cancelMode}>
            <Text style={styles.hintCancelText}>{t('COMP_ANNULER')}</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom action buttons */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomRow}>
          <Pressable
            style={[styles.actionBtn, uiMode === 'creating_line' && styles.actionBtnActive]}
            onPress={handleCreateLineBtn}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#FFFFFF" />
            <View>
              <Text style={styles.actionBtnLabel}>{t('COMP_CREER_LIGNE')}</Text>
              <Text style={styles.actionBtnCost}>10 000 MILES</Text>
            </View>
          </Pressable>
          <Pressable
            style={[
              styles.actionBtn,
              (uiMode === 'extending_pick_line' || uiMode === 'extending_pick_dest') && styles.actionBtnActive,
              cur.lines.length === 0 && styles.actionBtnDisabled,
            ]}
            onPress={handleExtendLineBtn}
            disabled={cur.lines.length === 0}
          >
            <MaterialCommunityIcons name="vector-polyline" size={18} color={cur.lines.length === 0 ? '#888' : '#FFFFFF'} />
            <View>
              <Text style={[styles.actionBtnLabel, cur.lines.length === 0 && { color: '#888' }]}>{t('COMP_PROLONGER')}</Text>
              <Text style={[styles.actionBtnCost, cur.lines.length === 0 && { color: '#888' }]}>1 000 MILES</Text>
            </View>
          </Pressable>
        </View>
        {(cargoUnlocked || hubUnlocked || intlUnlocked) && (
          <View style={[styles.bottomRow, { marginTop: 6 }]}>
            {cargoUnlocked && (
              <Pressable
                style={[styles.actionBtn, uiMode === 'cargo_pick_line' && styles.actionBtnActive, (cur.lines.length === 0 || totalCargo >= MAX_CARGO_GLOBAL) && styles.actionBtnDisabled]}
                onPress={handleCargoBtn}
                disabled={cur.lines.length === 0}
              >
                <MaterialCommunityIcons name="package-variant" size={18} color={(cur.lines.length === 0 || totalCargo >= MAX_CARGO_GLOBAL) ? '#888' : '#FFFFFF'} />
                <View>
                  <Text style={[styles.actionBtnLabel, (cur.lines.length === 0 || totalCargo >= MAX_CARGO_GLOBAL) && { color: '#888' }]}>CARGO {totalCargo}/{MAX_CARGO_GLOBAL}</Text>
                  <Text style={[styles.actionBtnCost, (cur.lines.length === 0 || totalCargo >= MAX_CARGO_GLOBAL) && { color: '#888' }]}>20 000 MILES</Text>
                </View>
              </Pressable>
            )}
            {hubUnlocked && (
              <Pressable
                style={[styles.actionBtn, uiMode === 'hub_pick_dest' && styles.actionBtnActive, totalHubs >= MAX_HUB_GLOBAL && styles.actionBtnDisabled]}
                onPress={handleHubBtn}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={18} color={totalHubs >= MAX_HUB_GLOBAL ? '#888' : '#FFFFFF'} />
                <View>
                  <Text style={[styles.actionBtnLabel, totalHubs >= MAX_HUB_GLOBAL && { color: '#888' }]}>HUB {totalHubs}/{MAX_HUB_GLOBAL}</Text>
                  <Text style={[styles.actionBtnCost, totalHubs >= MAX_HUB_GLOBAL && { color: '#888' }]}>5 000 MILES</Text>
                </View>
              </Pressable>
            )}
            {intlUnlocked && (
              <Pressable
                style={[styles.actionBtn, (uiMode === 'intl_pick_dest' || uiMode === 'intl_creating_line_to') && styles.actionBtnActive, totalIntl >= MAX_INTL_GLOBAL && styles.actionBtnDisabled]}
                onPress={handleIntlAirportBtn}
              >
                <MaterialCommunityIcons name="airplane" size={18} color={totalIntl >= MAX_INTL_GLOBAL ? '#888' : '#FFD700'} />
                <View>
                  <Text style={[styles.actionBtnLabel, totalIntl >= MAX_INTL_GLOBAL && { color: '#888' }]}>{t('COMP_AEROPORT_INTL')} {totalIntl}/{MAX_INTL_GLOBAL}</Text>
                  <Text style={[styles.actionBtnCost, totalIntl >= MAX_INTL_GLOBAL && { color: '#888' }]}>50 000 MILES</Text>
                </View>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Locked popup */}
      <Modal visible={!!lockedDestMsg} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setLockedDestMsg(null)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons
              name={lockedDestMsg === 'CROISEMENT INTERDIT' ? 'close-octagon' : 'lock-alert'}
              size={32}
              color="#C44536"
            />
            <Text style={styles.modalTitle}>
              {lockedDestMsg === 'CROISEMENT INTERDIT' ? t('COMP_CROISEMENT_TITLE') : t('COMP_DEST_RELIEE_TITLE')}
            </Text>
            <Text style={styles.modalText}>
              {lockedDestMsg === 'CROISEMENT INTERDIT'
                ? t('COMP_CROISEMENT_DESC') : translateLocked(lockedDestMsg, t)}
            </Text>
            <Pressable style={styles.modalBtn} onPress={() => setLockedDestMsg(null)}>
              <Text style={styles.modalBtnText}>{t('COMP_OK')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showInsufficientMiles} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowInsufficientMiles(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="alert" size={32} color="#C44536" />
            <Text style={styles.modalTitle}>MILES INSUFFISANTS</Text>
            <Text style={styles.modalText}>Vous n'avez pas assez de MILES</Text>
            <Pressable style={styles.modalBtn} onPress={() => setShowInsufficientMiles(false)}>
              <Text style={styles.modalBtnText}>{t('COMP_OK')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showCargoUnlockPopup} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCargoUnlockPopup(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="cube-outline" size={36} color="#8B6914" />
            <Text style={styles.modalTitle}>{t('COMP_CARGO_UNLOCKED_TITLE')}</Text>
            <Text style={styles.modalText}>{t('COMP_CARGO_UNLOCKED_DESC')}</Text>
            <Text style={[styles.modalText, { fontSize: 12, marginTop: 6 }]}>Coût : 20 000 MILES</Text>
            <Pressable style={styles.modalBtn} onPress={() => setShowCargoUnlockPopup(false)}>
              <Text style={styles.modalBtnText}>{t('COMP_COMPRIS')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showHubUnlockPopup} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowHubUnlockPopup(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="map-marker-radius" size={36} color="#8B6914" />
            <Text style={styles.modalTitle}>{t('COMP_HUB_UNLOCKED_TITLE')}</Text>
            <Text style={styles.modalText}>{t('COMP_HUB_UNLOCKED_DESC')}</Text>
            <Text style={[styles.modalText, { fontSize: 12, marginTop: 6 }]}>Coût : 5 000 MILES</Text>
            <Pressable style={styles.modalBtn} onPress={() => setShowHubUnlockPopup(false)}>
              <Text style={styles.modalBtnText}>{t('COMP_COMPRIS')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

                        <Modal visible={gameOver === 'lost'} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          <Image
            source={require('../assets/images/compagnie-victory-bg.png')}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
          <View style={styles.modalFullOverlay} />
          <View style={styles.modalFullContent}>
            <View style={styles.modalFullTopBlock}>
              <Text style={styles.modalFullTitle}>{t('COMP_GAMEOVER_TITLE')}</Text>
              <Text style={styles.modalFullText}>{t('COMP_GAMEOVER_TEXT')}</Text>
              <Text style={styles.modalFullScore}>
                {delivered} {t('COURRIERS_LOWER') === 'mails' ? 'MAILS COLLECTED' : 'COURRIERS COLLECTÉS'}
              </Text>
            </View>

            <View style={styles.modalFullCenterBlock}>
            </View>

            <View style={styles.modalFullButtonsRow}>
              <Pressable style={styles.modalFullBtn} onPress={() => setShowAdModal(true)}>
                <Text style={styles.modalFullBtnText}>{t('REJOUER')}</Text>
              </Pressable>
              <Pressable style={[styles.modalFullBtn, { backgroundColor: '#5A4838' }]} onPress={() => router.replace('/level')}>
                <Text style={styles.modalFullBtnText}>{t('RETOUR')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <AdModal
        visible={showAdModal}
        onClose={() => {
          setShowAdModal(false);
          router.replace('/worldwide');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#264a38',
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counter: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  counterLabel: {
    color: '#C4A882',
    fontFamily: 'BigNoodleTitling',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  counterValue: {
    color: '#FFD700',
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 'auto',
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  destTouch: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(196, 168, 130, 0.95)',
    borderColor: '#FFD700',
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(60, 60, 60, 0.7)',
    borderColor: 'rgba(120, 120, 120, 0.4)',
  },
  actionBtnLabel: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  actionBtnCost: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 9,
    color: '#FFD700',
    letterSpacing: 0.8,
  },
  hintBox: {
    position: 'absolute',
    top: 90,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.95)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  hintText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: 1,
    flex: 1,
  },
  hintCancel: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  hintCancelText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#F0E1BE',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B6914',
    minWidth: 260,
  },
  modalTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: 2,
    marginTop: 12,
  },
  modalText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    color: '#3A2A1A',
    textAlign: 'center',
    marginTop: 8,
  },
  modalBtn: {
    marginTop: 18,
    backgroundColor: '#8B6914',
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 6,
  },
  modalBtnText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  navArrow: {
    position: 'absolute',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 9,
  },
  navLeft: {
    left: 6,
    top: '45%',
  },
  navRight: {
    right: 6,
    top: '45%',
  },
  navBottom: {
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  navTop: {
    alignSelf: 'center',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  navArrowLabel: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 1,
  },
  mapLabelBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 12,
    zIndex: 9,
  },
  mapLabelText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 2,
  },
  modalUnlockTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3A2A1A',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalUnlockCard: {
    width: 136,
    height: 136,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(20, 20, 20, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalUnlockImage: {
    width: '100%',
    height: '100%',
  },
  modalBtnSmall: {
    backgroundColor: '#8B6914',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
    minWidth: 70,
  },
  modalBtnSmallText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  modalFullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalFullContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  modalFullTopBlock: {
    alignItems: 'center',
  },
  modalFullCenterBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFullTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  modalFullText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  modalFullScore: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 2,
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  modalFullUnlockGroup: {
    alignItems: 'center',
  },
  modalFullUnlockTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  modalFullUnlockCard: {
    width: 136,
    height: 136,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(20, 20, 20, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalFullUnlockImage: {
    width: '100%',
    height: '100%',
  },
  modalFullButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  modalFullBtn: {
    flex: 1,
    backgroundColor: '#8B6914',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  modalFullBtnText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
});
