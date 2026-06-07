import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Plus, ArrowLeft, Save, Trash2, Music } from "lucide-react";
import { useSongs, songsStore, VALID_KEYS, normalizeKey, isValidKey, GENRES, type Song } from "@/data/songs";

export const Route = createFileRoute("/editor")({
  component: EditorPage,
});

// ── Editor de música individual ───────────────────────────────────────────
function SongEditor({ song, onBack }: { song: Song | null; onBack: () => void }) {
  const isNew = song === null;
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [key, setKey] = useState(song?.key ?? "");
  const [bpm, setBpm] = useState(song?.bpm ? String(song.bpm) : "");
  const [lyrics, setLyrics] = useState(song?.lyrics ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSave = title.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const data = {
      title: title.trim(),
      artist: artist.trim(),
      key: key.trim() ? normalizeKey(key) : "",
      bpm: bpm.trim() ? Number(bpm) : undefined,
      lyrics: lyrics.trim() || undefined,
      genre: song?.genre,
    };
    if (isNew) {
      await songsStore.add(data);
    } else {
      await songsStore.update(song!.id, data);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (isNew) onBack();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da música..."
            className="w-full text-lg font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artista"
            className="w-full text-sm bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => key.trim() && setKey(normalizeKey(key))}
            placeholder="Tom"
            maxLength={4}
            className="w-14 h-8 px-2 text-center text-sm font-bold rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            placeholder="BPM"
            type="number"
            min={40}
            max={300}
            className="w-16 h-8 px-2 text-center text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? "bg-green-500 text-white"
                : "bg-foreground text-background hover:opacity-80 disabled:opacity-40"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Salvo!" : saving ? "..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder={"[G]           [D]\nWish you were here\n[Em]          [C]\nWe're just two lost souls swimming in a fish bowl\n\n[Refrão]\n[C]    [G]\nHow I wish, how I wish you were here..."}
        className="flex-1 w-full px-6 py-5 text-sm font-mono leading-7 bg-background text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none"
        spellCheck={false}
      />

      {/* Footer info */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-border text-xs text-muted-foreground shrink-0">
        <span>{lyrics.split("\n").length} linhas · {lyrics.length} caracteres</span>
        <span>Suporta cifras [G], letras e anotações</span>
      </div>
    </div>
  );
}

// ── Lista de músicas com texto ────────────────────────────────────────────
function EditorPage() {
  const songs = useSongs();
  const [editing, setEditing] = useState<Song | "new" | null>(null);

  const textSongs = songs.filter((s) => s.lyrics);

  if (editing === "new") {
    return (
      <div className="h-screen flex flex-col">
        <SongEditor song={null} onBack={() => setEditing(null)} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="h-screen flex flex-col">
        <SongEditor song={editing} onBack={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-10">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-light text-foreground">Editor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escreva letras, cifras e anotações das suas músicas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nova música
        </button>
      </header>

      {textSongs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma música ainda</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Escreva letras, cifras e anotações diretamente no app. Suas músicas ficam disponíveis nos setlists e no show.
          </p>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-80"
          >
            <Plus className="h-4 w-4" />
            Escrever primeira música
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {textSongs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => setEditing(song)}
              className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border text-left hover:border-foreground/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">{song.title}</span>
                  {song.key && (
                    <span className="inline-flex items-center px-2 h-5 rounded-full bg-foreground text-background text-[10px] font-bold">
                      {song.key}
                    </span>
                  )}
                  {song.bpm && (
                    <span className="text-xs text-muted-foreground">{song.bpm} BPM</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-2 font-mono">
                  {song.lyrics?.slice(0, 80)}...
                </p>
              </div>
              <div className="text-xs text-muted-foreground/40 shrink-0 mt-1">
                {song.lyrics?.split("\n").length} linhas
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
