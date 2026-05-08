import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  countCurveIntersections,
  getIntersectionProgresses,
  findBestCurveDirection,
} from '../utils/geometry';
import { isOnLandByMask, isValidDestination } from '../data/landMasks';

// Point definition (normalized 0-1 coordinates)
export interface MapPoint {
  id: string;
  x: number;
  y: number;
}

export interface Flight {
  from: MapPoint;
  to: MapPoint;
  curveDirection?: number; // 1 or -1 to indicate curve direction
}

export interface CargoOption {
  point: MapPoint;
  type: 'mail' | 'fuel' | 'repair' | 'delivery' | 'customs';
  amount: number;
}

// ─── ANTI-OVERLAP: Vérification rectangulaire des chevauchements ─────────────
// Les badges SVG sont rectangulaires (~60px large × ~40px haut).
// Sur un écran de 360px, cela correspond à ~0.17 en X et ~0.05 en Y normalisé.
// On utilise des seuils conservateurs pour éviter tout chevauchement visuel.
const DEST_MIN_DIST_X = 0.16;
const DEST_MIN_DIST_Y = 0.09;

const isDestTooClose = (x: number, y: number, existingPoints: MapPoint[]): boolean => {
  return existingPoints.some(p =>
    Math.abs(p.x - x) < DEST_MIN_DIST_X && Math.abs(p.y - y) < DEST_MIN_DIST_Y
  );
};

// Espacement plus strict pour les niveaux à petites régions (Atlantique)
const isDestTooCloseStrict = (x: number, y: number, existingPoints: MapPoint[]): boolean => {
  return existingPoints.some(p =>
    Math.abs(p.x - x) < 0.18 && Math.abs(p.y - y) < 0.13
  );
};

// Quand aucun point parfait n'est trouvé, choisit le candidat le plus éloigné
const pickBestCandidate = (candidates: MapPoint[], existingPoints: MapPoint[]): MapPoint => {
  if (candidates.length === 0) return { id: `fb_${Date.now()}`, x: 0.4, y: 0.3 };
  if (existingPoints.length === 0) return candidates[0];
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const score = Math.min(...existingPoints.map(p =>
      Math.max(Math.abs(p.x - c.x) / DEST_MIN_DIST_X, Math.abs(p.y - c.y) / DEST_MIN_DIST_Y)
    ));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
};


// Define land regions for Europe (approximate polygons - normalized coordinates)
// AFFINÉES pour éviter les zones de mer (bleu)
const LAND_REGIONS = [
  // Zone unique couvrant toute la carte d'Europe avec marges pour éviter les bords haut et droit
  // minY: 0.10 (éloigné du bord haut) | maxY: 0.55 (évite pare-brise) | maxX: 0.82 (éloigné bord droit)
  { minX: 0.05, maxX: 0.82, minY: 0.10, maxY: 0.55 },
];

// Régions terrestres pour Gibraltar - ESPAGNE (moitié supérieure de la carte)
// L'eau (Atlantique) est à GAUCHE, les terres sont au CENTRE-DROITE
const GIBRALTAR_SPAIN_REGIONS = [
  // Espagne intérieure - centre-droite de la carte
  { minX: 0.35, maxX: 0.65, minY: 0.08, maxY: 0.22 },
  // Espagne sud - au-dessus du détroit, zone intérieure
  { minX: 0.25, maxX: 0.55, minY: 0.15, maxY: 0.30 },
  // Espagne est (Valence/Murcie)
  { minX: 0.55, maxX: 0.85, minY: 0.06, maxY: 0.20 },
  // Espagne centre-nord
  { minX: 0.40, maxX: 0.80, minY: 0.04, maxY: 0.15 },
  // Andalousie intérieure (au-dessus du détroit, loin des côtes)
  { minX: 0.30, maxX: 0.60, minY: 0.25, maxY: 0.38 },
];

// Régions terrestres pour Gibraltar - AFRIQUE DU NORD (moitié inférieure)
// MAP_HEIGHT ≈ 58% écran + 50px, donc y=0.90 est encore visible.
// Afrique commence à y≈0.44 (masque) et s'étend jusqu'à y=1.0 (terre pleine).
// On couvre de y=0.44 à y=0.82 pour utiliser toute la moitié inférieure visible.
const GIBRALTAR_AFRICA_REGIONS = [
  // Maroc côte nord - bande étroite juste après le détroit
  { minX: 0.24, maxX: 0.50, minY: 0.44, maxY: 0.54 },
  // Maroc centre - zone intermédiaire (s'élargit)
  { minX: 0.20, maxX: 0.62, minY: 0.52, maxY: 0.64 },
  // Maroc sud - large zone intérieure
  { minX: 0.15, maxX: 0.75, minY: 0.62, maxY: 0.74 },
  // Maroc profond - toute la largeur visible
  { minX: 0.10, maxX: 0.82, minY: 0.72, maxY: 0.82 },
];

// Régions terrestres pour GIBRALTAR II - COLLECTE (moitié inférieure = Afrique)
const GIBRALTAR2_COLLECT_REGIONS = [
  // Moitié inférieure de l'écran (Afrique du Nord, y=0.45 à y=0.82)
  { minX: 0.20, maxX: 0.50, minY: 0.45, maxY: 0.82 },
  { minX: 0.40, maxX: 0.70, minY: 0.45, maxY: 0.82 },
  { minX: 0.55, maxX: 0.85, minY: 0.50, maxY: 0.82 },
];

// Régions terrestres pour GIBRALTAR II - DISTRIBUTION (moitié supérieure = Espagne)
const GIBRALTAR2_DISTRIB_REGIONS = [
  { minX: 0.35, maxX: 0.65, minY: 0.05, maxY: 0.20 },
  { minX: 0.25, maxX: 0.55, minY: 0.12, maxY: 0.28 },
  { minX: 0.55, maxX: 0.85, minY: 0.04, maxY: 0.18 },
  { minX: 0.40, maxX: 0.80, minY: 0.02, maxY: 0.14 },
  { minX: 0.30, maxX: 0.60, minY: 0.22, maxY: 0.36 },
];

// Bureau de douane central GIBRALTAR II
const GIBRALTAR2_CUSTOMS: MapPoint = {
  id: 'gibraltar2_customs',
  x: 0.50,
  y: 0.46,
};

// Régions terrestres pour ATLANTIQUE - GUINÉE (haut-droite de la carte)
const ATLANTIQUE_GUINEA_REGIONS = [
  // Afrique nord-ouest (Guinée/Sénégal - pas trop haut ni trop à droite)
  { minX: 0.48, maxX: 0.78, minY: 0.06, maxY: 0.14 },
  // Afrique occidentale (côte descendante)
  { minX: 0.56, maxX: 0.78, minY: 0.12, maxY: 0.20 },
  // Afrique - Golfe de Guinée
  { minX: 0.72, maxX: 0.86, minY: 0.22, maxY: 0.36 },
  // Afrique - côte sud
  { minX: 0.76, maxX: 0.86, minY: 0.34, maxY: 0.50 },
];

// Régions terrestres pour ATLANTIQUE - BRÉSIL (gauche de la carte)
const ATLANTIQUE_BRAZIL_REGIONS = [
  // Brésil nord-est (bosse, Natal/Recife)
  { minX: 0.04, maxX: 0.12, minY: 0.28, maxY: 0.38 },
  // Brésil est (côte s'élargissant)
  { minX: 0.04, maxX: 0.30, minY: 0.38, maxY: 0.52 },
  // Brésil sud-est (partie la plus large)
  { minX: 0.04, maxX: 0.36, minY: 0.50, maxY: 0.66 },
  // Brésil sud
  { minX: 0.04, maxX: 0.26, minY: 0.64, maxY: 0.80 },
];


// Régions terrestres pour AMAZONIE (carte d'Amérique du Sud)
const AMAZONIE_REGIONS = [
  // Nord intérieur (Amazonie profonde)
  { minX: 0.35, maxX: 0.55, minY: 0.20, maxY: 0.40 },
  // Centre intérieur (Brésil central)
  { minX: 0.45, maxX: 0.65, minY: 0.45, maxY: 0.50 },
  // Est intérieur (large zone)
  { minX: 0.50, maxX: 0.70, minY: 0.30, maxY: 0.50 },
  // Ouest intérieur
  // Sud intérieur
];

// Régions pour AFRICA AGAIN - SUD (phase 1 : collecte, moitié basse de la carte visible)
// La carte visible va de y=0 (haut) à y~0.90 (juste au-dessus du pare-brise)
// Milieu de la carte visible = y~0.45 → partie inférieure = y de 0.50 à 0.85
const AFRICA_AGAIN_SOUTH_REGIONS = [
  // Moitié inférieure de l'écran (y=0.45 à y=0.82)
  { minX: 0.08, maxX: 0.40, minY: 0.45, maxY: 0.82 },
  { minX: 0.30, maxX: 0.65, minY: 0.45, maxY: 0.82 },
  { minX: 0.55, maxX: 0.85, minY: 0.45, maxY: 0.82 },
];

// Régions pour AFRICA AGAIN - NORD (phase 2 : distribution, moitié haute de la carte visible)
// Partie supérieure = y de 0.05 à 0.40
const AFRICA_AGAIN_NORTH_REGIONS = [
  // Nord-ouest (Mauritanie / Sahara ouest)
  { minX: 0.08, maxX: 0.40, minY: 0.05, maxY: 0.38 },
  // Centre-nord (Mali nord / Algérie sud)
  { minX: 0.30, maxX: 0.65, minY: 0.05, maxY: 0.38 },
  // Nord-est (Niger nord / Tchad)
  { minX: 0.55, maxX: 0.85, minY: 0.05, maxY: 0.38 },
];

// Régions pour SAHEL - combinées (1 seul avion, toute la carte)
const SAHEL_REGIONS = [
  { minX: 0.05, maxX: 0.40, minY: 0.05, maxY: 0.38 },
  { minX: 0.30, maxX: 0.65, minY: 0.05, maxY: 0.38 },
  { minX: 0.55, maxX: 0.85, minY: 0.05, maxY: 0.38 },
  { minX: 0.05, maxX: 0.40, minY: 0.42, maxY: 0.50 },
  { minX: 0.30, maxX: 0.65, minY: 0.42, maxY: 0.50 },
  { minX: 0.55, maxX: 0.85, minY: 0.42, maxY: 0.50 },
];


// ─── CAMPAGNE EUROPE ───────────────────────────────────────────────────────
// Carte d'Europe divisée en 4 quadrants, 20 destinations par quadrant
// Coordonnées en espace normalisé COMPLET (0-1, 0-1) de la carte entière

type Quadrant = 'BL' | 'BR' | 'TL' | 'TR';

// Bornes de chaque quadrant en coordonnées normalisées
const QUADRANT_BOUNDS: Record<Quadrant, { minX: number; maxX: number; minY: number; maxY: number }> = {
  BL: { minX: 0, maxX: 0.5, minY: 0.5, maxY: 1 },
  BR: { minX: 0.5, maxX: 1, minY: 0.5, maxY: 1 },
  TL: { minX: 0, maxX: 0.5, minY: 0, maxY: 0.5 },
  TR: { minX: 0.5, maxX: 1, minY: 0, maxY: 0.5 },
};

// Régions terrestres par quadrant (éviter la mer)
// Coordonnées basées sur l'analyse de campagne-europe-map.png
// x: 0=gauche, 1=droite; y: 0=haut, 1=bas
const CAMPAGNE_LAND_REGIONS: Record<Quadrant, Array<{ minX: number; maxX: number; minY: number; maxY: number }>> = {
  BL: [
    // Péninsule ibérique (Espagne intérieur + Portugal)
    { minX: 0.06, maxX: 0.34, minY: 0.58, maxY: 0.76 },
    // Espagne est / côte méditerranéenne
    { minX: 0.25, maxX: 0.34, minY: 0.62, maxY: 0.80 },
    // France sud (au-dessus des Pyrénées)
    { minX: 0.20, maxX: 0.34, minY: 0.52, maxY: 0.62 },
    // Afrique du Nord (Maroc côte)
    { minX: 0.08, maxX: 0.34, minY: 0.78, maxY: 0.84 },
  ],
  BR: [
    // France est / Suisse / Allemagne sud
    { minX: 0.52, maxX: 0.72, minY: 0.52, maxY: 0.62 },
    // Italie nord (Plaine du Pô)
    { minX: 0.58, maxX: 0.74, minY: 0.62, maxY: 0.72 },
    // Italie péninsule (botte)
    { minX: 0.62, maxX: 0.76, minY: 0.70, maxY: 0.84 },
    // Balkans ouest (Croatie, Serbie)
    { minX: 0.72, maxX: 0.78, minY: 0.60, maxY: 0.72 },
    // Balkans est / Grèce
    { minX: 0.72, maxX: 0.78, minY: 0.72, maxY: 0.84 },
    // Europe de l'Est (Pologne sud, Hongrie)
    { minX: 0.72, maxX: 0.78, minY: 0.52, maxY: 0.62 },
  ],
  TL: [
    // Islande
    { minX: 0.08, maxX: 0.18, minY: 0.08, maxY: 0.16 },
    // Irlande
    { minX: 0.12, maxX: 0.22, minY: 0.16, maxY: 0.24 },
    // Grande-Bretagne
    { minX: 0.18, maxX: 0.28, minY: 0.16, maxY: 0.28 },
    // Bretagne / Nord-Ouest France
    { minX: 0.20, maxX: 0.34, minY: 0.28, maxY: 0.38 },
    // Benelux / Nord France
    { minX: 0.28, maxX: 0.36, minY: 0.36, maxY: 0.44 },
  ],
  TR: [
    // Scandinavie (Norvège / Suède côte ouest)
    { minX: 0.52, maxX: 0.68, minY: 0.08, maxY: 0.22 },
    // Scandinavie sud (Suède sud / Danemark)
    { minX: 0.52, maxX: 0.64, minY: 0.22, maxY: 0.34 },
    // Finlande
    { minX: 0.72, maxX: 0.78, minY: 0.08, maxY: 0.18 },
    // Pays Baltes
    { minX: 0.72, maxX: 0.78, minY: 0.20, maxY: 0.30 },
    // Allemagne / Pologne
    { minX: 0.54, maxX: 0.76, minY: 0.34, maxY: 0.44 },
    // Biélorussie / Ukraine nord
    { minX: 0.76, maxX: 0.78, minY: 0.30, maxY: 0.44 },
  ],
};

// Navigation entre quadrants : pour chaque quadrant, les flèches de sortie
// Chaque flèche = { direction, targetQuadrant, arrowPosition (dans l'espace complet), entryPosition (dans l'espace complet) }
interface QuadrantArrow {
  direction: 'up' | 'down' | 'left' | 'right';
  targetQuadrant: Quadrant;
  arrowPosition: { x: number; y: number }; // position de la flèche en coordonnées complètes
  entryPosition: { x: number; y: number }; // position d'arrivée dans le quadrant cible
  label: string;
}

const QUADRANT_ARROWS: Record<Quadrant, QuadrantArrow[]> = {
  BL: [
    { direction: 'right', targetQuadrant: 'BR', arrowPosition: { x: 0.47, y: 0.68 }, entryPosition: { x: 0.53, y: 0.68 }, label: '→' },
    { direction: 'up', targetQuadrant: 'TL', arrowPosition: { x: 0.28, y: 0.53 }, entryPosition: { x: 0.28, y: 0.47 }, label: '↑' },
  ],
  BR: [
    { direction: 'left', targetQuadrant: 'BL', arrowPosition: { x: 0.53, y: 0.68 }, entryPosition: { x: 0.47, y: 0.68 }, label: '←' },
    { direction: 'up', targetQuadrant: 'TR', arrowPosition: { x: 0.72, y: 0.53 }, entryPosition: { x: 0.72, y: 0.47 }, label: '↑' },
  ],
  TL: [
    { direction: 'right', targetQuadrant: 'TR', arrowPosition: { x: 0.47, y: 0.32 }, entryPosition: { x: 0.53, y: 0.32 }, label: '→' },
    { direction: 'down', targetQuadrant: 'BL', arrowPosition: { x: 0.28, y: 0.40 }, entryPosition: { x: 0.28, y: 0.53 }, label: '↓' },
  ],
  TR: [
    { direction: 'down', targetQuadrant: 'BL', arrowPosition: { x: 0.72, y: 0.40 }, entryPosition: { x: 0.28, y: 0.53 }, label: '↓' },
    { direction: 'left', targetQuadrant: 'TL', arrowPosition: { x: 0.53, y: 0.32 }, entryPosition: { x: 0.47, y: 0.32 }, label: '←' },
  ],
};

interface CampaignPoint {
  point: MapPoint;
  quadrant: Quadrant;
  type: 'mail' | 'fuel' | 'key';
  amount: number; // Montant fixé dès la génération (ne change plus)
  visited: boolean;
}

// ─── MASQUE TERRE / MER (50×50) — carte campagne-europe-map.png ────────────
const CAMPAGNE_EUROPE_LAND_MASK: string[] = [
  "11111111000111111000000000000000000000100100000000",
  "11110000000001100000000000000111111110000000001000",
  "11110000000000000000000000111111111111111100001100",
  "11110000000000000000000011111111111111111111100111",
  "11000000000000000000000011111111111111111111100011",
  "10001000000011000000000111111111111111011111011111",
  "10011110000000000000001111111111111111110000111111",
  "11001100000000000000001111111000111111110001111111",
  "11100001100000000000111111111000111111111111111111",
  "11000000000000000000111111110011111111111111111111",
  "11000000000000000111111111100111111111111011111111",
  "11000000000000001111111111000011111111011101111111",
  "11000000000000001111111111000011111111101111111111",
  "11000000000000001111111111100011000001111111111111",
  "11100001110000001111111111100000011111111111101111",
  "11100001110000001100110111000000111111111111111111",
  "11000001100000000000011110000000011111111111111111",
  "10001001100000000000011110000011111111111111111111",
  "10111100100000000011011110000011111111111111111111",
  "00111000110000000010000000000011111111111111111111",
  "01100011110000000011100111111111111111111111111111",
  "00000111111100111111111111111111111111111111111111",
  "00000111111001111111111111111111111111111111111111",
  "10000000000111111111111111111111111111111111111111",
  "10000000001111111111111111111111111111111111111111",
  "00001111111111111111111111111111111111111111111111",
  "10000111111111111111111111111111111111111111111111",
  "10000011111111111111111111111111111111111111111001",
  "00000001111111111111111111111111111111111111100011",
  "00000001111111111111111111111111111111111000110011",
  "11110011111111111111101111111111111111100000000000",
  "11111111111111110011100111111111111111100000000000",
  "11111111111000000001110011111111111111100000000000",
  "11111111110000000001111000011111111111000000111000",
  "11111110000000001000011100000111111111100011111111",
  "11111110000000001000000111100111111000001111111111",
  "11111100000000001000000011000111000001111111111111",
  "01100000000000100000000011000011100001111111111111",
  "10000000000000000000000110000001000000111111111111",
  "11111111111111111100011100001001100000001100110011",
  "11111111111111111100000001011000000000000000000011",
  "11111111111111111100000001010000000000001110000011",
  "11111111111111111100000000000000000000000000000111",
  "11111111111111111100000000000000000000000000000111",
  "11111111111111111111111000000011110000000000001111",
  "11111111111111111111111100000011111111100111111111",
  "11111111111111111111111111110111111111111111111111",
  "11111111111111111111111111111111111111111111111111",
  "11111111111111111111111111111111111111111111111111",
  "11111111111111111111111111111111111111111111111111",
];

// Vérifie si un point (x, y) normalisé [0-1] est sur terre dans la carte campagne
const isOnLandCampaign = (x: number, y: number): boolean => {
  // Zone sûre : éviter pare-brise et bord droit
  if (x < 0.03 || x > 0.85 || y < 0.03 || y > 0.88) return false;
  const gridSize = CAMPAGNE_EUROPE_LAND_MASK.length; // 50
  const gx = Math.min(Math.floor(x * gridSize), gridSize - 1);
  const gy = Math.min(Math.floor(y * gridSize), gridSize - 1);
  if (gy < 0 || gy >= gridSize || gx < 0 || gx >= gridSize) return false;
  return CAMPAGNE_EUROPE_LAND_MASK[gy][gx] === '1';
};

