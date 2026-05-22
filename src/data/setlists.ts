import { useSyncExternalStore } from "react";

export type Setlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
};

const STORAGE_KEY = "setlists:v1";

const defaultSetlists: Setlist[] = [
  {
    id: "default-1",
    name: "Show de Sábado — Corporativo",
    songIds: ["1", "4", "7"],
    createdAt: Date.now(),
  },
];

function load(): Setlist[] {
  if (typeof window === "undefined") return defaultSetlists;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSetlists;
    const parsed = JSON.parse(raw) as Setlist[];
    if (!Array.isArray(parsed)) return defaultSetlists;
    return parsed;
  } catch {
    return defaultSetlists;
  }
}

function persist(items: Setlist[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

let state: Setlist[] = defaultSetlists;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const setlistsStore = {
  get: () => state,
  subscribe(l: () => void) {
    ensureHydrated();
    if (hydrated) l();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  create(name: string): Setlist {
    ensureHydrated();
    const item: Setlist = {
      id: makeId(),
      name: name.trim() || "Novo setlist",
      songIds: [],
      createdAt: Date.now(),
    };
    state = [item, ...state];
    persist(state);
    emit();
    return item;
  },
  rename(id: string, name: string) {
    ensureHydrated();
    state = state.map((s) => (s.id === id ? { ...s, name } : s));
    persist(state);
    emit();
  },
  remove(id: string) {
    ensureHydrated();
    state = state.filter((s) => s.id !== id);
    persist(state);
    emit();
  },
  setSongs(id: string, songIds: string[]) {
    ensureHydrated();
    state = state.map((s) => (s.id === id ? { ...s, songIds } : s));
    persist(state);
    emit();
  },
};

export function useSetlists(): Setlist[] {
  return useSyncExternalStore(
    setlistsStore.subscribe,
    setlistsStore.get,
    () => defaultSetlists,
  );
}
