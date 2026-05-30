import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell
} from "recharts";

const SHOCK_LABELS: Record<string, string> = {
  palm_oil: "Aceite de Palma",
  port_strike: "Paro Portuario",
  weather: "Clima / Cosecha",
  policy: "Política / USDA",
};

const SHOCK_ICONS: Record<string, string> = {
  palm_oil: "🌴",
  port_strike: "⚓",
  weather: "🌩",
  policy: "📋",
};

const fmtDateShort = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`;
};

const CustomShockTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border p-3 text-xs" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono" style={{ color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function Shocks() {
  const { data: shocks, isLoading: shocksLoading } = useQuery({
    queryKey: ["/api/shocks"],
    queryFn: () => apiRequest("GET", "/api/shocks").then(r => r.json()),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics"],
    queryFn: () => apiRequest("GET", "/api/analytics").then(r => r.json()),
  });

  if (shocksLoading || analyticsLoading || !shocks || !analytics) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72" />
        <div className="space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const { data: series } = analytics;

  // Create combined chart data with shocks overlaid
  const shockDateMap: Record<string, any> = {};
  shocks.forEach((s: any) => {
    shockDateMap[s.date.slice(0, 7)] = s; // match by year-month
  });

  const chartData = series.map((r: any) => {
    const monthKey = r.date.slice(0, 7);
    const shock = shockDateMap[monthKey];
    return {
      date: fmtDateShort(r.date),
      "Ratio A/H": +r.oil_meal_ratio.toFixed(3),
      "Aceite (¢/lb)": +r.oil_chicago.toFixed(2),
      "Harina ($/t ÷10)": +(r.meal_chicago / 10).toFixed(2),
      hasShock: !!shock,
      shockType: shock?.type ?? null,
      shockTitle: shock?.title ?? null,
    };
  });

  // Impact analysis data
  const impactData = shocks.map((s: any) => ({
    date: s.date.slice(0, 7),
    label: s.title.slice(0, 30) + "…",
    oil_impact: s.oil_impact_pct ?? 0,
    meal_impact: s.meal_impact_pct ?? 0,
    type: s.type,
  }));

  // Group shocks by type for stats
  const byType: Record<string, number> = {};
  shocks.forEach((s: any) => {
    byType[s.type] = (byType[s.type] ?? 0) + 1;
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Shocks de Oferta Externa</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Impacto de inventarios de aceite de palma, paros portuarios, clima y políticas agrícolas en subproductos
        </p>
      </div>

      {/* Type summary */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(SHOCK_LABELS).map(([type, label]) => (
          <div key={type} className="kpi-card">
            <div className={`shock-badge ${type} text-xs mb-2`}>{SHOCK_ICONS[type]} {label}</div>
            <div className="text-xl font-mono font-semibold tabular text-foreground">{byType[type] ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">eventos en 2 años</div>
          </div>
        ))}
      </div>

      {/* Price chart with shock markers */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Evolución de Precios y Eventos de Shock</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Líneas verticales indican semanas con eventos registrados de shock de oferta
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} interval={7} />
            <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomShockTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Aceite (¢/lb)" stroke="var(--color-oil)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Harina ($/t ÷10)" stroke="var(--color-meal)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Ratio A/H" stroke="var(--color-ratio)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            {chartData
              .filter((d: any) => d.hasShock)
              .map((d: any, i: number) => (
                <ReferenceLine
                  key={i}
                  x={d.date}
                  stroke={
                    d.shockType === "port_strike" ? "var(--color-alert)" :
                    d.shockType === "palm_oil" ? "#5abc64" :
                    d.shockType === "weather" ? "var(--color-meal)" :
                    "var(--color-ratio)"
                  }
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  opacity={0.7}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Impact comparison bar chart */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Impacto estimado por evento — Aceite vs. Harina</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Variación porcentual en precio del subproducto en la semana posterior al evento
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={impactData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 130 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={130} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, name: string) => [`${Number(v).toFixed(1)}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={0} stroke="hsl(var(--border))" />
            <Bar dataKey="oil_impact" name="Impacto Aceite %" fill="var(--color-oil)" opacity={0.85} />
            <Bar dataKey="meal_impact" name="Impacto Harina %" fill="var(--color-meal)" opacity={0.85} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Shock event log */}
      <div className="rounded-lg border" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="text-sm font-semibold text-foreground">Registro de Eventos de Shock</div>
        </div>
        <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
          {shocks.map((shock: any) => (
            <div key={shock.id} className="p-4 hover:bg-muted/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className="text-xl flex-shrink-0 mt-0.5">{SHOCK_ICONS[shock.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`shock-badge ${shock.type}`}>{SHOCK_LABELS[shock.type]}</span>
                    <span className={`alert-badge ${shock.impact === 'high' ? 'extreme' : 'warning'}`}>
                      {shock.impact === 'high' ? '● Alto impacto' : '● Impacto moderado'}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{shock.date}</span>
                  </div>
                  <div className="text-sm font-semibold text-foreground mb-1">{shock.title}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{shock.description}</div>
                  {(shock.oil_impact_pct !== null || shock.meal_impact_pct !== null) && (
                    <div className="flex gap-4 mt-2">
                      {shock.oil_impact_pct !== null && (
                        <span className={`text-xs font-mono font-semibold ${shock.oil_impact_pct > 0 ? 'text-oil' : 'text-alert-color'}`}>
                          Aceite: {shock.oil_impact_pct > 0 ? '+' : ''}{shock.oil_impact_pct}%
                        </span>
                      )}
                      {shock.meal_impact_pct !== null && (
                        <span className={`text-xs font-mono font-semibold ${shock.meal_impact_pct > 0 ? 'text-meal' : 'text-alert-color'}`}>
                          Harina: {shock.meal_impact_pct > 0 ? '+' : ''}{shock.meal_impact_pct}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