// Génère un point aléatoire sur terre dans un quadrant spécifique — validé par masque
const generateCampaignLandPoint = (
  quadrant: Quadrant,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = CAMPAGNE_LAND_REGIONS[quadrant];
  let attempts = 0;
  const maxAttempts = 500;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    // Empêcher les destinations trop à droite — limites par quadrant
    const maxXForQuadrant: Record<string, number> = { TL: 0.36, TR: 0.78, BL: 0.36, BR: 0.78 };
    if (x > (maxXForQuadrant[quadrant] || 0.78)) { attempts++; continue; }
    
    // Empêcher les destinations trop en haut
    const minYForQuadrant: Record<string, number> = { TL: 0.06, TR: 0.06, BL: 0.52, BR: 0.52 };
    if (y < (minYForQuadrant[quadrant] || 0.06)) { attempts++; continue; }
    
    // Empêcher les destinations derrière le pare-brise (bas de chaque quadrant)
    const maxYForQuadrant: Record<string, number> = { TL: 0.44, TR: 0.44, BL: 0.86, BR: 0.86 };
    if (y > (maxYForQuadrant[quadrant] || 0.86)) { attempts++; continue; }
    
    // ── Validation masque terre/mer ──
    if (!isOnLandCampaign(x, y)) {
      attempts++;
      continue;
    }
    
    // Vérifier la distance minimum avec les points existants
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `camp_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        x,
        y,
      };
    }
    attempts++;
  }
  
  // Fallback avec anti-chevauchement
  const fbCandidates: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 300) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isOnLandCampaign(x, y)) {
      const pt: MapPoint = { id: `camp_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  // Dernier recours
  return {
    id: `camp_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    x: (regions[0].minX + regions[0].maxX) / 2,
    y: (regions[0].minY + regions[0].maxY) / 2,
  };
};

// Génère les destinations de la campagne :
// - BL : 7 courriers (1-3) + 3 bidons d'essence
// - BR, TL, TR : 10 courriers (1-3) chacun, pas de bidon
// - Montants fixés dès la génération (ne changent jamais)
const generateCampaignPoints = (): CampaignPoint[] => {
  const allPoints: CampaignPoint[] = [];
  const allMapPoints: MapPoint[] = [];
  const quadrants: Quadrant[] = ['BL', 'BR', 'TL', 'TR'];
  
  // Pré-remplir avec les positions des flèches de navigation pour éviter les chevauchements
  for (const q of quadrants) {
    const arrows = QUADRANT_ARROWS[q] || [];
    for (const arrow of arrows) {
      allMapPoints.push({ id: `arrow_${q}_${arrow.direction}`, x: arrow.arrowPosition.x, y: arrow.arrowPosition.y });
    }
  }
  
  for (const quadrant of quadrants) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const point = generateCampaignLandPoint(quadrant, allMapPoints);
      allMapPoints.push(point);
      
      let type: 'mail' | 'fuel' | 'key';
      let amount: number;
      
      if (quadrant === 'BL' && i >= 7) {
        // 3 derniers points du BL = bidons d'essence
        type = 'fuel';
        amount = 30;
      } else {
        // Tous les autres = courrier (1 à 3 max)
        type = 'mail';
        amount = Math.floor(Math.random() * 3) + 1; // 1, 2 ou 3
      }
      
      allPoints.push({ point, quadrant, type, amount, visited: false });
    }
  }
  
  return allPoints;
};

// ─── CAMPAGNE SCANDINAVIE ─────────────────────────────────────────────────
// Même mécanique que Campagne Europe mais sur la carte de Scandinavie

// Régions terrestres par quadrant pour la Scandinavie
// La carte montre : Norvège à gauche, Suède au centre, Finlande à droite
// Danemark en bas-gauche, Baltique au centre
const SCANDINAVIE_LAND_REGIONS: Record<Quadrant, Array<{ minX: number; maxX: number; minY: number; maxY: number }>> = {
  BL: [
    // Norvège/Suède sud - zone haute du quadrant
    { minX: 0.06, maxX: 0.34, minY: 0.52, maxY: 0.62 },
    // Péninsule centre (zone étroite)
    { minX: 0.10, maxX: 0.26, minY: 0.60, maxY: 0.76 },
    // Danemark / côte élargie (zone basse)
    { minX: 0.04, maxX: 0.32, minY: 0.76, maxY: 0.88 },
    // Zone large intermédiaire
    { minX: 0.06, maxX: 0.30, minY: 0.68, maxY: 0.82 },
  ],
  BR: [
    // Finlande / Russie (éloigné du bord droit)
    { minX: 0.56, maxX: 0.78, minY: 0.52, maxY: 0.62 },
    { minX: 0.60, maxX: 0.78, minY: 0.60, maxY: 0.74 },
    { minX: 0.56, maxX: 0.78, minY: 0.72, maxY: 0.85 },
    // Suède sud-est
    { minX: 0.52, maxX: 0.62, minY: 0.54, maxY: 0.66 },
  ],
  TL: [
    // Norvège nord (éloigné du bord haut)
    { minX: 0.06, maxX: 0.20, minY: 0.10, maxY: 0.24 },
    // Norvège centre
    { minX: 0.08, maxX: 0.22, minY: 0.22, maxY: 0.38 },
    // Suède nord-ouest
    { minX: 0.18, maxX: 0.36, minY: 0.14, maxY: 0.30 },
    // Suède centre-ouest
    { minX: 0.24, maxX: 0.42, minY: 0.30, maxY: 0.44 },
  ],
  TR: [
    // Finlande nord (éloigné du bord haut et du bord droit)
    { minX: 0.58, maxX: 0.76, minY: 0.10, maxY: 0.22 },
    // Finlande centre
    { minX: 0.56, maxX: 0.74, minY: 0.22, maxY: 0.38 },
    // Suède nord-est
    { minX: 0.52, maxX: 0.64, minY: 0.16, maxY: 0.32 },
    // Finlande est
    { minX: 0.66, maxX: 0.78, minY: 0.30, maxY: 0.44 },
  ],
};

// Flèches de navigation entre quadrants — Scandinavie
const SCANDINAVIE_QUADRANT_ARROWS: Record<Quadrant, QuadrantArrow[]> = {
  BL: [
    { direction: 'right', targetQuadrant: 'BR', arrowPosition: { x: 0.47, y: 0.68 }, entryPosition: { x: 0.53, y: 0.68 }, label: '→' },
    { direction: 'up', targetQuadrant: 'TL', arrowPosition: { x: 0.22, y: 0.53 }, entryPosition: { x: 0.22, y: 0.47 }, label: '↑' },
  ],
  BR: [
    { direction: 'left', targetQuadrant: 'BL', arrowPosition: { x: 0.53, y: 0.68 }, entryPosition: { x: 0.47, y: 0.68 }, label: '←' },
    { direction: 'up', targetQuadrant: 'TR', arrowPosition: { x: 0.68, y: 0.53 }, entryPosition: { x: 0.68, y: 0.47 }, label: '↑' },
  ],
  TL: [
    { direction: 'right', targetQuadrant: 'TR', arrowPosition: { x: 0.47, y: 0.28 }, entryPosition: { x: 0.53, y: 0.28 }, label: '→' },
    { direction: 'down', targetQuadrant: 'BL', arrowPosition: { x: 0.22, y: 0.40 }, entryPosition: { x: 0.22, y: 0.53 }, label: '↓' },
  ],
  TR: [
    { direction: 'down', targetQuadrant: 'BR', arrowPosition: { x: 0.68, y: 0.40 }, entryPosition: { x: 0.68, y: 0.53 }, label: '↓' },
    { direction: 'left', targetQuadrant: 'TL', arrowPosition: { x: 0.53, y: 0.28 }, entryPosition: { x: 0.47, y: 0.28 }, label: '←' },
  ],
};

// Validation terre/mer pour la carte Scandinavie — utilise LAND_MASKS['scandinavie']
const isOnLandScandinavie = (x: number, y: number): boolean => {
  if (x < 0.03 || x > 0.85 || y < 0.03 || y > 0.88) return false;
  return isValidDestination('scandinavie', x, y);
};

// Génère un point aléatoire sur terre dans un quadrant — Scandinavie
const generateScandinavieLandPoint = (
  quadrant: Quadrant,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = SCANDINAVIE_LAND_REGIONS[quadrant];
  let attempts = 0;
  const maxAttempts = 500;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    // Limites bord droit et pare-brise par quadrant
    const maxXQ: Record<string, number> = { TL: 0.38, TR: 0.86, BL: 0.38, BR: 0.86 };
    const maxYQ: Record<string, number> = { TL: 0.44, TR: 0.44, BL: 0.94, BR: 0.94 };
    if (x > (maxXQ[quadrant] || 0.85) || y > (maxYQ[quadrant] || 0.94)) { attempts++; continue; }
    
    if (!isOnLandScandinavie(x, y)) {
      attempts++;
      continue;
    }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `scand_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        x, y,
      };
    }
    attempts++;
  }
  
  // Fallback avec anti-chevauchement
  const fbCandidates: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 300) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isOnLandScandinavie(x, y)) {
      const pt: MapPoint = { id: `scand_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  return {
    id: `scand_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    x: (regions[0].minX + regions[0].maxX) / 2,
    y: (regions[0].minY + regions[0].maxY) / 2,
  };
};

// Génère les 40 destinations Scandinavie (même règles que Campagne Europe)
const generateScandinaviePoints = (): CampaignPoint[] => {
  const allPoints: CampaignPoint[] = [];
  const allMapPoints: MapPoint[] = [];
  const quadrants: Quadrant[] = ['BL', 'BR', 'TL', 'TR'];
  
  for (const quadrant of quadrants) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const point = generateScandinavieLandPoint(quadrant, allMapPoints);
      allMapPoints.push(point);
      
      let type: 'mail' | 'fuel' | 'key';
      let amount: number;
      
      if (quadrant === 'BL' && i >= 7) {
        type = 'fuel';
        amount = 30;
      } else {
        type = 'mail';
        amount = Math.floor(Math.random() * 3) + 1;
      }
      
      allPoints.push({ point, quadrant, type, amount, visited: false });
    }
  }
  
  return allPoints;
};


// ─── CAMPAGNE CORSICA ─────────────────────────────────────────────────────
// 2 secteurs : Nord (Corse Nord : Cap Corse → centre) et Sud (Corse Sud : Ajaccio → Bonifacio)
// Mêmes mécaniques que Campagne Scandinavie (20 mails max, bureau de poste au Sud)

// Régions terrestres par secteur pour la Corse
// Nord = 'TL' — moitié nord de la Corse (Cap Corse, Bastia, Calvi, Saint-Florent, Corte)
// Sud = 'BL' — moitié sud de la Corse (Ajaccio, Porto-Vecchio, Bonifacio) + bureau de poste
const CORSICA_LAND_REGIONS: Record<Quadrant, Array<{ minX: number; maxX: number; minY: number; maxY: number }>> = {
  TL: [
    // Cap Corse (pointe nord en haut, fine bande verticale)
    { minX: 0.62, maxX: 0.74, minY: 0.06, maxY: 0.28 },
    // Élargissement sous Cap Corse (Saint-Florent / Bastia base)
    { minX: 0.40, maxX: 0.74, minY: 0.30, maxY: 0.42 },
    // Corps nord large (Calvi, Île-Rousse à l'ouest, Bastia à l'est)
    { minX: 0.24, maxX: 0.74, minY: 0.42, maxY: 0.60 },
    // Centre nord (Corte, Balagne)
    { minX: 0.22, maxX: 0.74, minY: 0.60, maxY: 0.74 },
  ],
  BL: [
    // Corps centre haut (continuation depuis le nord, Vivario / Vico)
    { minX: 0.30, maxX: 0.62, minY: 0.02, maxY: 0.18 },
    // Ajaccio / Porto-Vecchio (centre)
    { minX: 0.34, maxX: 0.66, minY: 0.18, maxY: 0.32 },
    // Sud du corps (Sartène, Sainte-Lucie)
    { minX: 0.36, maxX: 0.62, minY: 0.32, maxY: 0.46 },
    // Pointe Bonifacio
    { minX: 0.46, maxX: 0.58, minY: 0.46, maxY: 0.55 },
  ],
  // BR et TR non utilisés pour Corsica
  BR: [],
  TR: [],
};

// Flèches de navigation entre les 2 secteurs — Corsica
// Zone visible de la carte ≈ y: 0.02 à 0.48 (au-dessus du pare-brise)
const CORSICA_QUADRANT_ARROWS: Record<Quadrant, QuadrantArrow[]> = {
  TL: [
    // Flèche centrée juste au-dessus du pare-brise (bas de la zone carte visible)
    { direction: 'down', targetQuadrant: 'BL', arrowPosition: { x: 0.50, y: 0.75 }, entryPosition: { x: 0.50, y: 0.16 }, label: '↓ SUD' },
  ],
  BL: [
    // Flèche centrée EN HAUT de l'écran visible
    { direction: 'up', targetQuadrant: 'TL', arrowPosition: { x: 0.50, y: 0.06 }, entryPosition: { x: 0.50, y: 0.36 }, label: '↑ NORD' },
  ],
  BR: [],
  TR: [],
};

// Validation terre/mer pour la carte Corsica
// Les coordonnées sont en espace viewport (0-1), chaque secteur a son propre masque
const isOnLandCorsica = (x: number, y: number, quadrant: Quadrant = 'TL'): boolean => {
  if (x < 0.03 || x > 0.85 || y < 0.01 || y > 0.98) return false;
  const maskId = quadrant === 'BL' ? 'corsica_south' : 'corsica_north';
  return isValidDestination(maskId, x, y);
};

// Génère un point aléatoire sur terre dans un secteur — Corsica
const generateCorsicaLandPoint = (
  quadrant: Quadrant,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = CORSICA_LAND_REGIONS[quadrant];
  if (!regions || regions.length === 0) {
    return { id: `cors_fallback_${Date.now()}`, x: 0.40, y: 0.50 };
  }
  let attempts = 0;
  const maxAttempts = 500;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isOnLandCorsica(x, y, quadrant)) {
      attempts++;
      continue;
    }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `cors_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        x, y,
      };
    }
    attempts++;
  }
  
  // Fallback avec anti-chevauchement
  const fbCandidates2: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 300) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isOnLandCorsica(x, y, quadrant)) {
      const pt: MapPoint = { id: `cors_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates2.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates2.length > 0) return pickBestCandidate(fbCandidates2, existingPoints);
  return {
    id: `cors_${quadrant}_${Date.now()}_fallback`,
    x: (regions[0].minX + regions[0].maxX) / 2,
    y: (regions[0].minY + regions[0].maxY) / 2,
  };
};

// Génère les destinations Corsica : 20 au Nord, 20 au Sud
const generateCorsicaPoints = (): CampaignPoint[] => {
  const allPoints: CampaignPoint[] = [];
  const allMapPoints: MapPoint[] = [];
  
  // === SECTEUR NORD (TL) : 10 destinations (7 courrier + 3 fuel) — Côte d'Azur uniquement ===
  for (let i = 0; i < 10; i++) {
    const point = generateCorsicaLandPoint('TL', allMapPoints);
    allMapPoints.push(point);
    
    let type: 'mail' | 'fuel' | 'key';
    let amount: number;
    
    // Les 3 derniers sont des bidons d'essence
    if (i >= 7) {
      type = 'fuel';
      amount = 30;
    } else if (i === 0) {
      // 1 destination à 6 courriers dans le secteur Nord
      type = 'mail';
      amount = 6;
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1;
    }
    
    allPoints.push({ point, quadrant: 'TL', type, amount, visited: false });
  }
  
  // === SECTEUR SUD (BL) : 10 destinations, UNIQUEMENT courrier sur la Corse ===
  for (let i = 0; i < 10; i++) {
    const point = generateCorsicaLandPoint('BL', allMapPoints);
    allMapPoints.push(point);
    
    allPoints.push({
      point,
      quadrant: 'BL',
      type: 'mail',
      // 1 destination à 6 courriers dans le secteur Sud (la première)
      amount: i === 0 ? 6 : Math.floor(Math.random() * 5) + 1,
      visited: false,
    });
  }
  
  return allPoints;
};


// ─── CAMPAGNE SARDEGNA ─────────────────────────────────────────────────────
// 3 secteurs : Nord (TL) = Sud Corse → Nord Sardaigne, Centre (BL) = Sardaigne, Sud (BR) = Sud Sardaigne → Tunisie
// Règle identique à Europe 40, capacité 20 courriers, bureau de poste en Tunisie, objectif 70 courriers

// Régions terrestres par secteur pour la Sardaigne
const SARDEGNA_LAND_REGIONS: Record<Quadrant, Array<{ minX: number; maxX: number; minY: number; maxY: number }>> = {
  TL: [
    // Nord Sardaigne (île large, centrée)
    { minX: 0.18, maxX: 0.78, minY: 0.14, maxY: 0.40 },
    { minX: 0.22, maxX: 0.76, minY: 0.38, maxY: 0.62 },
    { minX: 0.24, maxX: 0.74, minY: 0.60, maxY: 0.82 },
  ],
  BL: [
    // Centre Sardaigne (corps principal)
    { minX: 0.18, maxX: 0.78, minY: 0.10, maxY: 0.36 },
    { minX: 0.22, maxX: 0.76, minY: 0.34, maxY: 0.58 },
    { minX: 0.24, maxX: 0.74, minY: 0.56, maxY: 0.76 },
  ],
  BR: [
    // Tunisie : côte nord (mer en haut, terre au centre et en bas)
    { minX: 0.08, maxX: 0.72, minY: 0.28, maxY: 0.52 },
    // Tunisie : intérieur (large masse de terre)
    { minX: 0.04, maxX: 0.82, minY: 0.50, maxY: 0.82 },
  ],
  TR: [],
};

// Flèches de navigation entre les 3 secteurs — Sardegna
const SARDEGNA_QUADRANT_ARROWS: Record<Quadrant, QuadrantArrow[]> = {
  TL: [
    { direction: 'down', targetQuadrant: 'BL', arrowPosition: { x: 0.50, y: 0.75 }, entryPosition: { x: 0.50, y: 0.10 }, label: '↓ CENTRE' },
  ],
  BL: [
    { direction: 'up', targetQuadrant: 'TL', arrowPosition: { x: 0.50, y: 0.04 }, entryPosition: { x: 0.50, y: 0.85 }, label: '↑ NORD' },
    { direction: 'down', targetQuadrant: 'BR', arrowPosition: { x: 0.50, y: 0.75 }, entryPosition: { x: 0.50, y: 0.10 }, label: '↓ TUNISIE' },
  ],
  BR: [
    { direction: 'up', targetQuadrant: 'BL', arrowPosition: { x: 0.50, y: 0.04 }, entryPosition: { x: 0.50, y: 0.85 }, label: '↑ CENTRE' },
  ],
  TR: [],
};

// Validation terre/mer pour la carte Sardegna
const isOnLandSardegna = (x: number, y: number, quadrant: Quadrant = 'TL'): boolean => {
  if (x < 0.03 || x > 0.85 || y < 0.01 || y > 0.98) return false;
  const maskId = quadrant === 'BL' ? 'sardegna_center' : quadrant === 'BR' ? 'sardegna_south' : 'sardegna_north';
  return isValidDestination(maskId, x, y);
};

// Génère un point aléatoire sur terre dans un secteur — Sardegna
const generateSardegnaLandPoint = (
  quadrant: Quadrant,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = SARDEGNA_LAND_REGIONS[quadrant];
  if (!regions || regions.length === 0) {
    return { id: `sard_fallback_${Date.now()}`, x: 0.40, y: 0.50 };
  }
  let attempts = 0;
  const maxAttempts = 500;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isOnLandSardegna(x, y, quadrant)) {
      attempts++;
      continue;
    }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `sard_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        x, y,
      };
    }
    attempts++;
  }
  
  // Fallback avec anti-chevauchement
  const fbCandidates: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 1000) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isOnLandSardegna(x, y, quadrant)) {
      const pt: MapPoint = { id: `sard_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  // Dernier recours — parcourir le masque pour trouver un point valide
  const scanCandidates: MapPoint[] = [];
  for (let my = 0.1; my < 0.9; my += 0.02) {
    for (let mx = 0.1; mx < 0.9; mx += 0.02) {
      if (isOnLandSardegna(mx, my, quadrant)) {
        scanCandidates.push({ id: `sard_${quadrant}_${Date.now()}_scan`, x: mx, y: my });
      }
    }
  }
  if (scanCandidates.length > 0) return pickBestCandidate(scanCandidates, existingPoints);
  return {
    id: `sard_${quadrant}_${Date.now()}_fallback`,
    x: (regions[0].minX + regions[0].maxX) / 2,
    y: (regions[0].minY + regions[0].maxY) / 2,
  };
};

// Génère 3 destinations aléatoires pour un tour — Sardegna (pas de réparation)
const generateSardegnaCargoOptions = (
  currentPoint: MapPoint,
  quadrant: Quadrant,
  visitedPoints: MapPoint[] = [],
  aerodromePoint?: MapPoint | null
): CargoOption[] => {
  const options: CargoOption[] = [];
  const usedPoints: MapPoint[] = [...visitedPoints, currentPoint];
  
  // Exclure les positions des flèches et de l'aérodrome pour éviter les superpositions
  const arrows = SARDEGNA_QUADRANT_ARROWS[quadrant];
  for (const arrow of arrows) {
    usedPoints.push({ id: 'arrow_excl', x: arrow.arrowPosition.x, y: arrow.arrowPosition.y });
  }
  if (aerodromePoint) {
    usedPoints.push(aerodromePoint);
  }
  
  for (let i = 0; i < 3; i++) {
    const point = generateSardegnaLandPoint(quadrant, [...usedPoints, ...options.map(o => o.point)]);
    
    // Type aléatoire : ~30% fuel, ~70% courrier (PAS de réparation)
    const rand = Math.random();
    let type: 'mail' | 'fuel';
    let amount: number;
    if (rand < 0.30) {
      type = 'fuel';
      amount = 25 + Math.floor(Math.random() * 15); // 25-39
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1; // 1-5
    }
    
    options.push({ point, type, amount });
  }
  
  // NOTE: l'aérodrome n'est PAS un cargo option, c'est un point fixe (comme la poste)
  // Le changement d'avion se fait via un bouton dédié quand l'avion est à l'aérodrome
  
  // Ajouter les flèches de navigation du secteur
  for (const arrow of arrows) {
    options.push({
      point: {
        id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
        x: arrow.arrowPosition.x,
        y: arrow.arrowPosition.y,
      },
      type: 'arrow' as any,
      amount: 0,
    });
  }
  
  return options;
};


// ─── CAMPAGNE AFRIQUE DU NORD ────────────────────────────────────────────────
// 3 secteurs HORIZONTAUX : Gauche (TL=Maroc), Centre (TR=Algérie), Droite (BR=Tunisie)
// Règles identiques à Sardegna (3 options/tour), avion départ à droite, poste à gauche

const AFNORD_LAND_REGIONS: Record<Quadrant, Array<{ minX: number; maxX: number; minY: number; maxY: number }>> = {
  TL: [
    // Maroc — terre au-dessus du pare-brise uniquement (y < 0.50)
    { minX: 0.08, maxX: 0.85, minY: 0.18, maxY: 0.35 },
    { minX: 0.08, maxX: 0.85, minY: 0.35, maxY: 0.48 },
  ],
  TR: [
    // Algérie — terre au-dessus du pare-brise
    { minX: 0.05, maxX: 0.85, minY: 0.18, maxY: 0.35 },
    { minX: 0.05, maxX: 0.85, minY: 0.35, maxY: 0.48 },
  ],
  BR: [
    // Tunisie — terre au-dessus du pare-brise
    { minX: 0.05, maxX: 0.75, minY: 0.18, maxY: 0.35 },
    { minX: 0.05, maxX: 0.70, minY: 0.35, maxY: 0.48 },
  ],
  BL: [],
};

// Flèches horizontales ← →
const AFNORD_QUADRANT_ARROWS: Record<Quadrant, QuadrantArrow[]> = {
  TL: [
    { direction: 'right' as any, targetQuadrant: 'TR', arrowPosition: { x: 0.92, y: 0.45 }, entryPosition: { x: 0.08, y: 0.45 }, label: '→ ALGÉRIE' },
  ],
  TR: [
    { direction: 'left' as any, targetQuadrant: 'TL', arrowPosition: { x: 0.06, y: 0.45 }, entryPosition: { x: 0.90, y: 0.45 }, label: '← MAROC' },
    { direction: 'right' as any, targetQuadrant: 'BR', arrowPosition: { x: 0.92, y: 0.45 }, entryPosition: { x: 0.08, y: 0.45 }, label: '→ TUNISIE' },
  ],
  BR: [
    { direction: 'left' as any, targetQuadrant: 'TR', arrowPosition: { x: 0.06, y: 0.45 }, entryPosition: { x: 0.90, y: 0.45 }, label: '← ALGÉRIE' },
  ],
  BL: [],
};

