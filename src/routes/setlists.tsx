import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
import { Search, GripVertical, Calendar, Clock, Music2, X, Play } from "lucide-react";
import { useSongs, type Song } from "@/data/songs";

export const Route = createFileRoute("/setlists")({
  component: SetlistsPage,
});

const MINUTES_PER_SONG = 4;

/* ---------- Left column item (draggable, not sortable) ---------- */
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
      className={`flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-lg border transition-all select-none ${
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

/* ---------- Right column item (sortable) ---------- */
function SetlistItem({
  song,
  index,
  onRemove,
}: {
  song: Song;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `set-${song.id}`, data: { song, source: "setlist" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 min-h-[56px] px-4 py-3 rounded-lg border-2 bg-card transition-colors ${
        isDragging
          ? "opacity-40 border-primary"
          : "border-border hover:border-primary/60"
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
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-2 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
        aria-label="Remover do setlist"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- Drop area for the setlist column ---------- */
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
        isOver && isDraggingFromLibrary
          ? "border-primary bg-primary/5"
          : "border-border"
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

/* ---------- Page ---------- */
function SetlistsPage() {
  const [query, setQuery] = useState("");
  const [setlist, setSetlist] = useState<Song[]>([
    allSongs[0],
    allSongs[3],
    allSongs[6],
  ]);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [activeSource, setActiveSource] = useState<"library" | "setlist" | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSongs;
    return allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q),
    );
  }, [query]);

  const setlistIds = new Set(setlist.map((s) => s.id));

  const totalMinutes = setlist.length * MINUTES_PER_SONG;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const duration =
    hours > 0 ? `${hours}h ${mins.toString().padStart(2, "0")}min` : `${mins}min`;

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

    // From library -> setlist
    if (activeData.source === "library") {
      if (setlistIds.has(activeData.song.id)) return;
      const overId = String(over.id);
      if (overId === "setlist-dropzone") {
        setSetlist((prev) => [...prev, activeData.song]);
      } else if (overId.startsWith("set-")) {
        const overSongId = overId.slice(4);
        const idx = setlist.findIndex((s) => s.id === overSongId);
        setSetlist((prev) => {
          const next = [...prev];
          next.splice(idx, 0, activeData.song);
          return next;
        });
      }
      return;
    }

    // Reorder within setlist
    if (activeData.source === "setlist" && active.id !== over.id) {
      const oldIdx = setlist.findIndex((s) => `set-${s.id}` === active.id);
      const newIdx = setlist.findIndex((s) => `set-${s.id}` === over.id);
      if (oldIdx >= 0 && newIdx >= 0) {
        setSetlist((prev) => arrayMove(prev, oldIdx, newIdx));
      }
    }
  }

  function removeFromSetlist(id: string) {
    setSetlist((prev) => prev.filter((s) => s.id !== id));
  }

  const navigate = useNavigate();
  const showName = "Show de Sábado — Corporativo";

  function startShow() {
    if (setlist.length === 0) return;
    navigate({
      to: "/performance",
      search: { ids: setlist.map((s) => s.id).join(","), name: showName },
    });
  }

  return (
    <div className="p-8 lg:p-10 h-screen flex flex-col">
      <header className="mb-6 shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Setlists de Shows</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Arraste músicas do repertório para montar o roteiro.
          </p>
        </div>
        <button
          type="button"
          onClick={startShow}
          disabled={setlist.length === 0}
          className="inline-flex items-center gap-2 h-14 px-6 rounded-lg bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
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
          {/* LEFT — Repertoire */}
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

          {/* RIGHT — Setlist */}
          <section className="flex flex-col bg-card/30 rounded-2xl border border-border p-5 min-h-0">
            <div className="mb-4 shrink-0">
              <h3 className="text-xl font-bold text-foreground">
                Show de Sábado — Corporativo
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Sáb, 24 de Maio · 21:00
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Music2 className="h-4 w-4 text-primary" />
                  <span className="text-foreground font-semibold">
                    {setlist.length}
                  </span>{" "}
                  músicas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-foreground font-semibold">{duration}</span>{" "}
                  estimado
                </span>
              </div>
            </div>

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
