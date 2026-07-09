import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const qaRuns = pgTable("qa_runs", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  siteTitle: text("site_title"),
  siteFavicon: text("site_favicon"),
  siteHeadings: jsonb("site_headings"),
  siteImages: jsonb("site_images"),
  siteLinks: jsonb("site_links"),
  siteHeadingInversion: jsonb("site_heading_inversion"),
  siteBrokenImages: jsonb("site_broken_images"),
  siteLinkTransition: text("site_link_transition"),
  siteOverflows: jsonb("site_overflows"),
  siteSections: jsonb("site_sections"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const qaBreakpoints = pgTable("qa_breakpoints", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .references(() => qaRuns.id)
    .notNull(),
  dims: text("dims").notNull(),
  category: text("category").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  overflows: jsonb("overflows"),
  hiddenSections: jsonb("hidden_sections"),
  hamburgerDetected: boolean("hamburger_detected").default(false),
  hamburgerLinks: jsonb("hamburger_links"),
  sectionBounds: jsonb("section_bounds"),
  screenshotBlobUrl: text("screenshot_blob_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