const isOnLandAfNord = (x: number, y: number, quadrant: Quadrant = 'TL'): boolean => {
  if (x < 0.03 || x > 0.85 || y < 0.01 || y > 0.98) return false;
  const maskId = quadrant === 'TR' ? 'afnord_center' : quadrant === 'BR' ? 'afnord_right' : 'afnord_left';
  return isValidDestination(maskId, x, y);
};

const generateAfNordLandPoint = (
  quadrant: Quadrant,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = AFNORD_LAND_REGIONS[quadrant];
  if (!regions || regions.length === 0) {
    return { id: `afn_fallback_${Date.now()}`, x: 0.50, y: 0.50 };
  }
  let attempts = 0;
  while (attempts < 500) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (!isOnLandAfNord(x, y, quadrant)) { attempts++; continue; }
    const tooClose = isDestTooClose(x, y, existingPoints);
    if (!tooClose) {
      return { id: `afn_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
    }
    attempts++;
  }
  // Fallback avec anti-chevauchement — scan le masque
  const fbCandidates: MapPoint[] = [];
  for (let my = 0.2; my < 0.9; my += 0.02) {
    for (let mx = 0.1; mx < 0.9; mx += 0.02) {
      if (isOnLandAfNord(mx, my, quadrant)) {
        const pt: MapPoint = { id: `afn_${quadrant}_${Date.now()}_scan`, x: mx, y: my };
        if (!isDestTooClose(mx, my, existingPoints)) return pt;
        fbCandidates.push(pt);
      }
    }
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  return { id: `afn_${quadrant}_${Date.now()}_fb`, x: 0.50, y: 0.50 };
};

const generateAfNordCargoOptions = (
  currentPoint: MapPoint,
  quadrant: Quadrant,
  visitedPoints: MapPoint[] = []
): CargoOption[] => {
  const options: CargoOption[] = [];
  const usedPoints: MapPoint[] = [...visitedPoints, currentPoint];
  
  for (let i = 0; i < 3; i++) {
    const point = generateAfNordLandPoint(quadrant, usedPoints);
    usedPoints.push(point);
    let type: 'mail' | 'fuel';
    let amount: number;
    // Fuel uniquement dans le secteur DROIT (BR = Tunisie)
    if (quadrant === 'BR' && Math.random() < 0.30) {
      type = 'fuel';
      amount = 25 + Math.floor(Math.random() * 15);
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1;
    }
    options.push({ point, type, amount });
  }
  
  // Flèches de navigation
  const arrows = AFNORD_QUADRANT_ARROWS[quadrant];
  for (const arrow of arrows) {
    options.push({
      point: { id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`, x: arrow.arrowPosition.x, y: arrow.arrowPosition.y },
      type: 'arrow' as any,
      amount: 0,
    });
  }
  return options;
};





// ─── RETOUR FRANCE (2 secteurs verticaux: Nord=France, Sud=Espagne+AfNord) ───
const RETOUR_FRANCE_LAND_REGIONS: Record<Quadrant, Array<{ minX: number; maxX: number; minY: number; maxY: number }>> = {
  TL: [
    // France corps principal (hexagone central)
    { minX: 0.20, maxX: 0.82, minY: 0.24, maxY: 0.52 },
    // France sud + Pyrénées
    { minX: 0.14, maxX: 0.82, minY: 0.50, maxY: 0.76 },
  ],
  BL: [
    // Espagne (péninsule ibérique, partie supérieure)
    { minX: 0.08, maxX: 0.82, minY: 0.06, maxY: 0.30 },
    // Espagne sud + côte méditerranéenne
    { minX: 0.08, maxX: 0.70, minY: 0.28, maxY: 0.48 },
    // Algérie nord (grande masse de terre en bas)
    { minX: 0.10, maxX: 0.82, minY: 0.60, maxY: 0.88 },
  ],
  BR: [],
  TR: [],
};

const RETOUR_FRANCE_QUADRANT_ARROWS: Record<Quadrant, QuadrantArrow[]> = {
  TL: [
    { direction: 'down', targetQuadrant: 'BL', arrowPosition: { x: 0.50, y: 0.82 }, entryPosition: { x: 0.50, y: 0.12 }, label: '↓ SUD' },
  ],
  BL: [
    { direction: 'up', targetQuadrant: 'TL', arrowPosition: { x: 0.50, y: 0.08 }, entryPosition: { x: 0.50, y: 0.50 }, label: '↑ NORD' },
  ],
  BR: [],
  TR: [],
};

const isOnLandRetourFrance = (x: number, y: number, quadrant: Quadrant = 'TL'): boolean => {
  if (x < 0.03 || x > 0.85 || y < 0.01 || y > 0.90) return false;
  const maskId = quadrant === 'BL' ? 'retourfrance_south' : 'retourfrance_north';
  return isValidDestination(maskId, x, y);
};

