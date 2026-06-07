import { Link, useRouterState } from "@tanstack/react-router";
import { Music, ListMusic, Settings, PenLine } from "lucide-react";

const items = [
  { title: "Músicas", url: "/", icon: Music },
  { title: "Setlists de Shows", url: "/setlists", icon: ListMusic },
  { title: "Editor", url: "/editor", icon: PenLine },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* ── Sidebar lateral — tablet/desktop (md+) ── */}
      <aside className="hidden md:flex w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex-col min-h-screen">
        <div className="px-6 py-8 border-b border-sidebar-border">
          <h1 className="text-2xl tracking-tight text-foreground">
            <span className="font-light">Show</span><span className="font-bold">Prod</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground tracking-widest uppercase">Cockpit do palco</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const active = currentPath === item.url;
            return (
              <Link
                key={item.url}
                to={item.url}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[48px] ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Bottom navigation — mobile only (< md) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar border-t border-sidebar-border flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const active = currentPath === item.url;
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-lg transition-colors ${
                active ? "text-primary" : "text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] leading-none">
                {item.title === "Setlists de Shows" ? "Setlists" : item.title}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
