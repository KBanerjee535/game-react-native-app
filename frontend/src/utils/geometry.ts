// geometry.ts - Robust geometric intersection utilities for flight path detection
// Extracted from gameStore.ts for clarity and maintainability

import { MapPoint, Flight } from '../store/gameStore';

// ─── Line Segment Intersection ──────────────────────────────────────────────

/**
 * Check if two line segments intersect.
 * Returns the parameter `ua` (0-1 along first segment) if they intersect, or -1 if not.
 * Uses a very small epsilon to avoid false positives at shared endpoints.
 */
export const doLinesIntersectWithParam = (
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): number => {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-10) return -1; // parallel or coincident

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  // Very tight epsilon: only exclude the very tip of endpoints
  const eps = 0.003;
  if (ua > eps && ua < (1 - eps) && ub > eps && ub < (1 - eps)) {
    return ua;
  }
  return -1;
};

export const doLinesIntersect = (
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean => {
  return doLinesIntersectWithParam(x1, y1, x2, y2, x3, y3, x4, y4) >= 0;
};

// ─── Quadratic Bezier Sampling ──────────────────────────────────────────────

/**
 * Sample points along a quadratic Bezier curve.
 * Uses an adaptive number of samples based on the curve's chord length.
 */
export const sampleCurvePoints = (
  x1: number, y1: number,
  ctrlX: number, ctrlY: number,
  x2: number, y2: number,
  numSamples?: number
): Array<{ x: number; y: number }> => {
  // If no explicit count, compute adaptive sample count based on chord length
  if (numSamples === undefined) {
    const chordLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    // More samples for longer curves: minimum 32, scale up to 80
    numSamples = Math.max(32, Math.min(80, Math.round(chordLen * 200)));
  }
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const mt = 1 - t;
    const x = mt * mt * x1 + 2 * mt * t * ctrlX + t * t * x2;
    const y = mt * mt * y1 + 2 * mt * t * ctrlY + t * t * y2;
    points.push({ x, y });
  }
  return points;
};

// ─── Control Point Helper ───────────────────────────────────────────────────

/**
 * Compute the Bézier control point for a flight path curve.
 * Uses aspect ratio correction to match the pixel-space curve shape.
 * Without correction, the perpendicular offset direction differs between
 * normalized (square) and pixel (rectangular) spaces, causing ghost intersections.
 * @param aspectRatio - map height / width ratio (e.g., 1.38 for iPhone)
 */
export const getControlPoint = (
  from: MapPoint,
  to: MapPoint,
  direction: number,
  aspectRatio: number = 1
): { ctrlX: number; ctrlY: number } => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Scale dx/dy to pixel-equivalent space for correct perpendicular direction
  const dxScaled = dx;
  const dyScaled = dy * aspectRatio;
  const lenScaled = Math.sqrt(dxScaled * dxScaled + dyScaled * dyScaled);
  if (lenScaled === 0) return { ctrlX: midX, ctrlY: midY };
  // Perpendicular in pixel-equivalent space: (-dyScaled, dxScaled)
  // Convert back to normalized space: perpX = -dyScaled, perpY = dxScaled / aspectRatio
  // But we need the offset magnitude in normalized space too
  const offset = lenScaled * 0.15;
  return {
    ctrlX: midX + (-dyScaled / lenScaled) * offset * direction,
    ctrlY: midY + (dxScaled / lenScaled) * offset * direction / aspectRatio,
  };
};

// ─── Curve-to-Curve Intersection ────────────────────────────────────────────

/**
 * Count how many existing flights the new flight path crosses.
 * Uses segment-by-segment intersection with adaptive sampling.
 */
export const countCurveIntersections = (
  from: MapPoint,
  to: MapPoint,
  direction: number,
  completedFlights: Flight[],
  aspectRatio: number = 1
): number => {
  const { ctrlX, ctrlY } = getControlPoint(from, to, direction, aspectRatio);
  const newCurvePoints = sampleCurvePoints(from.x, from.y, ctrlX, ctrlY, to.x, to.y);

  // Helper: check if two points are the same (shared endpoint)
  const isSamePoint = (a: MapPoint, b: MapPoint) => {
    const threshold = 0.015;
    return Math.abs(a.x - b.x) < threshold && Math.abs(a.y - b.y) < threshold;
  };

  let count = 0;

  for (const flight of completedFlights) {
    // Skip flights that share an endpoint with the new flight
    if (isSamePoint(flight.from, from) || isSamePoint(flight.to, from) ||
        isSamePoint(flight.from, to) || isSamePoint(flight.to, to)) {
      continue;
    }
    
    const flightDir = flight.curveDirection || 1;
    const { ctrlX: fCtrlX, ctrlY: fCtrlY } = getControlPoint(flight.from, flight.to, flightDir, aspectRatio);
    const flightPoints = sampleCurvePoints(
      flight.from.x, flight.from.y,
      fCtrlX, fCtrlY,
      flight.to.x, flight.to.y
    );

    let flightIntersects = false;
    const numSeg = newCurvePoints.length - 1;
    for (let i = 0; i < numSeg && !flightIntersects; i++) {
      // Ignorer les intersections très proches des extrémités
      const segProgress = i / numSeg;
      if (segProgress < 0.03 || segProgress > 0.97) continue;
      
      for (let j = 0; j < flightPoints.length - 1 && !flightIntersects; j++) {
        // Ignorer les segments très proches des extrémités du vol existant
        const existingProgress = j / (flightPoints.length - 1);
        if (existingProgress < 0.03 || existingProgress > 0.97) continue;
        
        if (doLinesIntersect(
          newCurvePoints[i].x, newCurvePoints[i].y,
          newCurvePoints[i + 1].x, newCurvePoints[i + 1].y,
          flightPoints[j].x, flightPoints[j].y,
          flightPoints[j + 1].x, flightPoints[j + 1].y
        )) {
          flightIntersects = true;
        }
      }
    }

    if (flightIntersects) count++;
  }

  return count;
};

