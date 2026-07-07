import puppeteer, { type Page } from "puppeteer-core";
import { getChromiumPath } from "@/lib/browser/index";
import { BREAKPOINTS } from "./breakpoints";

export type BreakpointCategory = "desktop" | "ipad" | "mobile";

export interface Breakpoint {
  width: number;
  height: number;
  category: BreakpointCategory;
}

export interface QaBreakpointResult {
  dims: string;
  category: BreakpointCategory;
  data: unknown;
  screenshot: Buffer;
}

export interface QaCollectionResult {
  siteWide: unknown;
  breakpoints: QaBreakpointResult[];
}

/**
 * Port of lib/puppeteer/example.sh to Puppeteer.
 *
 * The bash script drove the `agent-browser` CLI in four phases:
 *   1. Open the page at 1920x1080 and trigger lazy content via scroll.
 *   2. Collect site-wide DOM data (headings, images, links, sections, overflow...).
 *   3. Iterate responsive breakpoints: resize, scroll, full-page screenshot, per-breakpoint data.
 *   4. Close the browser.
 *
 * Here each `agent-browser eval --stdin <script>` becomes `page.evaluate(fn, ...args)`,
 * which returns a real JS object, so we skip the bash "is the stdout valid JSON?" guessing
 * and just `JSON.stringify` what evaluate gives us. Viewport dimensions are passed as
 * function arguments instead of shell-string-interpolated into the source.
 */



const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Slugify a URL's hostname the same way the bash sed did: strip scheme + www + path. */
export function slugFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "site";
  }
}

