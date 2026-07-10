import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const siteQaRuns = pgTable("site_qa_runs", {
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

export const figmaQaRuns = pgTable("figma_qa_runs", {
  id: serial("id").primaryKey(),
  figmaUrl: text("figma_url").notNull(),
  fileKey: text("file_key").notNull(),
  nodeId: text("node_id"),
  title: text("title"),
  headings: jsonb("headings"),
  images: jsonb("images"),
  links: jsonb("links"),
  headingInversion: jsonb("heading_inversion"),
  brokenImages: jsonb("broken_images"),
  linkTransition: text("link_transition"),
  overflows: jsonb("overflows"),
  sections: jsonb("sections"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteQaBreakpoints = pgTable("site_qa_breakpoints", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .references(() => siteQaRuns.id)
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
