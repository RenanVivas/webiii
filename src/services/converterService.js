import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * HTML to Markdown converter using Turndown with GFM support.
 */
class ConverterService {
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-',
      hr: '---',
    });

    // Enable GitHub Flavored Markdown (tables, strikethrough, task lists)
    this.turndown.use(gfm);

    // Custom rules
    this._addCustomRules();
  }

  _addCustomRules() {
    // Remove empty links
    this.turndown.addRule('emptyLinks', {
      filter: (node) => {
        return node.nodeName === 'A' && (!node.textContent || !node.textContent.trim());
      },
      replacement: () => '',
    });

    // Handle images with alt text
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        if (!src) return '';
        return `![${alt}](${src})`;
      },
    });

    // Remove hidden elements
    this.turndown.addRule('hidden', {
      filter: (node) => {
        const style = node.getAttribute('style') || '';
        return style.includes('display: none') || style.includes('display:none') ||
               style.includes('visibility: hidden') || style.includes('visibility:hidden') ||
               node.getAttribute('hidden') !== null ||
               node.getAttribute('aria-hidden') === 'true';
      },
      replacement: () => '',
    });
  }

  /**
   * Convert HTML to clean Markdown.
   * @param {string} html - HTML string
   * @returns {string} Markdown string
   */
  htmlToMarkdown(html) {
    if (!html) return '';

    let markdown = this.turndown.turndown(html);

    // Post-processing cleanup
    markdown = markdown
      // Remove excessive blank lines (3+ → 2)
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing whitespace on lines
      .replace(/[ \t]+$/gm, '')
      // Trim
      .trim();

    return markdown;
  }
}

const converterService = new ConverterService();
export default converterService;