export function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours(),
  )}-${p(d.getMinutes())}`;
}

export function dimsLabel(bp: Breakpoint): string {
  return `${bp.width}x${bp.height}`;
}

/** Scroll the page to the bottom in steps of one viewport to trigger lazy-loads / animations. */
async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const step = window.innerHeight || 800;
    const maxScroll = document.body.scrollHeight;
    let y = 0;
    while (y < maxScroll) {
      y += step;
      window.scrollTo(0, y);
    }
  });
}

/**
 * Phase 2 of the bash script: site-wide data. Runs once at desktop width.
 * These helpers run inside the browser context (serialized by page.evaluate),
 * so DOM globals are available there; the outer TS types are only advisory.
 */
async function collectSiteWide(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    function getSelector(el: Element | null): string {
      if (!el || el === document.body || el === document.documentElement)
        return el ? el.tagName.toLowerCase() : "";
      if (el.id) return "#" + el.id;
      const parts: string[] = [];
      let c: Element | null = el;
      while (c && c !== document.body && c !== document.documentElement) {
        if (c.nodeType !== 1) break;
        let s = c.tagName.toLowerCase();
        if ((c as HTMLElement).id) {
          s = "#" + (c as HTMLElement).id;
          parts.unshift(s);
          break;
        }
        const cn = (c as HTMLElement).className;
        if (cn && typeof cn === "string") {
          const cls = cn.trim().replace(/\s+/g, ".");
          if (cls) s += "." + cls;
        }
        const p = c.parentElement;
        if (p) {
          const siblings = Array.from(p.children).filter(
            (x) => x.tagName === c!.tagName,
          );
          if (siblings.length > 1)
            s += `:nth-of-type(${siblings.indexOf(c!) + 1})`;
        }
        parts.unshift(s);
        c = c.parentElement;
      }
      return parts.join(" > ");
    }
    function getXPath(el: Element | null): string {
      if (!el || el.nodeType !== 1) return "";
      if (el.id) return `//*[@id="${el.id}"]`;
      const parts: string[] = [];
      let c: Element | null = el;
      while (c && c !== document.body && c !== document.documentElement) {
        if (c.nodeType !== 1) break;
        const tag = c.tagName.toLowerCase();
        let idx = 1;
        let sib = c.previousElementSibling;
        while (sib) {
          if (sib.tagName === c.tagName) idx++;
          sib = sib.previousElementSibling;
        }
        parts.unshift(`${tag}[${idx}]`);
        c = c.parentElement;
      }
      return "//" + parts.join("/");
    }
    function getVisibleParentSelector(el: Element | null): string {
      if (!el || el.nodeType !== 1) return "";
      let p = el.parentElement;
      while (p && p !== document.body && p !== document.documentElement) {
        const cs = getComputedStyle(p);
        if (
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          (p.offsetWidth > 0 || p.offsetHeight > 0)
        )
          return getSelector(p);
        p = p.parentElement;
      }
      return "";
    }
    function getVisibleParentXPath(el: Element | null): string {
      if (!el || el.nodeType !== 1) return "";
      let p = el.parentElement;
      while (p && p !== document.body && p !== document.documentElement) {
        const cs = getComputedStyle(p);
        if (
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          (p.offsetWidth > 0 || p.offsetHeight > 0)
        )
          return getXPath(p);
        p = p.parentElement;
      }
      return "";
    }
    function getSectionLabel(el: Element): string {
      const h = el.querySelector("h1,h2,h3,h4,h5,h6");
      if (h && (h as HTMLElement).innerText.trim())
        return (h as HTMLElement).innerText.trim().substring(0, 60);
      const lbl =
        el.getAttribute("aria-label") ||
        el.getAttribute("data-label") ||
        el.getAttribute("title");
      if (lbl) return lbl.substring(0, 60);
      const txt = (el as HTMLElement).innerText.trim();
      if (txt) {
        const words = txt.split(/\s+/).slice(0, 5);
        return words.join(" ") + (txt.split(/\s+/).length > 5 ? "\u2026" : "");
      }
      return el.className
        ? el.className.split(" ")[0].substring(0, 40)
        : el.tagName.toLowerCase();
    }

    const headings = Array.from(
      document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
    ).map((h) => {
      const cs = getComputedStyle(h);
      return {
        tag: h.tagName,
        text: (h as HTMLElement).innerText.trim() || h.textContent!.trim(),
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        color: cs.color,
        selector: getSelector(h),
        xpath: getXPath(h),
      };
    });

    const images = Array.from(document.images).map((img) => ({
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      alt: img.alt,
      visible: !!(
        img.offsetWidth ||
        img.offsetHeight ||
        img.getClientRects().length
      ),
      selector: getSelector(img),
      xpath: getXPath(img),
      parentSelector: getVisibleParentSelector(img),
      parentXpath: getVisibleParentXPath(img),
    }));

    const links = Array.from(document.querySelectorAll("a")).map((a) => ({
      href: a.getAttribute("href"),
      text: (a as HTMLElement).innerText.trim(),
      isEmpty: !a.getAttribute("href") || a.getAttribute("href") === "",
      isPlaceholder: a.getAttribute("href") === "#",
      selector: getSelector(a),
      xpath: getXPath(a),
    }));

    const faviconLink = document.querySelector('link[rel~="icon"]');
    const favicon = faviconLink ? faviconLink.getAttribute("href") : null;

    // Heading size descending rule: h1 > h2 > h3 > h4 > h5 > h6
    const sizes: Record<string, number> = {};
    headings.forEach((h) => {
      const px = Number.parseFloat(h.fontSize);
      if (!Number.isNaN(px) && sizes[h.tag] === undefined) sizes[h.tag] = px;
    });
    const order = ["H1", "H2", "H3", "H4", "H5", "H6"];
    let lastSize = Infinity;
    let inversion: { tag: string; size: number; previousSize: number } | null =
      null;
    for (const tag of order) {
      if (sizes[tag] !== undefined) {
        if (sizes[tag] > lastSize) {
          inversion = { tag, size: sizes[tag], previousSize: lastSize };
          break;
        }
        lastSize = sizes[tag];
      }
    }

    const brokenImages = images.filter(
      (i) =>
        i.naturalWidth === 0 &&
        i.naturalHeight === 0 &&
        i.src &&
        !i.src.endsWith(".svg"),
    );

    let linkTransition: string | null = null;
    const sampleLink = document.querySelector('a[href]:not([href="#"])');
    if (sampleLink) {
      linkTransition = getComputedStyle(sampleLink).transitionDuration;
    }

    const overflows: unknown[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const computed = getComputedStyle(el);
      if (
        rect.width > window.innerWidth &&
        computed.overflowX !== "hidden" &&
        computed.position !== "fixed" &&
        computed.position !== "absolute"
      ) {
        overflows.push({
          tag: el.tagName,
          class: el.className,
          width: rect.width,
          innerWidth: window.innerWidth,
          selector: getSelector(el),
          xpath: getXPath(el),
          parentSelector: getVisibleParentSelector(el),
          parentXpath: getVisibleParentXPath(el),
        });
      }
    });

    const sections: unknown[] = [];
    const candidates = document.querySelectorAll(
      'section, [class*="section"], [class*="hero"], [class*="header"], [class*="footer"], [class*="testimonial"], [class*="feature"]',
    );
    candidates.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 50) {
        sections.push({
          index: idx,
          tag: el.tagName,
          class: el.className.substring(0, 100),
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          textPreview: (el as HTMLElement).innerText
            .trim()
            .substring(0, 150)
            .replace(/\s+/g, " "),
          selector: getSelector(el),
          xpath: getXPath(el),
          label: getSectionLabel(el),
        });
      }
    });

    return {
      title: document.title,
      url: window.location.href,
      headings,
      images,
      links,
      favicon,
      headingInversion: inversion,
      brokenImages,
      linkTransition,
      overflows: overflows.slice(0, 50),
      sections,
    };
  });
}

