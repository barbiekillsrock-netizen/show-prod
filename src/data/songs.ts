import { useSyncExternalStore } from "react";
import { savePdf, deletePdf } from "@/lib/pdf-storage";

export const VALID_KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm",
];

export const GENRES = [
  "Rock", "Pop", "Sertanejo", "Pagode", "Samba", "MPB", "Forró", "Gospel",
  "Blues", "Jazz", "Soul/Funk", "R&B", "Hip-Hop", "Eletrônico", "Reggae",
  "Clássico", "Bossa Nova", "Axé", "Funk", "Metal", "Outro",
];

export function normalizeKey(raw: string): string {
  const trimmed = raw.trim();
  // case-insensitive match
  const found = VALID_KEYS.find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  return found ?? trimmed;
}

export function isValidKey(raw: string): boolean {
  if (!raw.trim()) return true; // empty = optional, no error
  return VALID_KEYS.some(
    (k) => k.toLowerCase() === raw.trim().toLowerCase()
  );
}

export type Song = {
  id: string;
  title: string;
  artist: string;
  key: string;
  genre?: string;
  hasPdf?: boolean;
  pdfName?: string;
};

const STORAGE_KEY = "songs:v1";

const defaultSongs: Song[] = [
  { id: "1", title: "Wish You Were Here", artist: "Pink Floyd", key: "G" },
  { id: "2", title: "Tempo Perdido", artist: "Legião Urbana", key: "D" },
  { id: "3", title: "Garota de Ipanema", artist: "Tom Jobim", key: "F" },
  { id: "4", title: "Black", artist: "Pearl Jam", key: "E" },
  { id: "5", title: "Sozinho", artist: "Caetano Veloso", key: "Am" },
  { id: "6", title: "Wonderwall", artist: "Oasis", key: "F#m" },
  { id: "7", title: "Hotel California", artist: "Eagles", key: "Bm" },
  { id: "8", title: "Hey Jude", artist: "The Beatles", key: "F" },
  { id: "9", title: "Trem-Bala", artist: "Ana Vilela", key: "C" },
  { id: "10", title: "Creep", artist: "Radiohead", key: "G" },
  { id: "11", title: "Eduardo e Mônica", artist: "Legião Urbana", key: "G#" },
  { id: "12", title: "Sunday Bloody Sunday", artist: "U2", key: "D" },
];

function load(): Song[] {
  if (typeof window === "undefined") return defaultSongs;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSongs;
    const parsed = JSON.parse(raw) as Song[];
    if (!Array.isArray(parsed)) return defaultSongs;
    return parsed;
  } catch {
    return defaultSongs;
  }
}

function persist(songs: Song[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch {
    // ignore quota
  }
}

let hydrated = false;
function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
}

let state: Song[] = defaultSongs;
if (typeof window !== "undefined") {
  state = load();
  hydrated = true;
}
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const songsStore = {
  get: () => state,
  subscribe(l: () => void) {
    ensureHydrated();
    if (hydrated) l();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async add(
    song: Omit<Song, "id" | "hasPdf">,
    pdfFile?: File | null,
  ): Promise<Song> {
    ensureHydrated();
    const id = makeId();
    const entry: Song = {
      id,
      title: song.title,
      artist: song.artist,
      key: normalizeKey(song.key),
      genre: song.genre,
      pdfName: pdfFile?.name,
      hasPdf: false,
    };
    if (pdfFile) {
      try {
        await savePdf(id, pdfFile);
        entry.hasPdf = true;
      } catch {
        entry.hasPdf = false;
      }
    }
    state = [entry, ...state];
    persist(state);
    emit();
    return entry;
  },
  async remove(id: string) {
    ensureHydrated();
    state = state.filter((s) => s.id !== id);
    persist(state);
    emit();
    await deletePdf(id).catch(() => {});
  },
  async update(
    id: string,
    patch: Partial<Omit<Song, "id" | "hasPdf">>,
    pdfFile?: File | null,
  ): Promise<void> {
    ensureHydrated();
    const existing = state.find((s) => s.id === id);
    if (!existing) return;
    const updated: Song = {
      ...existing,
      ...patch,
      key: patch.key !== undefined ? normalizeKey(patch.key) : existing.key,
    };
    if (pdfFile) {
      try {
        await savePdf(id, pdfFile);
        updated.hasPdf = true;
        updated.pdfName = pdfFile.name;
      } catch {
        // keep existing
      }
    }
    state = state.map((s) => (s.id === id ? updated : s));
    persist(state);
    emit();
  },
};

export function useSongs(): Song[] {
  return useSyncExternalStore(
    songsStore.subscribe,
    songsStore.get,
    () => defaultSongs,
  );
}

export const songs = defaultSongs;
