# 🌐 Webiii

**Self-hosted web scraping API** — Transform any website into clean, structured data ready for LLMs.

Inspired by [Firecrawl](https://firecrawl.dev), built for full control and zero usage limits.

## Features

| Endpoint | Description |
|----------|-------------|
| `POST /v1/scrape` | Convert any URL to Markdown, HTML, screenshot, or links |
| `POST /v1/crawl` | Async recursive crawl with job ID + polling |
| `GET /v1/crawl/:id` | Check crawl job status & results |
| `POST /v1/map` | Discover all URLs on a domain (sitemap + crawl) |
| `POST /v1/extract` | LLM-powered structured data extraction with JSON Schema |
| `POST /v1/search` | Web search + scrape results |

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Configure
cp .env.example .env
# Edit .env with your API key and Gemini key

# Start
npm run dev
```

## Authentication

All endpoints require a Bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

## API Examples

### Scrape
```bash
curl -X POST http://localhost:3002/v1/scrape \
  -H "Authorization: Bearer webiii-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown", "links"],
    "onlyMainContent": true
  }'
```

### Crawl (async)
```bash
# Start crawl
curl -X POST http://localhost:3002/v1/crawl \
  -H "Authorization: Bearer webiii-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "limit": 10,
    "maxDepth": 2,
    "scrapeOptions": {
      "formats": ["markdown"],
      "onlyMainContent": true
    }
  }'

# Check status (use the returned job ID)
curl http://localhost:3002/v1/crawl/JOB_ID \
  -H "Authorization: Bearer webiii-dev-key-2026"
```

### Map
```bash
curl -X POST http://localhost:3002/v1/map \
  -H "Authorization: Bearer webiii-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "search": "blog",
    "limit": 50
  }'
```

### Extract (LLM)
```bash
curl -X POST http://localhost:3002/v1/extract \
  -H "Authorization: Bearer webiii-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com"],
    "prompt": "Extract the page title and main heading",
    "schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "heading": { "type": "string" }
      }
    }
  }'
```

### Search
```bash
curl -X POST http://localhost:3002/v1/search \
  -H "Authorization: Bearer webiii-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "best web scraping tools 2026",
    "limit": 5,
    "scrapeOptions": {
      "formats": ["markdown"],
      "onlyMainContent": true
    }
  }'
```

## Tech Stack

- **Express.js** — API server
- **Playwright** — Headless browser for JS-rendered pages
- **Cheerio** — Fast HTML parsing
- **Turndown** — HTML → Markdown conversion
- **Google Gemini** — LLM for structured extraction
- **DuckDuckGo** — Web search (free, no API key needed)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `API_KEY` | `webiii-dev-key-2026` | Bearer token for auth |
| `GEMINI_API_KEY` | — | Google Gemini API key (for /extract) |
| `MAX_CONCURRENT_BROWSERS` | `3` | Max Playwright instances |
| `LOG_LEVEL` | `info` | Winston log level |

## License

MIT