/**
 * Phase 3 of the bash script: per-breakpoint data. Viewport dimensions and
 * category are passed as args (the bash version interpolated them into the source).
 */
async function collectBreakpoint(page: Page, bp: Breakpoint): Promise<unknown> {
  return page.evaluate(
    (w: number, h: number, category: BreakpointCategory) => {
      function getSelector(el: Element | null): string {
        if (!el || el === document.body || el === document.documentElement)
          return el ? el.tagName.toLowerCase() : "";
        if (el.id) return "#" + el.id;
        const parts: string[] = [];
        let c: Element | null = el;
        while (c && c !== document.body && c !== document.documentElement) {
          if (c.nodeType !== 1) break;
          let s = c.tagName.toLowerCase();
          if ((c as HTMLElement).id) {
            s = "#" + (c as HTMLElement).id;
            parts.unshift(s);
            break;
          }
          const cn = (c as HTMLElement).className;
          if (cn && typeof cn === "string") {
            const cls = cn.trim().replace(/\s+/g, ".");
            if (cls) s += "." + cls;
          }
          const p = c.parentElement;
          if (p) {
            const siblings = Array.from(p.children).filter(
              (x) => x.tagName === c!.tagName,
            );
            if (siblings.length > 1)
              s += `:nth-of-type(${siblings.indexOf(c!) + 1})`;
          }
          parts.unshift(s);
          c = c.parentElement;
        }
        return parts.join(" > ");
      }
      function getXPath(el: Element | null): string {
        if (!el || el.nodeType !== 1) return "";
        if (el.id) return `//*[@id="${el.id}"]`;
        const parts: string[] = [];
        let c: Element | null = el;
        while (c && c !== document.body && c !== document.documentElement) {
          if (c.nodeType !== 1) break;
          const tag = c.tagName.toLowerCase();
          let idx = 1;
          let sib = c.previousElementSibling;
          while (sib) {
            if (sib.tagName === c.tagName) idx++;
            sib = sib.previousElementSibling;
          }
          parts.unshift(`${tag}[${idx}]`);
          c = c.parentElement;
        }
        return "//" + parts.join("/");
      }
      function getVisibleParentSelector(el: Element | null): string {
        if (!el || el.nodeType !== 1) return "";
        let p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
          const cs = getComputedStyle(p);
          if (
            cs.display !== "none" &&
            cs.visibility !== "hidden" &&
            (p.offsetWidth > 0 || p.offsetHeight > 0)
          )
            return getSelector(p);
          p = p.parentElement;
        }
        return "";
      }
      function getVisibleParentXPath(el: Element | null): string {
        if (!el || el.nodeType !== 1) return "";
        let p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
          const cs = getComputedStyle(p);
          if (
            cs.display !== "none" &&
            cs.visibility !== "hidden" &&
            (p.offsetWidth > 0 || p.offsetHeight > 0)
          )
            return getXPath(p);
          p = p.parentElement;
        }
        return "";
      }
      function getSectionLabel(el: Element): string {
        const h = el.querySelector("h1,h2,h3,h4,h5,h6");
        if (h && (h as HTMLElement).innerText.trim())
          return (h as HTMLElement).innerText.trim().substring(0, 60);
        const lbl =
          el.getAttribute("aria-label") ||
          el.getAttribute("data-label") ||
          el.getAttribute("title");
        if (lbl) return lbl.substring(0, 60);
        const txt = (el as HTMLElement).innerText.trim();
        if (txt) {
          const words = txt.split(/\s+/).slice(0, 5);
          return (
            words.join(" ") + (txt.split(/\s+/).length > 5 ? "\u2026" : "")
          );
        }
        return el.className
          ? el.className.split(" ")[0].substring(0, 40)
          : el.tagName.toLowerCase();
      }
      function findParentSection(el: Element): string {
        const sectionSelectors = [
          "section",
          '[class*="hero"]',
          '[class*="section"]',
          '[class*="header"]',
          '[class*="footer"]',
          '[class*="feature"]',
          '[class*="testimonial"]',
        ];
        let current: Element | null = el.parentElement;
        while (
          current &&
          current !== document.body &&
          current !== document.documentElement
        ) {
          for (const sel of sectionSelectors) {
            if (current?.matches?.(sel)) return getSectionLabel(current);
          }
          current = current?.parentElement ?? null;
        }
        return "";
      }

      const results = {
        viewport: {
          width: w,
          height: h,
          category,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        },
        overflows: [] as unknown[],
        hiddenSections: [] as unknown[],
        hamburgerDetected: false,
        hamburgerLinks: [] as string[],
        sectionBounds: [],
      };

      document.querySelectorAll("*").forEach((el) => {
        const rect = el.getBoundingClientRect();
        const computed = getComputedStyle(el);
        if (
          rect.width > window.innerWidth + 2 &&
          computed.overflowX !== "hidden" &&
          computed.position !== "fixed" &&
          computed.position !== "absolute" &&
          el.tagName !== "HTML" &&
          el.tagName !== "BODY"
        ) {
          results.overflows.push({
            tag: el.tagName,
            class: el.className.substring(0, 80),
            width: Math.round(rect.width),
            vw: window.innerWidth,
            selector: getSelector(el),
            xpath: getXPath(el),
            parentSelector: getVisibleParentSelector(el),
            parentXpath: getVisibleParentXPath(el),
            sectionLabel: findParentSection(el),
          });
        }
      });

      const seen = new Set<string>();
      results.overflows = results.overflows
        .filter((o) => {
          const item = o as { tag: string; class: string };
          const key = item.tag + "|" + item.class;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 30);

      const sectionSelectors = [
        "header",
        "footer",
        "section",
        '[class*="hero"]',
        '[class*="section"]',
        '[class*="feature"]',
        '[class*="testimonial"]',
      ];
      sectionSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.height === 0) {
            results.hiddenSections.push({
              selector: sel,
              class: el.className.substring(0, 80),
              elementSelector: getSelector(el),
              xpath: getXPath(el),
              parentSelector: getVisibleParentSelector(el),
              parentXpath: getVisibleParentXPath(el),
              label: getSectionLabel(el),
            });
          }
        });
      });

      if (category === "mobile") {
        const hamburgerSelectors = [
          'button[class*="hamburger"]',
          'button[class*="menu"]',
          '[class*="hamburger"]',
          '[class*="navbar-toggler"]',
          '[aria-label*="menu"]',
          "button:has(.bar)",
          '[class*="toggle"]',
        ];
        for (const sel of hamburgerSelectors) {
          const btn = document.querySelector(sel) as HTMLElement | null;
          if (btn && btn.offsetParent !== null) {
            results.hamburgerDetected = true;
            btn.click();
            const start = Date.now();
            while (Date.now() - start < 500) {
              /* spin briefly to let the menu open */
            }
            const navLinks = document.querySelectorAll(
              'nav a, [class*="menu"] a, [class*="nav"] a, .mobile-menu a',
            );
            results.hamburgerLinks = Array.from(navLinks)
              .map((a) => (a as HTMLElement).innerText.trim())
              .filter(Boolean);
            break;
          }
        }
      }

      return results;
    },
    bp.width,
    bp.height,
    bp.category,
  );
}

