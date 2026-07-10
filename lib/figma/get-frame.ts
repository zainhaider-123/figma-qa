import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { account } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types mirroring the Puppeteer automation.ts data shape, adapted for Figma
// ---------------------------------------------------------------------------

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: {
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
    italic?: boolean;
    textCase?: string;
    fills?: FigmaPaint[];
  };
  characters?: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  clipsContent?: boolean;
  layoutMode?: string;
  hyperlink?: { type?: string; url?: string };
}

interface FigmaPaint {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
  visible?: boolean;
  imageRef?: string;
  scaleMode?: string;
  gradientHandlePositions?: unknown[];
  gradientStops?: unknown[];
}

interface FigmaEffect {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  spread?: number;
}

export interface FigmaHeading {
  tag: string;
  text: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
  nodeId: string;
  nodeName: string;
}

export interface FigmaImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  alt: string;
  visible: boolean;
  nodeId: string;
  nodeName: string;
  parentNodeId: string;
  parentNodeName: string;
}

export interface FigmaLink {
  href: string;
  text: string;
  nodeId: string;
  nodeName: string;
}

export interface FigmaOverflow {
  tag: string;
  className: string;
  width: number;
  innerWidth: number;
  nodeId: string;
  nodeName: string;
  parentNodeId: string;
  parentNodeName: string;
  sectionLabel: string;
}

export interface FigmaSection {
  index: number;
  tag: string;
  className: string;
  top: number;
  height: number;
  width: number;
  textPreview: string;
  nodeId: string;
  nodeName: string;
  label: string;
}

export interface FigmaFrameData {
  title: string;
  fileKey: string;
  nodeId: string | null;
  headings: FigmaHeading[];
  images: FigmaImage[];
  links: FigmaLink[];
  headingInversion: { tag: string; size: number; previousSize: number } | null;
  brokenImages: FigmaImage[];
  linkTransition: string | null;
  overflows: FigmaOverflow[];
  sections: FigmaSection[];
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string | null;
}

