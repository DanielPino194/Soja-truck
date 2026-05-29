import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ReferenceLine } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const CustomScatterTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border p-3 text-xs" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <div className="font-medium mb-1.5" style={{ color: "hsl(var(--foreground))" }}>{d?.date}</div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="inline-block w-2 h-2 rounded-full bg-oil" />
        <span className="text-muted-foreground">Aceite Chicago:</span>
        <span className="font-mono text-oil">{d?.x?.toFixed(2)} ¢/lb</span>
      </div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="inline-block w-2 h-2 rounded-full bg-meal" />
        <span className="text-muted-foreground">Harina Chicago:</span>
        <span className="font-mono text-meal">{d?.y?.toFixed(1)} USD/t</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-ratio" />
        <span className="text-muted-foreground">Ratio A/H:</span>
        <span className="font-mono text-ratio">{d?.ratio?.toFixed(3)}</span>
      </div>
    </div>
  );
};

const CustomLineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border p-3 text-xs" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono" style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`;
};

export function Correlation() {
  const { data: corrData, isLoading: corrLoading } = useQuery({
    queryKey: ["/api/correlation"],
    queryFn: () => apiRequest("GET", "/api/correlation").then(r => r.json()),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics"],
    queryFn: () => apiRequest("GET", "/api/analytics").then(r => r.json()),
  });

  if (corrLoading || analyticsLoading || !corrData || !analytics) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const { scatter, correlation, oilCorrelation } = corrData;
  const { data: series } = analytics;

  // Scatter points colored by period (darker = older)
  const scatterPoints = scatter.map((p: any, i: number) => ({
    ...p,
    index: i,
  }));

  // Compute data domain for scatter
  const xVals = scatterPoints.map((p: any) => p.x);
  const yVals = scatterPoints.map((p: any) => p.y);
  const xMin = xVals.length ? Math.floor(Math.min(...xVals) * 0.95) : 0;
  const xMax = xVals.length ? Math.ceil(Math.max(...xVals) * 1.05) : 100;
  const yMin = yVals.length ? Math.floor(Math.min(...yVals) * 0.95) : 0;
  const yMax = yVals.length ? Math.ceil(Math.max(...yVals) * 1.05) : 500;

  // Timeline data for dual-axis equivalent chart
  const timelineData = series.map((r: any) => ({
    date: fmtDate(r.date),
    "Aceite (¢/lb)": +r.oil_chicago.toFixed(2),
    "Harina ($/t ÷10)": +(r.meal_chicago / 10).toFixed(2),
    "Oil Rosario": +r.oil_rosario.toFixed(2),
    "Harina Rosario ×10": +(r.meal_rosario * 10).toFixed(1),
  }));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Correlación Aceite / Harina</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Análisis de correlación entre subproductos — Chicago CBOT · Últimos 2 años
        </p>
      </div>

      {/* Correlation stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="kpi-card oil">
          <div className="section-title text-xs mb-2">Corr. Aceite vs. Harina</div>
          <div className="text-xl font-mono font-semibold tabular text-ratio">
            {correlation?.toFixed(3)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {Math.abs(correlation) > 0.7 ? "Correlación fuerte" : Math.abs(correlation) > 0.4 ? "Correlación moderada" : "Correlación débil"}
            {correlation < 0 ? " negativa" : " positiva"}
          </div>
        </div>
        <div className="kpi-card meal">
          <div className="section-title text-xs mb-2">Corr. Chicago vs. Rosario (Aceite)</div>
          <div className="text-xl font-mono font-semibold tabular text-oil">
            {oilCorrelation?.toFixed(3)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {Math.abs(oilCorrelation) > 0.9 ? "Correlación muy alta" : "Alta transmisión de precios"}
          </div>
        </div>
        <div className="kpi-card bean">
          <div className="section-title text-xs mb-2">Datos analizados</div>
          <div className="text-xl font-mono font-semibold tabular text-bean">
            {scatter?.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">observaciones semanales · 2 años</div>
        </div>
      </div>

      {/* Scatter plot */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Dispersión Aceite vs. Harina — Chicago CBOT</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Cada punto = una semana · Eje X: Aceite (¢/lb) · Eje Y: Harina (USD/ton) · Color: gradiente temporal (azul=reciente)
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis
              type="number" dataKey="x" name="Aceite Chicago"
              domain={[xMin, xMax]}
              label={{ value: "Aceite CBOT (¢/lb)", position: "insideBottom", offset: -10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              type="number" dataKey="y" name="Harina Chicago"
              domain={[yMin, yMax]}
              label={{ value: "Harina (USD/ton)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip content={<CustomScatterTooltip />} />
            <Scatter
              data={scatterPoints}
              fill="var(--color-oil)"
              opacity={0.75}
              shape={(props: any) => {
                const ratio = (props.index ?? 0) / (scatter.length || 1);
                // Gradient from muted (old) to bright (new)
                const r = Math.round(63 + (91 - 63) * ratio);
                const g = Math.round(173 + (155 - 173) * ratio);
                const b = Math.round(114 + (213 - 114) * ratio);
                return <circle cx={props.cx} cy={props.cy} r={4} fill={`rgb(${r},${g},${b})`} opacity={0.8} />;
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chicago vs Rosario comparison chart */}
      <div className="rounded-lg border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">Chicago vs. Rosario — Aceite y Harina</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Comparación de precios futuros CBOT con disponibles Rosario · Basis y transmisión de precio
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timelineData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} interval={7} />
            <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomLineTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Aceite (¢/lb)" stroke="var(--color-oil)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Oil Rosario" stroke="var(--color-rosario)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" dataKey="Harina ($/t ÷10)" stroke="var(--color-meal)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Harina Rosario ×10" stroke="#7ecbc8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
