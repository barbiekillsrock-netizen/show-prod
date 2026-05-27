import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search,
  GripVertical,
  Calendar,
  Clock,
  Music2,
  X,
  Play,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Check,
  Share2,
} from "lucide-react";
import { useSongs, type Song } from "@/data/songs";
import { jsPDF } from "jspdf";
import { getPdfBlob } from "@/lib/pdf-storage";
import { buildDemoPdfBytes } from "@/lib/demo-pdf";
import { useSetlists, setlistsStore, type Setlist } from "@/data/setlists";

export const Route = createFileRoute("/setlists")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: SetlistsPage,
});

const MINUTES_PER_SONG = 4;

async function shareSetlistPdf(setlist: Setlist, songs: Song[]) {
  const validSongs = setlist.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  // ── Documento final com jsPDF ─────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const margin = 16;
  let y = 20;
  let firstPage = true;

  function ensurePage() {
    if (!firstPage) return;
    firstPage = false;
  }

  // ── Capa ──────────────────────────────────────────────────────────────────
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ShowProd", margin, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Setlist de Show", margin, 21);
  y = 38;

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(setlist.name, margin, y);
  y += 7;

  const total = validSongs.length * MINUTES_PER_SONG;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const durStr = h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${validSongs.length} música${validSongs.length !== 1 ? "s" : ""}  •  Duração estimada: ${durStr}  •  ${new Date().toLocaleDateString("pt-BR")}`,
    margin, y
  );
  y += 8;

  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // Cabeçalho tabela
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, W - margin * 2, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("#", margin + 2, y + 1);
  doc.text("Título", margin + 10, y + 1);
  doc.text("Artista", margin + 90, y + 1);
  doc.text("Tom", margin + 145, y + 1);
  doc.text("Estilo", margin + 162, y + 1);
  y += 10;

  validSongs.forEach((song, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, W - margin * 2, 8, "F");
    }
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(String(i + 1), margin + 2, y + 1);
    const title = song.title.length > 32 ? song.title.slice(0, 30) + "…" : song.title;
    doc.text(title, margin + 10, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const artist = song.artist.length > 22 ? song.artist.slice(0, 20) + "…" : song.artist;
    doc.text(artist, margin + 90, y + 1);
    if (song.key) {
      doc.setFillColor(0, 229, 255);
      doc.roundedRect(margin + 143, y - 3, 14, 6, 1, 1, "F");
      doc.setTextColor(10, 10, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(song.key, margin + 145, y + 1);
    }
    if (song.genre) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(song.genre, margin + 162, y + 1);
    }
    y += 9;
  });

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, 285, W - margin, 285);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text("Gerado por ShowProd", margin, 290);

  // ── Cifras: renderiza cada página do PDF via pdfjs → canvas → jsPDF ──────
  for (const song of validSongs) {
    try {
      // Obtém ArrayBuffer do PDF (real ou demo)
      let pdfBytes: ArrayBuffer;
      if (song.hasPdf) {
        const blob = await getPdfBlob(song.id);
        if (!blob) continue;
        pdfBytes = await blob.arrayBuffer();
      } else {
        pdfBytes = buildDemoPdfBytes(song);
      }

      const pdfDoc = await pdfjs.getDocument({ data: pdfBytes }).promise;

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        doc.addPage();
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        // Renderiza em canvas offscreen
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Calcula dimensões para caber na página A4 com margem
        const availW = W - margin * 2;
        const availH = H - margin * 2;
        const ratio = viewport.width / viewport.height;
        let imgW = availW;
        let imgH = imgW / ratio;
        if (imgH > availH) { imgH = availH; imgW = imgH * ratio; }
        const imgX = (W - imgW) / 2;
        const imgY = (H - imgH) / 2;

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        doc.addImage(imgData, "JPEG", imgX, imgY, imgW, imgH);
      }
    } catch {
      // PDF indisponível — pula
    }
  }

  // ── Compartilha ───────────────────────────────────────────────────────────
  const filename = `${setlist.name.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "setlist"}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: setlist.name });
  } else if (navigator.share) {
    const url = URL.createObjectURL(blob);
    await navigator.share({ title: setlist.name, url });
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}