const generateRetourFranceLandPoint = (
  quadrant: Quadrant,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = RETOUR_FRANCE_LAND_REGIONS[quadrant];
  if (!regions || regions.length === 0) return { id: `rf_${Date.now()}`, x: 0.4, y: 0.3 };
  const maxAttempts = 500;
  let attempts = 0;
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (x > 0.82 || y > 0.88) { attempts++; continue; }
    if (!isOnLandRetourFrance(x, y, quadrant)) { attempts++; continue; }
    const tooClose = isDestTooClose(x, y, existingPoints);
    if (tooClose) { attempts++; continue; }
    return { id: `rf_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
  }
  const fbCandidates: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 300) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isOnLandRetourFrance(x, y, quadrant)) {
      const pt: MapPoint = { id: `rf_${quadrant}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  return { id: `rf_${quadrant}_${Date.now()}_fb`, x: (regions[0].minX + regions[0].maxX) / 2, y: (regions[0].minY + regions[0].maxY) / 2 };
};

// Génère les options de cargo pour RETOUR FRANCE
// Mix: collecte (+1 à +5), distribution (-1 à -5), fuel, repair
const generateRetourFranceCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  currentMailInPlane: number,
  currentQuadrant: Quadrant
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateRetourFranceLandPoint(currentQuadrant, [...allExistingPoints, ...options.map(o => o.point)]);
    const rand = Math.random();
    
    if (rand < 0.10) {
      // 10% fuel
      options.push({ point, type: 'fuel', amount: 30 + Math.floor(Math.random() * 20) });
    } else if (rand < 0.18) {
      // 8% repair
      options.push({ point, type: 'repair', amount: 1 });
    } else if (rand < 0.55 || currentMailInPlane === 0) {
      // ~37% collect (forced if plane empty)
      const maxCollect = 20 - currentMailInPlane;
      const amount = Math.min(1 + Math.floor(Math.random() * 5), maxCollect > 0 ? maxCollect : 1);
      options.push({ point, type: 'mail', amount });
    } else {
      // ~45% distribute (delivery)
      const amount = Math.min(1 + Math.floor(Math.random() * 5), currentMailInPlane);
      options.push({ point, type: 'delivery', amount: amount > 0 ? amount : 1 });
    }
  }
  
  // Ajouter les flèches de navigation
  const arrows = RETOUR_FRANCE_QUADRANT_ARROWS[currentQuadrant];
  if (arrows) {
    for (const arrow of arrows) {
      options.push({
        point: { id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`, x: arrow.arrowPosition.x, y: arrow.arrowPosition.y },
        type: 'arrow' as any,
        amount: 0,
      });
    }
  }
  
  return options;
};


// Points côtiers pour BUENOS AIRES - positions exactes le long du littoral terre/mer
const BUENOS_AIRES_COAST_POINTS = [
  // Estuaire nord-ouest (Rio de la Plata)
  { x: 0.042, y: 0.066 },
  { x: 0.117, y: 0.080 },
  { x: 0.155, y: 0.125 },
  { x: 0.198, y: 0.187 },
  { x: 0.240, y: 0.236 },
  // Côte nord (Rio de la Plata → Uruguay)
  { x: 0.302, y: 0.215 },
  { x: 0.371, y: 0.251 },
  { x: 0.450, y: 0.266 },
  { x: 0.520, y: 0.273 },
  { x: 0.579, y: 0.263 },
  { x: 0.647, y: 0.267 },
  { x: 0.710, y: 0.270 },
  { x: 0.767, y: 0.260 },
  // Côte est (vers le Brésil)
  { x: 0.813, y: 0.236 },
  { x: 0.844, y: 0.199 },
  { x: 0.854, y: 0.153 },
  { x: 0.833, y: 0.110 },
  { x: 0.801, y: 0.073 },
  { x: 0.779, y: 0.050 },
  // Côte sud (Argentine sud)
  { x: 0.564, y: 0.502 },
  { x: 0.470, y: 0.615 },
  { x: 0.381, y: 0.727 },
  { x: 0.310, y: 0.820 },
  { x: 0.260, y: 0.900 },
  // Points intermédiaires côte est → sud
  { x: 0.210, y: 0.340 },
  { x: 0.220, y: 0.420 },
];

// Régions terrestres pour PATAGONIE (carte Argentine sud)
const PATAGONIE_REGIONS = [
  { minX: 0.15, maxX: 0.55, minY: 0.10, maxY: 0.20 },
  { minX: 0.18, maxX: 0.50, minY: 0.20, maxY: 0.35 },
  { minX: 0.15, maxX: 0.48, minY: 0.35, maxY: 0.50 },
];

// Régions terrestres pour PARAGUAY (carte intérieur continent)
const PARAGUAY_REGIONS = [
  { minX: 0.08, maxX: 0.85, minY: 0.08, maxY: 0.25 },
  { minX: 0.08, maxX: 0.85, minY: 0.25, maxY: 0.45 },
  { minX: 0.08, maxX: 0.85, minY: 0.45, maxY: 0.50 },
];


// Régions terrestres pour MAURITANIE (carte désertique)

// ANDES: Barrière de montagnes et régions
// Nouvelle carte andes-map-v3.png : portrait, continent au centre, océans de part et d'autre
const ANDES_BARRIER_X = 0.30; // Position X de la chaîne de montagnes
const ANDES_COL = { x: 0.28, y: 0.16 }; // Col (point de passage au nord, où il y a de la terre des 2 côtés)

// ─── MASQUE TERRE / MER (50×50) — carte andes-map-v3.png ──────────────────
const ANDES_LAND_MASK: string[] = [
  "00000011111111111111111111111110000000000000000000",
  "00000000111111111111111111111111100000000000000000",
  "00000000001111111111111111111111110000000000000000",
  "00000000001111111111111111111111111111100000000001",
  "00000000001111111111111111111111111111111000000000",
  "00000000001111111111111111111111111111111100000000",
  "00000000011111111111111111111111111111111100000000",
  "00000000111111111111111111111111111111111100000000",
  "00000001111111111111111111111111111111111111000000",
  "00000001111111111111111111111111111111111111111000",
  "00000000111111111111111111111111111111111111111111",
  "00000001111111111111111111111111111111111111111111",
  "00000001111111111111111111111111111111111111111111",
  "00000000111111111111111111111111111111111111111111",
  "00000000011111111111111111111111111111111111111111",
  "00000000001111111111111111111111111111111111111111",
  "00000000000111111111111111111111111111111111111111",
  "00000000000111111111111111111111111111111111111111",
  "00000000000011111111111111111111111111111111111111",
  "00000000000001111111111111111111111111111111111111",
  "00000000000000011111111111111111111111111111111111",
  "00000000000000000111111111111111111111111111111111",
  "00000000000000000011111111111111111111111111111111",
  "00000000000000000001111111111111111111111111111111",
  "00000000000000000001111111111111111111111111111111",
  "00000000000000000001111111111111111111111111111111",
  "00000000000000000001111111111111111111111111111111",
  "00000000000000000001111111111111111111111111100000",
  "00000000000000000001111111111111111111111110000000",
  "00000000000000000011111111111111111111111100000000",
  "00000000000000000011111111111111111111111000000000",
  "00000000000000000111111111111111111111110000000000",
  "00000000000000000111111111111111111111100000000000",
  "00000000000000000111111111111111111110000000000000",
  "00000000000000000111111111111111111100000000000000",
  "00000000000000000111111111111111111000000000000000",
  "00000000000000001111111111111111000000000000000000",
  "00000000000000001111111111111111000000000000000000",
  "00000000000000001111111111111110000000000000000000",
  "00000000000000001111111111100000000000000000000000",
  "00000000000000001111111111000000000000000000000000",
  "00000000000000001111111110000000000000000000000000",
  "00000000000000001111111100000000000000000000000000",
  "00000000000000001111111000000000000000000000000000",
  "00000000000000001111110000000000000000000000000000",
  "00000000000000011111111000000000000000000000000000",
  "00000000000000011111111000000000000000000000000000",
  "00000000000000011111110000000000000000000000000001",
  "00000000000000011111100000000000000000000000000001",
  "00000000000000011111100000000000000000000000000011",
];

const isOnLandAndes = (x: number, y: number): boolean => {
  const gridSize = ANDES_LAND_MASK.length; // 50
  const gx = Math.min(Math.floor(x * gridSize), gridSize - 1);
  const gy = Math.min(Math.floor(y * gridSize), gridSize - 1);
  if (gy < 0 || gy >= gridSize || gx < 0 || gx >= gridSize) return false;
  return ANDES_LAND_MASK[gy][gx] === '1';
};

// Régions GAUCHE (côté Pacifique - ouest des Andes) pour le bureau de poste
// Seulement dans le nord où il y a de la terre entre la côte et la chaîne
const ANDES_LEFT_REGIONS = [
  { minX: 0.12, maxX: 0.26, minY: 0.02, maxY: 0.16 },
  { minX: 0.16, maxX: 0.28, minY: 0.16, maxY: 0.30 },
];

// Régions DROITE (côté Atlantique - est des Andes) pour les destinations mail
const ANDES_RIGHT_REGIONS = [
  // Nord (large, tropiques)
  { minX: 0.32, maxX: 0.60, minY: 0.02, maxY: 0.16 },
  { minX: 0.28, maxX: 0.85, minY: 0.10, maxY: 0.28 },
  // Centre-nord
  { minX: 0.32, maxX: 0.85, minY: 0.28, maxY: 0.45 },
  // Centre (plaines)
  { minX: 0.40, maxX: 0.85, minY: 0.45, maxY: 0.50 },
  // Centre-sud
  // Sud (Patagonie commence, terre se rétrécit)
];

// Régions terrestres pour MAURITANIE (carte désertique)
// La côte Atlantique est à GAUCHE (x < 0.12 environ), le reste est terrestre
const MAURITANIE_REGIONS = [
  // Nord intérieur (éviter côte ouest)
  { minX: 0.15, maxX: 0.50, minY: 0.08, maxY: 0.28 },
  // Nord-est
  { minX: 0.45, maxX: 0.85, minY: 0.06, maxY: 0.25 },
  // Centre-ouest (éviter côte)
  { minX: 0.18, maxX: 0.50, minY: 0.28, maxY: 0.50 },
  // Centre
  { minX: 0.40, maxX: 0.80, minY: 0.25, maxY: 0.50 },
  // Centre-est
  { minX: 0.60, maxX: 0.85, minY: 0.30, maxY: 0.50 },
  // Sud intérieur (éviter côte)
  // Sud centre
  // Sud-est
  // Extrême sud intérieur
];

// ─── MASQUE TERRE / MER (50×50) — carte europe-map-vintage-new.png ─────────
// '1' = terre, '0' = mer/océan. Généré par analyse R-B > 40 des pixels.
const EUROPE_LAND_MASK: string[] = [
  "00000000000000000000000000000000001110000000000000",
  "00000000000000000000000000000000111111000000000010",
  "00000000000000000000000000000111111111111110000011",
  "00000000000000000000000000001111111111111111111001",
  "00000000000000000000000000001111111111111111110111",
  "00011111000000000000000000111111111111111101100111",
  "00111111000000000000000001111111111111111100000111",
  "00011111000000000000000001111111100111111110011111",
  "00000000000000000000000001111111001111111111111111",
  "00000000000000000000000111111111001111111111111111",
  "00000000000000000000001111111110011111111111011111",
  "00000000000000000000111111111100011111111011111111",
  "00000000000000000001111111111100011111110001111111",
  "00000000000000000001111111111000011110000111111111",
  "00000000000000000001111111111110000000111111111111",
  "00000000111000000001111111111100000111111111111111",
  "00000000111100000000100011111000000011111111111111",
  "00000000111000000000001001111000001111111111111111",
  "00000000011000000000011001110000011111111111111111",
  "00001111001100000000011101100000001111111111111111",
  "00001110001110000000010001000110111111111111111111",
  "00011110111110000000001111111111111111111111111111",
  "00000000111111000111111111111111111111111111111111",
  "00000000011110001111111111111111111111111111111111",
  "00000000000000111111111111111111111111111111111111",
  "00000000010001111111111111111111111111111111111111",
  "00000011111111111111111111111111111111111111111111",
  "00000000111111111111111111111111111111111111111111",
  "00000000011111111111111111111111111111111111111111",
  "00000000011111111111111111111111111111111111100001",
  "00000000011111111111111111111111111111111111100000",
  "11110000011111111111111110111111111111111111000000",
  "11111111111111111100001110001111111111111111000000",
  "11111111111110000000101111000011111111111111000001",
  "11111111111110000000000011100000011111111111001111",
  "11111111110000000000100001111000011111111111111111",
  "11111111100000000001100000001110011111000011111111",
  "11111111100000000000100000000100001111100011111111",
  "11111110000000000000000000000100000111100011111111",
  "00000000000000000000000001110000000011100000111100",
  "11000000111111111111110000000000000010100000000000",
  "11111111111111111111110000000000000000000000000000",
  "11111111111111111111111000000000000000000000000000",
  "11111111111111111111110000000000000000000000000000",
  "11111111111111111111111000000000000000000000000000",
  "11111111111111111111111111110000000111111100000001",
  "11111111111111111111111111111110000111111111111111",
  "11111111111111111111111111111111101111111111111111",
  "11111111111111111111111111111111111111111111111111",
  "11111111111111111111111111111111111111111111111111",
];

// Vérifie si un point (x, y) normalisé [0-1] se trouve sur la terre
const isOnLandEurope = (x: number, y: number): boolean => {
  // Zone sûre : éviter pare-brise et bord droit
  if (x < 0.03 || x > 0.85 || y < 0.03 || y > 0.88) return false;
  const gridSize = EUROPE_LAND_MASK.length; // 50
  const gx = Math.min(Math.floor(x * gridSize), gridSize - 1);
  const gy = Math.min(Math.floor(y * gridSize), gridSize - 1);
  if (gy < 0 || gy >= gridSize || gx < 0 || gx >= gridSize) return false;
  return EUROPE_LAND_MASK[gy][gx] === '1';
};

// Generate a random point on land — validé par le masque binaire terre/mer
const generateRandomLandPoint = (existingPoints: MapPoint[] = []): MapPoint => {
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = LAND_REGIONS[Math.floor(Math.random() * LAND_REGIONS.length)];
    const x = region.minX + Math.random() * (Math.min(region.maxX, 0.88) - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    // Éviter les points derrière le pare-brise du tableau de bord (y > 0.55)
    if (y > 0.55) {
      attempts++;
      continue;
    }
    
    // ── Validation masque terre/mer ──
    if (!isOnLandEurope(x, y)) {
      attempts++;
      continue;
    }
    
    // Check minimum distance from existing points (éviter les chevauchements)
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
      };
    }
    attempts++;
  }
  
  // Fallback avec anti-chevauchement
  const fbCandidates: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 200) {
    const region = LAND_REGIONS[Math.floor(Math.random() * LAND_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = Math.min(0.55, region.minY + Math.random() * (region.maxY - region.minY));
    if (isOnLandEurope(x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  // Dernier recours absolu (ne devrait jamais arriver)
  return {
    id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    x: 0.35,
    y: 0.45,
  };
};

// Générer un point aléatoire pour GIBRALTAR dans une zone spécifique
const generateGibraltarPoint = (
  phase: 1 | 2,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = phase === 1 ? GIBRALTAR_SPAIN_REGIONS : GIBRALTAR_AFRICA_REGIONS;
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('gibraltar', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
      };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('gibraltar', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = regions[Math.floor(Math.random() * regions.length)];
  return {
    id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    x: region.minX + Math.random() * (region.maxX - region.minX),
    y: region.minY + Math.random() * (region.maxY - region.minY),
  };
};

// Calculate distance between two points
export const calculateDistance = (from: MapPoint, to: MapPoint): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Générer un point pour GIBRALTAR II
const generateGibraltar2Point = (
  phase: 1 | 2,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = phase === 1 ? GIBRALTAR2_COLLECT_REGIONS : GIBRALTAR2_DISTRIB_REGIONS;
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (Math.min(region.maxX, 0.88) - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('gibraltar', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('gibraltar', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = regions[0];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer les options de cargo pour GIBRALTAR II
const generateGibraltar2CargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  phase: 1 | 2,
  mailCount: number,
  totalMiles: number
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  if (phase === 1) {
    // Phase 1 - Collecte dans le sud
    // Si on a assez de courrier (>=20), proposer le bureau de douane
    if (mailCount >= 20) {
      options.push({
        point: { ...GIBRALTAR2_CUSTOMS, id: `customs_${Date.now()}` },
        type: 'customs' as any,
        amount: 20000, // Coût en MILES
      });
    }
    
    // Remplir les 3 (ou 2 si customs) options restantes
    const remaining = mailCount >= 20 ? 2 : 3;
    for (let i = 0; i < remaining; i++) {
      const point = generateGibraltar2Point(1, [...allExistingPoints, ...options.map(o => o.point)]);
      const rand = Math.random();
      if (rand < 0.13) {
        options.push({ point, type: 'fuel', amount: 25 });
      } else if (rand < 0.23) {
        options.push({ point, type: 'repair', amount: 1 });
      } else {
        options.push({ point, type: 'mail', amount: Math.floor(Math.random() * 5) + 1 });
      }
    }
  } else {
    // Phase 2 - Distribution dans le nord (-1 à -3 courriers par point)
    for (let i = 0; i < 3; i++) {
      const point = generateGibraltar2Point(2, [...allExistingPoints, ...options.map(o => o.point)]);
      const rand = Math.random();
      if (rand < 0.12) {
        options.push({ point, type: 'fuel', amount: 25 });
      } else if (rand < 0.20) {
        options.push({ point, type: 'repair', amount: 1 });
      } else {
        // Distribution : -1 à -3
        const maxDelivery = Math.min(3, mailCount);
        options.push({ point, type: 'delivery', amount: maxDelivery > 0 ? Math.floor(Math.random() * maxDelivery) + 1 : 1 });
      }
    }
  }
  
  return options;
};

// Générer un point pour MAURITANIE
const generateMauritaniaPoint = (existingPoints: MapPoint[] = []): MapPoint => {
  const regions = MAURITANIE_REGIONS;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
      };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  for (let i = 0; i < 200; i++) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    if (!isDestTooClose(x, y, existingPoints)) return pt;
    fbCandidates.push(pt);
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = regions[Math.floor(Math.random() * regions.length)];
  return {
    id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    x: region.minX + Math.random() * (region.maxX - region.minX),
    y: region.minY + Math.random() * (region.maxY - region.minY),
  };
};

// Générer les options de cargo pour MAURITANIE
// Comme EUROPE mais le courrier est plafonné à 20 dans l'avion
const generateMauritaniaCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  currentMailInPlane: number
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateMauritaniaPoint([...allExistingPoints, ...options.map(o => o.point)]);
    
    const rand = Math.random();
    let type: 'mail' | 'fuel' | 'repair';
    let amount: number;
    
    if (rand < 0.13) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.23) {
      type = 'repair';
      amount = 1;
    } else {
      type = 'mail';
      // Limiter le courrier pour ne pas dépasser 20
      const remaining = 20 - currentMailInPlane;
      amount = remaining > 0 ? Math.min(Math.floor(Math.random() * 5) + 1, remaining) : 1;
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};

// Generate cargo options for 3 random destinations
const generateCargoOptions = (currentPoint: MapPoint, visitedPoints: MapPoint[], isFirstTurn: boolean = false): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateRandomLandPoint([...allExistingPoints, ...options.map(o => o.point)]);
    
    // Premier tour EUROPE 20 : uniquement du courrier
    if (isFirstTurn) {
      const amount = Math.floor(Math.random() * 5) + 1;
      options.push({ point, type: 'mail', amount });
      continue;
    }
    
    const rand = Math.random();
    let type: 'mail' | 'fuel' | 'repair';
    let amount: number;
    
    if (rand < 0.13) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.23) {
      type = 'repair';
      amount = 1;
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1;
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};

// Générer les options de cargo pour GIBRALTAR
const generateGibraltarCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  phase: 1 | 2,
  mailCount: number
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateGibraltarPoint(phase, [...allExistingPoints, ...options.map(o => o.point)]);
    
    const rand = Math.random();
    
    if (phase === 1) {
      // Phase 1 - Collecte en Espagne : courrier, essence, réparation
      let type: 'mail' | 'fuel' | 'repair';
      let amount: number;
      
      if (rand < 0.13) {
        type = 'fuel';
        amount = 25;
      } else if (rand < 0.23) {
        type = 'repair';
        amount = 1;
      } else {
        type = 'mail';
        amount = Math.floor(Math.random() * 5) + 1;
      }
      
      options.push({ point, type, amount });
    } else {
      // Phase 2 - Distribution en Afrique : bureaux de poste + essence/réparation
      let type: 'mail' | 'fuel' | 'repair' | 'delivery';
      let amount: number;
      
      if (rand < 0.12) {
        type = 'fuel';
        amount = 25;
      } else if (rand < 0.20) {
        type = 'repair';
        amount = 1;
      } else {
        type = 'delivery';
        // Le nombre de courriers à déposer (entre 1 et min(5, mailCount restant))
        const maxDelivery = Math.min(5, mailCount);
        amount = maxDelivery > 0 ? Math.floor(Math.random() * maxDelivery) + 1 : 1;
      }
      
      options.push({ point, type, amount });
    }
  }
  
  return options;
};

// Générer un point aléatoire pour ATLANTIQUE dans une zone spécifique
const generateAtlantiquePoint = (
  phase: 1 | 2,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = phase === 1 ? ATLANTIQUE_GUINEA_REGIONS : ATLANTIQUE_BRAZIL_REGIONS;
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('atlantique', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooCloseStrict(x, y, existingPoints);
    
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('atlantique', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooCloseStrict(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = regions[Math.floor(Math.random() * regions.length)];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer les options de cargo pour ATLANTIQUE (même logique que Gibraltar)
const generateAtlantiqueCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  phase: number,
  mailCount: number
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];

  // 3 destinations COLLECTE en GUINÉE (côte africaine)
  // 1 fois sur 5 (20%) → essence à la place du courrier
  for (let i = 0; i < 3; i++) {
    const point = generateAtlantiquePoint(1, [...allExistingPoints, ...options.map(o => o.point)]);
    if (Math.random() < 0.20) {
      options.push({ point, type: 'fuel', amount: 25 });
    } else {
      const amount = Math.floor(Math.random() * 5) + 1; // 1-5 courriers
      options.push({ point, type: 'mail', amount });
    }
  }

  // 3 destinations LIVRAISON au BRÉSIL (côte sud-américaine)
  // 1 fois sur 5 (20%) → réparation à la place de la livraison
  for (let i = 0; i < 3; i++) {
    const point = generateAtlantiquePoint(2, [...allExistingPoints, ...options.map(o => o.point)]);
    if (Math.random() < 0.20) {
      options.push({ point, type: 'repair', amount: 1 });
    } else {
      const maxDelivery = Math.min(5, mailCount);
      const amount = maxDelivery > 0 ? Math.floor(Math.random() * maxDelivery) + 1 : 1;
      options.push({ point, type: 'delivery', amount });
    }
  }

  return options;
};


// Générer un point aléatoire pour ATLANTIQUE 2 dans une zone spécifique
// Phase 1 = Brésil (bas-gauche), Phase 2 = Guinée (haut-droite) → inversé par rapport à ATLANTIQUE
const generateAtlantique2Point = (
  phase: 1 | 2,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = phase === 1 ? ATLANTIQUE_BRAZIL_REGIONS : ATLANTIQUE_GUINEA_REGIONS;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
      };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  for (let i = 0; i < 200; i++) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    if (!isDestTooClose(x, y, existingPoints)) return pt;
    fbCandidates.push(pt);
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = regions[Math.floor(Math.random() * regions.length)];
  return {
    id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    x: region.minX + Math.random() * (region.maxX - region.minX),
    y: region.minY + Math.random() * (region.maxY - region.minY),
  };
};

// Générer les options de cargo pour ATLANTIQUE 2
const generateAtlantique2CargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  phase: 1 | 2,
  mailCount: number
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateAtlantique2Point(phase, [...allExistingPoints, ...options.map(o => o.point)]);
    
    const rand = Math.random();
    
    if (phase === 1) {
      // Phase 1 - Collecte au Brésil : courrier + essence + réparation
      let type: 'mail' | 'fuel' | 'repair';
      let amount: number;
      
      if (rand < 0.25) {
        type = 'fuel';
        amount = 25;
      } else if (rand < 0.35) {
        type = 'repair';
        amount = 1;
      } else {
        type = 'mail';
        amount = Math.floor(Math.random() * 5) + 1;
      }
      
      options.push({ point, type, amount });
    } else {
      // Phase 2 - Distribution en Guinée : bureaux de poste + essence/réparation
      let type: 'mail' | 'fuel' | 'repair' | 'delivery';
      let amount: number;
      
      if (rand < 0.12) {
        type = 'fuel';
        amount = 25;
      } else if (rand < 0.20) {
        type = 'repair';
        amount = 1;
      } else {
        type = 'delivery';
        const maxDelivery = Math.min(5, mailCount);
        amount = maxDelivery > 0 ? Math.floor(Math.random() * maxDelivery) + 1 : 1;
      }
      
      options.push({ point, type, amount });
    }
  }
  
  return options;
};


// Générer un point pour AFRICA AGAIN dans une zone spécifique
const generateAfricaAgainPoint = (
  phase: 1 | 2,
  existingPoints: MapPoint[] = []
): MapPoint => {
  const regions = phase === 1 ? AFRICA_AGAIN_SOUTH_REGIONS : AFRICA_AGAIN_NORTH_REGIONS;
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('africa_again', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('africa_again', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = regions[Math.floor(Math.random() * regions.length)];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer les options de cargo pour AFRICA AGAIN
const generateAfricaAgainCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  phase: 1 | 2,
  mailCount: number,
  isFirstTurn: boolean = false
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateAfricaAgainPoint(phase, [...allExistingPoints, ...options.map(o => o.point)]);
    
    const rand = Math.random();
    
    if (phase === 1) {
      // Phase 1 - Collecte au sud : comme EUROPE 20
      // Premier tour : uniquement du courrier
      if (isFirstTurn) {
        const amount = Math.floor(Math.random() * 5) + 1;
        options.push({ point, type: 'mail', amount });
        continue;
      }
      
      let type: 'mail' | 'fuel' | 'repair';
      let amount: number;
      
      // Essence rare : 1/15 = ~6.67%
      if (rand < (1 / 15)) {
        type = 'fuel';
        amount = 25;
      } else if (rand < 0.17) {
        type = 'repair';
        amount = 1;
      } else {
        type = 'mail';
        amount = Math.floor(Math.random() * 5) + 1;
      }
      
      options.push({ point, type, amount });
    } else {
      // Phase 2 - Distribution au nord : bureaux de poste + essence/réparation
      let type: 'mail' | 'fuel' | 'repair' | 'delivery';
      let amount: number;
      
      if (rand < 0.12) {
        type = 'fuel';
        amount = 25;
      } else if (rand < 0.22) {
        type = 'repair';
        amount = 1;
      } else {
        type = 'delivery';
        const maxDelivery = Math.min(5, mailCount);
        amount = maxDelivery > 0 ? Math.floor(Math.random() * maxDelivery) + 1 : 1;
      }
      
      options.push({ point, type, amount });
    }
  }
  
  return options;
};

// Générer un point terrestre pour AMAZONIE

// Générer un point pour SAHEL
// Générer un point pour SAHEL (1 seul avion, toute la carte)
const generateSahelPoint = (existingPoints: MapPoint[] = []): MapPoint => {
  let attempts = 0;
  while (attempts < 300) {
    const region = SAHEL_REGIONS[Math.floor(Math.random() * SAHEL_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (!isValidDestination('sahel', x, y)) { attempts++; continue; }
    const tooClose = isDestTooClose(x, y, existingPoints);
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = SAHEL_REGIONS[Math.floor(Math.random() * SAHEL_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('sahel', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = SAHEL_REGIONS[0];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer options SAHEL (1 seul avion, comme EUROPE)
const generateSahelOptions = (currentPoint: MapPoint, visitedPoints: MapPoint[]): CargoOption[] => {
  const options: CargoOption[] = [];
  const allPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateSahelPoint([...allPoints, ...options.map(o => o.point)]);
    const rand = Math.random();
    if (rand < 0.10) {
      options.push({ point, type: 'fuel', amount: 25 });
    } else if (rand < 0.18) {
      options.push({ point, type: 'repair', amount: 1 });
    } else {
      options.push({ point, type: 'mail', amount: Math.floor(Math.random() * 5) + 1 });
    }
  }
  return options;
};
const generateAmazoniePoint = (existingPoints: MapPoint[] = []): MapPoint => {
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = AMAZONIE_REGIONS[Math.floor(Math.random() * AMAZONIE_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('amazonie', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = AMAZONIE_REGIONS[Math.floor(Math.random() * AMAZONIE_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('amazonie', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = AMAZONIE_REGIONS[Math.floor(Math.random() * AMAZONIE_REGIONS.length)];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer les options de cargo pour AMAZONIE (réparations rares mais x2)
const generateAmazonieCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[]
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateAmazoniePoint([...allExistingPoints, ...options.map(o => o.point)]);
    const rand = Math.random();
    
    let type: 'mail' | 'fuel' | 'repair';
    let amount: number;
    
    if (rand < 0.12) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.17) {
      // Réparation rare (5% au lieu de ~10%) mais répare 2 pannes
      type = 'repair';
      amount = 2;
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1;
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};

// Vérifier si un segment de vol traverse une zone de turbulence circulaire
const doesFlightCrossTurbulence = (
  startX: number, startY: number,
  endX: number, endY: number,
  turbX: number, turbY: number,
  turbRadius: number
): boolean => {
  // Distance du centre de la turbulence au segment de droite [start, end]
  const dx = endX - startX;
  const dy = endY - startY;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;
  
  // Projection du centre de turbulence sur le segment
  let t = ((turbX - startX) * dx + (turbY - startY) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const closestX = startX + t * dx;
  const closestY = startY + t * dy;
  
  const distSq = (turbX - closestX) ** 2 + (turbY - closestY) ** 2;
  return distSq <= turbRadius * turbRadius;
};


// Générer un point côtier pour BUENOS AIRES (sur le littoral)
const generateBuenosAiresPoint = (existingPoints: MapPoint[] = []): MapPoint => {
  const coastPoints = BUENOS_AIRES_COAST_POINTS;
  const shuffled = [...coastPoints].sort(() => Math.random() - 0.5);
  // D'abord essayer les points sur terre avec anti-chevauchement
  for (const ref of shuffled) {
    if (!isValidDestination('buenos_aires', ref.x, ref.y)) continue;
    if (!isDestTooClose(ref.x, ref.y, existingPoints)) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: ref.x, y: ref.y };
    }
  }
  
  // Fallback : collecter candidats valides, choisir le meilleur
  const fbCandidates: MapPoint[] = [];
  for (const ref of shuffled) {
    if (isValidDestination('buenos_aires', ref.x, ref.y)) {
      fbCandidates.push({ id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: ref.x, y: ref.y });
    }
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  
  // Dernier recours
  const ref = shuffled[0];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: ref.x, y: ref.y };
};

// Générer les options de cargo pour BUENOS AIRES (comme Europe 20)
const generateBuenosAiresCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[]
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generateBuenosAiresPoint([...allExistingPoints, ...options.map(o => o.point)]);
    const rand = Math.random();
    
    let type: 'mail' | 'fuel' | 'repair';
    let amount: number;
    
    if (rand < 0.15) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.25) {
      type = 'repair';
      amount = 1;
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1;
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};

// Générer un point terrestre en Patagonie
const generatePatagoniePoint = (existingPoints: MapPoint[] = []): MapPoint => {
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = PATAGONIE_REGIONS[Math.floor(Math.random() * PATAGONIE_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('patagonie', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = PATAGONIE_REGIONS[Math.floor(Math.random() * PATAGONIE_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('patagonie', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = PATAGONIE_REGIONS[Math.floor(Math.random() * PATAGONIE_REGIONS.length)];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer un point pour ANDES (côté spécifié ou aléatoire)
const generateAndesPoint = (
  side: 'left' | 'right' | 'any',
  existingPoints: MapPoint[] = []
): MapPoint => {
  let attempts = 0;
  const maxAttempts = 300;
  const regions = side === 'left' ? ANDES_LEFT_REGIONS 
    : side === 'right' ? ANDES_RIGHT_REGIONS 
    : [...ANDES_LEFT_REGIONS, ...ANDES_RIGHT_REGIONS];
  
  while (attempts < maxAttempts) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    // ── Validation masque terre/mer ──
    if (!isOnLandAndes(x, y)) {
      attempts++;
      continue;
    }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return {
        id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x,
        y,
      };
    }
    attempts++;
  }
  
  // Fallback avec anti-chevauchement
  const fbCandidates: MapPoint[] = [];
  let fallbackAttempts = 0;
  while (fallbackAttempts < 200) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isOnLandAndes(x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fallbackAttempts++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  // Dernier recours : centre du continent
  return {
    id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    x: 0.45,
    y: 0.25,
  };
};

// Générer les options de cargo pour ANDES
// Destinations mail uniquement à l'EST (droite) de la chaîne
// L'avion peut aussi aller au Col ou au Bureau de Poste selon sa position
const generateAndesCargoOptions = (
  currentPoint: MapPoint,
  visitedPoints: MapPoint[],
  currentMailInPlane: number
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [currentPoint, ...visitedPoints];
  
  // Toujours générer des destinations à l'EST (côté collecte)
  for (let i = 0; i < 3; i++) {
    const point = generateAndesPoint('right', [...allExistingPoints, ...options.map(o => o.point)]);
    
    const rand = Math.random();
    let type: 'mail' | 'fuel' | 'repair';
    let amount: number;
    
    if (rand < 0.13) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.23) {
      type = 'repair';
      amount = 1;
    } else {
      type = 'mail';
      const remaining = 20 - currentMailInPlane;
      amount = remaining > 0 ? Math.min(Math.floor(Math.random() * 5) + 1, remaining) : 1;
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};

// Générer 4 options de cargo pour PATAGONIE
const generatePatagonieCargoOptions = (
  plane1Point: MapPoint,
  plane2Point: MapPoint,
  visitedPoints: MapPoint[]
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [plane1Point, plane2Point, ...visitedPoints];
  
  for (let i = 0; i < 3; i++) {
    const point = generatePatagoniePoint([...allExistingPoints, ...options.map(o => o.point)]);
    const rand = Math.random();
    
    let type: 'mail' | 'fuel' | 'repair';
    let amount: number;
    
    if (rand < 0.15) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.25) {
      type = 'repair';
      amount = 1;
    } else {
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1;
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};

// Générer un point terrestre au Paraguay
const generateParaguayPoint = (existingPoints: MapPoint[] = []): MapPoint => {
  let attempts = 0;
  const maxAttempts = 300;
  
  while (attempts < maxAttempts) {
    const region = PARAGUAY_REGIONS[Math.floor(Math.random() * PARAGUAY_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    
    if (!isValidDestination('paraguay', x, y)) { attempts++; continue; }
    
    const tooClose = isDestTooClose(x, y, existingPoints);
    
    if (!tooClose) {
      return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
    }
    attempts++;
  }
  
  const fbCandidates: MapPoint[] = [];
  let fb = 0;
  while (fb < 200) {
    const region = PARAGUAY_REGIONS[Math.floor(Math.random() * PARAGUAY_REGIONS.length)];
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);
    if (isValidDestination('paraguay', x, y)) {
      const pt: MapPoint = { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x, y };
      if (!isDestTooClose(x, y, existingPoints)) return pt;
      fbCandidates.push(pt);
    }
    fb++;
  }
  if (fbCandidates.length > 0) return pickBestCandidate(fbCandidates, existingPoints);
  const region = PARAGUAY_REGIONS[Math.floor(Math.random() * PARAGUAY_REGIONS.length)];
  return { id: `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, x: region.minX + Math.random() * (region.maxX - region.minX), y: region.minY + Math.random() * (region.maxY - region.minY) };
};

// Générer les options de cargo pour PARAGUAY
// Chaque destination est aléatoirement collecte (+1 à +5) ou distribution (-1 à -5)
// Au premier tour, uniquement des destinations de COLLECTE (courriers positifs)
const generateParaguayCargoOptions = (
  plane1Point: MapPoint,
  plane2Point: MapPoint,
  visitedPoints: MapPoint[]
): CargoOption[] => {
  const options: CargoOption[] = [];
  const allExistingPoints = [plane1Point, plane2Point, ...visitedPoints];
  const isFirstTurn = visitedPoints.length === 0;

  for (let i = 0; i < 3; i++) {
    const point = generateParaguayPoint([...allExistingPoints, ...options.map(o => o.point)]);
    const rand = Math.random();
    
    let type: 'mail' | 'delivery' | 'fuel' | 'repair';
    let amount: number;
    
    if (isFirstTurn) {
      // Premier tour : uniquement collecte (mail positif)
      type = 'mail';
      amount = Math.floor(Math.random() * 5) + 1; // +1 à +5
    } else if (rand < 0.12) {
      type = 'fuel';
      amount = 25;
    } else if (rand < 0.20) {
      type = 'repair';
      amount = 1;
    } else {
      // 50/50 collecte ou distribution
      const isCollect = Math.random() < 0.5;
      if (isCollect) {
        type = 'mail';
        amount = Math.floor(Math.random() * 5) + 1; // +1 à +5
      } else {
        type = 'delivery';
        amount = Math.floor(Math.random() * 5) + 1; // 1 à 5 (distribuer)
      }
    }
    
    options.push({ point, type, amount });
  }
  
  return options;
};


interface GameState {
  // Game status
  gameStatus: 'idle' | 'playing' | 'won' | 'lost';
  
  // Level
  currentLevelId: string;
  mailTarget: number;
  
  // Gibraltar specific
  gibraltarPhase: number | null; // null = not Gibraltar, 1-4 for multi-phase missions
  gibraltarMailCollected: number; // Nombre de courriers collectés en phase 1 (pour le télégramme de victoire)
  
  // Mauritanie specific
  mauritaniaMailCumul: number; // Cumul des courriers déposés au bureau de poste
  mauritaniaPostOffice: MapPoint | null; // Bureau de poste permanent
  
  // Amazonie specific
  turbulenceZone: { x: number; y: number; radius: number } | null; // Zone de turbulence circulaire
  turbulenceZone2: { x: number; y: number; radius: number } | null; // Seconde zone de turbulence (Atlantique 2)

  // Sardegna specific
  sardegnaAerodrome: MapPoint | null; // Aérodrome fixe au centre de la Sardaigne
  sardegnaAerodromeUsed: boolean; // L'avion 2 a-t-il déjà été utilisé ?

  
  // Andes specific
  andesCol: MapPoint | null; // Point de passage au col des Andes

  // Unlock tracking (set when a level is beaten for the very first time)
  newlyCompletedLevel: string | null;
  
  // Patagonie specific (dual-plane)
  patagonieSelectionPhase: 'plane1' | 'plane2' | 'flying' | null; // null = not Patagonie
  plane2CurrentPoint: MapPoint | null;
  plane2VisitedPoints: MapPoint[];
  plane2FuelLevel: number;
  plane2CompletedFlights: Flight[];
  plane2MechanicalWarnings: number;
  plane2CriticalCountdownActive: boolean;
  sahelPostOfficeMail: number; // Courriers stockés au bureau de poste SAHEL
  plane2CriticalCountdownEnd: number;
  plane2IsFlying: boolean;
  plane2FlyingProgress: number;
  plane2FlyingDestination: MapPoint | null;
  plane2SelectedCargo: CargoOption | null;
  plane2FlightFuelCost: number;
  plane2FlightCurveDirection: 1 | -1; // direction de la courbe utilisée pendant le vol avion 2
  plane2FlightIntersectionProgresses: number[];
  plane2CrashPosition: { x: number; y: number } | null;
  
  // Paraguay specific (individual plane mail)
  plane1CarriedMail: number;
  plane2CarriedMail: number;
  
  // Miles system (persisted across missions)
  totalMiles: number;
  flightMilesEarned: number; // miles earned during current flight (for display)
  
  // Free play mode
  freeplayMode: string | null; // null = normal, 'europe' | 'andes' | 'patagonie_ii' = freeplay
  
  // Flash message (temporary message shown on screen)
  flashMessage: string | null;
  
  // Tutorial mode
  tutorialMode: boolean;
  tutorialStep: number; // 0=click dest, 1=mail collected, 2=click dest 2, 3=during flight miles, 4=warning screen, 5=hangar, 6+=done
  tutorialFlightCount: number;
  tutorialHangarDone: boolean; // le joueur a ouvert et fermé le HANGAR pendant le tuto
  
  // Current position (green point)
  currentPoint: MapPoint | null;
  
  // All visited points (shown in red)
  visitedPoints: MapPoint[];
  
  // Resources
  mailCount: number;
  fuelLevel: number;
  
  // Flights history (for drawing paths)
  completedFlights: Flight[];
  
  // Mechanical warnings (0-4 lights)
  mechanicalWarnings: number;
  
  // Critical state: when 4 warnings are active, 1 minute countdown
  criticalCountdownActive: boolean;
  criticalCountdownEnd: number; // timestamp when countdown ends
  
  // Game over reason tracking
  gameOverReason: 'fuel' | 'mechanical' | 'critical_timeout' | null;
  crashPosition: { x: number; y: number } | null;
  
  gameStartTime: number;
  
  // Destination options (3 choices)
  cargoOptions: CargoOption[];
  
  // Animation state
  isFlying: boolean;
  flyingProgress: number;
  flyingDestination: MapPoint | null;
  selectedCargo: CargoOption | null;
  flightFuelCost: number; // pre-calculated fuel cost for current flight
  flightActualFuelUsed: number; // actual fuel consumed (including turbulence multiplier)
  flightCurveDirection: 1 | -1; // direction de la courbe utilisée pendant le vol
  flightIntersectionProgresses: number[]; // pre-calculated progress values where intersections occur
  triggeredFlightIntersections: number[]; // indices of intersections already triggered this flight (atomic dedup)
  plane2TriggeredFlightIntersections: number[]; // same for plane 2
  
  // Map aspect ratio for pixel-accurate curve calculations
  mapAspectRatio: number; // height / width of the map area
  
  // Campagne Europe
  isCampaignMode: boolean;
  currentQuadrant: Quadrant;
  campaignPoints: CampaignPoint[];
  
  // Actions
  startGame: () => void;
  startTutorial: () => void;
  startLevel: (levelId: string, mailTarget: number) => void;
  setMapAspectRatio: (ratio: number) => void;
  switchQuadrant: (targetQuadrant: Quadrant, entryPosition: { x: number; y: number }) => void;
  selectDestination: (option: CargoOption) => void;
  selectAndesCol: () => void; // Passer par le col des Andes
  selectPatagonieDestination: (option: CargoOption, planeId: 1 | 2) => void;
  updateFlyingProgress: (progress: number) => void;
  updatePlane2FlyingProgress: (progress: number) => void;
  addMechanicalWarning: () => void;
  addPlane2MechanicalWarning: () => void;
  triggerFlightIntersection: (intersectionIndex: number) => void;
  triggerPlane2FlightIntersection: (intersectionIndex: number) => void;
  completeFlight: () => void;
  completePlane2Flight: () => void;
  crashMidFlight: (progress: number, reason: 'fuel' | 'mechanical') => void;
  crashPlane2MidFlight: (progress: number, reason: 'fuel' | 'mechanical') => void;
  checkCriticalTimeout: () => void;
  repairMechanical: () => void;
  endGame: (won: boolean) => void;
  resetGame: () => void;
  pauseGame: () => void;   // Met en pause sans perdre l'état
  resumeGame: () => void;  // Reprend la partie en cours
  // Miles & Hangar
  loadMiles: () => void;
  addMiles: (amount: number) => void;
  hangarRefuel: () => boolean; // returns true if successful
  hangarRepair: () => boolean; // returns true if successful
  hangarRefuelPlane2: () => boolean;
  hangarRepairPlane2: () => boolean;
}

// Geometry functions (countCurveIntersections, getIntersectionProgresses, findBestCurveDirection)
// are imported from ../utils/geometry.ts for maintainability and robust detection.

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  gameStatus: 'idle',
  currentLevelId: 'europe_20',
  mailTarget: 20,
  gibraltarPhase: null,
  gibraltarMailCollected: 0,
  mauritaniaMailCumul: 0,
  mauritaniaPostOffice: null,
  turbulenceZone: null,
  turbulenceZone2: null,
  andesCol: null,
  newlyCompletedLevel: null,
  sardegnaAerodrome: null,
  sardegnaAerodromeUsed: false,
  patagonieSelectionPhase: null,
  plane2CurrentPoint: null,
  plane2VisitedPoints: [],
  plane2FuelLevel: 100,
  plane2CompletedFlights: [],
  plane2MechanicalWarnings: 0,
  plane2CriticalCountdownActive: false,
  plane2CriticalCountdownEnd: 0,
  plane2IsFlying: false,
  plane2FlyingProgress: 0,
  plane2FlyingDestination: null,
  plane2SelectedCargo: null,
  plane2FlightFuelCost: 0,
  plane2FlightCurveDirection: 1 as 1 | -1,
  plane2FlightIntersectionProgresses: [],
  plane2TriggeredFlightIntersections: [],
  plane2CrashPosition: null,
  plane1CarriedMail: 0,
  plane2CarriedMail: 0,
  sahelPostOfficeMail: 0,
  totalMiles: 0,
  flightMilesEarned: 0,
  freeplayMode: null,
  flashMessage: null,
  tutorialMode: false,
  tutorialStep: 0,
  tutorialFlightCount: 0,
  currentPoint: null,
  visitedPoints: [],
  mailCount: 0,
  fuelLevel: 100,
  completedFlights: [],
  mechanicalWarnings: 0,
  criticalCountdownActive: false,
  criticalCountdownEnd: 0,
  gameOverReason: null,
  crashPosition: null,
  gameStartTime: 0,
  cargoOptions: [],
  isFlying: false,
  flyingProgress: 0,
  flyingDestination: null,
  selectedCargo: null,
  flightFuelCost: 0,
  flightActualFuelUsed: 0,
  flightCurveDirection: 1 as 1 | -1,
  flightIntersectionProgresses: [],
  triggeredFlightIntersections: [],
  plane2TriggeredFlightIntersections: [],
  mapAspectRatio: 1.38, // default H/W ratio, will be set dynamically

  // Campagne Europe
  isCampaignMode: false,
  currentQuadrant: 'BL' as Quadrant,
  campaignPoints: [] as CampaignPoint[],
  
  setMapAspectRatio: (ratio: number) => {
    set({ mapAspectRatio: ratio });
  },

  switchQuadrant: (targetQuadrant: Quadrant, entryPosition: { x: number; y: number }) => {
    const state = get();
    const entryPoint: MapPoint = {
      id: `entry_${targetQuadrant}_${Date.now()}`,
      x: entryPosition.x,
      y: entryPosition.y,
    };
    
    // Générer les cargoOptions pour le nouveau quadrant
    let newOptions: CargoOption[];
    
    if (state.currentLevelId === 'sardegna') {
      // Sardegna : 3 options aléatoires (comme Europe 40) + aérodrome si secteur BL
      const aero = (!state.sardegnaAerodromeUsed && targetQuadrant === 'BL') ? state.sardegnaAerodrome : null;
      newOptions = generateSardegnaCargoOptions(entryPoint, targetQuadrant, [], aero);
    } else if (state.currentLevelId === 'afrique_nord') {
      // Afrique du Nord : 3 options aléatoires, navigation horizontale
      newOptions = generateAfNordCargoOptions(entryPoint, targetQuadrant, []);
    } else if (state.currentLevelId === 'retour_france') {
      // RETOUR FRANCE : régénérer 3 options + flèches pour le nouveau secteur
      newOptions = generateRetourFranceCargoOptions(entryPoint, [], state.mailCount || 0, targetQuadrant);
    } else {
      const quadrantPoints = state.campaignPoints.filter(
        cp => cp.quadrant === targetQuadrant && !cp.visited
      );
      const arrows = (state.currentLevelId === 'niveau_16' ? SCANDINAVIE_QUADRANT_ARROWS : state.currentLevelId === 'corsica' ? CORSICA_QUADRANT_ARROWS : state.currentLevelId === 'sardegna' ? SARDEGNA_QUADRANT_ARROWS : state.currentLevelId === 'afrique_nord' ? AFNORD_QUADRANT_ARROWS : state.currentLevelId === 'retour_france' ? RETOUR_FRANCE_QUADRANT_ARROWS : QUADRANT_ARROWS)[targetQuadrant];
      
      newOptions = quadrantPoints.map(cp => ({
        point: cp.point,
        type: cp.type,
        amount: cp.amount,
      }));
      
      // Ajouter les flèches de navigation
      for (const arrow of arrows) {
        newOptions.push({
          point: {
            id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
            x: arrow.arrowPosition.x,
            y: arrow.arrowPosition.y,
          },
          type: 'arrow' as any,
          amount: 0,
        });
      }
    }
    
    set({
      currentQuadrant: targetQuadrant,
      currentPoint: entryPoint,
      cargoOptions: newOptions,
      completedFlights: [],
    });
  },

  
  startGame: () => {
    const startPoint = generateRandomLandPoint();
    const now = Date.now();
    const options = generateCargoOptions(startPoint, [], true); // Premier tour: uniquement courrier
    
    set({
      gameStatus: 'playing',
      currentPoint: startPoint,
      visitedPoints: [],
      mailCount: 0,
      fuelLevel: 100,
      completedFlights: [],
      mechanicalWarnings: 0,
      criticalCountdownActive: false,
      criticalCountdownEnd: 0,
      gameStartTime: now,
      cargoOptions: options,
      isFlying: false,
      flyingProgress: 0,
      flyingDestination: null,
      selectedCargo: null,
    });
  },
  
  startTutorial: () => {
    const startPoint = generateRandomLandPoint();
    const now = Date.now();
    // Tutorial: 3 destinations uniquement courrier (3 chacune)
    const tutorialOptions: CargoOption[] = [];
    for (let i = 0; i < 3; i++) {
      const point = generateRandomLandPoint([startPoint, ...tutorialOptions.map(o => o.point)]);
      tutorialOptions.push({ point, type: 'mail', amount: 3 });
    }
    
    set({
      gameStatus: 'playing',
      currentLevelId: 'europe_20',
      mailTarget: 999, // Pas de limite en mode tuto/freeplay
      currentPoint: startPoint,
      visitedPoints: [],
      mailCount: 0,
      fuelLevel: 100,
      completedFlights: [],
      mechanicalWarnings: 0,
      criticalCountdownActive: false,
      criticalCountdownEnd: 0,
      gameStartTime: now,
      cargoOptions: tutorialOptions,
      isFlying: false,
      flyingProgress: 0,
      flyingDestination: null,
      selectedCargo: null,
      freeplayMode: 'europe',
      tutorialMode: true,
      tutorialStep: 0,
      tutorialFlightCount: 0,
      tutorialHangarDone: false,
      gibraltarPhase: null,
      turbulenceZone: null,
      turbulenceZone2: null,
      totalMiles: 0,
      flightMilesEarned: 0,
    });
  },
  
  startLevel: (levelId: string, mailTarget: number) => {
    // Désactiver le mode tutoriel quand on lance une vraie mission
    set({ tutorialMode: false, tutorialStep: 0, tutorialFlightCount: 0, tutorialHangarDone: false });
    
    const isGibraltar = levelId === 'gibraltar';
    const isAtlantique = levelId === 'atlantique';
    const isMauritanie = levelId === 'mauritanie';
    const isAmazonie = levelId === 'amazonie';
    
    let startPoint: MapPoint;
    let options: CargoOption[];
    let postOffice: MapPoint | null = null;
    let turbZone: { x: number; y: number; radius: number } | null = null;
    
    if (isGibraltar) {
      startPoint = generateGibraltarPoint(1, []);
      options = generateGibraltarCargoOptions(startPoint, [], 1, 0);
    } else if (isAtlantique) {
      startPoint = generateAtlantiquePoint(1, []);
      options = generateAtlantiqueCargoOptions(startPoint, [], 1, 0);
    } else if (levelId === 'atlantique2') {
      // Atlantique 2 : Phase 1 au Brésil (bas-gauche)
      startPoint = generateAtlantique2Point(1, []);
      options = generateAtlantique2CargoOptions(startPoint, [], 1, 0);
      // 2 zones de turbulence ALÉATOIRES dans l'océan (zone bleue entre Brésil et Guinée)
      turbZone = {
        x: 0.25 + Math.random() * 0.30,  // océan : x entre 0.25 et 0.55
        y: 0.15 + Math.random() * 0.35,   // océan haut : y entre 0.15 et 0.50
        radius: 0.14,
      };
    } else if (levelId === 'africa_again') {
      // AFRICA AGAIN : Phase 1 - Collecte au sud (comme Europe 20)
      startPoint = generateAfricaAgainPoint(1, []);
      options = generateAfricaAgainCargoOptions(startPoint, [], 1, 0, true); // Premier tour = courrier uniquement
      // Pas de turbulence en phase 1, elle apparaît en phase 2
    } else if (isMauritanie) {
      startPoint = generateMauritaniaPoint();
      options = generateMauritaniaCargoOptions(startPoint, [], 0);
      postOffice = generateMauritaniaPoint([startPoint, ...options.map(o => o.point)]);
    } else if (isAmazonie) {
      startPoint = generateAmazoniePoint();
      options = generateAmazonieCargoOptions(startPoint, []);
      // Zone de turbulence aléatoire (27% de la carte - grande zone)
      turbZone = {
        x: 0.20 + Math.random() * 0.60,
        y: 0.20 + Math.random() * 0.60,
        radius: 0.189,
      };
    } else if (levelId === 'buenos_aires') {
      startPoint = generateBuenosAiresPoint();
      options = generateBuenosAiresCargoOptions(startPoint, []);
    } else if (levelId === 'andes') {
      // ANDES: Collecter à l'EST, passer par le col, livrer au bureau de poste à l'OUEST
      startPoint = generateAndesPoint('right');
      options = generateAndesCargoOptions(startPoint, [], 0);
      // Col fixe au milieu de la chaîne — créé AVANT le bureau de poste
      const andesColPoint: MapPoint = {
        id: `andes_col_${Date.now()}`,
        x: ANDES_COL.x,
        y: ANDES_COL.y,
      };
      // Bureau de poste aléatoire à GAUCHE (ouest) — éviter startPoint ET le col
      postOffice = generateAndesPoint('left', [startPoint, andesColPoint]);
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: postOffice,
        turbulenceZone: null,
  turbulenceZone2: null,
        andesCol: andesColPoint,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else if (levelId === 'patagonie') {
      // Patagonie : deux avions
      const p1Start = generatePatagoniePoint();
      const p2Start = generatePatagoniePoint([p1Start]);
      options = generatePatagonieCargoOptions(p1Start, p2Start, []);
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: null,
        turbulenceZone: null,
  turbulenceZone2: null,
        patagonieSelectionPhase: 'plane1',
        currentPoint: p1Start,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        plane2CurrentPoint: p2Start,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return; // Early return, already set everything
    } else if (levelId === 'paraguay') {
      // Paraguay : deux avions + collecte/distribution
      const p1Start = generateParaguayPoint();
      const p2Start = generateParaguayPoint([p1Start]);
      options = generateParaguayCargoOptions(p1Start, p2Start, []);
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0, // Compteur cumulé de courriers distribués
        mauritaniaPostOffice: null,
        turbulenceZone: null,
  turbulenceZone2: null,
        patagonieSelectionPhase: 'plane1',
        currentPoint: p1Start,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        plane2CurrentPoint: p2Start,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return; // Early return
    } else if (levelId === 'sahel') {
      // SAHEL : 1 avion, courrier illimité, +500 MILES par courrier
      startPoint = generateSahelPoint();
      options = generateSahelOptions(startPoint, []);
    } else if (levelId === 'gibraltar2') {
      // GIBRALTAR II : collecte au sud, douane, distribution au nord
      startPoint = generateGibraltar2Point(1);
      options = generateGibraltar2CargoOptions(startPoint, [], 1, 0, 0);
    } else if (levelId === 'campagne_europe') {
      // CAMPAGNE EUROPE : 4 quadrants, 80 destinations, 50 courriers
      const campaignPts = generateCampaignPoints();
      // Point de départ aléatoire dans le quadrant BL
      startPoint = generateCampaignLandPoint('BL', campaignPts.filter(p => p.quadrant === 'BL').map(p => p.point));
      
      // Générer les options du quadrant BL (non visités + flèches)
      const blPoints = campaignPts.filter(p => p.quadrant === 'BL');
      const arrows = QUADRANT_ARROWS['BL'];
      
      const campaignOptions: CargoOption[] = blPoints.map(cp => ({
        point: cp.point,
        type: cp.type,
        amount: cp.amount, // Montant fixé dès la génération
      }));
      
      // Ajouter les flèches comme destinations spéciales
      for (const arrow of arrows) {
        campaignOptions.push({
          point: {
            id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
            x: arrow.arrowPosition.x,
            y: arrow.arrowPosition.y,
          },
          type: 'arrow' as any,
          amount: 0,
        });
      }
      
      options = campaignOptions;
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: null,
        turbulenceZone: null,
        turbulenceZone2: null,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        isCampaignMode: true,
        currentQuadrant: 'BL' as Quadrant,
        campaignPoints: campaignPts,
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else if (levelId === 'niveau_16') {
      // CAMPAGNE SCANDINAVIE : mêmes règles que Campagne Europe + bureau de poste TR + capacité 20
      const campaignPts = generateScandinaviePoints();
      startPoint = generateScandinavieLandPoint('BL', campaignPts.filter(p => p.quadrant === 'BL').map(p => p.point));
      
      // Générer le bureau de poste dans le quadrant TR (Finlande)
      const allCampaignMapPoints = campaignPts.map(p => p.point);
      const postOfficePt = generateScandinavieLandPoint('TR', allCampaignMapPoints);
      
      const blPoints = campaignPts.filter(p => p.quadrant === 'BL');
      const arrows = SCANDINAVIE_QUADRANT_ARROWS['BL'];
      
      const campaignOptions: CargoOption[] = blPoints.map(cp => ({
        point: cp.point,
        type: cp.type,
        amount: cp.amount,
      }));
      
      for (const arrow of arrows) {
        campaignOptions.push({
          point: {
            id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
            x: arrow.arrowPosition.x,
            y: arrow.arrowPosition.y,
          },
          type: 'arrow' as any,
          amount: 0,
        });
      }
      
      options = campaignOptions;
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: postOfficePt, // Bureau de poste dans TR
        turbulenceZone: null,
        turbulenceZone2: null,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        isCampaignMode: true,
        currentQuadrant: 'BL' as Quadrant,
        campaignPoints: campaignPts,
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else if (levelId === 'corsica') {
      // CAMPAGNE CORSICA : 2 secteurs N/S, mêmes mécaniques que Scandinavie
      const campaignPts = generateCorsicaPoints();
      startPoint = generateCorsicaLandPoint('TL', campaignPts.filter(p => p.quadrant === 'TL').map(p => p.point));
      
      // Bureau de poste dans le secteur SUD (BL)
      const allCampaignMapPoints = campaignPts.map(p => p.point);
      const postOfficePt = generateCorsicaLandPoint('BL', allCampaignMapPoints);
      
      const tlPoints = campaignPts.filter(p => p.quadrant === 'TL');
      const arrows = CORSICA_QUADRANT_ARROWS['TL'];
      
      const campaignOptions: CargoOption[] = tlPoints.map(cp => ({
        point: cp.point,
        type: cp.type,
        amount: cp.amount,
      }));
      
      for (const arrow of arrows) {
        campaignOptions.push({
          point: {
            id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
            x: arrow.arrowPosition.x,
            y: arrow.arrowPosition.y,
          },
          type: 'arrow' as any,
          amount: 0,
        });
      }
      
      options = campaignOptions;
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: postOfficePt,
        turbulenceZone: null,
        turbulenceZone2: null,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        isCampaignMode: true,
        currentQuadrant: 'TL' as Quadrant,
        campaignPoints: campaignPts,
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else if (levelId === 'sardegna') {
      // CAMPAGNE SARDEGNA : 3 secteurs, règles identiques à EUROPE 40 (3 options par tour)
      startPoint = generateSardegnaLandPoint('TL', []);
      
      // Bureau de poste en Tunisie (secteur SUD = BR, forcé en zone Tunisie)
      let postOfficePt: MapPoint = { id: `sard_poste_${Date.now()}`, x: 0.40, y: 0.78 };
      for (let po = 0; po < 200; po++) {
        const px = 0.10 + Math.random() * 0.55;
        const py = 0.62 + Math.random() * 0.28;
        if (isOnLandSardegna(px, py, 'BR')) {
          postOfficePt = { id: `sard_poste_${Date.now()}`, x: px, y: py };
          break;
        }
      }
      
      // Aérodrome fixe au centre de la Sardaigne (secteur BL)
      const aerodromePt: MapPoint = { id: 'sardegna_aerodrome', x: 0.45, y: 0.45 };
      
      // Générer 3 options aléatoires pour le premier tour (comme Europe 40)
      options = generateSardegnaCargoOptions(startPoint, 'TL', []);
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: postOfficePt,
        sardegnaAerodrome: aerodromePt,
        sardegnaAerodromeUsed: false,
        turbulenceZone: null,
        turbulenceZone2: null,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        isCampaignMode: true,
        currentQuadrant: 'TL' as Quadrant,
        campaignPoints: [],
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else if (levelId === 'afrique_nord') {
      // AFRIQUE DU NORD : 3 secteurs horizontaux, avion départ à DROITE (BR=Tunisie)
      startPoint = generateAfNordLandPoint('BR', []);
      
      // Bureau de poste au MAROC (secteur gauche = TL)
      let postOfficePt: MapPoint = { id: `afn_poste_${Date.now()}`, x: 0.30, y: 0.50 };
      for (let po = 0; po < 200; po++) {
        const px = 0.10 + Math.random() * 0.70;
        const py = 0.25 + Math.random() * 0.60;
        if (isOnLandAfNord(px, py, 'TL')) {
          postOfficePt = { id: `afn_poste_${Date.now()}`, x: px, y: py };
          break;
        }
      }
      
      options = generateAfNordCargoOptions(startPoint, 'BR', []);
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: postOfficePt,
        turbulenceZone: null,
        turbulenceZone2: null,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        isCampaignMode: true,
        currentQuadrant: 'BR' as Quadrant,
        campaignPoints: [],
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else if (levelId === 'retour_france') {
      // RETOUR FRANCE : 2 secteurs verticaux, départ Afrique du Nord (BL) → France (TL)
      startPoint = generateRetourFranceLandPoint('BL', []);
      options = generateRetourFranceCargoOptions(startPoint, [], 0, 'BL');
      
      const now = Date.now();
      set({
        gameStatus: 'playing',
        currentLevelId: levelId,
        mailTarget: mailTarget,
        gibraltarPhase: null,
        gibraltarMailCollected: 0,
        mauritaniaMailCumul: 0,
        mauritaniaPostOffice: null,
        turbulenceZone: null,
        turbulenceZone2: null,
        patagonieSelectionPhase: null,
        currentPoint: startPoint,
        visitedPoints: [],
        mailCount: 0,
        fuelLevel: 100,
        completedFlights: [],
        mechanicalWarnings: 0,
        criticalCountdownActive: false,
        criticalCountdownEnd: 0,
        gameOverReason: null,
        crashPosition: null,
        gameStartTime: now,
        cargoOptions: options,
        isFlying: false,
        flyingProgress: 0,
        flyingDestination: null,
        selectedCargo: null,
        flightFuelCost: 0,
  flightActualFuelUsed: 0,
        flightIntersectionProgresses: [],
        triggeredFlightIntersections: [],
        isCampaignMode: true,
        currentQuadrant: 'BL' as Quadrant,
        campaignPoints: [],
        plane2CurrentPoint: null,
        plane2VisitedPoints: [],
        plane2FuelLevel: 100,
        plane2CompletedFlights: [],
        plane2MechanicalWarnings: 0,
        plane2CriticalCountdownActive: false,
        plane2CriticalCountdownEnd: 0,
        plane2IsFlying: false,
        plane2FlyingProgress: 0,
        plane2FlyingDestination: null,
        plane2SelectedCargo: null,
        plane2FlightFuelCost: 0,
        plane2FlightCurveDirection: 1 as 1 | -1,
        plane2FlightIntersectionProgresses: [],
        plane2TriggeredFlightIntersections: [],
        plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
      });
      return;
    } else {
      startPoint = generateRandomLandPoint();
      options = generateCargoOptions(startPoint, []);
    }
    
    const now = Date.now();
    
    set({
      gameStatus: 'playing',
      currentLevelId: levelId,
      mailTarget: mailTarget,
      gibraltarPhase: (isGibraltar || isAtlantique || levelId === 'atlantique2' || levelId === 'africa_again' || levelId === 'gibraltar2') ? 1 : null,
      gibraltarMailCollected: 0,
      mauritaniaMailCumul: 0,
      mauritaniaPostOffice: postOffice,
      turbulenceZone: turbZone,
      turbulenceZone2: levelId === 'atlantique2' ? { 
        x: 0.30 + Math.random() * 0.30,  // océan : x entre 0.30 et 0.60
        y: 0.45 + Math.random() * 0.30,   // océan bas : y entre 0.45 et 0.75
        radius: 0.14,
      } : null,
      currentPoint: startPoint,
      visitedPoints: [],
      mailCount: 0,
      fuelLevel: 100,
      completedFlights: [],
      mechanicalWarnings: 0,
      criticalCountdownActive: false,
      criticalCountdownEnd: 0,
      gameOverReason: null,
      crashPosition: null,
      gameStartTime: now,
      cargoOptions: options,
      isFlying: false,
      flyingProgress: 0,
      flyingDestination: null,
      selectedCargo: null,
      flightFuelCost: 0,
  flightActualFuelUsed: 0,
      flightIntersectionProgresses: [],
      triggeredFlightIntersections: [],
      patagonieSelectionPhase: null,
      plane2CurrentPoint: null,
      plane2VisitedPoints: [],
      plane2FuelLevel: 100,
      plane2CompletedFlights: [],
      plane2MechanicalWarnings: 0,
      plane2CriticalCountdownActive: false,
      plane2CriticalCountdownEnd: 0,
      plane2IsFlying: false,
      plane2FlyingProgress: 0,
      plane2FlyingDestination: null,
      plane2SelectedCargo: null,
      plane2FlightFuelCost: 0,
      plane2FlightCurveDirection: 1 as 1 | -1,
      plane2FlightIntersectionProgresses: [],
      plane2TriggeredFlightIntersections: [],
      plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
    });
  },
  
  selectDestination: (option: CargoOption) => {
    const state = get();
    if (!state.currentPoint || state.isFlying) return;
    
    // GIBRALTAR II : Vérifier que le joueur a assez de MILES pour la douane
    if (option.type === 'customs' && state.totalMiles < 20000) {
      set({ flashMessage: 'VOUS N\'AVEZ PAS 20000 MILES AU COMPTEUR POUR VOUS RENDRE AU BUREAU DE DOUANE' });
      setTimeout(() => { set({ flashMessage: null }); }, 2000);
      return;
    }
    
    // Pre-calculate fuel cost for this flight
    const distance = calculateDistance(state.currentPoint, option.point);
    const fuelCost = Math.round(distance * 40);
    
    // Pre-calculate the curve direction (using aspect ratio for pixel-accurate curves)
    const ar = state.mapAspectRatio;
    let bestDirection = findBestCurveDirection(
      state.currentPoint,
      option.point,
      state.completedFlights,
      ar
    );
    
    // TUTO step 5: forcer la direction qui CAUSE un croisement (inverser la meilleure)
    if (state.tutorialMode && state.tutorialStep === 5) {
      bestDirection = -bestDirection as 1 | -1;
    }
    
    // Pre-calculate intersection progress values for real-time warning triggers
    let intersectionProgresses = getIntersectionProgresses(
      state.currentPoint,
      option.point,
      bestDirection,
      state.completedFlights,
      ar
    );
    
    // TUTO step 5: GARANTIR une intersection à 50% du vol si aucune n'a été détectée
    if (state.tutorialMode && state.tutorialStep === 5 && intersectionProgresses.length === 0) {
      intersectionProgresses = [0.5];
    }
    
    set({
      isFlying: true,
      flyingProgress: 0,
      flyingDestination: option.point,
      selectedCargo: option,
      flightFuelCost: fuelCost,
      flightCurveDirection: bestDirection,
      flightIntersectionProgresses: intersectionProgresses,
      triggeredFlightIntersections: [],
    });
  },
  
  // Sélectionner le bureau de poste en Mauritanie (vol vers le bureau de poste pour livrer)
  selectPostOffice: () => {
    const state = get();
    if (!state.currentPoint || state.isFlying || state.gameStatus !== 'playing') return;
    if ((state.currentLevelId !== 'mauritanie' && state.currentLevelId !== 'andes' && state.currentLevelId !== 'niveau_16' && state.currentLevelId !== 'corsica' && state.currentLevelId !== 'sardegna' && state.currentLevelId !== 'afrique_nord') || !state.mauritaniaPostOffice) return;
    if (state.mailCount <= 0) return; // Pas de courrier à livrer
    
    const postOffice = state.mauritaniaPostOffice;
    const distance = calculateDistance(state.currentPoint, postOffice);
    const fuelCost = Math.round(distance * 40);
    
    // Créer un cargo de type 'delivery' pour le bureau de poste
    const deliveryCargo: CargoOption = {
      point: postOffice,
      type: 'delivery',
      amount: state.mailCount, // Livrer tout le courrier
    };
    
    const bestDirection = findBestCurveDirection(
      state.currentPoint,
      postOffice,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    const intersectionProgresses = getIntersectionProgresses(
      state.currentPoint,
      postOffice,
      bestDirection,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    set({
      isFlying: true,
      flyingProgress: 0,
      flyingDestination: postOffice,
      selectedCargo: deliveryCargo,
      flightFuelCost: fuelCost,
      flightCurveDirection: bestDirection,
      flightIntersectionProgresses: intersectionProgresses,
      triggeredFlightIntersections: [],
    });
  },

  // SARDEGNA: Utiliser l'aérodrome (changer d'avion → fuel plein + voyants éteints)
  useAerodrome: () => {
    const state = get();
    if (!state.currentPoint || state.isFlying || state.gameStatus !== 'playing') return;
    if (state.currentLevelId !== 'sardegna' || !state.sardegnaAerodrome || state.sardegnaAerodromeUsed) return;
    
    const aerodrome = state.sardegnaAerodrome;
    const distance = calculateDistance(state.currentPoint, aerodrome);
    const fuelCost = Math.round(distance * 40);
    
    // Vol vers l'aérodrome : type 'fuel' avec amount spécial
    const aeroCargo: CargoOption = {
      point: aerodrome,
      type: 'fuel',
      amount: 100, // sera ignoré, le reset se fait dans completeFlight
    };
    
    const bestDirection = findBestCurveDirection(
      state.currentPoint,
      aerodrome,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    const intersectionProgresses = getIntersectionProgresses(
      state.currentPoint,
      aerodrome,
      bestDirection,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    set({
      isFlying: true,
      flyingProgress: 0,
      flyingDestination: aerodrome,
      selectedCargo: aeroCargo,
      flightFuelCost: fuelCost,
      flightCurveDirection: bestDirection,
      flightIntersectionProgresses: intersectionProgresses,
      triggeredFlightIntersections: [],
    });
  },

  
  // ANDES: Sélectionner le col (point de passage)
  selectAndesCol: () => {
    const state = get();
    if (!state.currentPoint || state.isFlying || state.gameStatus !== 'playing') return;
    if (state.currentLevelId !== 'andes' || !state.andesCol) return;
    
    const colPoint = state.andesCol;
    const distance = calculateDistance(state.currentPoint, colPoint);
    const fuelCost = Math.round(distance * 40);
    
    // Le col est un passage neutre : pas de cargo, juste un déplacement
    const colCargo: CargoOption = {
      point: colPoint,
      type: 'fuel', // Type neutre pour ne pas ajouter de mail
      amount: 0, // Pas de carburant bonus
    };
    
    const bestDirection = findBestCurveDirection(
      state.currentPoint,
      colPoint,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    const intersectionProgresses = getIntersectionProgresses(
      state.currentPoint,
      colPoint,
      bestDirection,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    set({
      isFlying: true,
      flyingProgress: 0,
      flyingDestination: colPoint,
      selectedCargo: colCargo,
      flightFuelCost: fuelCost,
      flightCurveDirection: bestDirection,
      flightIntersectionProgresses: intersectionProgresses,
      triggeredFlightIntersections: [],
    });
  },
  
  // Patagonie: sélectionner une destination pour un avion spécifique
  selectPatagonieDestination: (option: CargoOption, planeId: 1 | 2) => {
    const state = get();
    if ((state.currentLevelId !== 'patagonie' && state.currentLevelId !== 'paraguay') || state.gameStatus !== 'playing') return;
    
    if (planeId === 1 && state.patagonieSelectionPhase === 'plane1') {
      // Avion 1 sélectionne sa destination
      const allFlights = [...state.completedFlights, ...state.plane2CompletedFlights];
      const distance = calculateDistance(state.currentPoint!, option.point);
      const fuelCost = Math.round(distance * 40);
      const ar = state.mapAspectRatio;
      const bestDirection = findBestCurveDirection(state.currentPoint!, option.point, allFlights, ar);
      const intersectionProgresses = getIntersectionProgresses(state.currentPoint!, option.point, bestDirection, allFlights, ar);
      
      // SAHEL n'utilise plus le mode 2 avions
      
      set({
        selectedCargo: option,
        flyingDestination: option.point,
        flightFuelCost: fuelCost,
        flightCurveDirection: bestDirection,
        flightIntersectionProgresses: intersectionProgresses,
        triggeredFlightIntersections: [],
        patagonieSelectionPhase: 'plane2',
      });
    } else if (planeId === 2 && state.patagonieSelectionPhase === 'plane2') {
      // Vérifier si l'avion 2 clique sur la même destination que l'avion 1 (désélection avion 1)
      if (state.selectedCargo && state.selectedCargo.point.id === option.point.id) {
        // Désélectionner avion 1 : revenir en phase plane1
        set({
          selectedCargo: null,
          flyingDestination: null,
          flightFuelCost: 0,
  flightActualFuelUsed: 0,
          flightIntersectionProgresses: [],
          triggeredFlightIntersections: [],
          patagonieSelectionPhase: 'plane1',
        });
        return;
      }
      // Avion 2 sélectionne sa destination - puis les deux décollent
      // Inclure le vol planifié de l'avion 1 dans les vols existants pour vérifier les intersections
      const allFlights = [...state.completedFlights, ...state.plane2CompletedFlights];
      // Ajouter le vol planifié de l'avion 1 comme vol existant
      if (state.currentPoint && state.flyingDestination) {
        const plane1Direction = findBestCurveDirection(state.currentPoint, state.flyingDestination, allFlights, state.mapAspectRatio);
        allFlights.push({
          from: state.currentPoint,
          to: state.flyingDestination,
          curveDirection: plane1Direction,
        });
      }
      const distance = calculateDistance(state.plane2CurrentPoint!, option.point);
      const fuelCost = Math.round(distance * 40);
      const bestDirection = findBestCurveDirection(state.plane2CurrentPoint!, option.point, allFlights, state.mapAspectRatio);
      const intersectionProgresses = getIntersectionProgresses(state.plane2CurrentPoint!, option.point, bestDirection, allFlights, state.mapAspectRatio);
      
      set({
        plane2SelectedCargo: option,
        plane2FlyingDestination: option.point,
        plane2FlightFuelCost: fuelCost,
        plane2FlightCurveDirection: bestDirection,
        plane2FlightIntersectionProgresses: intersectionProgresses,
        plane2TriggeredFlightIntersections: [],
        // Les deux décollent
        isFlying: true,
        flyingProgress: 0,
        plane2IsFlying: true,
        plane2FlyingProgress: 0,
        patagonieSelectionPhase: 'flying',
      });
    }
  },

  updateFlyingProgress: (progress: number) => {
    set({ flyingProgress: progress });
  },
  
  updatePlane2FlyingProgress: (progress: number) => {
    set({ plane2FlyingProgress: progress });
  },
  
  // Add a single mechanical warning (called in real-time during flight when crossing a path)
  addMechanicalWarning: () => {
    const state = get();
    const newWarnings = Math.min(4, state.mechanicalWarnings + 1);
    
    // If already at 4 warnings AND critical countdown is active, instant game over
    if (state.criticalCountdownActive && state.mechanicalWarnings >= 4) {
      // This shouldn't trigger during flight since crashMidFlight handles it
      return;
    }
    
    // If reaching 4 warnings, start critical countdown
    let newCriticalActive = state.criticalCountdownActive;
    let newCriticalEnd = state.criticalCountdownEnd;
    
    if (newWarnings >= 4 && !state.criticalCountdownActive) {
      newCriticalActive = true;
      newCriticalEnd = Date.now() + 60000; // 1 minute
    }
    
    set({
      mechanicalWarnings: newWarnings,
      criticalCountdownActive: newCriticalActive,
      criticalCountdownEnd: newCriticalEnd,
    });
  },
  
  // Patagonie: Add mechanical warning for plane 2
  addPlane2MechanicalWarning: () => {
    const state = get();
    const newWarnings = Math.min(4, state.plane2MechanicalWarnings + 1);
    
    if (state.plane2CriticalCountdownActive && state.plane2MechanicalWarnings >= 4) {
      return;
    }
    
    let newCriticalActive = state.plane2CriticalCountdownActive;
    let newCriticalEnd = state.plane2CriticalCountdownEnd;
    
    if (newWarnings >= 4 && !state.plane2CriticalCountdownActive) {
      newCriticalActive = true;
      newCriticalEnd = Date.now() + 60000;
    }
    
    set({
      plane2MechanicalWarnings: newWarnings,
      plane2CriticalCountdownActive: newCriticalActive,
      plane2CriticalCountdownEnd: newCriticalEnd,
    });
  },
  
  // ATOMIC intersection trigger for main plane — deduplicates by index in the store
  // This replaces the useRef-based dedup in index.tsx to guarantee exactly 1 warning per crossed flight
  triggerFlightIntersection: (intersectionIndex: number) => {
    const state = get();
    // Already triggered? Skip — this is the key dedup that prevents double warnings
    if (state.triggeredFlightIntersections.includes(intersectionIndex)) return;
    
    const newTriggered = [...state.triggeredFlightIntersections, intersectionIndex];
    const newWarnings = Math.min(4, state.mechanicalWarnings + 1);
    
    if (state.criticalCountdownActive && state.mechanicalWarnings >= 4) {
      // Already at max + critical — shouldn't happen here (crashMidFlight handles it)
      set({ triggeredFlightIntersections: newTriggered });
      return;
    }
    
    let newCriticalActive = state.criticalCountdownActive;
    let newCriticalEnd = state.criticalCountdownEnd;
    if (newWarnings >= 4 && !state.criticalCountdownActive) {
      newCriticalActive = true;
      newCriticalEnd = Date.now() + 60000;
    }
    
    console.log(`[TRIGGER] Intersection #${intersectionIndex} → warnings ${state.mechanicalWarnings}→${newWarnings}, triggered=[${newTriggered.join(',')}]`);
    
    set({
      triggeredFlightIntersections: newTriggered,
      mechanicalWarnings: newWarnings,
      criticalCountdownActive: newCriticalActive,
      criticalCountdownEnd: newCriticalEnd,
    });
  },
  
  // ATOMIC intersection trigger for plane 2
  triggerPlane2FlightIntersection: (intersectionIndex: number) => {
    const state = get();
    if (state.plane2TriggeredFlightIntersections.includes(intersectionIndex)) return;
    
    const newTriggered = [...state.plane2TriggeredFlightIntersections, intersectionIndex];
    const newWarnings = Math.min(4, state.plane2MechanicalWarnings + 1);
    
    if (state.plane2CriticalCountdownActive && state.plane2MechanicalWarnings >= 4) {
      set({ plane2TriggeredFlightIntersections: newTriggered });
      return;
    }
    
    let newCriticalActive = state.plane2CriticalCountdownActive;
    let newCriticalEnd = state.plane2CriticalCountdownEnd;
    if (newWarnings >= 4 && !state.plane2CriticalCountdownActive) {
      newCriticalActive = true;
      newCriticalEnd = Date.now() + 60000;
    }
    
    set({
      plane2TriggeredFlightIntersections: newTriggered,
      plane2MechanicalWarnings: newWarnings,
      plane2CriticalCountdownActive: newCriticalActive,
      plane2CriticalCountdownEnd: newCriticalEnd,
    });
  },
  
  // Crash the plane mid-flight at the given progress point
  crashMidFlight: (progress: number, reason: 'fuel' | 'mechanical') => {
    const state = get();
    if (!state.currentPoint || !state.flyingDestination) return;
    
    // Calculate crash position along the flight path
    const crashX = state.currentPoint.x + (state.flyingDestination.x - state.currentPoint.x) * progress;
    const crashY = state.currentPoint.y + (state.flyingDestination.y - state.currentPoint.y) * progress;
    
    // Add the partial flight to completed flights
    const bestDirection = findBestCurveDirection(
      state.currentPoint,
      state.flyingDestination,
      state.completedFlights,
      state.mapAspectRatio
    );
    const partialFlight: Flight = {
      from: state.currentPoint,
      to: { id: 'crash_point', x: crashX, y: crashY },
      curveDirection: bestDirection,
    };

    // SAHEL : si l'objectif est atteint au moment de la panne, mission gagnée
    const isSahelWin = state.currentLevelId === 'sahel' && state.mailCount >= state.mailTarget;

    set({
      isFlying: false,
      flyingProgress: 0,
      flyingDestination: null,
      selectedCargo: null,
      fuelLevel: reason === 'fuel' ? 0 : state.fuelLevel,
      completedFlights: [...state.completedFlights, partialFlight],
      gameStatus: isSahelWin ? 'won' : 'lost',
      gameOverReason: isSahelWin ? null : reason,
      crashPosition: { x: crashX, y: crashY },
      // Stop plane2 too if patagonie
      plane2IsFlying: false,
      plane2FlyingProgress: 0,
    });
    if (isSahelWin) {
      AsyncStorage.getItem('completed_levels').then(data => {
        const completed = data ? JSON.parse(data) : [];
        if (!completed.includes(state.currentLevelId)) {
          completed.push(state.currentLevelId);
          AsyncStorage.setItem('completed_levels', JSON.stringify(completed)).catch(() => {});
        }
      }).catch(() => {});
    }
  },
  
  // Patagonie: Crash plane 2 mid-flight
  crashPlane2MidFlight: (progress: number, reason: 'fuel' | 'mechanical') => {
    const state = get();
    if (!state.plane2CurrentPoint || !state.plane2FlyingDestination) return;
    
    const crashX = state.plane2CurrentPoint.x + (state.plane2FlyingDestination.x - state.plane2CurrentPoint.x) * progress;
    const crashY = state.plane2CurrentPoint.y + (state.plane2FlyingDestination.y - state.plane2CurrentPoint.y) * progress;
    
    const allFlights = [...state.completedFlights, ...state.plane2CompletedFlights];
    const bestDirection = findBestCurveDirection(state.plane2CurrentPoint, state.plane2FlyingDestination, allFlights, state.mapAspectRatio);
    const partialFlight: Flight = {
      from: state.plane2CurrentPoint,
      to: { id: 'crash_point_p2', x: crashX, y: crashY },
      curveDirection: bestDirection,
    };
    
    set({
      plane2IsFlying: false,
      plane2FlyingProgress: 0,
      plane2FlyingDestination: null,
      plane2SelectedCargo: null,
      plane2FuelLevel: reason === 'fuel' ? 0 : state.plane2FuelLevel,
      plane2CompletedFlights: [...state.plane2CompletedFlights, partialFlight],
      plane2CrashPosition: { x: crashX, y: crashY },
      gameStatus: 'lost',
      gameOverReason: reason,
      crashPosition: { x: crashX, y: crashY },
      // Stop plane1 too
      isFlying: false,
      flyingProgress: 0,
    });
  },
  
  completeFlight: () => {
    const state = get();
    if (!state.currentPoint || !state.flyingDestination || !state.selectedCargo) return;
    
    const option = state.selectedCargo;
    
    // Calculate fuel consumption based on distance
    const distance = calculateDistance(state.currentPoint, state.flyingDestination);
    let fuelCost = Math.round(distance * 40);
    
    // Les pénalités turbulence (Amazonie, Atlantique 2, Africa Again) sont gérées
    // en temps réel pendant l'animation du vol (index.tsx fuelMultiplier).
    // Ne PAS les appliquer ici pour éviter la double déduction.
    
    // Calculate new values
    let newMailCount = state.mailCount;
    // Utiliser le carburant réellement consommé (incluant le multiplicateur turbulence) si disponible
    const actualFuelCost = state.flightActualFuelUsed > 0 ? state.flightActualFuelUsed : fuelCost;
    let newFuelLevel = Math.max(0, state.fuelLevel - actualFuelCost);
    let newMechanicalWarnings = state.mechanicalWarnings;
    let newTotalMiles = state.totalMiles;
    let newCriticalActive = state.criticalCountdownActive;
    let newCriticalEnd = state.criticalCountdownEnd;
    
    // Utiliser la direction de courbe SAUVEGARDÉE (celle du vol réel)
    // au lieu de la recalculer, pour que la courbe stockée corresponde exactement
    // à celle affichée pendant le vol
    const actualDirection = state.flightCurveDirection || findBestCurveDirection(
      state.currentPoint,
      state.flyingDestination,
      state.completedFlights,
      state.mapAspectRatio
    );
    
    const newFlight: Flight = {
      from: state.currentPoint,
      to: state.flyingDestination,
      curveDirection: actualDirection,
    };
    
    // Les intersections sont déjà comptées en temps réel pendant le vol (index.tsx)
    // via addMechanicalWarning(). Ne PAS recompter ici pour éviter le double comptage.
    
    // Apply cargo AFTER counting intersections
    if (option.type === 'mail') {
      if (state.currentLevelId === 'paraguay') {
        // Paraguay : collecte → ajouter au compteur individuel de l'avion 1
        // ne PAS modifier mailCount ici
      } else {
        newMailCount += option.amount;
        // Mauritanie / Andes / Scandinavie : plafonner à 20 courriers dans l'avion
        if (state.currentLevelId === 'mauritanie' || state.currentLevelId === 'andes' || state.currentLevelId === 'niveau_16' || state.currentLevelId === 'corsica' || state.currentLevelId === 'sardegna' || state.currentLevelId === 'afrique_nord' || state.currentLevelId === 'retour_france' || state.currentLevelId === 'atlantique') {
          newMailCount = Math.min(20, newMailCount);
        }
      }
    } else if (option.type === 'delivery') {
      if (state.currentLevelId === 'mauritanie' || state.currentLevelId === 'andes' || state.currentLevelId === 'niveau_16' || state.currentLevelId === 'corsica' || state.currentLevelId === 'sardegna' || state.currentLevelId === 'afrique_nord') {
        // Mauritanie / Andes / Scandinavie / Corsica : ne PAS déduire ici, sera géré plus bas
      } else if (state.currentLevelId === 'paraguay') {
        // Paraguay : distribution → sera géré plus bas avec le compteur individuel
      } else if (state.currentLevelId === 'retour_france') {
        // RETOUR FRANCE : ne PAS déduire ici, sera géré dans la section retour_france
      } else if (state.currentLevelId === 'atlantique') {
        // ATLANTIQUE : ne PAS déduire ici, géré dans la section ATLANTIQUE 4 phases
      } else {
        // Gibraltar phase 2 : distribuer le courrier (déduire)
        newMailCount = Math.max(0, newMailCount - option.amount);
      }
    } else if (option.type === 'fuel') {
      newFuelLevel = Math.min(100, newFuelLevel + option.amount);
    } else if (option.type === 'repair') {
      // Repair: remove warning lights (amount = 1 normally, 2 for Amazonie)
      const repairAmount = option.amount || 1;
      newMechanicalWarnings = Math.max(0, newMechanicalWarnings - repairAmount);
      // If we go below 4, cancel the critical countdown
      if (newMechanicalWarnings < 4) {
        newCriticalActive = false;
        newCriticalEnd = 0;
      }
    } else if (option.type === 'customs') {
      // GIBRALTAR II : Bureau de douane — déduire 20 000 MILES, passer en phase 2
      newTotalMiles = Math.max(0, state.totalMiles - 20000);
    }
    
    // Check if 4th warning just got lit → start critical countdown
    if (newMechanicalWarnings >= 4 && !newCriticalActive) {
      newCriticalActive = true;
      newCriticalEnd = Date.now() + 60000; // 1 minute from now
    }
    
    const newCompletedFlights = [...state.completedFlights, newFlight];
    const newVisitedPoints = [...state.visitedPoints, state.currentPoint];
    const newCurrentPoint = state.flyingDestination;
    
    // Calculer les miles parcourus (distance normalisée * 2500)
    const dx = state.flyingDestination.x - state.currentPoint.x;
    const dy = state.flyingDestination.y - state.currentPoint.y;
    const flightDistance = Math.sqrt(dx * dx + dy * dy);
    const milesEarned = Math.round(flightDistance * 2500);
    
    // Mauritanie : livraison au bureau de poste (bureau FIXE, ne change jamais)
    let newMauritaniaCumul = state.mauritaniaMailCumul;
    const newPostOffice = state.mauritaniaPostOffice; // FIXE - ne change pas
    
    if ((state.currentLevelId === 'mauritanie' || state.currentLevelId === 'andes') && option.type === 'delivery') {
      // Transférer TOUT le courrier de l'avion vers le cumul
      newMauritaniaCumul += newMailCount;
      newMailCount = 0; // Vider l'avion
    }
    
    // CAMPAGNE SCANDINAVIE : livraison au bureau de poste
    if (state.currentLevelId === 'niveau_16' && option.type === 'delivery') {
      newMauritaniaCumul += newMailCount;
      newMailCount = 0;
    }
    
    // CAMPAGNE CORSICA : livraison au bureau de poste
    if (state.currentLevelId === 'corsica' && option.type === 'delivery') {
      newMauritaniaCumul += newMailCount;
      newMailCount = 0;
    }
    
    // CAMPAGNE SARDEGNA : livraison au bureau de poste (Tunisie)
    if (state.currentLevelId === 'sardegna' && option.type === 'delivery') {
      newMauritaniaCumul += newMailCount;
      newMailCount = 0;
    }
    
    // CAMPAGNE SARDEGNA : aérodrome (changement d'avion → fuel plein + voyants éteints)
    if (state.currentLevelId === 'sardegna' && option.point.id === 'sardegna_aerodrome' && !state.sardegnaAerodromeUsed) {
      newFuelLevel = 100;
      newMechanicalWarnings = 0;
    }
    
    // AFRIQUE DU NORD : livraison au bureau de poste (Maroc)
    if (state.currentLevelId === 'afrique_nord' && option.type === 'delivery') {
      newMauritaniaCumul += newMailCount;
      newMailCount = 0;
    }
    
    // Paraguay : gestion collecte/distribution pour avion 1
    let newPlane1Carried = state.plane1CarriedMail;
    if (state.currentLevelId === 'paraguay') {
      if (option.type === 'mail') {
        // Collecte : augmenter le compteur individuel de l'avion 1
        newPlane1Carried += option.amount;
      } else if (option.type === 'delivery') {
        // Distribution : distribuer min(carried, amount)
        const actualDelivered = Math.min(newPlane1Carried, option.amount);
        newPlane1Carried -= actualDelivered;
        newMauritaniaCumul += actualDelivered; // Le cumul global augmente
      }
    }
    
    // SAHEL : mode 1 avion standard (plus de système de collecte nord/sud)
    
    // Gibraltar : détecter le changement de phase et générer les options selon la phase
    let newGibraltarPhase = state.gibraltarPhase;
    let newGibraltarMailCollected = state.gibraltarMailCollected;
    let newOptions: CargoOption[];
    // Early declaration so win conditions can be set in ATLANTIQUE flow below
    let newGameStatus: typeof state.gameStatus = state.gameStatus;
    let newGameOverReason = state.gameOverReason;
    let newCrashPosition = state.crashPosition;
    
    if (state.currentLevelId === 'gibraltar') {
      // Transition phase 1 → phase 2 quand on atteint 20 courriers
      if (state.gibraltarPhase === 1 && newMailCount >= 20) {
        newGibraltarPhase = 2;
        newGibraltarMailCollected = newMailCount;
      }
      newOptions = generateGibraltarCargoOptions(
        newCurrentPoint,
        newVisitedPoints,
        newGibraltarPhase as (1 | 2),
        newMailCount
      );
    } else if (state.currentLevelId === 'atlantique') {
      // ATLANTIQUE simplifié : pas de phases, 6 destinations simultanées (3 collecte Guinée + 3 livraison Brésil)
      // Victoire si 25 courriers cumulés distribués
      if (option.type === 'mail') {
        // Collecte en Guinée : déjà ajouté plus haut (newMailCount += amount). Plafonner à 20.
        newMailCount = Math.min(20, newMailCount);
      } else if (option.type === 'delivery') {
        const delivered = Math.min(option.amount, newMailCount);
        newMailCount = newMailCount - delivered;
        newGibraltarMailCollected = (state.gibraltarMailCollected || 0) + delivered;
        if (newGibraltarMailCollected >= 25) {
          newGameStatus = 'won';
        }
      }
      newOptions = generateAtlantiqueCargoOptions(
        newCurrentPoint,
        newVisitedPoints,
        0,
        newMailCount
      );
    } else if (state.currentLevelId === 'atlantique2') {
      // Transition phase 1 → phase 2 quand on atteint 30 courriers
      if (state.gibraltarPhase === 1 && newMailCount >= 30) {
        newGibraltarPhase = 2;
        newGibraltarMailCollected = newMailCount;
      }
      newOptions = generateAtlantique2CargoOptions(
        newCurrentPoint,
        newVisitedPoints,
        newGibraltarPhase as (1 | 2),
        newMailCount
      );
    } else if (state.currentLevelId === 'africa_again') {
      // AFRICA AGAIN : Transition phase 1 → phase 2 quand on atteint 25 courriers
      if (state.gibraltarPhase === 1 && newMailCount >= 25) {
        newGibraltarPhase = 2;
        newGibraltarMailCollected = newMailCount;
      }
      newOptions = generateAfricaAgainCargoOptions(
        newCurrentPoint,
        newVisitedPoints,
        newGibraltarPhase as (1 | 2),
        newMailCount,
        false
      );
    } else if (state.currentLevelId === 'gibraltar2') {
      // GIBRALTAR II : Transition phase 1 → phase 2 quand customs est choisi
      if (option.type === 'customs') {
        newGibraltarPhase = 2;
        newGibraltarMailCollected = newMailCount;
      }
      newOptions = generateGibraltar2CargoOptions(
        newCurrentPoint,
        newVisitedPoints,
        newGibraltarPhase as (1 | 2),
        newMailCount,
        state.totalMiles
      );
    } else if (state.currentLevelId === 'mauritanie') {
      // Inclure le bureau de poste dans les points existants pour éviter les chevauchements
      const mauritanieVisited = state.mauritaniaPostOffice 
        ? [...newVisitedPoints, state.mauritaniaPostOffice] 
        : newVisitedPoints;
      newOptions = generateMauritaniaCargoOptions(newCurrentPoint, mauritanieVisited, newMailCount);
    } else if (state.currentLevelId === 'andes') {
      // Inclure le col ET le bureau de poste pour éviter les chevauchements
      const andesExclude = [...newVisitedPoints];
      if (state.andesCol) andesExclude.push(state.andesCol);
      if (state.mauritaniaPostOffice) andesExclude.push(state.mauritaniaPostOffice);
      newOptions = generateAndesCargoOptions(newCurrentPoint, andesExclude, newMailCount);
    } else if (state.currentLevelId === 'amazonie') {
      newOptions = generateAmazonieCargoOptions(newCurrentPoint, newVisitedPoints);
    } else if (state.currentLevelId === 'buenos_aires') {
      newOptions = generateBuenosAiresCargoOptions(newCurrentPoint, newVisitedPoints);
    } else if (state.currentLevelId === 'patagonie') {
      // Patagonie: ne PAS générer de nouvelles options ici. 
      // Attendre que les deux avions aient atterri dans completePlane2Flight / completeFlight
      newOptions = []; // Temporaire, sera remplacé quand les deux atterrissent
    } else if (state.currentLevelId === 'paraguay') {
      // Paraguay: idem Patagonie, attendre les deux avions
      newOptions = [];
    } else if (state.currentLevelId === 'sahel') {
      // SAHEL: 1 avion, options régénérées normalement
      newOptions = generateSahelOptions(newCurrentPoint, newVisitedPoints);
    } else if (state.currentLevelId === 'sardegna') {
      // SARDEGNA : 3 options aléatoires par tour (comme Europe 40), avec navigation secteurs
      const isArrowDest = option.type === ('arrow' as any);
      const isAerodromeDest = option.point.id === 'sardegna_aerodrome';
      if (isArrowDest) {
        newOptions = [];
      } else {
        // Passer l'aérodrome si pas encore utilisé et on est dans BL
        const aero = (!state.sardegnaAerodromeUsed && !isAerodromeDest) ? state.sardegnaAerodrome : null;
        newOptions = generateSardegnaCargoOptions(newCurrentPoint, state.currentQuadrant, newVisitedPoints, aero);
      }
    } else if (state.currentLevelId === 'afrique_nord') {
      // AFRIQUE DU NORD : 3 options aléatoires par tour, navigation horizontale
      const isArrowDest = option.type === ('arrow' as any);
      if (isArrowDest) {
        newOptions = [];
      } else {
        newOptions = generateAfNordCargoOptions(newCurrentPoint, state.currentQuadrant, newVisitedPoints);
      }
    } else if (state.currentLevelId === 'retour_france') {
      // RETOUR FRANCE : 3 options aléatoires par tour (collecte/distribution), navigation 2 secteurs
      const isArrowDest = option.type === ('arrow' as any);
      if (isArrowDest) {
        newOptions = [];
      } else {
        // Gérer la distribution (type 'delivery') : ajouter au compteur CUMUL
        if (option.type === 'delivery') {
          const delivered = Math.min(option.amount, newMailCount);
          newMailCount = newMailCount - delivered;
          newMauritaniaCumul = (state.mauritaniaMailCumul || 0) + delivered;
          // Vérifier victoire
          if (newMauritaniaCumul >= (state.mailTarget || 100)) {
            newGameStatus = 'won';
          }
        } else if (option.type === 'mail') {
          // Collecte : déjà gérée dans la section générique avec cap à 20
        }
        newOptions = generateRetourFranceCargoOptions(newCurrentPoint, newVisitedPoints, newMailCount, state.currentQuadrant);
      }
    } else if (state.currentLevelId === 'campagne_europe' || state.currentLevelId === 'niveau_16' || state.currentLevelId === 'corsica') {
      // CAMPAGNE : marquer le point comme visité et régénérer les options du quadrant
      const isArrowDest = option.type === ('arrow' as any);
      
      if (isArrowDest) {
        // L'avion arrive sur une flèche → le changement de quadrant sera géré après le set()
        // On ne marque rien comme visité, les flèches sont permanentes
        // Générer des options vides temporairement (switchQuadrant les régénérera)
        newOptions = [];
      } else if (option.type === 'delivery') {
        // Livraison au bureau de poste (niveau_16/corsica) → ne pas marquer comme visité
        // Régénérer les options du quadrant actuel
        const quadrantUnvisited = state.campaignPoints.filter(
          cp => cp.quadrant === state.currentQuadrant && !cp.visited
        );
        const arrows = (state.currentLevelId === 'niveau_16' ? SCANDINAVIE_QUADRANT_ARROWS : state.currentLevelId === 'corsica' ? CORSICA_QUADRANT_ARROWS : state.currentLevelId === 'sardegna' ? SARDEGNA_QUADRANT_ARROWS : state.currentLevelId === 'afrique_nord' ? AFNORD_QUADRANT_ARROWS : state.currentLevelId === 'retour_france' ? RETOUR_FRANCE_QUADRANT_ARROWS : QUADRANT_ARROWS)[state.currentQuadrant];
        
        newOptions = quadrantUnvisited.map(cp => ({
          point: cp.point,
          type: cp.type,
          amount: cp.amount,
        }));
        
        for (const arrow of arrows) {
          newOptions.push({
            point: {
              id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
              x: arrow.arrowPosition.x,
              y: arrow.arrowPosition.y,
            },
            type: 'arrow' as any,
            amount: 0,
          });
        }
      } else {
        // Marquer le point comme visité dans campaignPoints
        const updatedCampaignPoints = state.campaignPoints.map(cp =>
          cp.point.id === state.flyingDestination!.id ? { ...cp, visited: true } : cp
        );
        
        // Régénérer les options pour le quadrant actuel
        const quadrantUnvisited = updatedCampaignPoints.filter(
          cp => cp.quadrant === state.currentQuadrant && !cp.visited
        );
        const arrows = (state.currentLevelId === 'niveau_16' ? SCANDINAVIE_QUADRANT_ARROWS : state.currentLevelId === 'corsica' ? CORSICA_QUADRANT_ARROWS : state.currentLevelId === 'sardegna' ? SARDEGNA_QUADRANT_ARROWS : state.currentLevelId === 'afrique_nord' ? AFNORD_QUADRANT_ARROWS : state.currentLevelId === 'retour_france' ? RETOUR_FRANCE_QUADRANT_ARROWS : QUADRANT_ARROWS)[state.currentQuadrant];
        
        newOptions = quadrantUnvisited.map(cp => ({
          point: cp.point,
          type: cp.type,
          amount: cp.amount, // Montant fixé dès la génération
        }));
        
        for (const arrow of arrows) {
          newOptions.push({
            point: {
              id: `arrow_${arrow.direction}_${arrow.targetQuadrant}`,
              x: arrow.arrowPosition.x,
              y: arrow.arrowPosition.y,
            },
            type: 'arrow' as any,
            amount: 0,
          });
        }
        
        // Mettre à jour campaignPoints dans le state
        set({ campaignPoints: updatedCampaignPoints });
      }
    } else {
      // Tutorial mode: forcer les options selon le tour
      // Note: tutorialFlightCount n'est PAS encore incrémenté ici
      // count=0 → on vient de finir le vol 1, on génère les options du tour 2 (courrier)
      // count=1 → on vient de finir le vol 2, on génère les options du tour 3 (essence)
      // count=2 → on vient de finir le vol 3, on génère les options du tour 4 (croisement)
      if (state.tutorialMode && state.tutorialFlightCount === 0) {
        // Tour 2: uniquement courrier (3 chacune)
        const tutorialOpts: CargoOption[] = [];
        for (let i = 0; i < 3; i++) {
          const point = generateRandomLandPoint([newCurrentPoint, ...newVisitedPoints, ...tutorialOpts.map(o => o.point)]);
          tutorialOpts.push({ point, type: 'mail', amount: 3 });
        }
        newOptions = tutorialOpts;
      } else if (state.tutorialMode && state.tutorialFlightCount === 1) {
        // Tour 3: uniquement bidons d'essence
        const tutorialOpts: CargoOption[] = [];
        for (let i = 0; i < 3; i++) {
          const point = generateRandomLandPoint([newCurrentPoint, ...newVisitedPoints, ...tutorialOpts.map(o => o.point)]);
          tutorialOpts.push({ point, type: 'fuel', amount: 30 });
        }
        newOptions = tutorialOpts;
      } else if (state.tutorialMode && state.tutorialStep === 5 && state.tutorialFlightCount >= 2) {
        // Tour 4 (après essence): TOUTES les destinations forcent un croisement
        // On génère 3 points de l'autre côté des vols existants pour garantir le croisement
        const allFlights = [...newCompletedFlights];
        const tutorialOpts: CargoOption[] = [];
        
        // Pour chaque destination, refléter la position actuelle à travers un vol existant
        for (let i = 0; i < 3 && i < allFlights.length; i++) {
          const flight = allFlights[i];
          const midX = (flight.from.x + flight.to.x) / 2;
          const midY = (flight.from.y + flight.to.y) / 2;
          // Réflexion de la position actuelle à travers le milieu du vol
          // + ajout d'un léger décalage pour chaque destination
          const offset = (i + 1) * 0.05;
          let crossX = 2 * midX - newCurrentPoint.x + offset;
          let crossY = 2 * midY - newCurrentPoint.y + offset;
          // Clamper dans les limites de la carte
          crossX = Math.min(0.85, Math.max(0.15, crossX));
          crossY = Math.min(0.85, Math.max(0.15, crossY));
          const crossPoint: MapPoint = { x: crossX, y: crossY, id: `tuto_cross_${i}_${Date.now()}`, type: 'mail' };
          tutorialOpts.push({ point: crossPoint, type: 'mail', amount: 3 });
        }
        // Si moins de 3 vols complétés, compléter avec des points aléatoires
        while (tutorialOpts.length < 3) {
          const point = generateRandomLandPoint([newCurrentPoint, ...newVisitedPoints, ...tutorialOpts.map(o => o.point)]);
          tutorialOpts.push({ point, type: 'mail', amount: 3 });
        }
        newOptions = tutorialOpts;
      } else {
        newOptions = generateCargoOptions(newCurrentPoint, newVisitedPoints);
      }
    }
    
    // Check win/lose conditions
    // (newGameStatus, newGameOverReason, newCrashPosition already declared above)
    
    if (state.currentLevelId === 'gibraltar' || state.currentLevelId === 'atlantique2' || state.currentLevelId === 'africa_again' || state.currentLevelId === 'gibraltar2') {
      // Gibraltar/Atlantique2/Africa Again/Gibraltar II : victoire quand phase 2 et mailCount = 0
      if (newGibraltarPhase === 2 && newMailCount <= 0) {
        newGameStatus = 'won';
      }
    } else if (state.currentLevelId === 'atlantique') {
      // ATLANTIQUE : victoire gérée dans la section 4 phases (phase 4, mailCount <= 0)
    } else if (state.currentLevelId === 'mauritanie' || state.currentLevelId === 'andes' || state.currentLevelId === 'niveau_16' || state.currentLevelId === 'corsica' || state.currentLevelId === 'sardegna' || state.currentLevelId === 'afrique_nord' || state.currentLevelId === 'retour_france') {
      // Mauritanie / Andes / Scandinavie / Retour France : victoire quand le cumul atteint le mailTarget
      if (newMauritaniaCumul >= state.mailTarget) {
        newGameStatus = 'won';
      }
    } else if (state.currentLevelId === 'paraguay') {
      // Paraguay : victoire quand le cumul distribué atteint le mailTarget
      if (newMauritaniaCumul >= state.mailTarget) {
        newGameStatus = 'won';
      }
    } else if (state.currentLevelId === 'sahel') {
      // SAHEL : pas de victoire possible (courrier illimité)
      // +500 MILES par courrier collecté
      if (option.type === 'mail') {
        const bonusMiles = option.amount * 500;
        // Mise à jour asynchrone des MILES (completeFlight n'a pas de newTotalMiles)
        setTimeout(() => {
          const s = get();
          set({ totalMiles: s.totalMiles + bonusMiles });
          AsyncStorage.setItem('courrier_total_miles', String(s.totalMiles + bonusMiles)).catch(() => {});
        }, 100);
      }
    } else {
      // Niveaux normaux : victoire quand on atteint le mailTarget
      if (newMailCount >= state.mailTarget) {
        newGameStatus = 'won';
      }
    }
    
    if (newFuelLevel <= 0 && newGameStatus !== 'won') {
      newGameStatus = 'lost';
      newGameOverReason = 'fuel';
      newCrashPosition = { x: newCurrentPoint.x, y: newCurrentPoint.y };
    }

    // SAHEL: la partie continue jusqu'à la panne. Si l'objectif (mailTarget) est atteint
    // au moment où la panne survient, la mission est gagnée.
    if (state.currentLevelId === 'sahel' && newGameStatus === 'lost' && newMailCount >= state.mailTarget) {
      newGameStatus = 'won';
      newGameOverReason = undefined;
    }
    
    // Sauvegarder le niveau complété dans AsyncStorage si victoire
    if (newGameStatus === 'won' && !state.freeplayMode) {
      const _levelId = state.currentLevelId;
      AsyncStorage.getItem('completed_levels').then(data => {
        const completed = data ? JSON.parse(data) : [];
        if (!completed.includes(_levelId)) {
          completed.push(_levelId);
          AsyncStorage.setItem('completed_levels', JSON.stringify(completed)).catch(() => {});
          set({ newlyCompletedLevel: _levelId });
        } else {
          set({ newlyCompletedLevel: null });
        }
      }).catch(() => { set({ newlyCompletedLevel: null }); });
    }
    
    set({
      currentPoint: newCurrentPoint,
      visitedPoints: newVisitedPoints,
      mailCount: newMailCount,
      fuelLevel: newFuelLevel,
      totalMiles: newTotalMiles,
      completedFlights: newCompletedFlights,
      mechanicalWarnings: newMechanicalWarnings,
      criticalCountdownActive: newCriticalActive,
      criticalCountdownEnd: newCriticalEnd,
      cargoOptions: newOptions,
      gibraltarPhase: newGibraltarPhase,
      gibraltarMailCollected: newGibraltarMailCollected,
      mauritaniaMailCumul: newMauritaniaCumul,
      mauritaniaPostOffice: newPostOffice,
      sardegnaAerodromeUsed: state.sardegnaAerodromeUsed || (state.currentLevelId === 'sardegna' && option.point.id === 'sardegna_aerodrome'),
      plane1CarriedMail: newPlane1Carried,
      // Amazonie : repositionner la zone de turbulence après chaque vol
      // Africa Again : activer la tempête de sable au centre lors de la phase 2
      turbulenceZone: state.currentLevelId === 'amazonie' ? {
        x: 0.20 + Math.random() * 0.60,
        y: 0.20 + Math.random() * 0.60,
        radius: 0.189,
      } : (state.currentLevelId === 'africa_again' && newGibraltarPhase === 2) ? {
        x: 0.45 + Math.random() * 0.10,  // centre de la carte
        y: 0.35 + Math.random() * 0.10,
        radius: 0.1147,  // -30% supplémentaire
      } : state.turbulenceZone,
      isFlying: false,
      flyingProgress: 0,
      flyingDestination: null,
      selectedCargo: null,
      gameStatus: newGameStatus,
      gameOverReason: newGameOverReason,
      crashPosition: newCrashPosition,
      tutorialFlightCount: state.tutorialMode ? state.tutorialFlightCount + 1 : state.tutorialFlightCount,
    });
    
    // Ajouter les miles au compteur global (persistent)
    if (milesEarned > 0) {
      get().addMiles(milesEarned);
    }
    
    // PATAGONIE: 200 MILES par courrier collecté (même si partie perdue)
    if (state.currentLevelId === 'patagonie' && option.type === 'mail') {
      get().addMiles(option.amount * 200);
    }
    // PARAGUAY: 500 MILES par courrier collecté (même si partie perdue)
    if (state.currentLevelId === 'paraguay' && option.type === 'mail') {
      get().addMiles(option.amount * 500);
    }
    
    // Patagonie: vérifier si les deux avions ont atterri pour générer de nouvelles options
    if (state.currentLevelId === 'patagonie' && newGameStatus === 'playing') {
      const updatedState = get();
      if (!updatedState.plane2IsFlying && !updatedState.isFlying) {
        // Les deux avions ont atterri - générer de nouvelles options
        const newPatOptions = generatePatagonieCargoOptions(
          updatedState.currentPoint!,
          updatedState.plane2CurrentPoint!,
          [...updatedState.visitedPoints, ...updatedState.plane2VisitedPoints]
        );
        set({
          cargoOptions: newPatOptions,
          patagonieSelectionPhase: 'plane1',
        });
      }
    }
    
    // Paraguay: vérifier si les deux avions ont atterri pour générer de nouvelles options
    if (state.currentLevelId === 'paraguay' && newGameStatus === 'playing') {
      const updatedState = get();
      if (!updatedState.plane2IsFlying && !updatedState.isFlying) {
        const newParOptions = generateParaguayCargoOptions(
          updatedState.currentPoint!,
          updatedState.plane2CurrentPoint!,
          [...updatedState.visitedPoints, ...updatedState.plane2VisitedPoints]
        );
        set({
          cargoOptions: newParOptions,
          patagonieSelectionPhase: 'plane1',
        });
      }
    }

    // CAMPAGNE : si c'est une destination flèche, changer de quadrant
    if ((state.currentLevelId === 'campagne_europe' || state.currentLevelId === 'niveau_16' || state.currentLevelId === 'corsica' || state.currentLevelId === 'sardegna' || state.currentLevelId === 'afrique_nord' || state.currentLevelId === 'retour_france') && option.type === ('arrow' as any) && newGameStatus === 'playing') {
      // Trouver la flèche correspondante
      const arrows = (state.currentLevelId === 'niveau_16' ? SCANDINAVIE_QUADRANT_ARROWS : state.currentLevelId === 'corsica' ? CORSICA_QUADRANT_ARROWS : state.currentLevelId === 'sardegna' ? SARDEGNA_QUADRANT_ARROWS : state.currentLevelId === 'afrique_nord' ? AFNORD_QUADRANT_ARROWS : state.currentLevelId === 'retour_france' ? RETOUR_FRANCE_QUADRANT_ARROWS : QUADRANT_ARROWS)[state.currentQuadrant];
      const arrowId = state.flyingDestination.id;
      const matchingArrow = arrows.find(a => 
        `arrow_${a.direction}_${a.targetQuadrant}` === arrowId
      );
      if (matchingArrow) {
        // Petit délai pour que le vol se termine visuellement, puis switch
        setTimeout(() => {
          get().switchQuadrant(matchingArrow.targetQuadrant, matchingArrow.entryPosition);
        }, 100);
      }
    }


  // Patagonie: compléter le vol de l'avion 2
  },
  completePlane2Flight: () => {
    const state = get();
    if (!state.plane2CurrentPoint || !state.plane2FlyingDestination || !state.plane2SelectedCargo) return;
    
    const option = state.plane2SelectedCargo;
    const distance = calculateDistance(state.plane2CurrentPoint, state.plane2FlyingDestination);
    const fuelCost = Math.round(distance * 40);
    
    let newMailCount = state.mailCount;
    let newP2FuelLevel = Math.max(0, state.plane2FuelLevel - fuelCost);
    let newP2Warnings = state.plane2MechanicalWarnings;
    let newP2CriticalActive = state.plane2CriticalCountdownActive;
    let newP2CriticalEnd = state.plane2CriticalCountdownEnd;
    
    const allFlights = [...state.completedFlights, ...state.plane2CompletedFlights];
    // Utiliser la direction de courbe SAUVEGARDÉE (celle du vol réel)
    // au lieu de la recalculer, pour que la courbe stockée corresponde exactement
    // à celle affichée pendant le vol
    const actualDirection = state.plane2FlightCurveDirection || findBestCurveDirection(state.plane2CurrentPoint, state.plane2FlyingDestination, allFlights, state.mapAspectRatio);
    
    const newFlight: Flight = {
      from: state.plane2CurrentPoint,
      to: state.plane2FlyingDestination,
      curveDirection: actualDirection,
    };
    
    // Apply cargo (shared mail counter for Patagonie, individual for Paraguay)
    let newMauritaniaCumul = state.mauritaniaMailCumul;
    let newPlane2Carried = state.plane2CarriedMail;
    
    if (state.currentLevelId === 'paraguay') {
      // Paraguay : gestion individuelle pour avion 2
      if (option.type === 'mail') {
        newPlane2Carried += option.amount;
      } else if (option.type === 'delivery') {
        const actualDelivered = Math.min(newPlane2Carried, option.amount);
        newPlane2Carried -= actualDelivered;
        newMauritaniaCumul += actualDelivered;
      } else if (option.type === 'fuel') {
        newP2FuelLevel = Math.min(100, newP2FuelLevel + option.amount);
      } else if (option.type === 'repair') {
        const repairAmount = option.amount || 1;
        newP2Warnings = Math.max(0, newP2Warnings - repairAmount);
        if (newP2Warnings < 4) {
          newP2CriticalActive = false;
          newP2CriticalEnd = 0;
        }
      }
    } else if (state.currentLevelId === 'sahel') {
      // SAHEL : gestion individuelle pour avion 2
      // 'mail' type = récupération au bureau de poste (géré par la distance check plus bas)
      if (option.type === 'delivery') {
        // Distribution dans le sud
        const actualDelivered = Math.min(newPlane2Carried, option.amount);
        newPlane2Carried -= actualDelivered;
        newMauritaniaCumul += actualDelivered;
      } else if (option.type === 'fuel') {
        newP2FuelLevel = Math.min(100, newP2FuelLevel + option.amount);
      } else if (option.type === 'repair') {
        const repairAmount = option.amount || 1;
        newP2Warnings = Math.max(0, newP2Warnings - repairAmount);
        if (newP2Warnings < 4) {
          newP2CriticalActive = false;
          newP2CriticalEnd = 0;
        }
      }
      // Note: 'mail' type (post office pickup) ne modifie PAS mailCount
      // Le pickup est géré par la distance check dans la section post-atterrissage
    } else {
      // Patagonie : compteur partagé
      if (option.type === 'mail') {
        newMailCount += option.amount;
      } else if (option.type === 'fuel') {
        newP2FuelLevel = Math.min(100, newP2FuelLevel + option.amount);
      } else if (option.type === 'repair') {
        const repairAmount = option.amount || 1;
        newP2Warnings = Math.max(0, newP2Warnings - repairAmount);
        if (newP2Warnings < 4) {
          newP2CriticalActive = false;
          newP2CriticalEnd = 0;
        }
      } else if (option.type === 'delivery') {
        const actualDelivered = Math.min(newPlane2Carried, option.amount);
        newPlane2Carried -= actualDelivered;
        newMauritaniaCumul += actualDelivered;
      }
    }
    
    if (newP2Warnings >= 4 && !newP2CriticalActive) {
      newP2CriticalActive = true;
      newP2CriticalEnd = Date.now() + 60000;
    }
    
    const newP2CompletedFlights = [...state.plane2CompletedFlights, newFlight];
    const newP2VisitedPoints = [...state.plane2VisitedPoints, state.plane2CurrentPoint];
    const newP2CurrentPoint = state.plane2FlyingDestination;
    
    // Check win/lose
    let newGameStatus = state.gameStatus;
    let newGameOverReason = state.gameOverReason;
    let newCrashPosition = state.crashPosition;
    
    if (state.currentLevelId === 'paraguay') {
      // Paraguay : victoire quand le cumul distribué atteint le mailTarget
      if (newMauritaniaCumul >= state.mailTarget) {
        newGameStatus = 'won';
      }
    } else if (state.currentLevelId === 'sahel') {
      // SAHEL : victoire quand avion 2 a distribué 30 courriers (mauritaniaMailCumul)
      if (newMauritaniaCumul >= state.mailTarget) {
        newGameStatus = 'won';
      }
    } else {
      if (newMailCount >= state.mailTarget) {
        newGameStatus = 'won';
      }
    }
    
    if (newP2FuelLevel <= 0 && newGameStatus !== 'won') {
      newGameStatus = 'lost';
      newGameOverReason = 'fuel';
      newCrashPosition = { x: newP2CurrentPoint.x, y: newP2CurrentPoint.y };
    }
    
    // Sauvegarder le niveau complété dans AsyncStorage si victoire
    if (newGameStatus === 'won' && !state.freeplayMode) {
      const _levelId = state.currentLevelId;
      AsyncStorage.getItem('completed_levels').then(data => {
        const completed = data ? JSON.parse(data) : [];
        if (!completed.includes(_levelId)) {
          completed.push(_levelId);
          AsyncStorage.setItem('completed_levels', JSON.stringify(completed)).catch(() => {});
          set({ newlyCompletedLevel: _levelId });
        } else {
          set({ newlyCompletedLevel: null });
        }
      }).catch(() => { set({ newlyCompletedLevel: null }); });
    }
    
    set({
      plane2CurrentPoint: newP2CurrentPoint,
      plane2VisitedPoints: newP2VisitedPoints,
      plane2CompletedFlights: newP2CompletedFlights,
      plane2FuelLevel: newP2FuelLevel,
      plane2MechanicalWarnings: newP2Warnings,
      plane2CriticalCountdownActive: newP2CriticalActive,
      plane2CriticalCountdownEnd: newP2CriticalEnd,
      plane2IsFlying: false,
      plane2FlyingProgress: 0,
      plane2FlyingDestination: null,
      plane2SelectedCargo: null,
      mailCount: newMailCount,
      mauritaniaMailCumul: newMauritaniaCumul,
      plane2CarriedMail: newPlane2Carried,
      gameStatus: newGameStatus,
      gameOverReason: newGameOverReason,
      crashPosition: newCrashPosition,
    });
    
    // PATAGONIE: 200 MILES par courrier collecté par avion 2
    if (state.currentLevelId === 'patagonie' && option.type === 'mail') {
      get().addMiles(option.amount * 200);
    }
    // PARAGUAY: 500 MILES par courrier collecté par avion 2
    if (state.currentLevelId === 'paraguay' && option.type === 'mail') {
      get().addMiles(option.amount * 500);
    }
    
    // Vérifier si les deux avions ont atterri
    if (state.currentLevelId === 'patagonie' && newGameStatus === 'playing') {
      const updatedState = get();
      if (!updatedState.isFlying && !updatedState.plane2IsFlying) {
        const newPatOptions = generatePatagonieCargoOptions(
          updatedState.currentPoint!,
          updatedState.plane2CurrentPoint!,
          [...updatedState.visitedPoints, ...updatedState.plane2VisitedPoints]
        );
        set({
          cargoOptions: newPatOptions,
          patagonieSelectionPhase: 'plane1',
        });
      }
    }
    
    // Paraguay: vérifier si les deux avions ont atterri
    if (state.currentLevelId === 'paraguay' && newGameStatus === 'playing') {
      const updatedState = get();
      if (!updatedState.isFlying && !updatedState.plane2IsFlying) {
        const newParOptions = generateParaguayCargoOptions(
          updatedState.currentPoint!,
          updatedState.plane2CurrentPoint!,
          [...updatedState.visitedPoints, ...updatedState.plane2VisitedPoints]
        );
        set({
          cargoOptions: newParOptions,
          patagonieSelectionPhase: 'plane1',
        });
      }
    }
  },
  
  // Called periodically to check if the 1-minute critical timer has expired
  checkCriticalTimeout: () => {
    const state = get();
    if (state.gameStatus !== 'playing') return;
    
    // Check plane 1 critical timeout
    if (state.criticalCountdownActive) {
      if (Date.now() >= state.criticalCountdownEnd) {
        // SAHEL : si l'objectif est atteint au moment de la panne, mission gagnée
        const isSahelWin = state.currentLevelId === 'sahel' && state.mailCount >= state.mailTarget;
        set({
          gameStatus: isSahelWin ? 'won' : 'lost',
          gameOverReason: isSahelWin ? null : 'critical_timeout',
          crashPosition: state.currentPoint ? { x: state.currentPoint.x, y: state.currentPoint.y } : null,
        });
        if (isSahelWin && !state.freeplayMode) {
          AsyncStorage.getItem('completed_levels').then(data => {
            const completed = data ? JSON.parse(data) : [];
            if (!completed.includes(state.currentLevelId)) {
              completed.push(state.currentLevelId);
              AsyncStorage.setItem('completed_levels', JSON.stringify(completed)).catch(() => {});
            }
          }).catch(() => {});
        }
        return;
      }
    }
    
    // Patagonie: check plane 2 critical timeout
    if (state.currentLevelId === 'patagonie' && state.plane2CriticalCountdownActive) {
      if (Date.now() >= state.plane2CriticalCountdownEnd) {
        set({
          gameStatus: 'lost',
          gameOverReason: 'critical_timeout',
          crashPosition: state.plane2CurrentPoint ? { x: state.plane2CurrentPoint.x, y: state.plane2CurrentPoint.y } : null,
        });
      }
    }
  },
  
  repairMechanical: () => {
    const state = get();
    const newWarnings = Math.max(0, state.mechanicalWarnings - 1);
    set({
      mechanicalWarnings: newWarnings,
      criticalCountdownActive: newWarnings >= 4 ? state.criticalCountdownActive : false,
      criticalCountdownEnd: newWarnings >= 4 ? state.criticalCountdownEnd : 0,
    });
  },
  
  endGame: (won: boolean) => {
    set({ gameStatus: won ? 'won' : 'lost' });
    // Sauvegarder le niveau complété
    if (won) {
      const state = get();
      if (!state.freeplayMode) {
        AsyncStorage.getItem('completed_levels').then(data => {
          const completed = data ? JSON.parse(data) : [];
          if (!completed.includes(state.currentLevelId)) {
            completed.push(state.currentLevelId);
            AsyncStorage.setItem('completed_levels', JSON.stringify(completed)).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  },
  
  // Mettre en pause la partie (retour au menu sans perdre l'état)
  pauseGame: () => {
    set({ gameStatus: 'idle' });
  },
  
  // Reprendre la partie en cours
  resumeGame: () => {
    const state = get();
    // Ne reprendre que si la partie a du contenu (un point courant)
    if (state.currentPoint) {
      set({ gameStatus: 'playing' });
    }
  },

  resetGame: () => {
    set({
      gameStatus: 'idle',
      currentPoint: null,
      visitedPoints: [],
      mailCount: 0,
      fuelLevel: 100,
      completedFlights: [],
      mechanicalWarnings: 0,
      criticalCountdownActive: false,
      criticalCountdownEnd: 0,
      gameOverReason: null,
      crashPosition: null,
      gameStartTime: 0,
      cargoOptions: [],
      gibraltarPhase: null,
      gibraltarMailCollected: 0,
      mauritaniaMailCumul: 0,
      mauritaniaPostOffice: null,
      turbulenceZone: null,
  turbulenceZone2: null,
      andesCol: null,
  newlyCompletedLevel: null,
      patagonieSelectionPhase: null,
      isFlying: false,
      flyingProgress: 0,
      flyingDestination: null,
      selectedCargo: null,
      flightIntersectionProgresses: [],
      triggeredFlightIntersections: [],
      plane2CurrentPoint: null,
      plane2VisitedPoints: [],
      plane2FuelLevel: 100,
      plane2CompletedFlights: [],
      plane2MechanicalWarnings: 0,
      plane2CriticalCountdownActive: false,
      plane2CriticalCountdownEnd: 0,
      plane2IsFlying: false,
      plane2FlyingProgress: 0,
      plane2FlyingDestination: null,
      plane2SelectedCargo: null,
      plane2FlightFuelCost: 0,
      plane2FlightCurveDirection: 1 as 1 | -1,
      plane2FlightIntersectionProgresses: [],
      plane2TriggeredFlightIntersections: [],
      plane2CrashPosition: null,
        plane1CarriedMail: 0,
        plane2CarriedMail: 0,
        sahelPostOfficeMail: 0,
        freeplayMode: null,
  flashMessage: null,
  tutorialMode: false,
  tutorialStep: 0,
  tutorialFlightCount: 0,
  tutorialHangarDone: false,
  isCampaignMode: false,
  currentQuadrant: 'BL' as Quadrant,
  campaignPoints: [] as CampaignPoint[],
    });
  },
  
  // ===== MILES & HANGAR =====
  loadMiles: async () => {
    // Remettre les miles à 0 entre deux sessions
    try {
      set({ totalMiles: 0 });
      await AsyncStorage.setItem('courrier_total_miles', '0');
    } catch (e) {
      console.log('Error resetting miles:', e);
    }
  },
  
  addMiles: async (amount: number) => {
    const newTotal = get().totalMiles + amount;
    set({ totalMiles: newTotal });
    try {
      await AsyncStorage.setItem('courrier_total_miles', String(newTotal));
    } catch (e) {
      console.log('Error saving miles:', e);
    }
  },
  
  hangarRefuel: () => {
    const state = get();
    if (state.totalMiles < 10000) return false;
    const newMiles = state.totalMiles - 10000;
    const newFuel = Math.min(100, state.fuelLevel + 25);
    set({ totalMiles: newMiles, fuelLevel: newFuel });
    AsyncStorage.setItem('courrier_total_miles', String(newMiles)).catch(() => {});
    return true;
  },
  
  hangarRepair: () => {
    const state = get();
    if (state.totalMiles < 10000 || state.mechanicalWarnings <= 0) return false;
    const newMiles = state.totalMiles - 10000;
    const newWarnings = state.mechanicalWarnings - 1;
    set({ 
      totalMiles: newMiles, 
      mechanicalWarnings: newWarnings,
      criticalCountdownActive: newWarnings < 4 ? false : state.criticalCountdownActive,
    });
    AsyncStorage.setItem('courrier_total_miles', String(newMiles)).catch(() => {});
    return true;
  },

  hangarRefuelPlane2: () => {
    const state = get();
    if (state.totalMiles < 10000) return false;
    const newMiles = state.totalMiles - 10000;
    const newFuel = Math.min(100, state.plane2FuelLevel + 25);
    set({ totalMiles: newMiles, plane2FuelLevel: newFuel });
    AsyncStorage.setItem('courrier_total_miles', String(newMiles)).catch(() => {});
    return true;
  },

  hangarRepairPlane2: () => {
    const state = get();
    if (state.totalMiles < 10000 || state.plane2MechanicalWarnings <= 0) return false;
    const newMiles = state.totalMiles - 10000;
    const newWarnings = state.plane2MechanicalWarnings - 1;
    set({ 
      totalMiles: newMiles, 
      plane2MechanicalWarnings: newWarnings,
      plane2CriticalCountdownActive: newWarnings < 4 ? false : state.plane2CriticalCountdownActive,
    });
    AsyncStorage.setItem('courrier_total_miles', String(newMiles)).catch(() => {});
    return true;
  },
}));

// Debug helper - expose store for testing (dev only)
if (typeof globalThis !== 'undefined' && __DEV__) {
  (globalThis as any).__gameStore = useGameStore;
}
