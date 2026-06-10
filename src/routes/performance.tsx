import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X, Pen, Eraser, Trash2, Palette, Moon, Sun, Pause, Play, ChevronsUp, ChevronsDown } from "lucide-react";
import { useSongs, type Song } from "@/data/songs";
import { getSongPdfUrl } from "@/lib/song-pdf";
import { getDarkModePreference } from "@/lib/preferences";
import { loadDrawing, loadDrawings, saveDrawing, clearDrawing } from "@/lib/drawings-storage";
import PdfView, { type PdfViewHandle } from "@/components/PdfView";

// ── Types ──────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type Stroke = { tool: "pen"; color: string; width: number; points: Point[] };
type DrawingMap = Record<string, Stroke[]>;

const DEFAULT_PDF_DIMS = { w: 595.28, h: 841.89 };

export const Route = createFileRoute("/performance")({
  ssr: false,
  component: PerformancePage,
});

function PerformancePage() {
  const { ids, name, from } = useSearch({ from: "/performance" });
  const exitTo = from === "songs" ? "/" : "/setlists";
  const navigate = useNavigate();

  // ── Setlist ──────────────────────────────────────────────────────────────
  const allSongs = useSongs();
  const setlist: Song[] = useMemo(() => {
    const idList: string[] = ids.split(",").filter(Boolean);
    return idList
      .map((id: string) => allSongs.find((s: Song) => s.id === id))
      .filter((s): s is Song => Boolean(s));
  }, [ids, allSongs]);

  // ── Mount / hint ─────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [showHint, setShowHint] = useState(true);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // ── Active song ───────────────────────────────────────────────────────────
  const [activeIdx, setActiveIdx] = useState(0);
  const activeSong = setlist[activeIdx] ?? null;
  const activeSongId = activeSong?.id;
  const activeSongPdfVersion = `${activeSong?.hasPdf}-${activeSong?.pdfName}`;
  const hasLyrics = Boolean(activeSong?.lyrics && !activeSong?.hasPdf);

  // ── Touch device detection (após mount) ──────────────────────────────────
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(
      typeof navigator !== "undefined" && navigator.maxTouchPoints > 0
    );
  }, []);

  // ── Preferences ───────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(true);
  useEffect(() => {
    setDarkMode(getDarkModePreference());
  }, []);

  // ── Cronômetro ────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  function formatTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // ── Drawing state ─────────────────────────────────────────────────────────
  const [tool, setTool] = useState<"pen" | "eraser" | null>(null);
  const [color, setColor] = useState<string>("#F5A623");
  const [drawings, setDrawings] = useState<DrawingMap>({});
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // ── Lyrics / auto-scroll ──────────────────────────────────────────────────
  const [lyricsFontSize, setLyricsFontSize] = useState(18);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const scrollAccumRef = useRef<number>(0);

  // ── PDF / stage refs ──────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<PdfViewHandle | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [pdfDims, setPdfDims] = useState<{ w: number; h: number } | null>(DEFAULT_PDF_DIMS);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({ current: 0, total: 1 });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMissing, setPdfMissing] = useState(false);

  const handlePdfLoadSuccess = useCallback((d: { w: number; h: number }) => {
    setPdfDims(d);
  }, []);
  const handlePagesChange = useCallback((info: { current: number; total: number }) => {
    setPageInfo(info);
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Carrega drawings do IndexedDB após mount
  useEffect(() => {
    const idList = ids.split(",").filter(Boolean);
    if (idList.length === 0) return;
    loadDrawings(idList).then((saved) => {
      setDrawings((prev) => ({ ...prev, ...saved }));
    });
  }, [ids]);

  // Carrega drawings ao mudar de música
  useEffect(() => {
    if (!activeSongId) return;
    loadDrawing(activeSongId).then((strokes) => {
      if (strokes.length > 0) {
        setDrawings((prev) => {
          if (prev[activeSongId]?.length === strokes.length) return prev;
          return { ...prev, [activeSongId]: strokes };
        });
      }
    });
  }, [activeSongId]);

  // Stage size observer
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const update = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Carrega PDF
  useEffect(() => {
    if (!mounted || !activeSong) return;
    if (activeSong.lyrics && !activeSong.hasPdf) {
      setPdfUrl(null);
      setPdfMissing(false);
      return;
    }
    let cancelled = false;
    setPdfUrl(null);
    setPdfMissing(false);
    getSongPdfUrl(activeSong)
      .then((url) => { if (!cancelled) setPdfUrl(url); })
      .catch(() => { if (!cancelled) { setPdfUrl(null); setPdfMissing(true); } });
    return () => { cancelled = true; };
  }, [mounted, activeSongId, activeSongPdfVersion]);

  // Reset scroll ao trocar de música
  useEffect(() => {
    setAutoScroll(false);
    scrollAccumRef.current = 0;
    if (lyricsContainerRef.current) lyricsContainerRef.current.scrollTop = 0;
  }, [activeSongId]);

  // Rolagem automática — só no cliente após mount
  useEffect(() => {
    if (!mounted || !autoScroll || !hasLyrics) {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
      return;
    }
    const pxPerSecond = scrollSpeed * 18;
    let lastTime: number | null = null;

    function step(now: number) {
      if (!autoScroll) return;
      if (lastTime !== null) {
        const delta = (now - lastTime) / 1000;
        scrollAccumRef.current += pxPerSecond * delta;
        const px = Math.floor(scrollAccumRef.current);
        if (px > 0 && lyricsContainerRef.current) {
          lyricsContainerRef.current.scrollTop += px;
          scrollAccumRef.current -= px;
          const el = lyricsContainerRef.current;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
            setAutoScroll(false);
            return;
          }
        }
      }
      lastTime = now;
      autoScrollRef.current = requestAnimationFrame(step);
    }
    autoScrollRef.current = requestAnimationFrame(step);
    return () => { if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current); };
  }, [mounted, autoScroll, scrollSpeed, hasLyrics]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") navigate({ to: exitTo });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Redraw canvas
  const fitSize = useMemo(() => {
    if (!pdfDims || stageSize.width === 0) return null;
    const sRatio = stageSize.width / stageSize.height;
    const pRatio = pdfDims.w / pdfDims.h;
    if (sRatio > pRatio) {
      const h = stageSize.height;
      return { width: Math.round(h * pRatio), height: h };
    }
    const w = stageSize.width;
    return { width: w, height: Math.round(w / pRatio) };
  }, [pdfDims, stageSize]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fitSize) return;
    canvas.width = fitSize.width;
    canvas.height = fitSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const savedStrokes = activeSong ? drawings[activeSong.id] || [] : [];
    const inProgress = currentStrokeRef.current;
    const strokes = inProgress ? [...savedStrokes, inProgress] : savedStrokes;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * fitSize.width;
      ctx.moveTo(stroke.points[0].x * fitSize.width, stroke.points[0].y * fitSize.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * fitSize.width, stroke.points[i].y * fitSize.height);
      }
      ctx.stroke();
    }
  }, [activeSong, drawings, fitSize]);

  useEffect(() => { redraw(); }, [redraw]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goPrev = useCallback(() => {
    const info = pdfRef.current?.getPageInfo();
    if (info && info.current > 0) { pdfRef.current?.scrollByPages(-1); return; }
    setActiveIdx((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    const info = pdfRef.current?.getPageInfo();
    if (info && info.current < info.total - 1) { pdfRef.current?.scrollByPages(1); return; }
    setActiveIdx((i) => (i < setlist.length - 1 ? i + 1 : i));
  }, [setlist.length]);

  // Reset scroll ao mudar música
  useEffect(() => {
    pdfRef.current?.scrollByPages(-9999);
    setPageInfo({ current: 0, total: 1 });
  }, [activeIdx]);

  // ── Swipe ─────────────────────────────────────────────────────────────────
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    if (tool !== null) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (tool !== null || swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const info = pdfRef.current?.getPageInfo();
    if (dx < 0) {
      if (info && info.current < info.total - 1) return;
      goNext();
    } else {
      if (info && info.current > 0) return;
      goPrev();
    }
  }

  // ── Canvas drawing ────────────────────────────────────────────────────────
  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    if (!canvas || !fitSize) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / fitSize.width,
      y: (e.clientY - rect.top) / fitSize.height,
    };
  }

  function eraseAt(point: Point) {
    if (!activeSong) return;
    const radius = 0.025;
    setDrawings((prev) => {
      const strokes = prev[activeSong.id] || [];
      const next = strokes.filter((s) =>
        s.points.every((p) => Math.hypot(p.x - point.x, p.y - point.y) > radius)
      );
      if (next.length === strokes.length) return prev;
      void saveDrawing(activeSong.id, next);
      return { ...prev, [activeSong.id]: next };
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeSong || tool === null) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    if (tool === "eraser") { eraseAt(pt); return; }
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = { tool: "pen", color, width: 3 / (fitSize?.width ?? 600), points: [pt] };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    if (tool === "eraser") { eraseAt(pt); return; }
    currentStrokeRef.current.points.push(pt);
    redraw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {}
    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!activeSong || !completedStroke || completedStroke.points.length < 2) return;
    setDrawings((prev) => {
      const existing = prev[activeSong.id] || [];
      const updated = [...existing, completedStroke];
      void saveDrawing(activeSong.id, updated);
      return { ...prev, [activeSong.id]: updated };
    });
  }

  function clearStrokes() {
    if (!activeSong) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearDrawing(activeSong.id);
    setDrawings((prev) => ({ ...prev, [activeSong.id]: [] }));
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!activeSong) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none" data-performance>
      {/* Top bar — linha única compacta */}
      <div className="absolute top-0 inset-x-0 z-30 flex flex-col pointer-events-none">
        {/* Linha 1: tudo em h-9 compacto */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 pointer-events-auto">
          {/* Sair */}
          <button
            type="button"
            onClick={() => navigate({ to: exitTo })}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-black/60 backdrop-blur border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Sair</span>
          </button>

          {/* Cronômetro */}
          <button
            type="button"
            onClick={() => setTimerRunning((r) => !r)}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-black/60 backdrop-blur border border-white/10 text-white/80 hover:text-white transition-colors tabular-nums shrink-0"
          >
            {timerRunning ? <Pause className="h-3 w-3 shrink-0" /> : <Play className="h-3 w-3 shrink-0 text-[#F5A623]" />}
            <span className="text-xs font-mono">{formatTime(elapsed)}</span>
          </button>

          {/* Título + tom + posição */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 h-8 px-2.5 rounded-md bg-black/60 backdrop-blur border border-white/10">
            {activeSong.key && (
              <span className="inline-flex items-center justify-center px-1.5 h-5 rounded bg-foreground text-background text-[10px] font-bold shrink-0">
                {activeSong.key}
              </span>
            )}
            {activeSong.bpm && (
              <span className="text-[10px] text-white/40 shrink-0">{activeSong.bpm}♩</span>
            )}
            <span className="text-xs font-medium text-white truncate">{activeSong.title}</span>
            <span className="text-[10px] text-white/30 shrink-0 ml-auto">{activeIdx + 1}/{setlist.length}</span>
          </div>

          {/* Dark mode */}
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-md border backdrop-blur transition-colors shrink-0 ${
              darkMode ? "bg-[#F5A623] text-[#0C0B09] border-[#F5A623]" : "bg-black/60 border-white/10 text-white/70 hover:text-white"
            }`}
          >
            {darkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Linha 2: Ferramentas — compacta */}
        <div className="flex items-center gap-1.5 px-2 pb-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
          {/* Controles de rolagem — só no modo lyrics */}
          {hasLyrics && (
            <>
              <button
                type="button"
                onClick={() => setAutoScroll(a => !a)}
                className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md border backdrop-blur transition-colors shrink-0 ${
                  autoScroll ? "bg-[#F5A623] text-[#0C0B09] border-[#F5A623] font-semibold" : "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80"
                }`}
                title={autoScroll ? "Pausar rolagem" : "Iniciar rolagem automática"}
              >
                {autoScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="text-xs">{autoScroll ? "Parar" : "Auto"}</span>
              </button>
              <button
                type="button"
                onClick={() => setScrollSpeed(s => Math.max(1, s - 1))}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-white shrink-0"
                title="Mais lento"
              ><ChevronsDown className="h-4 w-4" /></button>
              <span className="text-xs text-white/50 w-4 text-center shrink-0">{scrollSpeed}</span>
              <button
                type="button"
                onClick={() => setScrollSpeed(s => Math.min(10, s + 1))}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-white shrink-0"
                title="Mais rápido"
              ><ChevronsUp className="h-4 w-4" /></button>
            </>
          )}

          {/* Zoom de fonte — só no modo lyrics */}
          {hasLyrics && (
            <>
              <button type="button" onClick={() => setLyricsFontSize(s => Math.max(12, s - 2))}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-white font-bold shrink-0"
                title="Diminuir fonte">A-</button>
              <button type="button" onClick={() => setLyricsFontSize(s => Math.min(40, s + 2))}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-white font-bold shrink-0"
                title="Aumentar fonte">A+</button>
            </>
          )}

          {/* Caneta */}
          <button type="button" onClick={() => setTool((t) => (t === "pen" ? null : "pen"))}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-md border backdrop-blur transition-colors ${
              tool === "pen" ? "bg-[#F5A623] text-[#0C0B09] border-[#F5A623]" : "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80"
            }`} aria-label="Caneta">
            <Pen className="h-5 w-5" />
          </button>

          {tool !== null && (
            <button type="button"
              onClick={() => setColor((c) => (c === "#F5A623" ? "#FF0055" : "#F5A623"))}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 bg-black/60 backdrop-blur hover:bg-black/80 relative"
              aria-label="Trocar cor">
              <Palette className="h-5 w-5 text-white/70" />
              <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border border-black" style={{ backgroundColor: color }} />
            </button>
          )}

          {/* Borracha */}
          <button type="button" onClick={() => setTool((t) => (t === "eraser" ? null : "eraser"))}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-md border backdrop-blur transition-colors ${
              tool === "eraser" ? "bg-[#F5A623] text-[#0C0B09] border-[#F5A623]" : "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80"
            }`} aria-label="Borracha">
            <Eraser className="h-5 w-5" />
          </button>

          {/* Limpar */}
          <button type="button" onClick={clearStrokes}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/40 transition-colors"
            title="Limpar Traços">
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">Limpar</span>
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 bg-black overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Lyrics view */}
        {hasLyrics && activeSong.lyrics ? (
          <div
            ref={lyricsContainerRef}
            onClick={() => setAutoScroll(a => !a)}
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden px-8 py-6 ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}
          >
            <pre className="font-mono leading-7 whitespace-pre-wrap break-words" style={{ fontSize: `${lyricsFontSize}px` }}>
              {activeSong.lyrics}
            </pre>
            <div style={{ height: "80vh" }} />
          </div>
        ) : pdfUrl && stageSize.width > 0 ? (
          <PdfView
            ref={pdfRef}
            file={pdfUrl}
            width={stageSize.width}
            height={stageSize.height}
            darkMode={darkMode}
            onLoadSuccess={handlePdfLoadSuccess}
            onPagesChange={handlePagesChange}
          />
        ) : null}

        {/* Canvas de anotações */}
        {fitSize && activeSong && (tool !== null || (drawings[activeSong.id]?.length ?? 0) > 0) && (
          <canvas
            ref={canvasRef}
            className="absolute z-20"
            style={{
              width: fitSize.width, height: fitSize.height,
              left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
              cursor: tool === "eraser" ? "cell" : tool === "pen" ? "crosshair" : "default",
              pointerEvents: tool !== null ? "auto" : "none",
              touchAction: tool !== null ? "none" : "auto",
            }}
            onPointerDown={tool !== null ? onPointerDown : undefined}
            onPointerMove={tool !== null ? onPointerMove : undefined}
            onPointerUp={tool !== null ? onPointerUp : undefined}
            onPointerCancel={tool !== null ? onPointerUp : undefined}
          />
        )}

        {/* PDF missing */}
        {pdfMissing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-md mx-6 text-center bg-black/80 border border-red-500/30 text-white rounded-lg p-6">
              <p className="text-lg font-semibold text-destructive mb-2">Arquivo PDF não encontrado</p>
              <p className="text-sm text-white/50">
                O arquivo desta música não está mais disponível. Reenvie o PDF em "Músicas" para restaurá-lo.
              </p>
            </div>
          </div>
        )}

        {/* Hint swipe */}
        {showHint && !hasLyrics && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-white/40 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md border border-white/10">
            deslize para trocar de música
          </div>
        )}
      </div>

      {/* Setas — só desktop (sem touch) */}
      {mounted && !isTouchDevice && (
        <>
          <button type="button" aria-label="Anterior" onClick={goPrev}
            disabled={activeIdx === 0 && pageInfo.current === 0}
            className="stage-arrow absolute left-3 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center h-14 w-14 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-black/70 disabled:opacity-20 disabled:cursor-not-allowed transition">
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button type="button" aria-label="Próxima" onClick={goNext}
            disabled={activeIdx >= setlist.length - 1 && pageInfo.current >= pageInfo.total - 1}
            className="stage-arrow absolute right-3 top-1/2 -translate-y-1/2 z-30 inline-flex items-center justify-center h-14 w-14 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-black/70 disabled:opacity-20 disabled:cursor-not-allowed transition">
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      {/* Próxima música */}
      {activeIdx < setlist.length - 1 ? (
        <div className="absolute bottom-6 right-6 z-40 text-xs bg-black/60 backdrop-blur px-3 py-1.5 rounded-md border border-white/10 max-w-[240px] pointer-events-none">
          <span className="text-white/30 mr-1">A seguir:</span>
          <span className="text-white/70 font-medium">{setlist[activeIdx + 1].title}</span>
          <span className="text-white/30 ml-1">— {setlist[activeIdx + 1].artist}</span>
        </div>
      ) : (
        <div className="absolute bottom-6 right-6 z-40 text-xs text-white/40 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md border border-white/10 flex items-center gap-2 pointer-events-none">
          <X className="h-3 w-3" />
          Última música do show
        </div>
      )}
    </div>
  );
}
