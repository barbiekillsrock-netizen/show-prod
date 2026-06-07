import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X, Pen, Eraser, Trash2, Palette, Moon, Sun, Pause, Play } from "lucide-react";
import { useSongs, type Song } from "@/data/songs";
import { getSongPdfUrl } from "@/lib/song-pdf";
import { getDarkModePreference } from "@/lib/preferences";
import { loadDrawing, loadDrawings, saveDrawing, clearDrawing } from "@/lib/drawings-storage";
import PdfView, { type PdfViewHandle } from "@/components/PdfView";




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
  const [lyricsFontSize, setLyricsFontSize] = useState(18);
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" ? getDarkModePreference() : true
  );

  // Cronômetro
  const [elapsed, setElapsed] = useState(0); // segundos
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
  const [color, setColor] = useState<string>("#F5A623");
  const [drawings, setDrawings] = useState<DrawingMap>({});

  // Container for PDF + canvas overlay
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<PdfViewHandle | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [pdfDims, setPdfDims] = useState<{ w: number; h: number } | null>(DEFAULT_PDF_DIMS);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({ current: 0, total: 1 });

  const handlePdfLoadSuccess = useCallback((d: { w: number; h: number }) => {
    setPdfDims((prev) => (
      prev && Math.abs(prev.w - d.w) < 0.5 && Math.abs(prev.h - d.h) < 0.5
        ? prev
        : d
    ));
  }, []);

  const handlePagesChange = useCallback((info: { current: number; total: number }) => {
    setPageInfo(info);
  }, []);

  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Redirect to setlists only when the URL has no ids at all (don't bounce
  // while the songs store hydrates from localStorage).
  useEffect(() => {
    if (!ids) navigate({ to: exitTo });
  }, [ids, navigate]);

  // Carrega anotações do IndexedDB após mount (todas as músicas do show)
  useEffect(() => {
    const idList = ids.split(",").filter(Boolean);
    if (idList.length === 0) return;
    loadDrawings(idList).then((saved) => {
      setDrawings((prev) => ({ ...prev, ...saved }));
    });
  }, [ids]);

  // Quando muda de música ativa, garante que drawings dessa música estão carregados
  useEffect(() => {
    if (!activeSong) return;
    loadDrawing(activeSong.id).then((strokes) => {
      if (strokes.length > 0) {
        setDrawings((prev) => {
          if (prev[activeSong.id]?.length === strokes.length) return prev;
          return { ...prev, [activeSong.id]: strokes };
        });
      }
    });
  }, [activeSong?.id]);

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
  const activeSongPdfVersion = `${activeSong?.hasPdf}-${activeSong?.pdfName}`;
  const hasLyrics = Boolean(activeSong?.lyrics && !activeSong?.hasPdf);
  useEffect(() => {
    if (!mounted || !activeSong) return;
    let cancelled = false;
    setPdfUrl(null); // limpa URL antiga antes de carregar nova
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
  }, [mounted, activeSongId, activeSongPdfVersion]);

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
    // Inclui stroke em progresso (do ref) no redraw
    const savedStrokes = activeSong ? drawings[activeSong.id] || [] : [];
    const inProgress = currentStrokeRef.current;
    const strokes = inProgress ? [...savedStrokes, inProgress] : savedStrokes;
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

  // Swipe gesture para troca de música (touch devices)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    if (tool !== null) return; // não interfere no modo desenho
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (tool !== null || swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    // Só detecta swipe horizontal maior que 60px e mais horizontal que vertical
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const info = pdfRef.current?.getPageInfo();
    if (dx < 0) {
      // Swipe esquerda → próxima
      if (info && info.current < info.total - 1) return; // deixa PdfView tratar
      goNext();
    } else {
      // Swipe direita → anterior
      if (info && info.current > 0) return; // deixa PdfView tratar
      goPrev();
    }
  }

  // Navigation: prev/next moves through pages first, then between songs.
  const goPrev = useCallback(() => {
    const info = pdfRef.current?.getPageInfo();
    if (info && info.current > 0) {
      pdfRef.current?.scrollByPages(-1);
      return;
    }
    setActiveIdx((i) => (i > 0 ? i - 1 : i));
  }, []);
  const goNext = useCallback(() => {
    const info = pdfRef.current?.getPageInfo();
    if (info && info.current < info.total - 1) {
      pdfRef.current?.scrollByPages(1);
      return;
    }
    setActiveIdx((i) => (i < setlist.length - 1 ? i + 1 : i));
  }, [setlist.length]);

  // Reset scroll to first page whenever the active song changes
  useEffect(() => {
    pdfRef.current?.scrollToStart();
    setPageInfo({ current: 0, total: 1 });
  }, [activeIdx]);

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
      void saveDrawing(activeSong.id, next);
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
    // Cria o stroke no ref — só entra no state quando completo (onPointerUp)
    currentStrokeRef.current = { tool: "pen", color, width: 3, points: [pt] };
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
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    // Só salva strokes com pelo menos 2 pontos (traço real, não tap)
    if (!activeSong || !completedStroke || completedStroke.points.length < 2) return;

    setDrawings((prev) => {
      const existing = prev[activeSong.id] || [];
      const updated = [...existing, completedStroke];
      void saveDrawing(activeSong.id, updated);
      return { ...prev, [activeSong.id]: updated };
    });
  }

  // Clear current song drawings
  function clearStrokes() {
    if (!activeSong) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearDrawing(activeSong.id);
    setDrawings((prev) => ({ ...prev, [activeSong.id]: [] }));
  }


  if (!activeSong) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none" data-performance>
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex flex-col pointer-events-none">
        {/* Linha 1: Sair + Cronômetro + Título */}
        <div className="flex items-center justify-between px-3 py-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: exitTo })}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Sair</span>
          </button>

          {/* Cronômetro */}
          <button
            type="button"
            onClick={() => setTimerRunning((r) => !r)}
            className="inline-flex items-center gap-1.5 h-11 px-3 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-colors tabular-nums"
            title={timerRunning ? "Pausar cronômetro" : "Retomar cronômetro"}
          >
            {timerRunning
              ? <Pause className="h-3.5 w-3.5 shrink-0" />
              : <Play className="h-3.5 w-3.5 shrink-0 text-primary" />
            }
            <span className="text-sm font-mono">{formatTime(elapsed)}</span>
          </button>
        </div>

        <div className="pointer-events-auto px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/10 flex items-center gap-2">
          {activeSong.key && (
            <span className="inline-flex items-center justify-center px-2 h-6 rounded bg-primary text-primary-foreground text-xs font-bold shrink-0">
              {activeSong.key}
            </span>
          )}
          {activeSong.bpm && (
            <span className="inline-flex items-center justify-center px-2 h-6 rounded bg-[#2A2A2A] text-[#A3A3A3] text-xs font-medium shrink-0">
              {activeSong.bpm} BPM
            </span>
          )}
          <span className="text-sm font-medium text-white truncate max-w-[180px]">{activeSong.title}</span>
          <span className="text-xs text-white/40 shrink-0">{activeIdx + 1}/{setlist.length}</span>
        </div>

        </div>{/* fim linha 1 */}

        {/* Linha 2: Ferramentas — scroll horizontal no mobile */}
        <div className="flex items-center gap-2 px-3 pb-2 overflow-x-auto scrollbar-none pointer-events-auto">
          {/* Zoom de fonte — só no modo lyrics */}
          {hasLyrics && (
            <>
              <button
                type="button"
                onClick={() => setLyricsFontSize(s => Math.max(12, s - 2))}
                className="inline-flex items-center justify-center h-11 w-11 rounded-lg border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-white hover:bg-black/80 text-lg font-bold shrink-0"
                title="Diminuir fonte"
              >A-</button>
              <button
                type="button"
                onClick={() => setLyricsFontSize(s => Math.min(40, s + 2))}
                className="inline-flex items-center justify-center h-11 w-11 rounded-lg border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-white hover:bg-black/80 text-lg font-bold shrink-0"
                title="Aumentar fonte"
              >A+</button>
            </>
          )}

          {/* Dark Mode toggle */}
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className={`inline-flex items-center justify-center h-11 w-11 rounded-lg border backdrop-blur transition-colors ${
              darkMode
                ? "bg-foreground text-background border-foreground"
                : "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80"
            }`}
            aria-label={darkMode ? "Desativar modo escuro" : "Ativar modo escuro"}
            title={darkMode ? "Modo escuro ON" : "Modo escuro OFF"}
          >
            {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          {/* Tool: Pen */}
          <button
            type="button"
            onClick={() => setTool((t) => (t === "pen" ? null : "pen"))}
            className={`inline-flex items-center justify-center h-11 w-11 rounded-lg border backdrop-blur transition-colors ${
              tool === "pen"
                ? "bg-foreground text-background border-foreground"
                : "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80"
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
              onClick={() => setColor((c) => (c === "#F5A623" ? "#FF0055" : "#F5A623"))}
              className="inline-flex items-center justify-center h-11 w-11 rounded-lg border border-white/10 bg-black/60 backdrop-blur hover:bg-black/80 relative"
              aria-label="Trocar cor da caneta"
              title="Trocar cor"
            >
              <Palette className="h-5 w-5 text-white/70" />
              <span
                className="absolute bottom-1 right-1 h-3 w-3 rounded-full border border-black"
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
                ? "bg-foreground text-background border-foreground"
                : "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80"
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
            className="inline-flex items-center gap-2 h-11 px-3 rounded-lg border border-white/10 bg-black/60 backdrop-blur text-white/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/40 transition-colors"
            title="Limpar Traços"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">Limpar</span>
          </button>


        </div>{/* fim linha 2 */}
      </div>

      {/* Stage — PDF pages flow horizontally (scroll-snap). Vertical scroll only
          happens inside a single page if it overflows. */}
      <div
        ref={stageRef}
        className="absolute inset-0 bg-black overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {hasLyrics && activeSong?.lyrics ? (
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden px-8 py-6 ${
              darkMode ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            <pre
              className="font-mono text-base leading-7 whitespace-pre-wrap break-words"
              style={{ fontSize: `${lyricsFontSize}px` }}
            >
              {activeSong.lyrics}
            </pre>
          </div>
        ) : pdfUrl && stageSize.width > 0 && stageSize.height > 0 ? (
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

        {/* Drawing overlay — centered over the first page only.
            Stays in viewport (not inside the scroll strip) so the user always
            draws on a stable surface; pen marks apply to page 1. */}
        {/* Canvas unificado: ativo no modo desenho, passivo no modo leitura.
            Sempre visível quando há PDF carregado — anotações aparecem em
            qualquer página (o redraw usa drawings do state). */}
        {pdfUrl && fitSize && activeSong && (
          tool !== null || (drawings[activeSong.id]?.length ?? 0) > 0
        ) && (
          <canvas
            ref={canvasRef}
            className="absolute z-20"
            style={{
              width: fitSize.width,
              height: fitSize.height,
              left: "50%",
              top: "50%",
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

        {pdfMissing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-md mx-6 text-center bg-black/80 border border-red-500/30 text-white rounded-lg p-6">
              <p className="text-lg font-semibold text-destructive mb-2">
                Arquivo PDF não encontrado
              </p>
              <p className="text-sm text-white/50">
                O arquivo desta música não está mais disponível
                do navegador. Isso pode acontecer se os dados do site forem
                limpos. Reenvie o PDF em "Músicas" para restaurá-lo.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop-only navigation arrows. Hidden on touch devices via CSS
          (.stage-arrow rule in styles.css) — touch users swipe horizontally. */}
      <button
        type="button"
        aria-label="Página/música anterior"
        onClick={goPrev}
        disabled={activeIdx === 0 && pageInfo.current === 0}
        className="stage-arrow absolute left-3 top-1/2 -translate-y-1/2 z-30 items-center justify-center h-14 w-14 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-black/70 disabled:opacity-20 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft className="h-7 w-7" />
      </button>
      <button
        type="button"
        aria-label="Próxima página/música"
        onClick={goNext}
        disabled={activeIdx >= setlist.length - 1 && pageInfo.current >= pageInfo.total - 1}
        className="stage-arrow absolute right-3 top-1/2 -translate-y-1/2 z-30 items-center justify-center h-14 w-14 rounded-full bg-black/50 backdrop-blur border border-white/10 text-white/70 hover:text-white hover:bg-black/70 disabled:opacity-20 disabled:cursor-not-allowed transition"
      >
        <ChevronRight className="h-7 w-7" />
      </button>


      {/* Usage hint (auto-hides) */}
      {showHint && setlist.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-white/40 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md border border-white/10">
          Use as setas ← → do teclado, os botões laterais ou deslize para trocar de música
        </div>
      )}


      {/* Próxima música ou fim do show */}
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
