/**
 * URL utility functions for normalization, validation, and path matching.
 */

/**
 * Validates that a string is a proper HTTP/HTTPS URL.
 */
export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a URL by removing fragments, trailing slashes, and sorting query params.
 */
export function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    url.hash = '';
    // Sort query parameters for consistency
    const params = new URLSearchParams(url.searchParams);
    const sorted = new URLSearchParams([...params.entries()].sort());
    url.search = sorted.toString();
    // Remove trailing slash (except for root)
    let normalized = url.toString();
    if (normalized.endsWith('/') && url.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return urlStr;
  }
}

/**
 * Extracts the domain (hostname) from a URL.
 */
export function getDomain(urlStr) {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null;
  }
}

/**
 * Extracts the base URL (origin) from a URL.
 */
export function getBaseUrl(urlStr) {
  try {
    return new URL(urlStr).origin;
  } catch {
    return null;
  }
}

/**
 * Checks if a URL belongs to the same domain as the base URL.
 */
export function isSameDomain(urlStr, baseUrlStr) {
  return getDomain(urlStr) === getDomain(baseUrlStr);
}

/**
 * Checks if a URL path matches a glob pattern like /blog/*
 */
export function pathMatchesPattern(urlStr, pattern) {
  try {
    const url = new URL(urlStr);
    const path = url.pathname;

    // Convert glob pattern to regex
    const regexStr = '^' + pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      + '$';

    return new RegExp(regexStr).test(path);
  } catch {
    return false;
  }
}

/**
 * Checks if a URL matches any of the include/exclude path patterns.
 */
export function shouldIncludeUrl(urlStr, includePaths = [], excludePaths = []) {
  // If includePaths is specified, URL must match at least one
  if (includePaths.length > 0) {
    const matches = includePaths.some(pattern => pathMatchesPattern(urlStr, pattern));
    if (!matches) return false;
  }

  // If excludePaths is specified, URL must NOT match any
  if (excludePaths.length > 0) {
    const excluded = excludePaths.some(pattern => pathMatchesPattern(urlStr, pattern));
    if (excluded) return false;
  }

  return true;
}

/**
 * Resolves a relative URL against a base URL.
 */
export function resolveUrl(relative, base) {
  try {
    return new URL(relative, base).toString();
  } catch {
    return null;
  }
}
