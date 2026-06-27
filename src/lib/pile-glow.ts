import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Live, persisted "shuffle complete" gold-glow settings.
//
// When a shuffle finishes, a warm radial flare blooms over the card pile. Its
// exact placement, size and brightness are easier to dial in by eye than to
// guess, so this store keeps the values editable at runtime via the pile-glow
// calibration tool and persists them to localStorage. Defaults live in
// DEFAULT_PILE_GLOW so nothing changes until the user nudges a value.
// ---------------------------------------------------------------------------

export interface PileGlowConfig {
  x: number; // center X, % of stage width
  y: number; // center Y, % of stage height
  size: number; // diameter, % of stage width
  intensity: number; // peak opacity / colour depth, 0..1
}

export const DEFAULT_PILE_GLOW: PileGlowConfig = {
  x: 50,
  y: 50,
  size: 22,
  intensity: 0.75,
};

const STORAGE_KEY = "sm-pile-glow-v1";

function clone(cfg: PileGlowConfig): PileGlowConfig {
  return { ...cfg };
}

function load(): PileGlowConfig {
  if (typeof window === "undefined") return clone(DEFAULT_PILE_GLOW);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_PILE_GLOW);
    const saved = JSON.parse(raw) as Partial<PileGlowConfig>;
    const merged = clone(DEFAULT_PILE_GLOW);
    for (const key of Object.keys(merged) as (keyof PileGlowConfig)[]) {
      if (typeof saved[key] === "number") merged[key] = saved[key] as number;
    }
    return merged;
  } catch {
    return clone(DEFAULT_PILE_GLOW);
  }
}

let current = load();
// Transient (not persisted): forces the glow to render so it can be positioned
// while the calibration panel is open.
let preview = false;
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

export function getPileGlow() {
  return current;
}

export function subscribePileGlow(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function updatePileGlow(patch: Partial<PileGlowConfig>) {
  current = { ...current, ...patch };
  persist();
  emit();
}

export function resetPileGlow() {
  current = clone(DEFAULT_PILE_GLOW);
  persist();
  emit();
}

export function getPileGlowPreview() {
  return preview;
}

export function setPileGlowPreview(next: boolean) {
  preview = next;
  emit();
}

export function usePileGlow() {
  return useSyncExternalStore(subscribePileGlow, getPileGlow, () => DEFAULT_PILE_GLOW);
}

export function usePileGlowPreview() {
  return useSyncExternalStore(subscribePileGlow, getPileGlowPreview, () => false);
}
