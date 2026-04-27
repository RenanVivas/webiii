import scraperService from './scraperService.js';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * LLM-powered structured data extraction service.
 * Uses Google Gemini REST API to convert raw web content into structured JSON.
 */
class ExtractService {
  constructor() {
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  }

  /**
   * Extract structured data from one or more URLs.
   * @param {string[]} urls - URLs to extract from
   * @param {object} options
   * @param {string} options.prompt - What to extract
   * @param {object} options.schema - JSON Schema for output
   * @returns {object} Extracted data
   */
  async extract(urls, options = {}) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required for the /extract endpoint.');
    }

    const { prompt, schema } = options;

    if (!prompt && !schema) {
      throw new Error('Either "prompt" or "schema" is required for extraction.');
    }

    logger.info(`🧠 Extracting from ${urls.length} URL(s)`);

    // 1. Scrape all URLs and get markdown content
    const contents = [];
    for (const url of urls) {
      try {
        const result = await scraperService.scrape(url, {
          formats: ['markdown'],
          onlyMainContent: true,
        });
        contents.push({
          url,
          content: result.markdown || '',
          title: result.metadata?.title || '',
        });
      } catch (err) {
        logger.warn(`⚠️ Failed to scrape ${url} for extraction: ${err.message}`);
        contents.push({ url, content: '', title: '' });
      }
    }

    // 2. Build the LLM prompt
    const userPrompt = this._buildPrompt(contents, prompt, schema);

    // 3. Call Gemini REST API
    try {
      const response = await fetch(`${this.apiUrl}?key=${config.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // 4. Parse the response as JSON
      const extracted = this._parseJsonResponse(text);

      logger.info(`✅ Extraction completed for ${urls.length} URL(s)`);
      return extracted;
    } catch (err) {
      logger.error(`❌ LLM extraction failed: ${err.message}`);
      throw new Error(`Extraction failed: ${err.message}`);
    }
  }

  /**
   * Build the extraction prompt for the LLM.
   */
  _buildPrompt(contents, userPrompt, schema) {
    let prompt = `You are a precise data extraction assistant. Extract structured data from the following web page content(s).\n\n`;

    // Add page contents
    for (const { url, title, content } of contents) {
      prompt += `--- PAGE: ${url} ---\n`;
      if (title) prompt += `Title: ${title}\n`;
      prompt += `Content:\n${content.substring(0, 15000)}\n\n`; // Limit to avoid token overflow
    }

    // Add extraction instructions
    if (userPrompt) {
      prompt += `\nExtraction Task: ${userPrompt}\n`;
    }

    if (schema) {
      prompt += `\nYou MUST return a JSON object that matches this schema exactly:\n`;
      prompt += `${JSON.stringify(schema, null, 2)}\n`;
    }

    prompt += `\nIMPORTANT RULES:
1. Return ONLY valid JSON, no markdown code blocks, no explanation.
2. Extract data strictly from the provided content.
3. If a field cannot be found, use null.
4. Be precise and extract exact values from the content.
5. Return a single JSON object (not an array, unless the schema specifies an array at root level).`;

    return prompt;
  }

  /**
   * Parse the LLM response as JSON.
   */
  _parseJsonResponse(text) {
    // Remove markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error('Failed to parse LLM response as JSON');
        }
      }
      throw new Error('LLM response does not contain valid JSON');
    }
  }
}

const extractService = new ExtractService();
export default extractService;
