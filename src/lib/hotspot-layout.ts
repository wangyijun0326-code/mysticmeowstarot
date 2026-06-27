import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Live, persisted hotspot-layout store.
//
// Transparent click areas (Hotspot components) are placed over painted buttons
// in the design screenshots. Their exact position has to be tuned by hand, so
// this store keeps per-screen hotspot rectangles editable at runtime and
// persists the result to localStorage. Defaults match the current source values
// so nothing changes until the user nudges a value.
// ---------------------------------------------------------------------------

export type ScreenId = "menu" | "spreads" | "shuffle";

export interface HotspotRect {
  id: string;
  label: string;
  left: number; // percentage of stage width
  top: number; // percentage of stage height
  width: number; // percentage of stage width
  height: number; // percentage of stage height
  rotate?: number; // degrees
}

export interface ScreenHotspots {
  hotspots: HotspotRect[];
}

export type HotspotMap = Record<ScreenId, ScreenHotspots>;

const DEFAULTS: HotspotMap = {
  menu: {
    hotspots: [
      { id: "start", label: "开始占卜", left: 77, top: 65.4, width: 11, height: 19.5 },
      { id: "guide", label: "使用指南", left: 89.2, top: 65.4, width: 11, height: 19.5 },
    ],
  },
  spreads: {
    hotspots: [
      { id: "daily", label: "DAILY DRAW", left: 23.3, top: 56.5, width: 24.5, height: 47, rotate: 0 },
      { id: "three", label: "THREE CARDS", left: 49.4, top: 56.5, width: 24.5, height: 47, rotate: 0 },
      { id: "either", label: "EITHER OR", left: 76.3, top: 56.5, width: 24.5, height: 47, rotate: 0 },
    ],
  },
  shuffle: {
    hotspots: [
      { id: "done", label: "完成洗牌", left: 50, top: 92, width: 14, height: 7 },
    ],
  },
};

const STORAGE_KEY = "sm-hotspot-layout-v1";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function load(): HotspotMap {
  if (typeof window === "undefined") return clone(DEFAULTS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULTS);
    const saved = JSON.parse(raw) as Partial<HotspotMap>;
    const merged = clone(DEFAULTS);
    for (const screenId of Object.keys(merged) as ScreenId[]) {
      const screen = saved[screenId];
      if (!screen || !Array.isArray(screen.hotspots)) continue;
      for (const hotspot of screen.hotspots) {
        const target = merged[screenId].hotspots.find((h) => h.id === hotspot.id);
        if (!target) continue;
        if (typeof hotspot.left === "number") target.left = hotspot.left;
        if (typeof hotspot.top === "number") target.top = hotspot.top;
        if (typeof hotspot.width === "number") target.width = hotspot.width;
        if (typeof hotspot.height === "number") target.height = hotspot.height;
        if (typeof hotspot.rotate === "number") target.rotate = hotspot.rotate;
      }
    }
    return merged;
  } catch {
    return clone(DEFAULTS);
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

export function getHotspotLayout() {
  return current;
}

export function subscribeHotspotLayout(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function updateHotspot(
  screenId: ScreenId,
  id: string,
  patch: Partial<Omit<HotspotRect, "id" | "label">>,
) {
  current = clone(current);
  const hotspot = current[screenId].hotspots.find((h) => h.id === id);
  if (!hotspot) return;
  Object.assign(hotspot, patch);
  persist();
  emit();
}

export function resetHotspotLayout(screenId?: ScreenId) {
  if (screenId) {
    current = clone(current);
    current[screenId] = clone(DEFAULTS)[screenId];
  } else {
    current = clone(DEFAULTS);
  }
  persist();
  emit();
}

export function useHotspotLayout() {
  return useSyncExternalStore(subscribeHotspotLayout, getHotspotLayout, () => DEFAULTS);
}
