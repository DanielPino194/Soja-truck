import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar, Cell
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border p-3 text-xs" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono" style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function Spread() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
    queryFn: () => apiRequest("GET", "/api/analytics").then(r => r.json()),
  });

  if (isLoading || !analytics) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { data: series, stats } = analytics;

  const spreadData = series.map((r: any) => ({
    date: fmtDate(r.date),
    "Ratio A/H": +r.oil_meal_ratio.toFixed(3),
    "Prom. 30d": +r.avg30d.toFixed(3),
    "Banda +1σ": +r.upperBand.toFixed(3),
    "Banda −1σ": +r.lowerBand.toFixed(3),
    "Prom. hist.": +r.histAvg.toFixed(3),
    alert: r.isAlert,
    extreme: r.isExtreme,
  }));

  // Bar chart showing deviation from 30d avg
  const deviationData = series.slice(-26).map((r: any) => ({
    date: fmtDate(r.date),
    desv: +((r.oil_meal_ratio - r.avg30d) / r.avg30d * 100).toFixed(2),
    isAbove: r.oil_meal_ratio > r.avg30d,
    alert: r.isAlert,
  }));

  const currentRatio = stats.currentRatio ?? 0;
  const histMean = stats.historicalMeanRatio ?? 0;
  const deviationFromHist = histMean > 0 ? ((currentRatio - histMean) / histMean * 100) : 0;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Brecha Aceite / Harina</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ratio Aceite/Harina · Bandas de alerta ±1σ · Promedio móvil 30 días · Últimos 2 años
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="kpi-card ratio">
          <div className="section-title text-xs mb-2">Ratio actual</div>
          <div className="text-xl font-mono font-semibold tabular text-ratio">{currentRatio.toFixed(3)}</div>
          <div className="text-xs text-muted-foreground mt-1">Aceite/Harina ×100</div>
        </div>
        <div className="kpi-card oil">
          <div className="section-title text-xs mb-2">Prom. hist. 2 años</div>
          <div className="text-xl font-mono font-semibold tabular text-oil">{histMean.toFixed(3)}</div>
          <div className="text-xs text-muted-foreground mt-1">Media del período</div>
        </div>
        <div className="kpi-card meal">
          <div className="section-title text-xs mb-2">Prom. móvil 30d</div>
          <div className="text-xl font-mono font-semibold tabular text-meal">{stats.latest30dAvg?.toFixed(3)}</div>
          <div className="text-xs text-muted-foreground mt-1">4 semanas móviles</div>
        </div>
        <div className={`kpi-card ${Math.abs(deviationFromHist) > 10 ? "alert" : "bean"}`}>
          <div className="section-title text-xs mb-2">Desv. del histór.</div>
          <div className={`text-xl font-mono font-semibold tabular ${deviationFromHist > 0 ? "text-oil" : "text-alert-color"}`}>
            {deviationFromHist > 0 ? "+" : ""}{deviationFromHist.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">vs. media 2 años</div>
        </div>
      </div>

      {/* Main spread chart with bands */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Ratio Aceite/Harina con Bandas Estadísticas — 2 años</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Bandas ±1 desviación estándar histórica · Prom. móvil 30 días · Zonas de alerta activadas cuando el ratio supera las bandas
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={spreadData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} interval={7} />
            <YAxis
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {/* Bands area */}
            <Area type="monotone" dataKey="Banda +1σ" stroke="rgba(160,108,213,0.3)" fill="rgba(160,108,213,0.08)" strokeWidth={1} strokeDasharray="4 3" dot={false} />
            <Area type="monotone" dataKey="Banda −1σ" stroke="rgba(160,108,213,0.3)" fill="rgba(255,255,255,0)" strokeWidth={1} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="Prom. hist." stroke="hsl(var(--muted-foreground))" strokeWidth={1} dot={false} strokeDasharray="8 4" opacity={0.6} />
            <Line type="monotone" dataKey="Prom. 30d" stroke="var(--color-bean)" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="Ratio A/H" stroke="var(--color-ratio)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Deviation bars — last 26 weeks */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Desviación del Ratio vs. Promedio 30 días — Último semestre</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Verde = ratio sobre promedio (aceite relativamente caro) · Rojo = ratio bajo promedio (harina relativamente cara)
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={deviationData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Desviación"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <ReferenceLine y={8} stroke="rgba(224,92,92,0.4)" strokeDasharray="4 2" strokeWidth={1} />
            <ReferenceLine y={-8} stroke="rgba(224,92,92,0.4)" strokeDasharray="4 2" strokeWidth={1} />
            <Bar dataKey="desv" name="Desviación (%)">
              {deviationData.map((entry: any, idx: number) => (
                <Cell
                  key={idx}
                  fill={entry.alert
                    ? (entry.isAbove ? "var(--color-alert)" : "var(--color-meal)")
                    : (entry.isAbove ? "var(--color-oil)" : "rgba(91,155,213,0.6)")}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-oil" /> Aceite caro vs. harina</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-meal" /> Harina cara vs. aceite</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-alert-color" /> Alerta activa</span>
          <span className="flex items-center gap-1 ml-2">— Umbral ±8%</span>
        </div>
      </div>
    </div>
  );
}
