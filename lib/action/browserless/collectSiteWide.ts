"use server";

import { fetchData } from "./fetch";
import { BROWSER_HELPERS, buildScrollCode } from "./helpers";

export interface HeadingInfo {
  tag: string;
  text: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
  selector: string;
  xpath: string;
}

export interface ImageInfo {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  alt: string;
  visible: boolean;
  selector: string;
  xpath: string;
  parentSelector: string;
  parentXpath: string;
}

export interface LinkInfo {
  href: string | null;
  text: string;
  isEmpty: boolean;
  isPlaceholder: boolean;
  selector: string;
  xpath: string;
}

export interface OverflowInfo {
  tag: string;
  class: string;
  width: number;
  innerWidth: number;
  selector: string;
  xpath: string;
  parentSelector: string;
  parentXpath: string;
}

export interface SectionInfo {
  index: number;
  tag: string;
  class: string;
  top: number;
  height: number;
  width: number;
  textPreview: string;
  selector: string;
  xpath: string;
  label: string;
}

export interface SiteWideData {
  title: string;
  url: string;
  headings: HeadingInfo[];
  images: ImageInfo[];
  links: LinkInfo[];
  favicon: string | null;
  headingInversion: { tag: string; size: number; previousSize: number } | null;
  brokenImages: ImageInfo[];
  linkTransition: string | null;
  overflows: OverflowInfo[];
  sections: SectionInfo[];
}

const EXTRACTION_CODE = `
${BROWSER_HELPERS}

const results = {
  title: document.title,
  url: window.location.href,
  headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(function(h) {
    const cs = getComputedStyle(h);
    return {
      tag: h.tagName,
      text: h.innerText.trim() || h.textContent.trim(),
      fontSize: cs.fontSize,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      color: cs.color,
      selector: getSelector(h),
      xpath: getXPath(h)
    };
  }),
  images: Array.from(document.images).map(function(img) {
    return {
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      alt: img.alt,
      visible: !!(img.offsetWidth || img.offsetHeight || img.getClientRects().length),
      selector: getSelector(img),
      xpath: getXPath(img),
      parentSelector: getVisibleParentSelector(img),
      parentXpath: getVisibleParentXPath(img)
    };
  }),
  links: Array.from(document.querySelectorAll('a')).map(function(a) {
    return {
      href: a.getAttribute('href'),
      text: a.innerText.trim(),
      isEmpty: !a.getAttribute('href') || a.getAttribute('href') === '',
      isPlaceholder: a.getAttribute('href') === '#',
      selector: getSelector(a),
      xpath: getXPath(a)
    };
  }),
  favicon: (function () {
    const link = document.querySelector('link[rel~="icon"]');
    return link ? link.href : null;
  })()
};

var sizes = {};
results.headings.forEach(function(h) {
  var px = parseFloat(h.fontSize);
  if (!isNaN(px) && !sizes[h.tag]) sizes[h.tag] = px;
});
var order = ['H1','H2','H3','H4','H5','H6'];
var lastSize = Infinity;
var inversion = null;
for (var i = 0; i < order.length; i++) {
  var tag = order[i];
  if (sizes[tag] !== undefined) {
    if (sizes[tag] > lastSize) {
      inversion = { tag: tag, size: sizes[tag], previousSize: lastSize };
      break;
    }
    lastSize = sizes[tag];
  }
}
results.headingInversion = inversion;

results.brokenImages = results.images.filter(function(i) {
  return i.naturalWidth === 0 && i.naturalHeight === 0 && i.src && !i.src.endsWith('.svg');
});

var sampleLink = document.querySelector('a[href]:not([href="#"])');
if (sampleLink) {
  var styles = getComputedStyle(sampleLink);
  results.linkTransition = styles.transitionDuration;
} else {
  results.linkTransition = null;
}

var overflows = [];
document.querySelectorAll('*').forEach(function(el) {
  var rect = el.getBoundingClientRect();
  var computed = getComputedStyle(el);
  if (rect.width > window.innerWidth && computed.overflowX !== 'hidden' && computed.position !== 'fixed' && computed.position !== 'absolute') {
    overflows.push({
      tag: el.tagName,
      class: el.className,
      width: rect.width,
      innerWidth: window.innerWidth,
      selector: getSelector(el),
      xpath: getXPath(el),
      parentSelector: getVisibleParentSelector(el),
      parentXpath: getVisibleParentXPath(el)
    });
  }
});
results.overflows = overflows.slice(0, 50);

var sections = [];
var candidates = document.querySelectorAll('section, [class*="section"], [class*="hero"], [class*="header"], [class*="footer"], [class*="testimonial"], [class*="feature"]');
candidates.forEach(function(el, idx) {
  var rect = el.getBoundingClientRect();
  if (rect.height > 50) {
    sections.push({
      index: idx,
      tag: el.tagName,
      class: el.className.substring(0, 100),
      top: Math.round(rect.top),
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      textPreview: el.innerText.trim().substring(0, 150).replace(/\\s+/g, ' '),
      selector: getSelector(el),
      xpath: getXPath(el),
      label: getSectionLabel(el)
    });
  }
});
results.sections = sections;

return results;
`;

const FUNCTION_CODE = `
export default async function({ page, context }) {
  await page.goto(context.url, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1920, height: 1080 });

  await page.evaluate(${JSON.stringify(buildScrollCode())});
  await page.waitForTimeout(2000);

  var data = await page.evaluate(function() {
    ${EXTRACTION_CODE}
  });

  return data;
}
`;

export async function collectSiteWide(url: string): Promise<SiteWideData> {
  const result = await fetchData(
    { code: FUNCTION_CODE, context: { url } },
    "function"
  );
  return result as SiteWideData;
}
