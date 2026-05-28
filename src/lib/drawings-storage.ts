// Persiste anotações (DrawingMap) no localStorage por song ID
// Estrutura: drawings:<songId> = JSON de Stroke[]

type Point = { x: number; y: number };
type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
type DrawingMap = Record<string, Stroke[]>;

const PREFIX = "drawings:";

export function loadDrawings(songIds: string[]): DrawingMap {
  if (typeof window === "undefined") return {};
  const map: DrawingMap = {};
  for (const id of songIds) {
    try {
      const raw = window.localStorage.getItem(PREFIX + id);
      if (raw) {
        const parsed = JSON.parse(raw) as Stroke[];
        if (Array.isArray(parsed)) map[id] = parsed;
      }
    } catch {
      // ignora entradas corrompidas
    }
  }
  return map;
}

export function saveDrawing(songId: string, strokes: Stroke[]) {
  if (typeof window === "undefined") return;
  try {
    if (strokes.length === 0) {
      window.localStorage.removeItem(PREFIX + songId);
    } else {
      window.localStorage.setItem(PREFIX + songId, JSON.stringify(strokes));
    }
  } catch {
    // ignora erro de quota
  }
}

export function clearDrawing(songId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PREFIX + songId);
}
