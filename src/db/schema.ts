import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const countries = pgTable("countries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  iso2: text("iso2").notNull(),
  iso3: text("iso3"),
  capital: text("capital"),
  currency: text("currency"),
  timezone: text("timezone")
})

export const states = pgTable("states", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  country_id: uuid("country_id").references(() => countries.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
});

export const cities = pgTable("cities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  state_id: uuid("state_id").references(() => states.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  country_id: uuid("country_id").references(() => countries.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
});
