import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Monitor } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [wakeLock, setWakeLock] = useState(false);
  const [wakeLockSupported] = useState(
    typeof navigator !== "undefined" && "wakeLock" in navigator
  );

  // Ativa/desativa wake lock
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      try {
        lock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        lock.addEventListener("release", () => setWakeLock(false));
      } catch {
        setWakeLock(false);
      }
    }

    if (wakeLock) {
      acquire();
    }

    return () => {
      lock?.release().catch(() => {});
    };
  }, [wakeLock]);

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8">
        <h2 className="text-3xl font-light text-foreground">Configurações</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Ajustes do aplicativo e preferências de palco.
        </p>
      </header>

      <div className="space-y-4 max-w-2xl">
        {/* Manter tela ligada */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl p-5 min-h-[64px]">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <span className="text-base font-medium text-foreground">Manter tela ligada</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {wakeLockSupported
                  ? "Impede a tela de apagar durante o show"
                  : "Não suportado neste dispositivo"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!wakeLockSupported}
            onClick={() => setWakeLock((v) => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed ${
              wakeLock ? "bg-primary" : "bg-muted"
            }`}
            aria-checked={wakeLock}
            role="switch"
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transition-transform ${
                wakeLock ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Rolagem automática — em breve */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl p-5 min-h-[64px] opacity-50">
          <div>
            <span className="text-base font-medium text-foreground">Rolagem automática</span>
            <p className="text-xs text-muted-foreground mt-0.5">Em breve</p>
          </div>
          <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-1">Em breve</span>
        </div>
      </div>
    </div>
  );
}
