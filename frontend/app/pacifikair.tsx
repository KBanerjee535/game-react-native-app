import React, { useEffect, useRef, useState, useCallback } from 'react';
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

// Helper to translate dynamic locked-dest messages
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
const PLANE_SPEED = 75; // pixels per second (vitesse réduite de moitié)
const MAIL_INTERVAL_MIN = 2000; // ms - 1 mail every 2-3s
const MAIL_INTERVAL_MAX = 3000;
const NEW_DEST_INTERVAL = 10000; // ms - new destination every 10s
const PLANE_CAPACITY = 10;       // Avion standard : 10 courriers
const CARGO_CAPACITY = 20;       // CARGO : 20 courriers
const PLANE_PICKUP_PER_STOP = 5;   // avion standard : max 5 courriers par destination
const CARGO_PICKUP_PER_STOP = 10;  // cargo : max 10 courriers par destination
const COST_NEW_LINE = 10000;
const COST_EXTEND = 1000;
const COST_CARGO = 20000;
const COST_HUB = 5000;
const STARTING_MILES = 15000;
const CITY_LIMIT = 20;
const HUB_LIMIT = 100;
const CARGO_UNLOCK_DELIVERED = 200;  // courriers distribués pour débloquer CARGO
const HUB_UNLOCK_DELIVERED = 100;    // courriers distribués pour débloquer HUB
const COLLISION_DISTANCE = 22;        // distance px pour considérer une collision
const TOP_DESTINATION_MARGIN = 0.12;  // pas de destination dans les 12% supérieurs (zone popups/UI)
const LINE_COLORS = ['#C44536', '#3A6B7E', '#D49A26', '#5C8D3F', '#8E5BA5', '#C46B96', '#4A7A4A'];

// === TYPES ===
interface Destination {
  id: string;
  x: number; // px
  y: number; // px
  mails: number;
  isHub?: boolean;
}

interface Line {
  id: string;
  destIds: string[]; // ordered list of destinations
  color: string;
}

interface PlaneState {
  id: string;
  lineId: string;
  segIndex: number; // current segment index in line
  dir: 1 | -1; // direction along line
  progress: number; // 0-1 along current segment
  mails: number;
  loadingTimer: number; // ms remaining loading at destination
  isCargo?: boolean; // CARGO plane (capacité 20 vs 10 standard)
}

// === HELPERS ===
const isOnLand = (x_norm: number, y_norm: number): boolean => {
  const mask = LAND_MASKS['pacifikair'];
  if (!mask) return false;
  const r = Math.floor(y_norm * mask.length);
  const c = Math.floor(x_norm * mask[0].length);
  if (r < 0 || r >= mask.length || c < 0 || c >= mask[0].length) return false;
  return mask[r][c] === '1';
};

