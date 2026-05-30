// yahoo-finance2 v3 requires instantiation
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const YahooFinanceClass = require("yahoo-finance2").default;
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["ripHistorical"] });
import { db } from "./storage.js";
import { priceData } from "../shared/schema.js";
import { desc, eq } from "drizzle-orm";

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


/**
 * Fetch current quotes for the three CBOT futures
 */
export async function fetchLiveQuotes(): Promise<LiveQuote> {
  const [oil, meal, bean] = await Promise.all([
    yahooFinance.quote("ZL=F"),   // Soybean Oil Futures (¢/lb)
    yahooFinance.quote("ZM=F"),   // Soybean Meal Futures (USD/ton)
    yahooFinance.quote("ZS=F"),   // Soybean Futures (¢/bu)
  ]);

  const oilPrice = oil.regularMarketPrice ?? 0;
  const mealPrice = meal.regularMarketPrice ?? 0;
  const beanPrice = bean.regularMarketPrice ?? 0;
  const ratio = mealPrice > 0 ? (oilPrice / mealPrice) * 100 : 0;

  return {
    oil_chicago: oilPrice,
    meal_chicago: mealPrice,
    bean_chicago: beanPrice,
    oil_meal_ratio: ratio,
    timestamp: new Date().toISOString(),
    market_state: oil.marketState ?? "CLOSED",
  };
}

/**
 * Fetch 2-year weekly historical data and upsert into SQLite.
 * Called on first run and weekly via cron.
 */
export async function syncHistoricalData(): Promise<{ inserted: number; updated: number }> {
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(today.getFullYear() - 2);

  const queryOpts = {
    period1: twoYearsAgo,
    period2: today,
    interval: "1wk" as const,
  };

  const [oilHist, mealHist, beanHist] = await Promise.all([
    yahooFinance.historical("ZL=F", queryOpts),
    yahooFinance.historical("ZM=F", queryOpts),
    yahooFinance.historical("ZS=F", queryOpts),
  ]);

  // Index by ISO date string
  const mealMap = new Map(mealHist.map(r => [r.date.toISOString().slice(0, 10), r.close ?? 0]));
  const beanMap = new Map(beanHist.map(r => [r.date.toISOString().slice(0, 10), r.close ?? 0]));

  let inserted = 0;
  let updated = 0;

  for (const row of oilHist) {
    const dateStr = row.date.toISOString().slice(0, 10);
    const oilClose = row.close ?? 0;
    const mealClose = mealMap.get(dateStr) ?? 0;
    const beanClose = beanMap.get(dateStr) ?? 0;
    if (oilClose === 0 || mealClose === 0) continue;

    const ratio = (oilClose / mealClose) * 100;
    // Rosario basis approximation (±basis from Chicago)
    const oilRosario = parseFloat((oilClose * 22.046 / 100 - 1.5).toFixed(2));
    const mealRosario = parseFloat((mealClose / 10 + 0.8).toFixed(2));

    const existing = db.select().from(priceData).where(eq(priceData.date, dateStr)).get();

    if (existing) {
      db.update(priceData)
        .set({
          oil_chicago: oilClose,
          meal_chicago: mealClose,
          bean_chicago: beanClose,
          oil_meal_ratio: ratio,
          oil_rosario: oilRosario,
          meal_rosario: mealRosario,
        })
        .where(eq(priceData.date, dateStr))
        .run();
      updated++;
    } else {
      db.insert(priceData).values({
        date: dateStr,
        oil_chicago: oilClose,
        meal_chicago: mealClose,
        bean_chicago: beanClose,
        oil_meal_ratio: ratio,
        spread: oilClose - mealClose / 10,
        oil_rosario: oilRosario,
        meal_rosario: mealRosario,
      }).run();
      inserted++;
    }
  }

  console.log(`[yahoo] sync complete — inserted: ${inserted}, updated: ${updated}`);
  return { inserted, updated };
}
