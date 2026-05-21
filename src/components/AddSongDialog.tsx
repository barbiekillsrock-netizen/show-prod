import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { songsStore } from "@/data/songs";

export function AddSongDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [songKey, setSongKey] = useState("");

  if (!open) return null;

  function reset() {
    setTitle("");
    setArtist("");
    setSongKey("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !songKey.trim()) return;
    songsStore.add({
      title: title.trim(),
      artist: artist.trim(),
      key: songKey.trim(),
    });
    reset();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-2xl font-bold text-foreground">
              Adicionar Nova Cifra
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre uma música no seu repertório.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Título
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Wish You Were Here"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Artista
            </label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Ex.: Pink Floyd"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tom
            </label>
            <input
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
              placeholder="Ex.: G, Am, F#"
              className="w-full h-12 px-4 rounded-lg bg-background border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={4}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-5 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-muted min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !artist.trim() || !songKey.trim()}
              className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
