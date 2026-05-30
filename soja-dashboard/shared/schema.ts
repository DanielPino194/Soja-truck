import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const priceData = sqliteTable("price_data", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  oil_chicago: real("oil_chicago").notNull(),
  meal_chicago: real("meal_chicago").notNull(),
  bean_chicago: real("bean_chicago").notNull(),
  oil_meal_ratio: real("oil_meal_ratio").notNull(),
  spread: real("spread").notNull(),
  oil_rosario: real("oil_rosario").notNull(),
  meal_rosario: real("meal_rosario").notNull(),
});

export const shockEvents = sqliteTable("shock_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  type: text("type").notNull(), // "palm_oil", "port_strike", "weather", "policy"
  title: text("title").notNull(),
  description: text("description").notNull(),
  impact: text("impact").notNull(), // "high", "medium", "low"
  oil_impact_pct: real("oil_impact_pct"),
  meal_impact_pct: real("meal_impact_pct"),
});

export const insertPriceDataSchema = createInsertSchema(priceData).omit({ id: true });
export const insertShockEventSchema = createInsertSchema(shockEvents).omit({ id: true });

export type PriceData = typeof priceData.$inferSelect;
export type InsertPriceData = z.infer<typeof insertPriceDataSchema>;
export type ShockEvent = typeof shockEvents.$inferSelect;
export type InsertShockEvent = z.infer<typeof insertShockEventSchema>;
