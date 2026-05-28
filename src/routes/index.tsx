import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import { useSongs, GENRES } from "@/data/songs";
import { SongCard } from "@/components/SongCard";
import { AddSongDialog } from "@/components/AddSongDialog";
import { getSongPdfUrl } from "@/lib/song-pdf";

export const Route = createFileRoute("/")({
  component: SongsPage,
});

function SongsPage() {
  const router = useRouter();
  const songs = useSongs();
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "title" | "artist" | "key">("default");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const warmUp = () => {
      void import("@/components/PdfView");
      void router.preloadRoute({
        to: "/performance",
        search: { ids: songs[0]?.id ?? "", name: songs[0]?.title ?? "Show", from: "songs" },
      }).catch(() => {});
      songs
        .filter((song) => song.hasPdf)
        .slice(0, 12)
        .forEach((song) => void getSongPdfUrl(song).catch(() => {}));
    };
    const requestIdle = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({
      didTimeout: false,
      timeRemaining: () => 0,
    }), 250));
    const cancelIdle = window.cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    const id = requestIdle(warmUp);
    return () => cancelIdle(id);
  }, [router, songs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = songs.filter((s) => {
      const matchesQuery = !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.key ?? "").toLowerCase().includes(q) ||
        (s.genre ?? "").toLowerCase().includes(q);
      const matchesGenre = !genreFilter || s.genre === genreFilter;
      return matchesQuery && matchesGenre;
    });
    if (sortBy === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "artist") return [...list].sort((a, b) => a.artist.localeCompare(b.artist));
    if (sortBy === "key") return [...list].sort((a, b) => (a.key ?? "").localeCompare(b.key ?? ""));
    return list;
  }, [query, genreFilter, sortBy, songs]);

  // Gêneros que existem no repertório atual
  const activeGenres = useMemo(() => {
    const set = new Set(songs.map((s) => s.genre).filter(Boolean) as string[]);
    return GENRES.filter((g) => set.has(g));
  }, [songs]);

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Músicas</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Seu repertório, pronto para o palco.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, artista ou tom..."
            className="w-full h-14 pl-12 pr-4 rounded-lg bg-card border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-14 px-4 rounded-lg bg-card border border-border text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="default">Ordem padrão</option>
            <option value="title">A-Z título</option>
            <option value="artist">A-Z artista</option>
            <option value="key">Por tom</option>
          </select>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-14 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity min-h-[48px]"
          >
            <Plus className="h-5 w-5" strokeWidth={3} />
            Adicionar Nova Cifra
          </button>
        </div>
      </div>

      {/* Filtro por estilo */}
      {activeGenres.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 -mt-2">
          {activeGenres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenreFilter(genreFilter === g ? "" : g)}
              className={`h-8 px-3 rounded-full text-sm font-medium transition-colors ${
                genreFilter === g
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
          {genreFilter && (
            <button
              type="button"
              onClick={() => setGenreFilter("")}
              className="h-8 px-3 rounded-full text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground"
            >
              ✕ Limpar
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-base">
          Nenhuma música encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}

      <AddSongDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
