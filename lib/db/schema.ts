import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const qaSessions = pgTable("qa_sessions", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  siteSlug: text("site_slug").notNull(),
  status: text("status").notNull().default("completed"),
  siteWideData: jsonb("site_wide_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const qaBreakpoints = pgTable("qa_breakpoints", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => qaSessions.id, { onDelete: "cascade" }),
  dims: text("dims").notNull(),
  category: text("category").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  screenshotBlobUrl: text("screenshot_blob_url").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const qaImages = pgTable("qa_images", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => qaSessions.id, { onDelete: "cascade" }),
  breakpointId: integer("breakpoint_id").references(
    () => qaBreakpoints.id,
    { onDelete: "set null" },
  ),
  src: text("src").notNull(),
  alt: text("alt").notNull().default(""),
  naturalWidth: integer("natural_width").notNull().default(0),
  naturalHeight: integer("natural_height").notNull().default(0),
  visible: boolean("visible").notNull().default(false),
  broken: boolean("broken").notNull().default(false),
  selector: text("selector").notNull().default(""),
  xpath: text("xpath").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
