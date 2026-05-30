/**
 * Price fetching via API Ninjas commodity endpoint.
 * Replaces Yahoo Finance (which is blocked from cloud servers).
 * Free tier: 15-min delayed data, no daily call limit.
 *
 * Commodities used:
 *   soybean_oil  → ZL=F  (¢/lb)
 *   soybean_meal → ZM=F  (USD/ton)
 *   soybean      → ZS=F  (¢/bu)
 */
import { db } from "./storage.js";
import { priceData } from "../shared/schema.js";
import { eq } from "drizzle-orm";

const NINJAS_API_KEY = process.env.NINJAS_API_KEY ?? "";
const NINJAS_BASE = "https://api.api-ninjas.com/v1/commodityprice";

export interface LiveQuote {
  oil_chicago: number;
  meal_chicago: number;
  bean_chicago: number;
  oil_meal_ratio: number;
  timestamp: string;
  market_state: string;
}

export interface HistoricalRow {
  date: string;
  oil_chicago: number;
  meal_chicago: number;
  bean_chicago: number;
}

async function fetchCommodity(name: string): Promise<number> {
  const res = await fetch(`${NINJAS_BASE}?name=${name}`, {
    headers: { "X-Api-Key": NINJAS_API_KEY },
  });
  if (!res.ok) throw new Error(`API Ninjas error ${res.status} for ${name}`);
  const data = (await res.json()) as { price?: number; updated?: number };
  return data.price ?? 0;
}

/**
 * Fetch current quotes for the three CBOT futures via API Ninjas.
 */
export async function fetchLiveQuotes(): Promise<LiveQuote> {
  const [oilPrice, mealPrice, beanPrice] = await Promise.all([
    fetchCommodity("soybean_oil"),
    fetchCommodity("soybean_meal"),
    fetchCommodity("soybean"),
  ]);

  const ratio = mealPrice > 0 ? (oilPrice / mealPrice) * 100 : 0;

  return {
    oil_chicago: oilPrice,
    meal_chicago: mealPrice,
    bean_chicago: beanPrice,
    oil_meal_ratio: ratio,
    timestamp: new Date().toISOString(),
    market_state: "LIVE",
  };
}

/**
 * Persist today's live prices into SQLite so history stays current.
 * Called on startup and weekly via cron.
 */
export async function syncHistoricalData(): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  try {
    const quote = await fetchLiveQuotes();
    const dateStr = new Date().toISOString().slice(0, 10);
    const { oil_chicago, meal_chicago, bean_chicago, oil_meal_ratio } = quote;

    // oil_chicago en ¢/lb → USD/ton: multiplicar por 22.0462 (lb por tonelada métrica)
    const oilChicagoUsdTon = oil_chicago * 22.0462;
    const oilRosario = parseFloat((oilChicagoUsdTon - 60).toFixed(2)); // basis Rosario ≈ -60 USD/ton
    const mealRosario = parseFloat((meal_chicago - 15).toFixed(2)); // basis Rosario ≈ -15 USD/ton

    const existing = db.select().from(priceData).where(eq(priceData.date, dateStr)).get();

    if (existing) {
      db.update(priceData)
        .set({ oil_chicago, meal_chicago, bean_chicago, oil_meal_ratio, oil_rosario: oilRosario, meal_rosario: mealRosario })
        .where(eq(priceData.date, dateStr))
        .run();
      updated++;
    } else {
      db.insert(priceData).values({
        date: dateStr,
        oil_chicago,
        meal_chicago,
        bean_chicago,
        oil_meal_ratio,
        spread: oil_chicago - meal_chicago / 10,
        oil_rosario: oilRosario,
        meal_rosario: mealRosario,
      }).run();
      inserted++;
    }

    console.log(`[ninjas] sync complete — inserted: ${inserted}, updated: ${updated}`);
  } catch (err) {
    console.error("[ninjas] sync error:", err);
  }

  return { inserted, updated };
}
