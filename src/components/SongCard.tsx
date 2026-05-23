import { useNavigate } from "@tanstack/react-router";
import type { Song } from "@/data/songs";

export function SongCard({ song }: { song: Song }) {
  const navigate = useNavigate();
  return (
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
      <span className="absolute top-4 right-4 inline-flex items-center justify-center min-w-[48px] h-8 px-3 rounded-md bg-primary text-primary-foreground font-bold text-base tracking-wide">
        {song.key}
      </span>

      <div className="pr-16">
        <h3 className="text-xl font-semibold text-foreground leading-tight line-clamp-2">
          {song.title}
        </h3>
        <p className="mt-2 text-base text-muted-foreground">{song.artist}</p>
      </div>
    </button>
  );
}
