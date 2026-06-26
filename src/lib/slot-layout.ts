import { useSyncExternalStore } from "react";
import { SLOT_LAYOUTS, type SpreadId } from "./tarot";

// ---------------------------------------------------------------------------
// Live, persisted slot-layout store.
//
// The drawn cards must land precisely inside the gold frames painted into each
// design screenshot. Matching those by hand is iterative, so this store keeps
// per-spread slot positions (left/top, % of stage) AND the drawn-card width
// (% of stage) editable at runtime via the layout debugger, persisting the
// result to localStorage. Defaults come from SLOT_LAYOUTS so nothing changes
// until the user nudges a value.
// ---------------------------------------------------------------------------

export interface SlotPos {
  left: number;
  top: number;
}

export interface SpreadLayout {
  slots: SlotPos[];
  cardWidth: number; // percentage of the stage width
}

export type LayoutMap = Record<SpreadId, SpreadLayout>;

// Drawn-card widths that previously lived inline in DrawingStage.
const CARD_WIDTH_DEFAULT: Record<SpreadId, number> = {
  daily: 13,
  three: 11,
  either: 7.8,
};

const STORAGE_KEY = "sm-slot-layout-v1";

function parsePct(value: string) {
  return Number.parseFloat(value);
}

export const DEFAULT_LAYOUT: LayoutMap = (Object.keys(SLOT_LAYOUTS) as SpreadId[]).reduce(
  (acc, id) => {
    acc[id] = {
      slots: SLOT_LAYOUTS[id].map((slot) => ({
        left: parsePct(slot.left),
        top: parsePct(slot.top),
      })),
      cardWidth: CARD_WIDTH_DEFAULT[id],
    };
    return acc;
  },
  {} as LayoutMap,
);

function clone(map: LayoutMap): LayoutMap {
  return JSON.parse(JSON.stringify(map)) as LayoutMap;
}

function load(): LayoutMap {
  if (typeof window === "undefined") return clone(DEFAULT_LAYOUT);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_LAYOUT);
    const saved = JSON.parse(raw) as Partial<LayoutMap>;
    const merged = clone(DEFAULT_LAYOUT);
    for (const id of Object.keys(merged) as SpreadId[]) {
      const entry = saved[id];
      if (!entry) continue;
      if (typeof entry.cardWidth === "number") merged[id].cardWidth = entry.cardWidth;
      if (Array.isArray(entry.slots)) {
        entry.slots.forEach((slot, index) => {
          if (merged[id].slots[index] && slot && typeof slot.left === "number" && typeof slot.top === "number") {
            merged[id].slots[index] = { left: slot.left, top: slot.top };
          }
        });
      }
    }
    return merged;
  } catch {
    return clone(DEFAULT_LAYOUT);
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

export function getLayout() {
  return current;
}

export function subscribeLayout(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function updateSlot(id: SpreadId, index: number, patch: Partial<SlotPos>) {
  current = clone(current);
  current[id].slots[index] = { ...current[id].slots[index], ...patch };
  persist();
  emit();
}

export function updateCardWidth(id: SpreadId, width: number) {
  current = clone(current);
  current[id].cardWidth = width;
  persist();
  emit();
}

export function resetLayout(id?: SpreadId) {
  if (id) {
    current = clone(current);
    current[id] = clone(DEFAULT_LAYOUT)[id];
  } else {
    current = clone(DEFAULT_LAYOUT);
  }
  persist();
  emit();
}

export function useSlotLayout() {
  return useSyncExternalStore(
    subscribeLayout,
    getLayout,
    () => DEFAULT_LAYOUT,
  );
}
