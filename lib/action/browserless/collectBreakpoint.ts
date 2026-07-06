"use server";

import { fetchData } from "./fetch";
import { BROWSER_HELPERS } from "./helpers";

export interface BreakpointData {
  viewport: {
    width: number;
    height: number;
    category: string;
    innerWidth: number;
    innerHeight: number;
  };
  overflows: Array<{
    tag: string;
    class: string;
    width: number;
    vw: number;
    selector: string;
    xpath: string;
    parentSelector: string;
    parentXpath: string;
    sectionLabel: string;
  }>;
  hiddenSections: Array<{
    selector: string;
    class: string;
    elementSelector: string;
    xpath: string;
    parentSelector: string;
    parentXpath: string;
    label: string;
  }>;
  hamburgerDetected: boolean;
  hamburgerLinks: string[];
}

export async function collectBreakpoint(
  url: string,
  width: number,
  height: number,
  category: "desktop" | "ipad" | "mobile"
): Promise<BreakpointData> {
  const code = `
export default async function({ page, context }) {
  await page.goto(context.url, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: ${width}, height: ${height} });
  await page.waitForTimeout(1500);

  await page.evaluate(function() {
    var scrollTop = 0;
    var step = window.innerHeight || 800;
    var maxScroll = document.body.scrollHeight;
    while (scrollTop < maxScroll) {
      scrollTop += step;
      window.scrollTo(0, scrollTop);
    }
  });
  await page.waitForTimeout(1500);

  var data = await page.evaluate(function() {
    ${BROWSER_HELPERS}

    function findParentSection(el) {
      var sectionSelectors = ['section', '[class*="hero"]', '[class*="section"]', '[class*="header"]', '[class*="footer"]', '[class*="feature"]', '[class*="testimonial"]'];
      var current = el.parentElement;
      while (current && current !== document.body && current !== document.documentElement) {
        for (var i = 0; i < sectionSelectors.length; i++) {
          if (current.matches && current.matches(sectionSelectors[i])) {
            return getSectionLabel(current);
          }
        }
        current = current.parentElement;
      }
      return '';
    }

    var results = {
      viewport: { width: ${width}, height: ${height}, category: '${category}', innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      overflows: [],
      hiddenSections: [],
      hamburgerDetected: false,
      hamburgerLinks: [],
      sectionBounds: []
    };

    document.querySelectorAll('*').forEach(function(el) {
      var rect = el.getBoundingClientRect();
      var computed = getComputedStyle(el);
      if (rect.width > window.innerWidth + 2 && computed.overflowX !== 'hidden' && computed.position !== 'fixed' && computed.position !== 'absolute' && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
        results.overflows.push({
          tag: el.tagName,
          class: el.className.substring(0, 80),
          width: Math.round(rect.width),
          vw: window.innerWidth,
          selector: getSelector(el),
          xpath: getXPath(el),
          parentSelector: getVisibleParentSelector(el),
          parentXpath: getVisibleParentXPath(el),
          sectionLabel: findParentSection(el)
        });
      }
    });

    var seen = new Set();
    results.overflows = results.overflows.filter(function(o) {
      var key = o.tag + '|' + o.class;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);

    var sectionSelectors = ['header', 'footer', 'section', '[class*="hero"]', '[class*="section"]', '[class*="feature"]', '[class*="testimonial"]'];
    sectionSelectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        var rect = el.getBoundingClientRect();
        if (rect.height === 0) {
          results.hiddenSections.push({
            selector: sel,
            class: el.className.substring(0, 80),
            elementSelector: getSelector(el),
            xpath: getXPath(el),
            parentSelector: getVisibleParentSelector(el),
            parentXpath: getVisibleParentXPath(el),
            label: getSectionLabel(el)
          });
        }
      });
    });

    if ('${category}' === 'mobile') {
      var hamburgerSelectors = [
        'button[class*="hamburger"]',
        'button[class*="menu"]',
        '[class*="hamburger"]',
        '[class*="navbar-toggler"]',
        '[aria-label*="menu"]',
        'button:has(.bar)',
        '[class*="toggle"]'
      ];
      for (var i = 0; i < hamburgerSelectors.length; i++) {
        var sel = hamburgerSelectors[i];
        var btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          results.hamburgerDetected = true;
          btn.click();
          var start = Date.now();
          while (Date.now() - start < 500) { /* spin */ }
          var navLinks = document.querySelectorAll('nav a, [class*="menu"] a, [class*="nav"] a, .mobile-menu a');
          results.hamburgerLinks = Array.from(navLinks).map(function(a) { return a.innerText.trim(); }).filter(Boolean);
          break;
        }
      }
    }

    return results;
  });

  return data;
}
`;

  const result = await fetchData(
    { code, context: { url } },
    "function"
  );
  return result as BreakpointData;
}
