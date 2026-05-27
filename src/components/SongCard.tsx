import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import type { Song } from "@/data/songs";
import { songsStore } from "@/data/songs";
import { setlistsStore } from "@/data/setlists";

export function SongCard({ song }: { song: Song }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(true);
  }

  async function confirmAndDelete(e: React.MouseEvent) {
    e.stopPropagation();
    // Remove from all setlists
    const setlists = setlistsStore.get();
    setlists.forEach((sl) => {
      if (sl.songIds.includes(song.id)) {
        setlistsStore.setSongs(
          sl.id,
          sl.songIds.filter((id) => id !== song.id)
        );
      }
    });
    await songsStore.remove(song.id);
    setConfirmDelete(false);
  }

  function cancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          navigate({
            to: "/performance",
            search: { ids: song.id, name: song.title, from: "songs" },
          })
        }
        className="group relative text-left bg-card rounded-xl border border-border p-6 transition-all hover:border-primary hover:shadow-[0_0_0_1px_var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-primary min-h-[160px] flex flex-col justify-between"
      >
        {/* Badges: Tom + Estilo */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
          {song.key && (
            <span className="inline-flex items-center justify-center min-w-[48px] h-8 px-3 rounded-md bg-primary text-primary-foreground font-bold text-base tracking-wide">
              {song.key}
            </span>
          )}
          {song.genre && (
            <span className="inline-flex items-center justify-center px-2.5 h-6 rounded-md bg-[#2A2A2A] text-[#A3A3A3] font-medium text-xs">
              {song.genre}
            </span>
          )}
        </div>

        {/* Título e artista */}
        <div className="pr-16">
          <h3 className="text-xl font-semibold text-foreground leading-tight line-clamp-2">
            {song.title}
          </h3>
          <p className="mt-2 text-base text-muted-foreground">{song.artist}</p>
        </div>

        {/* Botão deletar — aparece no hover */}
        <button
          type="button"
          onClick={handleDelete}
          className="absolute bottom-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Excluir música"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </button>

      {/* Modal de confirmação de delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          onClick={cancelDelete}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground mb-2">
              Excluir música?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Excluir{" "}
              <span className="text-foreground font-medium">"{song.title}"</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="h-11 px-5 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAndDelete}
                className="h-11 px-5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
