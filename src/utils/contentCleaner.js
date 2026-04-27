import * as cheerio from 'cheerio';

/**
 * Tags and selectors to remove from HTML before conversion.
 */
const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'link[rel="stylesheet"]',
  'meta',
  // Ads & tracking
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[class*="advert"]',
  '[id*="google_ads"]',
  '[class*="tracking"]',
  '[class*="analytics"]',
  // Cookie banners & popups
  '[class*="cookie"]',
  '[class*="consent"]',
  '[class*="popup"]',
  '[class*="modal"]',
  '[class*="overlay"]',
  // Social share buttons
  '[class*="share"]',
  '[class*="social"]',
  // Navigation & footer (when onlyMainContent)
  // These are handled separately
];

const NAV_SELECTORS = [
  'nav',
  'header',
  'footer',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[class*="navbar"]',
  '[class*="sidebar"]',
  '[class*="menu"]',
  '[class*="breadcrumb"]',
  '[class*="pagination"]',
  '[class*="footer"]',
  '[class*="header"]',
  '[id*="sidebar"]',
  '[id*="menu"]',
  '[id*="footer"]',
  '[id*="header"]',
];

/**
 * Clean HTML by removing unwanted elements.
 * @param {string} html - Raw HTML string
 * @param {object} options
 * @param {boolean} options.onlyMainContent - Remove nav, header, footer, sidebar
 * @param {string[]} options.includeTags - Only keep these tag types
 * @param {string[]} options.excludeTags - Remove these tag types
 * @returns {string} Cleaned HTML
 */
export function cleanHtml(html, options = {}) {
  const $ = cheerio.load(html);

  // Always remove scripts, styles, ads, etc.
  REMOVE_SELECTORS.forEach(sel => {
    try { $(sel).remove(); } catch { /* ignore invalid selectors */ }
  });

  // Remove navigation elements if onlyMainContent
  if (options.onlyMainContent) {
    NAV_SELECTORS.forEach(sel => {
      try { $(sel).remove(); } catch { /* ignore */ }
    });

    // Try to find main content container
    const mainContent = $('main, article, [role="main"], .content, .post, .entry, #content, #main').first();
    if (mainContent.length) {
      return mainContent.html() || $.html();
    }
  }

  // Apply includeTags filter — keep only specified tags
  if (options.includeTags && options.includeTags.length > 0) {
    const selector = options.includeTags.join(', ');
    const matched = $(selector);
    if (matched.length) {
      return matched.map((_, el) => $.html(el)).get().join('\n');
    }
  }

  // Apply excludeTags filter — remove specified tags
  if (options.excludeTags && options.excludeTags.length > 0) {
    options.excludeTags.forEach(tag => {
      try { $(tag).remove(); } catch { /* ignore */ }
    });
  }

  return $.html();
}

/**
 * Extract metadata from HTML.
 */
export function extractMetadata(html, url) {
  const $ = cheerio.load(html);

  return {
    title: $('title').first().text().trim() || $('h1').first().text().trim() || '',
    description: $('meta[name="description"]').attr('content') ||
                 $('meta[property="og:description"]').attr('content') || '',
    language: $('html').attr('lang') || '',
    ogTitle: $('meta[property="og:title"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || '',
    ogUrl: $('meta[property="og:url"]').attr('content') || '',
    favicon: $('link[rel="icon"]').attr('href') ||
             $('link[rel="shortcut icon"]').attr('href') || '',
    sourceURL: url,
    statusCode: 200,
  };
}

/**
 * Extract all links from HTML.
 */
export function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();

  $('a[href]').each((_, el) => {
    let href = $(el).attr('href');
    if (!href) return;

    // Skip anchors, javascript:, mailto:, tel:
    if (href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) return;

    // Resolve relative URLs
    try {
      const resolved = new URL(href, baseUrl).toString();
      links.add(resolved);
    } catch { /* skip invalid URLs */ }
  });

  return [...links];
}
