import { createFileRoute } from "@tanstack/react-router";
import { ListMusic } from "lucide-react";

export const Route = createFileRoute("/setlists")({
  component: SetlistsPage,
});

function SetlistsPage() {
  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Setlists de Shows</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Organize sequências de músicas para cada apresentação.
        </p>
      </header>

      <div className="bg-card border border-border rounded-xl p-16 flex flex-col items-center text-center">
        <ListMusic className="h-12 w-12 text-primary mb-4" />
        <h3 className="text-xl font-semibold text-foreground">Nenhum setlist ainda</h3>
        <p className="mt-2 text-base text-muted-foreground max-w-md">
          Crie seu primeiro setlist arrastando músicas do seu repertório.
        </p>
      </div>
    </div>
  );
}
