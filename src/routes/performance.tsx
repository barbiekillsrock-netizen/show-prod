import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X, Pen, Eraser, Trash2, Palette } from "lucide-react";
import { useSongs, type Song } from "@/data/songs";
import { getSongPdfUrl } from "@/lib/song-pdf";
import PdfView from "@/components/PdfView";




type Point = { x: number; y: number };
type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
type DrawingMap = Record<string, Stroke[]>;
const DEFAULT_PDF_DIMS = { w: 595.28, h: 841.89 };

export const Route = createFileRoute("/performance")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : "",
    name: typeof search.name === "string" ? search.name : "Show",
    from: typeof search.from === "string" ? search.from : "",
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const { ids, name, from } = useSearch({ from: "/performance" });
  const exitTo = from === "songs" ? "/" : "/setlists";
  const navigate = useNavigate();

  const allSongs = useSongs();
  const setlist: Song[] = useMemo(() => {
    const idList: string[] = ids.split(",").filter(Boolean);
    return idList
      .map((id: string) => allSongs.find((s: Song) => s.id === id))
      .filter((s): s is Song => Boolean(s));
  }, [ids, allSongs]);

  const [mounted, setMounted] = useState(false);
  const [showHint, setShowHint] = useState(true);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const [activeIdx, setActiveIdx] = useState(0);
  const activeSong = setlist[activeIdx];

  const [tool, setTool] = useState<"pen" | "eraser" | null>(null);
  const [color, setColor] = useState<string>("#00E5FF");
  const [drawings, setDrawings] = useState<DrawingMap>({});

  // Container for PDF + canvas overlay
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [pdfDims, setPdfDims] = useState<{ w: number; h: number } | null>(DEFAULT_PDF_DIMS);

  const handlePdfLoadSuccess = useCallback((d: { w: number; h: number }) => {
    setPdfDims((prev) => (
      prev && Math.abs(prev.w - d.w) < 0.5 && Math.abs(prev.h - d.h) < 0.5
        ? prev
        : d
    ));
  }, []);

  // Touch swipe state
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Redirect to setlists only when the URL has no ids at all (don't bounce
  // while the songs store hydrates from localStorage).
  useEffect(() => {
    if (!ids) navigate({ to: exitTo });
  }, [ids, navigate]);

  // Stage size
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const update = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resolve PDF URL (async — backed by IndexedDB or generated demo).
  // Keep previous URL while loading the next one to avoid a black flash.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMissing, setPdfMissing] = useState(false);
  const activeSongId = activeSong?.id;
  useEffect(() => {
    if (!mounted || !activeSong) return;
    let cancelled = false;
    setPdfMissing(false);
    getSongPdfUrl(activeSong)
      .then((url) => {
        if (!cancelled) setPdfUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[performance] PDF load error", err);
        setPdfUrl(null);
        setPdfMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, activeSongId]);

  // Compute PDF render size (object-contain)
  const fitSize = useMemo(() => {
    if (!pdfDims || !stageSize.width || !stageSize.height) return null;
    const sRatio = stageSize.width / stageSize.height;
    const pRatio = pdfDims.w / pdfDims.h;
    if (pRatio > sRatio) {
      return { width: stageSize.width, height: stageSize.width / pRatio };
    }
    return { width: stageSize.height * pRatio, height: stageSize.height };
  }, [pdfDims, stageSize]);

  // Redraw canvas whenever active song or size changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fitSize) return;
    canvas.width = fitSize.width;
    canvas.height = fitSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const strokes = activeSong ? drawings[activeSong.id] || [] : [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      const first = stroke.points[0];
      ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      }
      ctx.stroke();
    }
  }, [activeSong, drawings, fitSize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Navigation
  const goPrev = useCallback(() => {
    setActiveIdx((i) => (i > 0 ? i - 1 : i));
  }, []);
  const goNext = useCallback(() => {
    setActiveIdx((i) => (i < setlist.length - 1 ? i + 1 : i));
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") navigate({ to: exitTo });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, navigate, exitTo]);

  // ---------- Drawing handlers ----------
  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function eraseAt(point: Point) {
    if (!activeSong) return;
    const radius = 0.025; // normalized
    setDrawings((prev) => {
      const strokes = prev[activeSong.id] || [];
      const next = strokes.filter((s) =>
        s.points.every(
          (p) =>
            Math.hypot(p.x - point.x, p.y - point.y) > radius,
        ),
      );
      if (next.length === strokes.length) return prev;
      return { ...prev, [activeSong.id]: next };
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeSong) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;

    if (tool === "eraser") {
      eraseAt(pt);
      return;
    }
    const stroke: Stroke = { tool: "pen", color, width: 3, points: [pt] };
    currentStrokeRef.current = stroke;
    setDrawings((prev) => ({
      ...prev,
      [activeSong.id]: [...(prev[activeSong.id] || []), stroke],
    }));
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !activeSong) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;

    if (tool === "eraser") {
      eraseAt(pt);
      return;
    }

    // Append to current stroke (mutate ref, then trigger redraw via state copy)
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    stroke.points.push(pt);

    // Incremental draw (low-latency) without full state update each move
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const n = stroke.points.length;
      if (n >= 2) {
        const a = stroke.points[n - 2];
        const b = stroke.points[n - 1];
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.stroke();
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    currentStrokeRef.current = null;
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Commit final stroke state (already in drawings)
  }

  // Clear current song drawings
  function clearStrokes() {
    if (!activeSong) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawings((prev) => ({ ...prev, [activeSong.id]: [] }));
  }

  // ---------- Touch swipe (on side zones only) ----------
  function onSwipeStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onSwipeEnd(e: React.TouchEvent, fallback: () => void) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) {
      fallback();
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      if (dx < 0) goNext();
      else goPrev();
    } else {
      fallback();
    }
  }

  if (!activeSong) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground select-none">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 pointer-events-none">
        <button
          type="button"
          onClick={() => navigate({ to: exitTo })}
          className="pointer-events-auto inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-card/70 backdrop-blur border border-border text-foreground hover:bg-card"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Sair</span>
        </button>

        <div className="pointer-events-auto px-4 py-2 rounded-lg bg-card/70 backdrop-blur border border-border text-center">
          <p className="text-xs text-muted-foreground leading-none">{name}</p>
          <p className="text-base font-semibold leading-tight mt-1">
            {activeSong.title}{" "}
            <span className="text-muted-foreground font-normal">— {activeSong.artist}</span>{" "}
            <span className="ml-2 inline-flex items-center justify-center min-w-[36px] h-6 px-2 rounded bg-primary text-primary-foreground text-xs font-bold align-middle">
              {activeSong.key}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeIdx + 1} / {setlist.length}
          </p>
          {setlist.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {setlist.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-label={`Ir para música ${i + 1}: ${s.title}`}
                  title={`${i + 1}. ${s.title}`}
                  className={`h-2 rounded-full transition-all ${
                    i === activeIdx
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted hover:bg-muted-foreground/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Tool: Pen */}
          <button
            type="button"
            onClick={() => setTool((t) => (t === "pen" ? null : "pen"))}
            className={`inline-flex items-center justify-center h-11 w-11 rounded-lg border backdrop-blur transition-colors ${
              tool === "pen"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/70 border-border text-foreground hover:bg-card"
            }`}
            aria-label="Caneta"
            title="Caneta"
          >
            <Pen className="h-5 w-5" />
          </button>

          {/* Color toggle - only when a tool is active */}
          {tool !== null && (
            <button
              type="button"
              onClick={() => setColor((c) => (c === "#00E5FF" ? "#FF0055" : "#00E5FF"))}
              className="inline-flex items-center justify-center h-11 w-11 rounded-lg border border-border bg-card/70 backdrop-blur hover:bg-card relative"
              aria-label="Trocar cor da caneta"
              title="Trocar cor"
            >
              <Palette className="h-5 w-5 text-foreground" />
              <span
                className="absolute bottom-1 right-1 h-3 w-3 rounded-full border border-background"
                style={{ backgroundColor: color }}
              />
            </button>
          )}

          {/* Tool: Eraser */}
          <button
            type="button"
            onClick={() => setTool((t) => (t === "eraser" ? null : "eraser"))}
            className={`inline-flex items-center justify-center h-11 w-11 rounded-lg border backdrop-blur transition-colors ${
              tool === "eraser"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/70 border-border text-foreground hover:bg-card"
            }`}
            aria-label="Borracha"
            title="Borracha"
          >
            <Eraser className="h-5 w-5" />
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={clearStrokes}
            className="inline-flex items-center gap-2 h-11 px-3 rounded-lg border border-border bg-card/70 backdrop-blur text-foreground hover:bg-destructive/20 hover:text-destructive hover:border-destructive/40"
            title="Limpar Traços"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">Limpar Traços</span>
          </button>

          {/* Save - only when a tool is active */}
          {tool !== null && (
            <button
              type="button"
              onClick={() => setTool(null)}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
              title="Salvar edição"
            >
              <span className="text-sm font-semibold">Salvar</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center bg-black"
      >
        {pdfUrl && stageSize.width > 0 && stageSize.height > 0 && (
          <div
            className="relative"
            style={{
              width: fitSize?.width ?? stageSize.width,
              height: fitSize?.height ?? stageSize.height,
            }}
          >
            <PdfView
              file={pdfUrl}
              width={fitSize?.width ?? stageSize.width}
              height={fitSize?.height ?? stageSize.height}
              onLoadSuccess={handlePdfLoadSuccess}
            />

            {/* Canvas overlay - only active when a tool is selected */}
            {fitSize && tool !== null && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 touch-none"
                style={{
                  width: fitSize.width,
                  height: fitSize.height,
                  cursor: tool === "eraser" ? "cell" : "crosshair",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            )}

            {/* Render strokes (read-only) when not editing */}
            {fitSize && tool === null && activeSong && (drawings[activeSong.id]?.length ?? 0) > 0 && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ width: fitSize.width, height: fitSize.height }}
              />
            )}
          </div>
        )}

        {pdfMissing && (
          <div className="max-w-md mx-6 text-center bg-card/90 border border-destructive/50 text-foreground rounded-lg p-6">
            <p className="text-lg font-semibold text-destructive mb-2">
              Arquivo PDF não encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              O upload desta cifra não está mais disponível no armazenamento
              do navegador. Isso pode acontecer se os dados do site forem
              limpos. Reenvie o PDF em "Músicas" para restaurá-lo.
            </p>
          </div>
        )}


      </div>

      {/* Side swipe zones (keep gesture support, invisible) */}
      <div
        aria-hidden
        onTouchStart={onSwipeStart}
        onTouchEnd={(e) => onSwipeEnd(e, () => {})}
        className="absolute top-0 bottom-0 left-0 w-[50px] z-10"
      />
      <div
        aria-hidden
        onTouchStart={onSwipeStart}
        onTouchEnd={(e) => onSwipeEnd(e, () => {})}
        className="absolute top-0 bottom-0 right-0 w-[50px] z-10"
      />

      {/* Visible navigation buttons */}
      <button
        type="button"
        aria-label="Música anterior"
        onClick={goPrev}
        disabled={activeIdx === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center h-14 w-14 rounded-full bg-card/70 backdrop-blur border border-border text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft className="h-7 w-7" />
      </button>
      <button
        type="button"
        aria-label="Próxima música"
        onClick={goNext}
        disabled={activeIdx >= setlist.length - 1}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center h-14 w-14 rounded-full bg-card/70 backdrop-blur border border-border text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronRight className="h-7 w-7" />
      </button>

      {/* Usage hint (auto-hides) */}
      {showHint && setlist.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-muted-foreground bg-card/80 backdrop-blur px-3 py-1.5 rounded-md border border-border">
          Use as setas ← → do teclado, os botões laterais ou deslize para trocar de cifra
        </div>
      )}

      {/* End-of-show hint when on last */}
      {activeIdx === setlist.length - 1 && (
        <div className="absolute bottom-4 right-4 z-30 text-xs text-muted-foreground bg-card/70 backdrop-blur px-3 py-1.5 rounded-md border border-border flex items-center gap-2">
          <X className="h-3 w-3" />
          Última música do show
        </div>
      )}
    </div>
  );
}
