import { useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

const navItems = [
  { path: "/", label: "Resumen", icon: "◉" },
  { path: "/correlacion", label: "Correlación", icon: "⊕" },
  { path: "/brecha", label: "Brecha Aceite/Harina", icon: "∥" },
  { path: "/alertas", label: "Alertas", icon: "⚠" },
  { path: "/shocks", label: "Shocks de Oferta", icon: "⚡" },
];

export function Sidebar() {
  const [location, navigate] = useHashLocation();

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="SojaTrack">
            <circle cx="14" cy="14" r="13" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <ellipse cx="14" cy="14" rx="6" ry="10" stroke="hsl(var(--primary))" strokeWidth="1.5" transform="rotate(-30 14 14)" />
            <circle cx="14" cy="14" r="2.5" fill="hsl(var(--primary))" />
            <line x1="14" y1="5" x2="14" y2="23" stroke="hsl(var(--primary))" strokeWidth="0.75" strokeOpacity="0.4" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-foreground leading-none">SojaTrack</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Chicago · Rosario
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <div className="section-title px-3 py-2 mb-1">Navegación</div>
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`nav-item w-full text-left ${location === item.path ? "active" : ""}`}
          >
            <span className="text-base leading-none" style={{ fontFamily: "monospace", width: "16px", flexShrink: 0 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="p-3 border-t"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          Fuente: CBOT / Rosario
        </div>
        <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          Actualización semanal
        </div>
      </div>
    </aside>
  );
}
