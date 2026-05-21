import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, X, Pen, Eraser, Trash2, Palette } from "lucide-react";
import { songs as allSongs, type Song } from "@/data/songs";
import { getSongPdfUrl } from "@/lib/song-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

type Point = { x: number; y: number };
type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
type DrawingMap = Record<string, Stroke[]>;

export const Route = createFileRoute("/performance")({
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : "",
    name: typeof search.name === "string" ? search.name : "Show",
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const { ids, name } = useSearch({ from: "/performance" });
  const navigate = useNavigate();

  const setlist: Song[] = useMemo(() => {
    const idList: string[] = ids.split(",").filter(Boolean);
    return idList
      .map((id: string) => allSongs.find((s: Song) => s.id === id))
      .filter((s): s is Song => Boolean(s));
  }, [ids]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeIdx, setActiveIdx] = useState(0);
  const activeSong = setlist[activeIdx];

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>("#00E5FF");
  const [drawings, setDrawings] = useState<DrawingMap>({});

  // Container for PDF + canvas overlay
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [pdfDims, setPdfDims] = useState<{ w: number; h: number } | null>(null);

  // Touch swipe state
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Redirect home if no setlist
  useEffect(() => {
    if (setlist.length === 0) navigate({ to: "/setlists" });
  }, [setlist.length, navigate]);

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

  const pdfUrl = useMemo(
    () => (mounted && activeSong ? getSongPdfUrl(activeSong) : null),
    [mounted, activeSong],
  );

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
      if (e.key === "Escape") navigate({ to: "/setlists" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, navigate]);

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
          onClick={() => navigate({ to: "/setlists" })}
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
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Tool: Pen */}
          <button
            type="button"
            onClick={() => setTool("pen")}
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

          {/* Color toggle */}
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

          {/* Tool: Eraser */}
          <button
            type="button"
            onClick={() => setTool("eraser")}
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
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center bg-black"
      >
        {pdfUrl && fitSize && (
          <div
            className="relative"
            style={{ width: fitSize.width, height: fitSize.height }}
          >
            <Document
              file={pdfUrl}
              loading={
                <div className="text-muted-foreground text-base p-6">
                  Carregando cifra...
                </div>
              }
              error={
                <div className="text-destructive text-base p-6">
                  Não foi possível abrir o PDF.
                </div>
              }
            >
              <Page
                pageNumber={1}
                width={fitSize.width}
                height={fitSize.height}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={(p) => {
                  setPdfDims({ w: p.originalWidth, h: p.originalHeight });
                }}
              />
            </Document>

            {/* Canvas overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 touch-none"
              style={{ width: fitSize.width, height: fitSize.height, cursor: tool === "eraser" ? "cell" : "crosshair" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        )}

        {/* Initial PDF dimension probe (off-screen first-load fallback) */}
        {pdfUrl && !fitSize && (
          <div className="hidden">
            <Document file={pdfUrl}>
              <Page
                pageNumber={1}
                width={400}
                onLoadSuccess={(p) =>
                  setPdfDims({ w: p.originalWidth, h: p.originalHeight })
                }
              />
            </Document>
          </div>
        )}
      </div>

      {/* Invisible side tap/swipe zones */}
      <button
        type="button"
        aria-label="Música anterior"
        onClick={goPrev}
        onTouchStart={onSwipeStart}
        onTouchEnd={(e) => onSwipeEnd(e, goPrev)}
        className="absolute top-0 bottom-0 left-0 w-[50px] z-20 bg-transparent group"
      >
        <span className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
          <ChevronLeft className="h-8 w-8 text-primary" />
        </span>
      </button>
      <button
        type="button"
        aria-label="Próxima música"
        onClick={goNext}
        onTouchStart={onSwipeStart}
        onTouchEnd={(e) => onSwipeEnd(e, goNext)}
        className="absolute top-0 bottom-0 right-0 w-[50px] z-20 bg-transparent group"
      >
        <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity rotate-180">
          <ChevronLeft className="h-8 w-8 text-primary" />
        </span>
      </button>

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