/**
 * Run the full QA data collection (port of example.sh) against `url`.
 * Returns collected data in memory — screenshots as Buffers, JSON data as objects.
 * The caller is responsible for persisting results to disk.
 */
export async function collectQaData(
  url: string,
): Promise<QaCollectionResult> {
  if (!url) throw new Error("collectQaData: url is required");

  console.log("=== QA Collection Start ===");
  console.log("Site:", url);

  const executablePath = await getChromiumPath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const breakpoints: QaBreakpointResult[] = [];

  try {
    const page = await browser.newPage();

    console.log("\n[1/4] Opening site at 1920x1080...");

    await page.evaluateOnNewDocument(() => {
      (window as any).__name = (target: any, value: string) => {
        Object.defineProperty(target, "name", { value, configurable: true });
        return target;
      };
    });

    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("        Scrolling to bottom to trigger lazy content...");
    await scrollToBottom(page);
    await wait(2000);

    console.log("[2/4] Collecting site-wide data...");
    const siteWide = await collectSiteWide(page);

    console.log("[3/4] Testing responsive breakpoints...");
    for (const bp of BREAKPOINTS) {
      const dims = dimsLabel(bp);
      console.log(`  → ${dims} (${bp.category})`);

      await page.setViewport({ width: bp.width, height: bp.height });
      await wait(1500);

      await scrollToBottom(page);
      await wait(1500);

      const screenshot = await page.screenshot({ fullPage: true }) as Buffer;

      const bpData = await collectBreakpoint(page, bp);

      breakpoints.push({ dims, category: bp.category, data: bpData, screenshot });
    }

    console.log("[4/4] Closing browser...");

    console.log("\n=== QA Collection Complete ===");

    return { siteWide, breakpoints };
  } finally {
    await browser.close().catch(() => { });
  }
}

export default collectQaData;
