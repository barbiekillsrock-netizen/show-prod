import { Link, useRouterState } from "@tanstack/react-router";
import { Music, ListMusic, Settings } from "lucide-react";

const items = [
  { title: "Músicas", url: "/", icon: Music },
  { title: "Setlists de Shows", url: "/setlists", icon: ListMusic },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="px-6 py-8 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Show<span className="text-primary">Prod</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Cockpit do palco</p>
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
  );
}
