import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const otpSessions = pgTable("otp_sessions", {
  id: serial().primaryKey(),
  email: text().notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  firstName: text("first_name"),
  surname: text(),
  phone: text(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const authSessions = pgTable("auth_sessions", {
  id: serial().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  token: text().notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