// Coastal cell: sea adjacent to land within radius
const isCoastal = (x_norm: number, y_norm: number): boolean => {
  if (isOnLand(x_norm, y_norm)) return false;
  const mask = LAND_MASKS['pacifikair'];
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

const generateCoastalDestination = (existing: Destination[], imgRect: {x:number,y:number,w:number,h:number}, screenH: number, screenW: number): Destination | null => {
  // Marge de 7% de chaque côté de l'écran
  const MARGIN = 0.07;
  const minScreenX = MARGIN * screenW;
  const maxScreenX = (1 - MARGIN) * screenW;
  const minScreenY = MARGIN * screenH;
  const maxScreenY = (1 - MARGIN) * screenH;
  for (let attempt = 0; attempt < 300; attempt++) {
    const x_norm = 0.02 + Math.random() * 0.96;
    const y_norm = 0.02 + Math.random() * 0.96;
    if (!isCoastal(x_norm, y_norm)) continue;
    const px = imgRect.x + x_norm * imgRect.w;
    const py = imgRect.y + y_norm * imgRect.h;
    if (px < minScreenX || px > maxScreenX) continue;
    if (py < minScreenY || py > maxScreenY) continue;
    // Check minimum distance from existing
    let tooClose = false;
    for (const d of existing) {
      const dx = d.x - px;
      const dy = d.y - py;
      if (Math.sqrt(dx * dx + dy * dy) < 60) { tooClose = true; break; }
    }
    if (tooClose) continue;
    return { id: `dest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, x: px, y: py, mails: 0 };
  }
  return null;
};

// Curved path between two points (bezier)
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

// Position on a quadratic bezier
const pointOnCurve = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) => {
  const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  // Tangent direction
  const tx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
  const ty = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
  const angle = Math.atan2(ty, tx) * 180 / Math.PI;
  return { x, y, angle };
};

// Compute total length of a line in pixels
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

// Segment intersection (line segments in 2D)
const segmentsIntersect = (a1: {x:number,y:number}, a2: {x:number,y:number}, b1: {x:number,y:number}, b2: {x:number,y:number}) => {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 0.0001) return false;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
};

// Check if a new segment (fromId -> toId) would cross any existing line segment.
// Segments that share a destination (same endpoint) are not considered crossings.
const segmentCrossesAnyLine = (
  fromId: string,
  toId: string,
  existingLines: Line[],
  dests: Destination[],
): boolean => {
  const from = dests.find(d => d.id === fromId);
  const to = dests.find(d => d.id === toId);
  if (!from || !to) return false;
  for (const line of existingLines) {
    for (let i = 0; i < line.destIds.length - 1; i++) {
      const segFromId = line.destIds[i];
      const segToId = line.destIds[i + 1];
      // Ignore segments sharing an endpoint (common at HUBs)
      if (segFromId === fromId || segFromId === toId || segToId === fromId || segToId === toId) continue;
      const a = dests.find(d => d.id === segFromId);
      const b = dests.find(d => d.id === segToId);
      if (!a || !b) continue;
      if (segmentsIntersect(from, to, a, b)) return true;
    }
  }
  return false;
};

// === COMPONENT ===
export default function PacifikairScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const topOffset = insets.top; // safe area top padding (0 on web)
  const [mapW, setMapW] = useState(SCREEN_W);
  const [mapH, setMapH] = useState(SCREEN_H);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [planes, setPlanes] = useState<PlaneState[]>([]);
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
  const [tick, setTick] = useState(0); // Force re-render
  // Mode UI : 'idle' | 'creating_line' | 'extending_pick_line' | 'extending_pick_endpoint' | 'extending_pick_dest' | 'cargo_pick_line' | 'hub_pick_dest'
  const [uiMode, setUiMode] = useState<'idle' | 'creating_line' | 'extending_pick_line' | 'extending_pick_endpoint' | 'extending_pick_dest' | 'cargo_pick_line' | 'hub_pick_dest'>('idle');
  const [extendLineId, setExtendLineId] = useState<string | null>(null);
  const [extendEndpointId, setExtendEndpointId] = useState<string | null>(null);
  const [blinkTick, setBlinkTick] = useState(true);

  const lastTickTime = useRef(Date.now());
  const lastDestSpawn = useRef(Date.now());
  const mailNextTimes = useRef<Map<string, number>>(new Map());
  const colorIndex = useRef(0);
  const initRef = useRef(false);

  // === Calcul de la zone réellement occupée par l'image (mode contain) ===
  // Source image: 1024x1536 (aspect 0.667)
  const IMG_ASPECT = 1024 / 1536;
  const containerAspect = mapW > 0 ? mapW / mapH : 1;
  let imgRect = { x: 0, y: 0, w: mapW, h: mapH };
  if (containerAspect > IMG_ASPECT) {
    // Container plus large que l'image: bandes verticales
    const imgW = mapH * IMG_ASPECT;
    imgRect = { x: (mapW - imgW) / 2, y: 0, w: imgW, h: mapH };
  } else {
    // Container plus haut que l'image: bandes horizontales
    const imgH = mapW / IMG_ASPECT;
    imgRect = { x: 0, y: (mapH - imgH) / 2, w: mapW, h: imgH };
  }

  // === INIT: 2 starting destinations ===
  useEffect(() => {
    if (initRef.current) return;
    if (mapW === 0 || mapH === 0) return;
    initRef.current = true;
    const initial: Destination[] = [];
    for (let i = 0; i < 2; i++) {
      const d = generateCoastalDestination(initial, imgRect, mapH, mapW);
      if (d) initial.push(d);
    }
    setDestinations(initial);
    initial.forEach(d => {
      mailNextTimes.current.set(d.id, Date.now() + MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN));
    });
    lastDestSpawn.current = Date.now();
    lastTickTime.current = Date.now();
  }, [mapW, mapH]);

  // === GAME LOOP ===
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTickTime.current) / 1000;
      lastTickTime.current = now;

      // Spawn new destination every NEW_DEST_INTERVAL
      if (now - lastDestSpawn.current >= NEW_DEST_INTERVAL) {
        setDestinations(prev => {
          const newDest = generateCoastalDestination(prev, imgRect, mapH, mapW);
          if (newDest) {
            mailNextTimes.current.set(newDest.id, Date.now() + MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN));
            return [...prev, newDest];
          }
          return prev;
        });
        lastDestSpawn.current = now;
      }

      // Accumulate mails at destinations
      setDestinations(prev => {
        let changed = false;
        let lostFlag = false;
        const updated = prev.map(d => {
          const nextTime = mailNextTimes.current.get(d.id) ?? 0;
          if (now >= nextTime) {
            mailNextTimes.current.set(d.id, now + MAIL_INTERVAL_MIN + Math.random() * (MAIL_INTERVAL_MAX - MAIL_INTERVAL_MIN));
            const newMails = d.mails + 1;
            const limit = d.isHub ? HUB_LIMIT : CITY_LIMIT;
            changed = true;
            if (newMails >= limit) lostFlag = true;
            return { ...d, mails: newMails };
          }
          return d;
        });
        if (lostFlag) setGameOver('lost');
        return changed ? updated : prev;
      });

      // Update planes
      setPlanes(prevPlanes => {
        if (prevPlanes.length === 0) return prevPlanes;
        let totalMilesAdded = 0;
        let totalDelivered = 0;
        let totalCollected = 0;
        const destSnapshot = destinations;
        const linesSnapshot = lines;
        const newDestUpdates = new Map<string, { mailsDelta: number; loaded: number }>();
        const updated = prevPlanes.map(p => {
          const line = linesSnapshot.find(l => l.id === p.lineId);
          if (!line || line.destIds.length < 2) return p;
          if (p.loadingTimer > 0) {
            const np = { ...p, loadingTimer: Math.max(0, p.loadingTimer - dt * 1000) };
            return np;
          }
          // Move along current segment
          const fromId = line.destIds[p.segIndex];
          const toId = line.destIds[p.segIndex + p.dir];
          if (!toId) {
            // shouldn't happen, but reverse
            return { ...p, dir: -p.dir as 1 | -1 };
          }
          const from = destSnapshot.find(d => d.id === fromId);
          const to = destSnapshot.find(d => d.id === toId);
          if (!from || !to) return p;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const segLen = Math.sqrt(dx * dx + dy * dy);
          const moveDist = PLANE_SPEED * dt;
          const newProg = p.progress + (moveDist / segLen);
          totalMilesAdded += moveDist * 5; // 5 miles per pixel (visual scaling)

          if (newProg >= 1) {
            // Arrived at destination
            const arriveDestId = toId;
            const arriveDest = destSnapshot.find(d => d.id === arriveDestId);
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
        if (totalMilesAdded > 0) setMiles(m => Math.max(0, m - 0) + 0); // no-op visual; miles counter accumulates distance separately
        if (totalDelivered > 0) setDelivered(d => d + totalDelivered);
        if (totalCollected > 0) setCollected(c => c + totalCollected);
        // Apply destination updates
        if (newDestUpdates.size > 0) {
          setDestinations(prevD => prevD.map(d => {
            const u = newDestUpdates.get(d.id);
            return u ? { ...d, mails: Math.max(0, d.mails + u.mailsDelta) } : d;
          }));
        }
        // Track miles travelled
        if (totalMilesAdded > 0) {
          setMiles(m => m + Math.round(totalMilesAdded));
        }
        return updated;
      });

      setTick(t => (t + 1) % 1000);
    }, 50);
    return () => clearInterval(id);
  }, [gameOver, mapW, mapH, destinations.length, lines.length]);

  // === Animation clignotement pour les extrémités ===
  useEffect(() => {
    if (uiMode !== 'extending_pick_endpoint') return;
    const id = setInterval(() => setBlinkTick(b => !b), 400);
    return () => clearInterval(id);
  }, [uiMode]);

  // === Déblocage CARGO (200 distribués) ===
  useEffect(() => {
    if (!cargoUnlocked && delivered >= CARGO_UNLOCK_DELIVERED) {
      setCargoUnlocked(true);
      setShowCargoUnlockPopup(true);
    }
  }, [delivered, cargoUnlocked]);

  // === Déblocage HUB (250 distribués) ===
  useEffect(() => {
    if (!hubUnlocked && delivered >= HUB_UNLOCK_DELIVERED) {
      setHubUnlocked(true);
      setShowHubUnlockPopup(true);
    }
  }, [delivered, hubUnlocked]);

  // === Sauvegarder meilleur score (à chaque progression) ===
  useEffect(() => {
    if (delivered <= 0) return;
    (async () => {
      try {
        const prev = await AsyncStorage.getItem('best_pacifikair');
        const best = prev ? parseInt(prev, 10) : 0;
        if (delivered > best) {
          await AsyncStorage.setItem('best_pacifikair', String(delivered));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [delivered]);

  // === Détection de collisions entre avions ===
  useEffect(() => {
    if (gameOver || planes.length < 2) return;
    const id = setInterval(() => {
      // Calculer position de chaque avion
      const planePositions = planes.map(p => {
        const line = lines.find(l => l.id === p.lineId);
        if (!line) return null;
        const fromId = line.destIds[p.segIndex];
        const toIdx = p.segIndex + p.dir;
        if (toIdx < 0 || toIdx >= line.destIds.length) return null;
        const toId = line.destIds[toIdx];
        const a = destinations.find(d => d.id === fromId);
        const b = destinations.find(d => d.id === toId);
        if (!a || !b) return null;
        const { cx, cy } = curvePath(a.x, a.y, b.x, b.y, 1);
        const pos = pointOnCurve(a.x, a.y, cx, cy, b.x, b.y, p.progress);
        return { plane: p, x: pos.x, y: pos.y };
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      // Chercher collisions entre avions de lignes différentes
      for (let i = 0; i < planePositions.length; i++) {
        for (let j = i + 1; j < planePositions.length; j++) {
          const pi = planePositions[i];
          const pj = planePositions[j];
          if (pi.plane.lineId === pj.plane.lineId) continue;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          if (Math.sqrt(dx*dx + dy*dy) < COLLISION_DISTANCE) {
            // Collision : supprimer la ligne la plus courte
            const lineI = lines.find(l => l.id === pi.plane.lineId);
            const lineJ = lines.find(l => l.id === pj.plane.lineId);
            if (!lineI || !lineJ) continue;
            const lenI = computeLineLength(lineI, destinations);
            const lenJ = computeLineLength(lineJ, destinations);
            const shortLineId = lenI < lenJ ? lineI.id : lineJ.id;
            setLines(prev => prev.filter(l => l.id !== shortLineId));
            setPlanes(prev => prev.filter(p => p.lineId !== shortLineId));
            setCollisionPopup('Deux avions se sont percutés, la ligne la plus courte disparaît.');
            return;
          }
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [gameOver, planes, lines, destinations]);

  // === Limite du nombre de lignes ===
  // 4 lignes par défaut, +1 à 300 distribués, puis +1 tous les 300 distribués (600, 900, 1200...)
  const maxLines = 4 + Math.floor(delivered / 300);

  // === HANDLE BUTTON: Create line ===
  const handleCreateLineBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') {
      // Cancel current mode
      cancelMode();
      return;
    }
    if (lines.length >= maxLines) {
      setLockedDestMsg(`Limite de ${maxLines} lignes atteinte. Distribuez encore ${300 - (delivered % 300)} courriers pour débloquer une ligne supplémentaire.`);
      return;
    }
    if (miles < COST_NEW_LINE) {
      setShowInsufficientMiles(true);
      return;
    }
    setUiMode('creating_line');
    setSelectedDestId(null);
  };

  const handleExtendLineBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') {
      cancelMode();
      return;
    }
    if (miles < COST_EXTEND) {
      setShowInsufficientMiles(true);
      return;
    }
    if (lines.length === 0) return;
    setUiMode('extending_pick_line');
  };

  const cargoCount = planes.filter(p => p.isCargo).length;
  const hubCount = destinations.filter(d => d.isHub).length;
  const MAX_CARGO = 3;
  const MAX_HUB = 5;

  const handleCargoBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (cargoCount >= MAX_CARGO) {
      setLockedDestMsg(`Limite de ${MAX_CARGO} avions CARGO atteinte.`);
      return;
    }
    if (miles < COST_CARGO) { setShowInsufficientMiles(true); return; }
    if (lines.length === 0) return;
    setUiMode('cargo_pick_line');
  };

  const handleHubBtn = () => {
    if (gameOver) return;
    if (uiMode !== 'idle') { cancelMode(); return; }
    if (hubCount >= MAX_HUB) {
      setLockedDestMsg(`Limite de ${MAX_HUB} HUB atteinte.`);
      return;
    }
    if (miles < COST_HUB) { setShowInsufficientMiles(true); return; }
    setUiMode('hub_pick_dest');
  };

  const cancelMode = () => {
    setUiMode('idle');
    setSelectedDestId(null);
    setExtendLineId(null);
    setExtendEndpointId(null);
  };

  // === HANDLE TAP ON DESTINATION ===
  // Helper: check if a destination is already on any line (used for non-HUB blocking rule)
  const isDestOnAnyLine = (destId: string): boolean => {
    return lines.some(l => l.destIds.includes(destId));
  };
  const isDestLocked = (destId: string): boolean => {
    const d = destinations.find(x => x.id === destId);
    if (!d) return false;
    if (d.isHub) return false; // HUBs can be connected to multiple lines
    return isDestOnAnyLine(destId);
  };

  const handleDestTap = (destId: string) => {
    if (gameOver) return;

    if (uiMode === 'creating_line') {
      // Check HUB rule: non-HUB destinations already on a line cannot be re-used
      if (isDestLocked(destId)) {
        setLockedDestMsg('Cette destination est déjà reliée à une ligne. Transformez-la en HUB pour la relier à plusieurs lignes.');
        return;
      }
      if (!selectedDestId) {
        setSelectedDestId(destId);
        return;
      }
      if (selectedDestId === destId) {
        setSelectedDestId(null);
        return;
      }
      // Create new line between selectedDestId and destId
      const fromId = selectedDestId;
      const toId = destId;
      const fromD = destinations.find(d => d.id === fromId);
      const toD = destinations.find(d => d.id === toId);
      if (!fromD || !toD) { cancelMode(); return; }
      // Interdire le croisement avec une ligne existante
      if (segmentCrossesAnyLine(fromId, toId, lines, destinations)) {
        setLockedDestMsg('CROISEMENT INTERDIT');
        return;
      }
      if (miles < COST_NEW_LINE) {
        setShowInsufficientMiles(true);
        cancelMode();
        return;
      }
      const color = LINE_COLORS[colorIndex.current % LINE_COLORS.length];
      colorIndex.current++;
      const lineId = `line_${Date.now()}`;
      setMiles(m => m - COST_NEW_LINE);
      setLines(prev => [...prev, { id: lineId, destIds: [fromId, toId], color }]);
      setPlanes(prev => [...prev, {
        id: `plane_${lineId}`,
        lineId,
        segIndex: 0,
        dir: 1,
        progress: 0,
        mails: 0,
        loadingTimer: 0,
      }]);
      cancelMode();
      return;
    }

    if (uiMode === 'extending_pick_endpoint') {
      // User selects which endpoint of the line to extend from
      const line = lines.find(l => l.id === extendLineId);
      if (!line) return;
      const endpoints = [line.destIds[0], line.destIds[line.destIds.length - 1]];
      if (endpoints.includes(destId)) {
        setExtendEndpointId(destId);
        setUiMode('extending_pick_dest');
      }
      return;
    }

    if (uiMode === 'extending_pick_dest') {
      // User picks the new destination; we'll auto-extend from the closest endpoint OR HUB
      if (!extendLineId) return;
      const line = lines.find(l => l.id === extendLineId);
      if (!line) return;
      if (line.destIds.includes(destId)) return; // can't add a dest already in line
      // HUB rule: cannot extend to a non-HUB destination already on another line
      if (isDestLocked(destId)) {
        setLockedDestMsg('Cette destination est déjà reliée à une ligne. Transformez-la en HUB pour la relier à plusieurs lignes.');
        return;
      }
      const targetDest = destinations.find(d => d.id === destId);
      if (!targetDest) { cancelMode(); return; }

      // Candidats : 2 extrémités + tous les HUB présents sur la ligne (intérieur uniquement)
      type Cand = { id: string; pos: 'start' | 'end' | 'hub'; dist: number };
      const candidates: Cand[] = [];
      const startId = line.destIds[0];
      const endId = line.destIds[line.destIds.length - 1];
      const startD = destinations.find(d => d.id === startId);
      const endD = destinations.find(d => d.id === endId);
      if (startD) candidates.push({ id: startId, pos: 'start', dist: Math.hypot(startD.x - targetDest.x, startD.y - targetDest.y) });
      if (endD) candidates.push({ id: endId, pos: 'end', dist: Math.hypot(endD.x - targetDest.x, endD.y - targetDest.y) });
      for (let i = 1; i < line.destIds.length - 1; i++) {
        const dId = line.destIds[i];
        const dst = destinations.find(d => d.id === dId);
        if (dst && dst.isHub) {
          candidates.push({ id: dId, pos: 'hub', dist: Math.hypot(dst.x - targetDest.x, dst.y - targetDest.y) });
        }
      }
      candidates.sort((a, b) => a.dist - b.dist);

      // Try each candidate from closest; pick first one that doesn't cross any existing line
      let chosen: Cand | null = null;
      for (const cand of candidates) {
        if (!segmentCrossesAnyLine(cand.id, destId, lines, destinations)) {
          chosen = cand;
          break;
        }
      }
      if (!chosen) {
        setLockedDestMsg('CROISEMENT INTERDIT');
        return;
      }
      if (miles < COST_EXTEND) {
        setShowInsufficientMiles(true);
        cancelMode();
        return;
      }
      setMiles(m => m - COST_EXTEND);

      if (chosen.pos === 'start') {
        setLines(prev => prev.map(l => l.id === extendLineId ? { ...l, destIds: [destId, ...l.destIds] } : l));
      } else if (chosen.pos === 'end') {
        setLines(prev => prev.map(l => l.id === extendLineId ? { ...l, destIds: [...l.destIds, destId] } : l));
      } else {
        // Branche depuis un HUB : créer une nouvelle ligne courte (HUB + new dest)
        const color = LINE_COLORS[colorIndex.current % LINE_COLORS.length];
        colorIndex.current++;
        const newLineId = `line_${Date.now()}`;
        setLines(prev => [...prev, { id: newLineId, destIds: [chosen!.id, destId], color }]);
        setPlanes(prev => [...prev, {
          id: `plane_${newLineId}`,
          lineId: newLineId,
          segIndex: 0,
          dir: 1,
          progress: 0,
          mails: 0,
          loadingTimer: 0,
        }]);
      }
      cancelMode();
      return;
    }

    if (uiMode === 'hub_pick_dest') {
      // User picks a destination to upgrade into HUB
      const dest = destinations.find(d => d.id === destId);
      if (!dest || dest.isHub) return;
      if (miles < COST_HUB) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_HUB);
      setDestinations(prev => prev.map(d => d.id === destId ? { ...d, isHub: true } : d));
      cancelMode();
      return;
    }
  };

  const handleLineTap = (lineId: string) => {
    if (gameOver) return;
    if (uiMode === 'extending_pick_line') {
      // Skip endpoint selection: user will pick a destination and we'll auto-extend from the closest endpoint
      setExtendLineId(lineId);
      setUiMode('extending_pick_dest');
      return;
    }
    if (uiMode === 'cargo_pick_line') {
      // Add a CARGO plane to the chosen line
      if (miles < COST_CARGO) { setShowInsufficientMiles(true); cancelMode(); return; }
      setMiles(m => m - COST_CARGO);
      setPlanes(prev => [...prev, {
        id: `cargo_${lineId}_${Date.now()}`,
        lineId,
        segIndex: 0,
        dir: 1,
        progress: 0,
        mails: 0,
        loadingTimer: 0,
        isCargo: true,
      }]);
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

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Carte centrée à la bonne taille (aspect ratio préservé) */}
      {mapW > 0 && mapH > 0 && (
        <View style={{ position: 'absolute', left: imgRect.x, top: imgRect.y, width: imgRect.w, height: imgRect.h, overflow: 'hidden' }}>
          <Image
            source={require('../assets/images/pacifikair-map.png')}
            style={{ width: imgRect.w, height: imgRect.h }}
          />
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

      {/* SVG layer */}
      <Svg width={mapW} height={mapH} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 5 }]}>
        {/* Lines */}
        {lines.map((line) => {
          const segments = [];
          for (let i = 0; i < line.destIds.length - 1; i++) {
            const a = destinations.find(d => d.id === line.destIds[i]);
            const b = destinations.find(d => d.id === line.destIds[i + 1]);
            if (!a || !b) continue;
            const { path } = curvePath(a.x, a.y, b.x, b.y, 1);
            const isHighlighted = uiMode === 'extending_pick_line';
            segments.push(
              <Path
                key={`${line.id}_seg_${i}`}
                d={path}
                stroke={line.color}
                strokeWidth={isHighlighted ? 6 : 3}
                fill="none"
                opacity={isHighlighted ? 1 : 0.85}
              />
            );
          }
          return <G key={line.id}>{segments}</G>;
        })}

        {/* Planes */}
        {planes.map((p) => {
          const line = lines.find(l => l.id === p.lineId);
          if (!line) return null;
          const fromId = line.destIds[p.segIndex];
          const toIdx = p.segIndex + p.dir;
          if (toIdx < 0 || toIdx >= line.destIds.length) return null;
          const toId = line.destIds[toIdx];
          const a = destinations.find(d => d.id === fromId);
          const b = destinations.find(d => d.id === toId);
          if (!a || !b) return null;
          const { cx, cy } = curvePath(a.x, a.y, b.x, b.y, 1);
          const pos = pointOnCurve(a.x, a.y, cx, cy, b.x, b.y, p.progress);
          return (
            <G key={p.id} transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.angle + 90})`}>
              {p.isCargo ? (
                // CARGO : forme plus large/carrée
                <Path d="M -6 -10 L 6 -10 L 7 8 L -7 8 Z" fill="#D49A26" stroke="#000" strokeWidth={1} />
              ) : (
                <Path d="M 0 -8 L 4 6 L 0 4 L -4 6 Z" fill="#1A1A1A" stroke="#000" strokeWidth={0.5} />
              )}
            </G>
          );
        })}

        {/* Destinations */}
        {destinations.map(d => {
          const isSelected = selectedDestId === d.id;
          const limit = d.isHub ? HUB_LIMIT : CITY_LIMIT;
          const ratio = d.mails / limit;
          const ringColor = ratio >= 0.8 ? '#C44536' : ratio >= 0.5 ? '#D49A26' : '#3A6B7E';
          // Endpoint blinking when extending
          let isEndpointBlink = false;
          if (uiMode === 'extending_pick_endpoint' && extendLineId) {
            const line = lines.find(l => l.id === extendLineId);
            if (line) {
              const endpoints = [line.destIds[0], line.destIds[line.destIds.length - 1]];
              if (endpoints.includes(d.id)) isEndpointBlink = true;
            }
          }
          const baseRadius = d.isHub ? 22 : 16;
          const radius = isSelected || isEndpointBlink ? baseRadius + 4 : baseRadius;
          const shouldHide = isEndpointBlink && !blinkTick;
          if (shouldHide) return null;
          const finalRing = isEndpointBlink ? '#FFD700' : (isSelected ? '#FFD700' : (d.isHub ? '#5C8D3F' : ringColor));
          const fillColor = d.isHub ? '#E8DCB8' : '#F0E1BE';
          return (
            <G key={d.id}>
              {d.isHub && (
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

      {/* Pressable layers for lines (when picking a line) - multiple touch zones along curve */}
      {(uiMode === 'extending_pick_line' || uiMode === 'cargo_pick_line') && lines.map((line) => {
        const segments = [];
        for (let i = 0; i < line.destIds.length - 1; i++) {
          const a = destinations.find(d => d.id === line.destIds[i]);
          const b = destinations.find(d => d.id === line.destIds[i + 1]);
          if (!a || !b) continue;
          const { cx, cy } = curvePath(a.x, a.y, b.x, b.y, 1);
          // Sample 5 points along the curve (avoid endpoints)
          for (let s = 1; s <= 5; s++) {
            const t = s / 6;
            const pos = pointOnCurve(a.x, a.y, cx, cy, b.x, b.y, t);
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
      {destinations.map(d => (
        <Pressable
          key={`touch_${d.id}`}
          style={[styles.destTouch, { left: d.x - 24, top: d.y - 24, zIndex: 7 }]}
          onPress={() => handleDestTap(d.id)}
        />
      ))}

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

      {/* Hint message based on current mode */}
      {uiMode !== 'idle' && (
        <View style={[styles.hintBox, { top: topOffset + 54 }]}>
          <Text style={styles.hintText}>
            {uiMode === 'creating_line' && (selectedDestId ? t('COMP_SELECT_2ND_DEST') : t('COMP_SELECT_1ST_DEST'))}
            {uiMode === 'extending_pick_line' && t('COMP_EXTEND_STEP1')}
            {uiMode === 'extending_pick_dest' && t('COMP_EXTEND_STEP2')}
            {uiMode === 'cargo_pick_line' && t('COMP_CARGO_PICK')}
            {uiMode === 'hub_pick_dest' && t('COMP_HUB_PICK')}
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
              (uiMode === 'extending_pick_line' || uiMode === 'extending_pick_endpoint' || uiMode === 'extending_pick_dest') && styles.actionBtnActive,
              lines.length === 0 && styles.actionBtnDisabled,
            ]}
            onPress={handleExtendLineBtn}
            disabled={lines.length === 0}
          >
            <MaterialCommunityIcons name="vector-polyline" size={18} color={lines.length === 0 ? '#888' : '#FFFFFF'} />
            <View>
              <Text style={[styles.actionBtnLabel, lines.length === 0 && { color: '#888' }]}>{t('COMP_PROLONGER')}</Text>
              <Text style={[styles.actionBtnCost, lines.length === 0 && { color: '#888' }]}>1 000 MILES</Text>
            </View>
          </Pressable>
        </View>
        {(cargoUnlocked || hubUnlocked) && (
          <View style={[styles.bottomRow, { marginTop: 6 }]}>
            {cargoUnlocked && (
              <Pressable
                style={[styles.actionBtn, uiMode === 'cargo_pick_line' && styles.actionBtnActive, (lines.length === 0 || cargoCount >= MAX_CARGO) && styles.actionBtnDisabled]}
                onPress={handleCargoBtn}
                disabled={lines.length === 0}
              >
                <MaterialCommunityIcons name="package-variant" size={18} color={(lines.length === 0 || cargoCount >= MAX_CARGO) ? '#888' : '#FFFFFF'} />
                <View>
                  <Text style={[styles.actionBtnLabel, (lines.length === 0 || cargoCount >= MAX_CARGO) && { color: '#888' }]}>CARGO {cargoCount}/{MAX_CARGO}</Text>
                  <Text style={[styles.actionBtnCost, (lines.length === 0 || cargoCount >= MAX_CARGO) && { color: '#888' }]}>20 000 MILES</Text>
                </View>
              </Pressable>
            )}
            {hubUnlocked && (
              <Pressable
                style={[styles.actionBtn, uiMode === 'hub_pick_dest' && styles.actionBtnActive, hubCount >= MAX_HUB && styles.actionBtnDisabled]}
                onPress={handleHubBtn}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={18} color={hubCount >= MAX_HUB ? '#888' : '#FFFFFF'} />
                <View>
                  <Text style={[styles.actionBtnLabel, hubCount >= MAX_HUB && { color: '#888' }]}>HUB {hubCount}/{MAX_HUB}</Text>
                  <Text style={[styles.actionBtnCost, hubCount >= MAX_HUB && { color: '#888' }]}>5 000 MILES</Text>
                </View>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Locked destination / crossing popup */}
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

      {/* Insufficient miles popup */}
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

      {/* CARGO unlock instruction popup */}
      <Modal visible={showCargoUnlockPopup} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCargoUnlockPopup(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="cube-outline" size={36} color="#8B6914" />
            <Text style={styles.modalTitle}>{t('COMP_CARGO_UNLOCKED_TITLE')}</Text>
            <Text style={styles.modalText}>
              {t('COMP_CARGO_UNLOCKED_DESC')}
            </Text>
            <Text style={[styles.modalText, { fontSize: 12, marginTop: 6 }]}>
              Coût : 20 000 MILES
            </Text>
            <Pressable style={styles.modalBtn} onPress={() => setShowCargoUnlockPopup(false)}>
              <Text style={styles.modalBtnText}>{t('COMP_COMPRIS')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* HUB unlock instruction popup */}
      <Modal visible={showHubUnlockPopup} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowHubUnlockPopup(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="map-marker-radius" size={36} color="#8B6914" />
            <Text style={styles.modalTitle}>{t('COMP_HUB_UNLOCKED_TITLE')}</Text>
            <Text style={styles.modalText}>
              {t('COMP_HUB_UNLOCKED_DESC')}
            </Text>
            <Text style={[styles.modalText, { fontSize: 12, marginTop: 6 }]}>
              Coût : 5 000 MILES
            </Text>
            <Pressable style={styles.modalBtn} onPress={() => setShowHubUnlockPopup(false)}>
              <Text style={styles.modalBtnText}>{t('COMP_COMPRIS')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Game over modal */}
                        <Modal visible={gameOver === 'lost'} transparent={false} animationType="fade">
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
            {delivered >= 1000 && (
              <View style={styles.modalFullUnlockGroup}>
                <Text style={styles.modalFullUnlockTitle}>
                  {t('COURRIERS_LOWER') === 'mails' ? 'YOU UNLOCKED THE COMPANY' : 'VOUS AVEZ DÉBLOQUÉ LA COMPAGNIE'}
                </Text>
                <View style={styles.modalFullUnlockCard}>
                  <Image
                    source={require('../assets/images/airindiana-logo.png')}
                    style={styles.modalFullUnlockImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            )}
            </View>

            <View style={styles.modalFullButtonsRow}>
              <Pressable style={styles.modalFullBtn} onPress={() => router.replace('/pacifikair')}>
                <Text style={styles.modalFullBtnText}>{t('REJOUER')}</Text>
              </Pressable>
              {delivered >= 1000 && (
                <Pressable style={[styles.modalFullBtn, { backgroundColor: '#5C8D3F' }]} onPress={() => router.replace('/airindiana')}>
                  <Text style={styles.modalFullBtnText}>{t('COURRIERS_LOWER') === 'mails' ? 'NEXT' : 'SUIVANTE'}</Text>
                </Pressable>
              )}
              <Pressable style={[styles.modalFullBtn, { backgroundColor: '#5A4838' }]} onPress={() => router.replace('/level')}>
                <Text style={styles.modalFullBtnText}>{t('RETOUR')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3A6B7E',
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
  // Bottom action buttons
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
    borderRadius: 10,
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