/**
 * Get progress values (0-1) at which the new flight path intersects each existing flight.
 * Returns one progress value per crossed flight, sorted ascending.
 */
export const getIntersectionProgresses = (
  from: MapPoint,
  to: MapPoint,
  direction: number,
  completedFlights: Flight[],
  aspectRatio: number = 1
): number[] => {
  const { ctrlX, ctrlY } = getControlPoint(from, to, direction, aspectRatio);
  const newCurvePoints = sampleCurvePoints(from.x, from.y, ctrlX, ctrlY, to.x, to.y);
  const numSamples = newCurvePoints.length - 1;

  const progresses: number[] = [];
  
  // Helper: check if two points are the same (shared endpoint)
  const isSamePoint = (a: MapPoint, b: MapPoint) => {
    const threshold = 0.015; // ~1.5% of normalized space (aligned with countCurveIntersections)
    return Math.abs(a.x - b.x) < threshold && Math.abs(a.y - b.y) < threshold;
  };

  for (const flight of completedFlights) {
    // Skip flights that share an endpoint with the new flight
    // These are connected flights, not true crossings
    if (isSamePoint(flight.from, from) || isSamePoint(flight.to, from) ||
        isSamePoint(flight.from, to) || isSamePoint(flight.to, to)) {
      console.log(`[INTERSECT] SKIP flight (shared endpoint): from=(${flight.from.x.toFixed(2)},${flight.from.y.toFixed(2)}) to=(${flight.to.x.toFixed(2)},${flight.to.y.toFixed(2)})`);
      continue;
    }
    
    const flightDir = flight.curveDirection || 1;
    const { ctrlX: fCtrlX, ctrlY: fCtrlY } = getControlPoint(flight.from, flight.to, flightDir, aspectRatio);
    const flightPoints = sampleCurvePoints(
      flight.from.x, flight.from.y,
      fCtrlX, fCtrlY,
      flight.to.x, flight.to.y
    );

    // Find the first intersection with this flight (zone large pour ne rien manquer)
    let found = false;
    for (let i = 0; i < newCurvePoints.length - 1 && !found; i++) {
      // Ignorer les segments très proches des extrémités de la nouvelle courbe
      const segProgress = i / numSamples;
      if (segProgress < 0.03 || segProgress > 0.97) continue;
      
      for (let j = 0; j < flightPoints.length - 1 && !found; j++) {
        // Ignorer aussi les segments très proches des extrémités du vol existant
        const existingProgress = j / (flightPoints.length - 1);
        if (existingProgress < 0.03 || existingProgress > 0.97) continue;
        
        const ua = doLinesIntersectWithParam(
          newCurvePoints[i].x, newCurvePoints[i].y,
          newCurvePoints[i + 1].x, newCurvePoints[i + 1].y,
          flightPoints[j].x, flightPoints[j].y,
          flightPoints[j + 1].x, flightPoints[j + 1].y
        );
        if (ua >= 0) {
          // Progress along the entire curve
          const progress = (i + ua) / numSamples;
          console.log(`[INTERSECT] FOUND crossing with flight from=(${flight.from.x.toFixed(2)},${flight.from.y.toFixed(2)}) to=(${flight.to.x.toFixed(2)},${flight.to.y.toFixed(2)}) at progress=${progress.toFixed(3)}, segI=${i}/${numSamples}, segJ=${j}/${flightPoints.length-1}`);
          progresses.push(progress);
          found = true;
        }
      }
    }
  }

  progresses.sort((a, b) => a - b);
  
  // Filtrer les intersections très proches des extrémités de la courbe (< 3% ou > 97%)
  const filtered = progresses.filter(p => p > 0.03 && p < 0.97);
  
  // Dédupliquer les intersections numériquement identiques (< 1% de progression)
  // Seuil très faible pour ne pas fusionner deux croisements de tracés distincts
  const deduped: number[] = [];
  for (const p of filtered) {
    if (deduped.length === 0 || p - deduped[deduped.length - 1] > 0.01) {
      deduped.push(p);
    }
  }
  console.log(`[INTERSECT] NEW FLIGHT from=(${from.x.toFixed(2)},${from.y.toFixed(2)}) to=(${to.x.toFixed(2)},${to.y.toFixed(2)}) vs ${completedFlights.length} existing flights → ${deduped.length} intersections: [${deduped.map(p => p.toFixed(3)).join(', ')}]`);
  return deduped;
};

/**
 * Find the best curve direction (1 or -1) that minimizes intersections with existing flights.
 */
export const findBestCurveDirection = (
  from: MapPoint,
  to: MapPoint,
  completedFlights: Flight[],
  aspectRatio: number = 1
): number => {
  const int1 = countCurveIntersections(from, to, 1, completedFlights, aspectRatio);
  const int2 = countCurveIntersections(from, to, -1, completedFlights, aspectRatio);
  return int2 < int1 ? -1 : 1;
};
