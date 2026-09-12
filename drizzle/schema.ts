import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const environmentReadings = mysqlTable("environment_readings", {
  id: int("id").autoincrement().primaryKey(),
  station: varchar("station", { length: 32 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  temperatureC: double("temperature_c").notNull(),
  humidityPercent: double("humidity_percent").notNull(),
  pressureMbar: double("pressure_mbar").notNull(),
  windSpeedKnots: double("wind_speed_knots").notNull(),
  source: varchar("source", { length: 32 }).notNull().default("NCPOR"),
  dataType: mysqlEnum("data_type", ["REAL", "SIMULATED"]).notNull().default("REAL"),
});

export type EnvironmentReading = typeof environmentReadings.$inferSelect;
export type InsertEnvironmentReading = typeof environmentReadings.$inferInsert;
