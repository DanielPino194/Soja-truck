import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Line, ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function KpiCard({
  label, value, unit, change, colorClass, subLabel
}: {
  label: string; value: string; unit?: string; change?: number; colorClass: string; subLabel?: string;
}) {
  const changeColor = change === undefined ? "" : change > 0 ? "text-oil" : change < 0 ? "text-alert-color" : "text-muted-foreground";
  return (
    <div className={`kpi-card ${colorClass}`} data-testid="kpi-card">
      <div className="section-title text-xs mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular" style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {subLabel && <div className="text-xs text-muted-foreground mt-1">{subLabel}</div>}
      {change !== undefined && (
        <div className={`text-xs mt-1 tabular font-mono ${changeColor}`}>
          {change > 0 ? "▲" : change < 0 ? "▼" : "—"} {Math.abs(change)}% sem/sem
        </div>
      )}
    </div>
  );
}

const formatDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border p-3 text-xs" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <div className="font-medium mb-1.5" style={{ color: "hsl(var(--foreground))" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "hsl(var(--muted-foreground))" }}>{p.name}:</span>
          <span className="font-mono font-medium" style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
    queryFn: () => apiRequest("GET", "/api/analytics").then(r => r.json()),
    refetchInterval: 60000,
  });

  // Live quote — refreshes every 5 min
  const { data: live, isLoading: liveLoading } = useQuery({
    queryKey: ["/api/prices/live"],
    queryFn: () => apiRequest("GET", "/api/prices/live").then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { stats, data: series } = data;

  // Overlay live prices on top of DB stats when available
  const liveOil = live?.oil_chicago ?? stats.currentOilChicago;
  const liveMeal = live?.meal_chicago ?? stats.currentMealChicago;
  const liveBean = live?.bean_chicago ?? stats.currentBeanChicago;
  const liveRatio = live?.oil_meal_ratio ?? stats.currentRatio;
  const isLive = live && !live.fallback && live.market_state !== "CLOSED";
  const isFallback = live?.fallback;

  const chartData = series.slice(-52).map((r: any) => ({
    date: formatDate(r.date),
    "Aceite Chicago": +r.oil_chicago.toFixed(2),
    "Harina Chicago": +(r.meal_chicago / 10).toFixed(2),
    "Soja Chicago": +(r.bean_chicago / 25).toFixed(2),
    "Ratio A/H": +r.oil_meal_ratio.toFixed(2),
    "Prom. 30d": +r.avg30d.toFixed(2),
    isAlert: r.isAlert,
    isExtreme: r.isExtreme,
  }));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Resumen del Mercado</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Futuros CBOT — Aceite, Harina y Soja · Comparación Chicago / Rosario
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {stats.alertCount > 0 && (
            <span className="alert-badge warning">
              ⚠ {stats.alertCount} alertas activas
            </span>
          )}
          {liveLoading ? (
            <span className="opacity-50">Consultando precios...</span>
          ) : isLive ? (
            <Badge variant="outline" className="text-[10px] border-green-600 text-green-400 font-mono">
              ● EN VIVO · {live.market_state}
            </Badge>
          ) : isFallback ? (
            <Badge variant="outline" className="text-[10px] border-blue-600 text-blue-400 font-mono">
              ● Datos actualizados
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-blue-600 text-blue-400 font-mono">
              ● API Ninjas · delay 15 min
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3" data-testid="kpi-grid">
        <KpiCard
          label="Aceite Chicago" colorClass="oil"
          value={liveOil?.toFixed(2) ?? "—"} unit="¢/lb"
          change={stats.oilWow}
          subLabel="ZL=F · API Ninjas"
        />
        <KpiCard
          label="Harina Chicago" colorClass="meal"
          value={liveMeal?.toFixed(1) ?? "—"} unit="USD/t"
          change={stats.mealWow}
          subLabel="ZM=F · API Ninjas"
        />
        <KpiCard
          label="Soja Chicago" colorClass="bean"
          value={liveBean?.toFixed(2) ?? "—"} unit="¢/bu"
          subLabel="ZS=F · API Ninjas"
        />
        <KpiCard
          label="Ratio Aceite/Harina" colorClass="ratio"
          value={liveRatio?.toFixed(2) ?? "—"} unit="x"
          change={stats.ratioWow}
          subLabel={`Prom. hist: ${stats.historicalMeanRatio?.toFixed(2)}`}
        />
        <KpiCard
          label="Alertas (brecha)" colorClass={stats.alertCount > 0 ? "alert" : "oil"}
          value={String(stats.alertCount ?? 0)} unit="episodios"
          subLabel={`Prom. 30d ratio: ${stats.latest30dAvg?.toFixed(2)}`}
        />
      </div>

      {/* Main chart — Price trends */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Evolución de Precios — Último año</div>
            <div className="text-xs text-muted-foreground">Aceite en ¢/lb · Harina ÷10 · Soja ÷25 (normalizado para visualización)</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} interval={3} />
            <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-body)" }} />
            <Line type="monotone" dataKey="Aceite Chicago" stroke="var(--color-oil)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Harina Chicago" stroke="var(--color-meal)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Soja Chicago" stroke="var(--color-bean)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ratio chart */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="text-sm font-semibold text-foreground mb-1">Ratio Aceite/Harina vs Promedio 30 días</div>
        <div className="text-xs text-muted-foreground mb-3">Señales de alerta cuando el ratio supera ±8% del promedio móvil de 30 días</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} interval={3} />
            <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={stats.historicalMeanRatio} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 2" strokeWidth={1} />
            <Line type="monotone" dataKey="Ratio A/H" stroke="var(--color-ratio)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Prom. 30d" stroke="var(--color-bean)" strokeWidth={1.5} dot={false} strokeDasharray="5 3" opacity={0.8} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rosario comparison cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
          <div className="section-title text-xs mb-3">Aceite de Soja — Chicago vs. Rosario</div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Chicago CBOT</div>
              <div className="text-lg font-mono font-semibold text-oil tabular">{stats.currentOilChicago?.toFixed(2)} ¢/lb</div>
            </div>
            <div className="text-muted-foreground text-lg">→</div>
            <div>
              <div className="text-xs text-muted-foreground">Disponible Rosario</div>
              <div className="text-lg font-mono font-semibold text-rosario tabular">USD {stats.currentOilRosario?.toFixed(2)}/MT</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Basis: {stats.currentOilRosario && stats.currentOilChicago ? 
              `${(stats.currentOilRosario - stats.currentOilChicago * 22.046 / 100).toFixed(2)} USD/MT` : "—"}
          </div>
        </div>
        <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
          <div className="section-title text-xs mb-3">Harina de Soja — Chicago vs. Rosario</div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Chicago CBOT</div>
              <div className="text-lg font-mono font-semibold text-meal tabular">{stats.currentMealChicago?.toFixed(1)} USD/ton</div>
            </div>
            <div className="text-muted-foreground text-lg">→</div>
            <div>
              <div className="text-xs text-muted-foreground">Disponible Rosario</div>
              <div className="text-lg font-mono font-semibold text-rosario tabular">USD {stats.currentMealRosario?.toFixed(1)}/MT</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Basis: {stats.currentMealRosario && stats.currentMealChicago ?
              `${(stats.currentMealRosario - stats.currentMealChicago).toFixed(1)} USD/MT` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