function parseFigmaUrl(url: string): ParsedFigmaUrl {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error(
      "Invalid Figma URL. Expected format: https://www.figma.com/file/{fileKey}/...?node-id={nodeId}",
    );
  }

  const fileKey = match[1];
  let nodeId: string | null = null;

  try {
    const urlObj = new URL(url);
    nodeId = urlObj.searchParams.get("node-id");
  } catch {
    // URL constructor may throw on malformed URLs but the regex already matched
  }

  return { fileKey, nodeId };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getFigmaAccessToken(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error(
      "Not authenticated. Please sign in before accessing Figma frames.",
    );
  }

  const [figmaAccount] = await db
    .select({ accessToken: account.accessToken })
    .from(account)
    .where(
      and(eq(account.userId, session.user.id), eq(account.providerId, "figma")),
    )
    .limit(1);

  if (!figmaAccount?.accessToken) {
    throw new Error(
      "No Figma account connected. Please link your Figma account first.",
    );
  }

  return figmaAccount.accessToken;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function rgbaToString(
  color: { r: number; g: number; b: number; a: number },
  opacity = 1,
): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Math.round(color.a * opacity * 100) / 100;
  if (a >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getFillColor(node: FigmaNode): string {
  const fills = node.style?.fills || node.fills || [];
  for (const fill of fills) {
    if (fill.type === "SOLID" && fill.color) {
      return rgbaToString(fill.color, fill.opacity);
    }
  }
  return "none";
}

// ---------------------------------------------------------------------------
// Tree walker
// ---------------------------------------------------------------------------

function collectAllNodes(root: FigmaNode): FigmaNode[] {
  const result: FigmaNode[] = [];
  const stack: (FigmaNode | undefined)[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    result.push(node);
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }
  return result;
}

function buildParentMap(root: FigmaNode): Map<string, FigmaNode> {
  const map = new Map<string, FigmaNode>();
  const stack: (FigmaNode | undefined)[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.children) {
      for (const child of node.children) {
        map.set(child.id, node);
        stack.push(child);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function getSectionLabel(node: FigmaNode): string {
  if (!node.name) return node.type.toLowerCase();
  return node.name.substring(0, 60);
}

// ---------------------------------------------------------------------------
// Extractors — each mirrors a category from automation.ts
// ---------------------------------------------------------------------------

function extractHeadings(allNodes: FigmaNode[]): FigmaHeading[] {
  const headings: FigmaHeading[] = [];
  const levelPattern = /^h[1-6]$/i;

  for (const node of allNodes) {
    if (node.type !== "TEXT") continue;
    const text = (node.characters || "").trim();
    if (!text) continue;

    const fs = node.style?.fontSize ?? 16;
    const fw = node.style?.fontWeight ?? 400;

    const isHeadingByName = levelPattern.test(node.name);
    const isLarge = fs >= 18;
    const isBold = fw >= 600;

    if (!isHeadingByName && !isLarge && !isBold) continue;

    let tag = "p";
    if (isHeadingByName) {
      tag = node.name.match(levelPattern)?.[0]?.toLowerCase() ?? "h2";
    } else if (fs >= 32) {
      tag = "h1";
    } else if (fs >= 24) {
      tag = "h2";
    } else if (fs >= 20) {
      tag = "h3";
    } else if (fw >= 600) {
      tag = "h4";
    } else {
      tag = "h5";
    }

    headings.push({
      tag,
      text: text.substring(0, 200),
      fontSize: `${fs}px`,
      fontFamily: node.style?.fontFamily ?? "unknown",
      fontWeight: String(fw),
      color: getFillColor(node),
      nodeId: node.id,
      nodeName: node.name,
    });
  }

  return headings;
}

function extractImages(
  allNodes: FigmaNode[],
  parentMap: Map<string, FigmaNode>,
): FigmaImage[] {
  const images: FigmaImage[] = [];

  for (const node of allNodes) {
    const fills = node.fills ?? [];
    for (const fill of fills) {
      if (fill.type === "IMAGE" && fill.imageRef) {
        const bounds = node.absoluteBoundingBox;
        const parent = parentMap.get(node.id);
        images.push({
          src: fill.imageRef,
          naturalWidth: bounds?.width ?? 0,
          naturalHeight: bounds?.height ?? 0,
          alt: node.name,
          visible: fill.visible !== false,
          nodeId: node.id,
          nodeName: node.name,
          parentNodeId: parent?.id ?? "",
          parentNodeName: parent?.name ?? "",
        });
      }
    }
  }

  return images;
}

function extractLinks(allNodes: FigmaNode[]): FigmaLink[] {
  const links: FigmaLink[] = [];

  for (const node of allNodes) {
    if (node.type !== "TEXT") continue;

    const text = (node.characters || "").trim();
    if (!text) continue;

    if (node.hyperlink?.url) {
      links.push({
        href: node.hyperlink.url,
        text: text.substring(0, 200),
        nodeId: node.id,
        nodeName: node.name,
      });
    }
  }

  return links;
}

function extractHeadingInversion(
  headings: FigmaHeading[],
): FigmaFrameData["headingInversion"] {
  const sizes: Record<string, number> = {};

  for (const h of headings) {
    const px = Number.parseFloat(h.fontSize);
    if (!Number.isNaN(px) && sizes[h.tag] === undefined) {
      sizes[h.tag] = px;
    }
  }

  const order = ["h1", "h2", "h3", "h4", "h5", "h6"];
  let lastSize = Infinity;
  for (const tag of order) {
    if (sizes[tag] !== undefined) {
      if (sizes[tag] > lastSize) {
        return { tag, size: sizes[tag], previousSize: lastSize };
      }
      lastSize = sizes[tag];
    }
  }

  return null;
}

function extractOverflows(
  allNodes: FigmaNode[],
  parentMap: Map<string, FigmaNode>,
): FigmaOverflow[] {
  const overflows: FigmaOverflow[] = [];

  for (const node of allNodes) {
    const parent = parentMap.get(node.id);
    if (!parent) continue;

    const pBounds = parent.absoluteBoundingBox;
    const nBounds = node.absoluteBoundingBox;
    if (!pBounds || !nBounds) continue;

    if (nBounds.width > pBounds.width + 2) {
      overflows.push({
        tag: node.type,
        className: node.name.substring(0, 80),
        width: Math.round(nBounds.width),
        innerWidth: Math.round(pBounds.width),
        nodeId: node.id,
        nodeName: node.name,
        parentNodeId: parent.id,
        parentNodeName: parent.name,
        sectionLabel: getSectionLabel(parent),
      });
    }
  }

  const seen = new Set<string>();
  return overflows
    .filter((o) => {
      const key = `${o.tag}|${o.className}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

function extractSections(root: FigmaNode): FigmaSection[] {
  const sections: FigmaSection[] = [];

  const sectionTypes = new Set([
    "FRAME",
    "GROUP",
    "COMPONENT",
    "INSTANCE",
    "SECTION",
  ]);
  const children = root.children ?? [];

  children.forEach((child, idx) => {
    if (!sectionTypes.has(child.type)) return;

    const bounds = child.absoluteBoundingBox;
    if (!bounds || bounds.height <= 0) return;

    let allText = "";
    const descendants = collectAllNodes(child);
    for (const d of descendants) {
      if (d.type === "TEXT" && d.characters) {
        allText += `${d.characters} `;
      }
    }

    sections.push({
      index: idx,
      tag: child.type,
      className: child.name.substring(0, 100),
      top: Math.round(bounds.y),
      height: Math.round(bounds.height),
      width: Math.round(bounds.width),
      textPreview: allText.trim().substring(0, 150).replace(/\s+/g, " "),
      nodeId: child.id,
      nodeName: child.name,
      label: getSectionLabel(child),
    });
  });

  return sections;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function getFrame(url: string): Promise<FigmaFrameData> {
  const accessToken = await getFigmaAccessToken();
  const { fileKey, nodeId } = parseFigmaUrl(url);

  let apiUrl = `https://api.figma.com/v1/files/${fileKey}?geometry=paths`;
  if (nodeId) {
    apiUrl += `&ids=${encodeURIComponent(nodeId)}`;
  }

  const response = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Figma API error (${response.status}): ${body.slice(0, 500)}`,
    );
  }

  const raw = await response.json();

  let rootNode: FigmaNode;

  if (nodeId && raw.nodes) {
    const key = nodeId.replace("-", ":");
    const entry = raw.nodes[key];
    rootNode = entry?.document ?? entry;
  } else {
    rootNode = raw.document;
  }

  if (!rootNode) {
    throw new Error("Could not find the frame node in the Figma response.");
  }

  const allNodes = collectAllNodes(rootNode);
  const parentMap = buildParentMap(rootNode);
  const headings = extractHeadings(allNodes);
  const images = extractImages(allNodes, parentMap);
  const links = extractLinks(allNodes);
  const brokenImages = images.filter((i) => !i.src || i.naturalWidth === 0);

  return {
    title: rootNode.name || fileKey,
    fileKey,
    nodeId,
    headings,
    images,
    links,
    headingInversion: extractHeadingInversion(headings),
    brokenImages,
    linkTransition: null,
    overflows: extractOverflows(allNodes, parentMap),
    sections: extractSections(rootNode),
  };
}
