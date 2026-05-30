import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { fetchLiveQuotes, syncHistoricalData } from "./yahoo";
import type { LiveQuote } from "./yahoo";

// Cache live quote for 5 minutes to avoid hammering Yahoo Finance
let liveCache: { data: LiveQuote; ts: number } | null = null;
const LIVE_CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Seed synthetic data if DB is empty, then sync real Yahoo data
  await seedDatabase();

  // Background sync: pull real historical data from Yahoo on startup
  syncHistoricalData()
    .then(({ inserted, updated }) => {
      console.log(`[startup] Yahoo sync done — +${inserted} new rows, ~${updated} updated`);
    })
    .catch(err => {
      console.warn("[startup] Yahoo sync failed (will use seeded data):", err?.message ?? err);
    });

  // Weekly auto-sync: every Sunday at 23:00 UTC (Sunday night Argentina time)
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const msUntilNextSunday = (() => {
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun
    const daysUntil = day === 0 ? 7 : 7 - day;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntil);
    next.setUTCHours(23, 0, 0, 0);
    return next.getTime() - now.getTime();
  })();
  setTimeout(function weeklySyncLoop() {
    syncHistoricalData().catch(e => console.warn("[cron] weekly sync failed:", e?.message));
    setTimeout(weeklySyncLoop, ONE_WEEK_MS);
  }, msUntilNextSunday);

  // Get all price data
  app.get("/api/prices", (_req, res) => {
    const data = storage.getPriceData();
    res.json(data);
  });

  // Get price data with analytics
  app.get("/api/analytics", (_req, res) => {
    const data = storage.getPriceData().sort((a, b) => a.date.localeCompare(b.date));
    
    if (data.length === 0) {
      return res.json({ data: [], alerts: [], stats: {} });
    }

    // Calculate 30-day (4-week) rolling average for oil/meal ratio
    const enriched = data.map((row, i) => {
      const windowStart = Math.max(0, i - 4);
      const window = data.slice(windowStart, i + 1);
      const avg30d = window.reduce((s, r) => s + r.oil_meal_ratio, 0) / window.length;
      
      // Use longer historical context for historical average
      const histStart = Math.max(0, i - 52); // ~1 year lookback
      const histWindow = data.slice(histStart, i + 1);
      const histAvg = histWindow.reduce((s, r) => s + r.oil_meal_ratio, 0) / histWindow.length;
      const histStdev = Math.sqrt(
        histWindow.reduce((s, r) => s + Math.pow(r.oil_meal_ratio - histAvg, 2), 0) / histWindow.length
      );
      
      const isAlert = row.oil_meal_ratio > avg30d * 1.08 || row.oil_meal_ratio < avg30d * 0.92;
      const isExtreme = row.oil_meal_ratio > histAvg + 1.5 * histStdev || row.oil_meal_ratio < histAvg - 1.5 * histStdev;
      
      return {
        ...row,
        avg30d: Math.round(avg30d * 1000) / 1000,
        histAvg: Math.round(histAvg * 1000) / 1000,
        histStdev: Math.round(histStdev * 1000) / 1000,
        isAlert,
        isExtreme,
        // Upper/lower bands
        upperBand: Math.round((histAvg + histStdev) * 1000) / 1000,
        lowerBand: Math.round((histAvg - histStdev) * 1000) / 1000,
      };
    });

    // Extract alerts (last 10 alert episodes)
    const alerts = enriched
      .filter(r => r.isAlert || r.isExtreme)
      .slice(-15)
      .reverse()
      .map(r => ({
        date: r.date,
        ratio: r.oil_meal_ratio,
        avg30d: r.avg30d,
        deviation: Math.round((r.oil_meal_ratio - r.avg30d) / r.avg30d * 100 * 10) / 10,
        severity: r.isExtreme ? "extreme" : "warning",
        direction: r.oil_meal_ratio > r.avg30d ? "above" : "below",
      }));

    // Overall stats
    const allRatios = data.map(r => r.oil_meal_ratio);
    const mean = allRatios.reduce((s, v) => s + v, 0) / allRatios.length;
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    
    const stats = {
      currentOilChicago: latest.oil_chicago,
      currentMealChicago: latest.meal_chicago,
      currentBeanChicago: latest.bean_chicago,
      currentRatio: latest.oil_meal_ratio,
      currentSpread: latest.spread,
      currentOilRosario: latest.oil_rosario,
      currentMealRosario: latest.meal_rosario,
      historicalMeanRatio: Math.round(mean * 1000) / 1000,
      ratioWow: prev ? Math.round((latest.oil_meal_ratio - prev.oil_meal_ratio) / prev.oil_meal_ratio * 100 * 10) / 10 : 0,
      oilWow: prev ? Math.round((latest.oil_chicago - prev.oil_chicago) / prev.oil_chicago * 100 * 10) / 10 : 0,
      mealWow: prev ? Math.round((latest.meal_chicago - prev.meal_chicago) / prev.meal_chicago * 100 * 10) / 10 : 0,
      latest30dAvg: enriched[enriched.length - 1]?.avg30d ?? mean,
      alertCount: alerts.length,
    };

    res.json({ data: enriched, alerts, stats });
  });

  // Get shock events
  app.get("/api/shocks", (_req, res) => {
    const shocks = storage.getShockEvents();
    res.json(shocks);
  });

  // Get correlation data
  app.get("/api/correlation", (_req, res) => {
    const data = storage.getPriceData().sort((a, b) => a.date.localeCompare(b.date));
    
    // Scatter data for oil vs meal (Chicago)
    const scatter = data.map(r => ({
      date: r.date,
      x: r.oil_chicago,
      y: r.meal_chicago,
      ratio: r.oil_meal_ratio,
      oilRosario: r.oil_rosario,
      mealRosario: r.meal_rosario,
    }));

    // Pearson correlation oil vs meal
    const n = data.length;
    const xMean = data.reduce((s, r) => s + r.oil_chicago, 0) / n;
    const yMean = data.reduce((s, r) => s + r.meal_chicago, 0) / n;
    const cov = data.reduce((s, r) => s + (r.oil_chicago - xMean) * (r.meal_chicago - yMean), 0) / n;
    const xStd = Math.sqrt(data.reduce((s, r) => s + Math.pow(r.oil_chicago - xMean, 2), 0) / n);
    const yStd = Math.sqrt(data.reduce((s, r) => s + Math.pow(r.meal_chicago - yMean, 2), 0) / n);
    const correlation = Math.round(cov / (xStd * yStd) * 1000) / 1000;

    // Chicago vs Rosario correlation
    const oilCorrelation = (() => {
      const x2Mean = data.reduce((s, r) => s + r.oil_chicago, 0) / n;
      const y2Mean = data.reduce((s, r) => s + r.oil_rosario, 0) / n;
      const cov2 = data.reduce((s, r) => s + (r.oil_chicago - x2Mean) * (r.oil_rosario - y2Mean), 0) / n;
      const x2Std = Math.sqrt(data.reduce((s, r) => s + Math.pow(r.oil_chicago - x2Mean, 2), 0) / n);
      const y2Std = Math.sqrt(data.reduce((s, r) => s + Math.pow(r.oil_rosario - y2Mean, 2), 0) / n);
      return Math.round(cov2 / (x2Std * y2Std) * 1000) / 1000;
    })();

    res.json({ scatter, correlation, oilCorrelation });
  });

  // Live quote from Yahoo Finance (cached 5 min)
  app.get("/api/prices/live", async (_req, res) => {
    try {
      const now = Date.now();
      if (liveCache && now - liveCache.ts < LIVE_CACHE_TTL) {
        return res.json({ ...liveCache.data, cached: true });
      }
      const quote = await fetchLiveQuotes();
      liveCache = { data: quote, ts: now };
      res.json({ ...quote, cached: false });
    } catch (err: any) {
      // Fallback: return latest row from DB
      const rows = storage.getPriceData().sort((a, b) => b.date.localeCompare(a.date));
      const latest = rows[0];
      if (latest) {
        return res.json({
          oil_chicago: latest.oil_chicago,
          meal_chicago: latest.meal_chicago,
          bean_chicago: latest.bean_chicago,
          oil_meal_ratio: latest.oil_meal_ratio,
          timestamp: latest.date,
          market_state: "CLOSED",
          cached: false,
          fallback: true,
          error: err?.message ?? "Yahoo Finance unavailable",
        });
      }
      res.status(503).json({ error: err?.message ?? "Yahoo Finance unavailable" });
    }
  });

  // Trigger manual historical sync
  app.post("/api/sync", async (_req, res) => {
    try {
      const result = await syncHistoricalData();
      liveCache = null; // invalidate live cache
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message });
    }
  });

  return httpServer;
}
