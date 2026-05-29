import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";

const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const fmtDateShort = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`;
};

export function Alerts() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
    queryFn: () => apiRequest("GET", "/api/analytics").then(r => r.json()),
  });

  if (isLoading || !analytics) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { data: series, alerts, stats } = analytics;

  const chartData = series.map((r: any) => ({
    date: fmtDateShort(r.date),
    rawDate: r.date,
    ratio: +r.oil_meal_ratio.toFixed(3),
    avg30d: +r.avg30d.toFixed(3),
    upper: +(r.avg30d * 1.08).toFixed(3),
    lower: +(r.avg30d * 0.92).toFixed(3),
    isAlert: r.isAlert,
    isExtreme: r.isExtreme,
  }));

  const currentRatio = stats.currentRatio ?? 0;
  const avg30d = stats.latest30dAvg ?? 0;
  const dev = avg30d > 0 ? ((currentRatio - avg30d) / avg30d * 100) : 0;

  // Count individual weekly observations flagged
  const extremeCount = series.filter((r: any) => r.isExtreme).length;
  const warningCount = series.filter((r: any) => r.isAlert && !r.isExtreme).length;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Alertas — Brecha Aceite/Harina</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Se activan cuando el ratio supera ±8% del promedio móvil de 30 días · ±1.5σ para extremos
        </p>
      </div>

      {/* Alert status */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`kpi-card ${Math.abs(dev) > 8 ? "alert" : "oil"}`}>
          <div className="section-title text-xs mb-2">Estado actual</div>
          <div className={`text-sm font-semibold ${Math.abs(dev) > 8 ? "text-alert-color" : "text-oil"}`}>
            {Math.abs(dev) > 8 ? "⚠ ALERTA ACTIVA" : "✓ Normal"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {dev > 0 ? `+${dev.toFixed(1)}%` : `${dev.toFixed(1)}%`} vs. prom. 30d
          </div>
        </div>
        <div className="kpi-card meal">
          <div className="section-title text-xs mb-2">Alertas extremas</div>
          <div className="text-xl font-mono font-semibold tabular text-alert-color">{extremeCount}</div>
          <div className="text-xs text-muted-foreground mt-1">semanas ±1.5σ en 2 años</div>
        </div>
        <div className="kpi-card bean">
          <div className="section-title text-xs mb-2">Alertas moderadas</div>
          <div className="text-xl font-mono font-semibold tabular text-bean">{warningCount}</div>
          <div className="text-xs text-muted-foreground mt-1">semanas ±8% prom. 30d</div>
        </div>
        <div className="kpi-card ratio">
          <div className="section-title text-xs mb-2">Ratio actual / Prom. 30d</div>
          <div className="text-xl font-mono font-semibold tabular text-ratio">
            {currentRatio.toFixed(2)} / {avg30d.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">desviación: {dev.toFixed(1)}%</div>
        </div>
      </div>

      {/* Alert band chart */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Ratio con Bandas de Alerta ±8%</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Zona roja = ratio fuera del rango aceptable · Se generan alertas cuando el ratio cruza las bandas
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} interval={7} />
            <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, name: string) => [Number(v).toFixed(3), name]}
            />
            {/* Shade area between upper/lower */}
            <ReferenceArea
              y1={chartData[chartData.length - 1]?.lower ?? 0}
              y2={chartData[chartData.length - 1]?.upper ?? 30}
              fill="rgba(63,173,114,0.06)"
            />
            <Line type="monotone" dataKey="upper" stroke="rgba(224,92,92,0.5)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Banda +8%" />
            <Line type="monotone" dataKey="lower" stroke="rgba(224,92,92,0.5)" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Banda −8%" />
            <Line type="monotone" dataKey="avg30d" stroke="var(--color-bean)" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="Prom. 30d" />
            <Line
              type="monotone" dataKey="ratio" stroke="var(--color-ratio)" strokeWidth={2.5} dot={false} name="Ratio A/H"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alert log table */}
      <div className="rounded-lg border" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="text-sm font-semibold text-foreground">Registro de Alertas</div>
          <div className="text-xs text-muted-foreground">{alerts.length} episodios recientes</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                {["Fecha", "Ratio A/H", "Prom. 30d", "Desv. (%)", "Dirección", "Severidad"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No hay alertas activas en el período reciente
                  </td>
                </tr>
              ) : (
                alerts.map((alert: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b transition-colors hover:bg-muted/30"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <td className="px-4 py-2.5 font-mono">{alert.date}</td>
                    <td className="px-4 py-2.5 font-mono tabular text-ratio">{alert.ratio?.toFixed(3)}</td>
                    <td className="px-4 py-2.5 font-mono tabular">{alert.avg30d?.toFixed(3)}</td>
                    <td className={`px-4 py-2.5 font-mono tabular font-semibold ${alert.deviation > 0 ? "text-oil" : "text-alert-color"}`}>
                      {alert.deviation > 0 ? "+" : ""}{alert.deviation?.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs ${alert.direction === 'above' ? 'text-oil' : 'text-meal'}`}>
                        {alert.direction === 'above' ? '▲ Sobre prom.' : '▼ Bajo prom.'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`alert-badge ${alert.severity}`}>
                        {alert.severity === 'extreme' ? '● Extremo' : '● Alerta'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
