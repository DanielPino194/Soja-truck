import { Database } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import { priceData, shockEvents } from "@shared/schema";
import type { PriceData, InsertPriceData, ShockEvent, InsertShockEvent } from "@shared/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve("data.db");
const sqlite = new BetterSqlite3(DB_PATH);
export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS price_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    oil_chicago REAL NOT NULL,
    meal_chicago REAL NOT NULL,
    bean_chicago REAL NOT NULL,
    oil_meal_ratio REAL NOT NULL,
    spread REAL NOT NULL,
    oil_rosario REAL NOT NULL,
    meal_rosario REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shock_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT NOT NULL,
    oil_impact_pct REAL,
    meal_impact_pct REAL
  );
`);

export interface IStorage {
  getPriceData(): PriceData[];
  getPriceDataByRange(startDate: string, endDate: string): PriceData[];
  getLatestPrice(): PriceData | undefined;
  insertPriceData(data: InsertPriceData[]): void;
  getShockEvents(): ShockEvent[];
  insertShockEvent(event: InsertShockEvent): ShockEvent;
  countPriceData(): number;
  countShockEvents(): number;
}

export class Storage implements IStorage {
  getPriceData(): PriceData[] {
    return db.select().from(priceData).all();
  }

  getPriceDataByRange(startDate: string, endDate: string): PriceData[] {
    return db.select().from(priceData)
      .where(and(gte(priceData.date, startDate), lte(priceData.date, endDate)))
      .all();
  }

  getLatestPrice(): PriceData | undefined {
    const results = db.select().from(priceData).all();
    if (results.length === 0) return undefined;
    return results.sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  insertPriceData(data: InsertPriceData[]): void {
    const insert = db.insert(priceData);
    for (const row of data) {
      db.insert(priceData).values(row).run();
    }
  }

  getShockEvents(): ShockEvent[] {
    return db.select().from(shockEvents).all();
  }

  insertShockEvent(event: InsertShockEvent): ShockEvent {
    return db.insert(shockEvents).values(event).returning().get();
  }

  countPriceData(): number {
    const results = db.select().from(priceData).all();
    return results.length;
  }

  countShockEvents(): number {
    const results = db.select().from(shockEvents).all();
    return results.length;
  }
}

export const storage = new Storage();
