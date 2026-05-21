import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { songs } from "@/data/songs";
import { SongCard } from "@/components/SongCard";

export const Route = createFileRoute("/")({
  component: SongsPage,
});

function SongsPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q),
    );
  }, [query]);

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

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 h-14 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity min-h-[48px]"
        >
          <Plus className="h-5 w-5" strokeWidth={3} />
          Adicionar Nova Cifra
        </button>
      </div>

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
    </div>
  );
}
