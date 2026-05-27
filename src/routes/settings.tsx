import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Configurações</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Ajustes do aplicativo e preferências de palco.
        </p>
      </header>

      <div className="space-y-4 max-w-2xl">
        {[
          { label: "Rolagem automática", value: "Em breve" },
          { label: "Manter tela ligada", value: "Em breve" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between bg-card border border-border rounded-xl p-5 min-h-[64px]"
          >
            <span className="text-base font-medium text-foreground">{item.label}</span>
            <span className="text-base text-muted-foreground font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