function SetlistsIndex() {
  const setlists = useSetlists();
  const navigate = useNavigate();
  const allSongs = useSongs();

  function createNew() {
    const s = setlistsStore.create("Novo setlist");
    navigate({ to: "/setlists", search: { id: s.id } });
  }

  function startShow(s: Setlist) {
    if (s.songIds.length === 0) return;
    navigate({
      to: "/performance",
      search: { ids: s.songIds.join(","), name: s.name, from: "setlists" },
    });
  }

  function remove(s: Setlist) {
    if (confirm(`Excluir o setlist "${s.name}"?`)) setlistsStore.remove(s.id);
  }

  return (
    <div className="p-8 lg:p-10 h-screen flex flex-col">
      <header className="mb-8 shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Setlists de Shows</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Crie e gerencie os roteiros dos seus shows.
          </p>
        </div>
        <button
          type="button"
          onClick={createNew}
          className="inline-flex items-center gap-2 h-12 px-5 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 shadow-lg shadow-primary/20"
        >
          <Plus className="h-5 w-5" />
          Novo Setlist
        </button>
      </header>

      {setlists.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
          <Music2 className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-base">Nenhum setlist criado ainda.</p>
          <p className="text-sm mt-1">Clique em "Novo Setlist" para começar.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-max">
          {setlists.map((s) => {
            const valid = s.songIds.filter((id) =>
              allSongs.some((sg) => sg.id === id),
            );
            return (
              <article
                key={s.id}
                className="group bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-foreground line-clamp-2">
                    {s.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shareSetlistPdf(s, allSongs)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-2 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary"
                      aria-label="Exportar e compartilhar setlist"
                      title="Compartilhar PDF"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-2 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir setlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Music2 className="h-4 w-4 text-primary" />
                    <span className="text-foreground font-semibold">
                      {valid.length}
                    </span>{" "}
                    músicas
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-foreground font-semibold">
                      {formatDuration(valid.length)}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2 mt-auto">
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: "/setlists", search: { id: s.id } })
                    }
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => startShow(s)}
                    disabled={valid.length === 0}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Iniciar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Editor: existing 2-column drag/drop UI ---------- */

function RepertoireItem({ song, inSetlist }: { song: Song; inSetlist: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${song.id}`,
    data: { song, source: "library" },
    disabled: inSetlist,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-lg border transition-all select-none touch-none ${
        inSetlist
          ? "bg-card/40 border-border opacity-40 cursor-not-allowed"
          : "bg-card border-border cursor-grab active:cursor-grabbing hover:border-primary/60"
      } ${isDragging ? "opacity-30 border-primary" : ""}`}
    >
      <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-foreground truncate">{song.title}</p>
        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
      </div>
      <span className="inline-flex items-center justify-center min-w-[40px] h-7 px-2 rounded bg-primary/15 text-primary text-sm font-bold">
        {song.key}
      </span>
    </div>
  );
}

function SetlistItem({
  song,
  index,
  onRemove,
}: {
  song: Song;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `set-${song.id}`, data: { song, source: "setlist" } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-lg border-2 bg-card transition-colors ${
        isDragging ? "opacity-40 border-primary" : "border-border hover:border-primary/60"
      }`}
    >
      <span className="w-7 text-base font-bold text-primary tabular-nums">
        {index + 1}
      </span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-foreground truncate">
          {song.title}
        </p>
        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
      </div>
      <span className="inline-flex items-center justify-center min-w-[44px] h-8 px-2 rounded bg-primary text-primary-foreground text-sm font-bold">
        {song.key}
      </span>
      <button
        type="button"
        onClick={() => onRemove(song.id)}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-2 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
        aria-label="Remover do setlist"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SetlistDropArea({
  setlist,
  onRemove,
  isDraggingFromLibrary,
}: {
  setlist: Song[];
  onRemove: (id: string) => void;
  isDraggingFromLibrary: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "setlist-dropzone" });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 rounded-xl border-2 border-dashed transition-all p-3 space-y-2 overflow-y-auto ${
        isOver && isDraggingFromLibrary ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <SortableContext
        items={setlist.map((s) => `set-${s.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {setlist.map((song, i) => (
          <SetlistItem key={song.id} song={song} index={i} onRemove={onRemove} />
        ))}
      </SortableContext>

      {isOver && isDraggingFromLibrary && (
        <div className="h-14 rounded-lg border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
          Solte aqui para adicionar ao show
        </div>
      )}

      {setlist.length === 0 && !isOver && (
        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground py-12">
          <Music2 className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-base">Arraste músicas do repertório para cá</p>
          <p className="text-sm mt-1">para montar o roteiro do show.</p>
        </div>
      )}
    </div>
  );
}

function SetlistEditor({ setlist: meta }: { setlist: Setlist }) {
  const navigate = useNavigate();
  const allSongs = useSongs();
  const [query, setQuery] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(meta.name);

  const setlist: Song[] = useMemo(
    () =>
      meta.songIds
        .map((id) => allSongs.find((s) => s.id === id))
        .filter((s): s is Song => Boolean(s)),
    [meta.songIds, allSongs],
  );
  const setlistIds = new Set(setlist.map((s) => s.id));

  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [activeSource, setActiveSource] = useState<"library" | "setlist" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSongs;
    return allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
    );
  }, [query, allSongs]);

  function update(songs: Song[]) {
    setlistsStore.setSongs(
      meta.id,
      songs.map((s) => s.id),
    );
  }

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { song: Song; source: "library" | "setlist" }
      | undefined;
    if (data) {
      setActiveSong(data.song);
      setActiveSource(data.source);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveSong(null);
    setActiveSource(null);
    if (!over) return;
    const activeData = active.data.current as
      | { song: Song; source: "library" | "setlist" }
      | undefined;
    if (!activeData) return;

    if (activeData.source === "library") {
      if (setlistIds.has(activeData.song.id)) return;
      const overId = String(over.id);
      if (overId === "setlist-dropzone") {
        update([...setlist, activeData.song]);
      } else if (overId.startsWith("set-")) {
        const overSongId = overId.slice(4);
        const idx = setlist.findIndex((s) => s.id === overSongId);
        const next = [...setlist];
        next.splice(idx, 0, activeData.song);
        update(next);
      }
      return;
    }

    if (activeData.source === "setlist" && active.id !== over.id) {
      const oldIdx = setlist.findIndex((s) => `set-${s.id}` === active.id);
      const newIdx = setlist.findIndex((s) => `set-${s.id}` === over.id);
      if (oldIdx >= 0 && newIdx >= 0) update(arrayMove(setlist, oldIdx, newIdx));
    }
  }

  function removeFromSetlist(id: string) {
    update(setlist.filter((s) => s.id !== id));
  }

  function saveName() {
    const v = nameDraft.trim() || meta.name;
    setlistsStore.rename(meta.id, v);
    setNameDraft(v);
    setEditingName(false);
  }

  function startShow() {
    if (setlist.length === 0) return;
    navigate({
      to: "/performance",
      search: { ids: setlist.map((s) => s.id).join(","), name: meta.name, from: "setlists" },
    });
  }

  return (
    <div className="p-8 lg:p-10 h-screen flex flex-col">
      <header className="mb-6 shrink-0 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate({ to: "/setlists", search: {} })}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar para setlists
          </button>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setNameDraft(meta.name);
                    setEditingName(false);
                  }
                }}
                className="text-3xl font-bold bg-background border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={saveName}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                aria-label="Salvar nome"
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(meta.name);
                setEditingName(true);
              }}
              className="group inline-flex items-center gap-2 text-left"
            >
              <h2 className="text-3xl font-bold text-foreground">{meta.name}</h2>
              <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Criado em {new Date(meta.createdAt).toLocaleDateString("pt-BR")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Music2 className="h-4 w-4 text-primary" />
              <span className="text-foreground font-semibold">{setlist.length}</span>{" "}
              músicas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-foreground font-semibold">
                {formatDuration(setlist.length)}
              </span>{" "}
              estimado
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={startShow}
          disabled={setlist.length === 0}
          className="inline-flex items-center gap-2 h-14 px-6 rounded-lg bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
        >
          <Play className="h-5 w-5 fill-current" />
          Iniciar Show
        </button>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveSong(null);
          setActiveSource(null);
        }}
      >
        <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
          <section className="flex flex-col bg-card/30 rounded-2xl border border-border p-5 min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-xl font-bold text-foreground">Meu Repertório</h3>
              <span className="text-sm text-muted-foreground">
                {filtered.length} músicas
              </span>
            </div>
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar no repertório..."
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filtered.map((song) => (
                <RepertoireItem
                  key={song.id}
                  song={song}
                  inSetlist={setlistIds.has(song.id)}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col bg-card/30 rounded-2xl border border-border p-5 min-h-0">
            <h4 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 shrink-0">
              Roteiro do Show
            </h4>
            <SetlistDropArea
              setlist={setlist}
              onRemove={removeFromSetlist}
              isDraggingFromLibrary={activeSource === "library"}
            />
          </section>
        </div>

        <DragOverlay>
          {activeSong ? (
            <div className="flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-lg border-2 border-primary bg-card opacity-90 shadow-2xl shadow-primary/30 cursor-grabbing">
              <GripVertical className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-base font-semibold text-foreground">
                  {activeSong.title}
                </p>
                <p className="text-sm text-muted-foreground">{activeSong.artist}</p>
              </div>
              <span className="inline-flex items-center justify-center min-w-[44px] h-8 px-2 rounded bg-primary text-primary-foreground text-sm font-bold">
                {activeSong.key}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
