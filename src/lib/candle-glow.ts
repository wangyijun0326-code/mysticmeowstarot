import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Live, persisted candle-glow positions.
//
// The flickering golden halo must sit exactly on the painted candle flame in
// each background screenshot. Matching that by hand is iterative, so this store
// keeps per-state flame positions (x/y, % of stage) editable at runtime via the
// candle calibration tool, persisting the result to localStorage. Defaults stay
// in DEFAULT_GLOW so nothing changes until the user nudges a value.
// ---------------------------------------------------------------------------

export type GlowState =
  | "MENU"
  | "SPREAD_SELECTION"
  | "SHUFFLE"
  | "DRAWING"
  | "REVERSAL"
  | "END";

export interface GlowSpot {
  x: number; // % of stage width
  y: number; // % of stage height
}

export type GlowMap = Record<GlowState, GlowSpot[]>;

// [x%, y%] of the candle flame within each background screenshot.
export const DEFAULT_GLOW: GlowMap = {
  MENU: [{ x: 12, y: 36 }],
  SPREAD_SELECTION: [{ x: 6, y: 13 }],
  SHUFFLE: [{ x: 90, y: 24 }],
  DRAWING: [{ x: 7, y: 15 }],
  REVERSAL: [{ x: 7, y: 15 }],
  END: [{ x: 7, y: 15 }],
};

const STORAGE_KEY = "sm-candle-glow-v1";

function clone(map: GlowMap): GlowMap {
  return JSON.parse(JSON.stringify(map)) as GlowMap;
}

function load(): GlowMap {
  if (typeof window === "undefined") return clone(DEFAULT_GLOW);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_GLOW);
    const saved = JSON.parse(raw) as Partial<GlowMap>;
    const merged = clone(DEFAULT_GLOW);
    for (const id of Object.keys(merged) as GlowState[]) {
      const entry = saved[id];
      if (Array.isArray(entry)) {
        entry.forEach((spot, index) => {
          if (
            merged[id][index] &&
            spot &&
            typeof spot.x === "number" &&
            typeof spot.y === "number"
          ) {
            merged[id][index] = { x: spot.x, y: spot.y };
          }
        });
      }
    }
    return merged;
  } catch {
    return clone(DEFAULT_GLOW);
  }
}

let current = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

export function getGlow() {
  return current;
}

export function subscribeGlow(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function updateGlow(id: GlowState, index: number, patch: Partial<GlowSpot>) {
  current = clone(current);
  current[id][index] = { ...current[id][index], ...patch };
  persist();
  emit();
}

export function resetGlow(id?: GlowState) {
  if (id) {
    current = clone(current);
    current[id] = clone(DEFAULT_GLOW)[id];
  } else {
    current = clone(DEFAULT_GLOW);
  }
  persist();
  emit();
}

export function useGlow() {
  return useSyncExternalStore(subscribeGlow, getGlow, () => DEFAULT_GLOW);
}
