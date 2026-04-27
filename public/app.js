const API_KEY = 'Renans2pietro18@';
let currentTab = 'scrape';
let lastResult = '';

// Intersection Observer for scroll animations
const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.15
};

const observer = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.animate-on-scroll').forEach(section => {
    observer.observe(section);
  });
});

// Tab switching
function setTab(el) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.querySelector('.tab-dot').classList.remove('red');
  });
  el.classList.add('active');
  el.querySelector('.tab-dot').classList.add('red');
  
  currentTab = el.dataset.tab;
  
  // Show/hide options
  document.querySelectorAll('.opt').forEach(g => g.classList.remove('visible'));
  const group = document.querySelector(`.opt[data-for="${currentTab}"]`);
  if (group) group.classList.add('visible');

  // Update placeholder & Pill text
  const input = document.getElementById('urlInput');
  const pill = document.getElementById('scrapingPill');
  
  if (currentTab === 'search') {
    input.placeholder = 'Enter search query...';
    input.value = '';
    pill.textContent = 'Searching...';
  } else {
    input.placeholder = 'https://example.com';
    input.value = 'https://example.com';
    if(currentTab === 'scrape') pill.textContent = 'Scraping...';
    if(currentTab === 'map') pill.textContent = 'Mapping...';
    if(currentTab === 'crawl') pill.textContent = 'Crawling...';
    if(currentTab === 'extract') pill.textContent = 'Extracting...';
  }
}

// Code Snippet Tabs
function setCodeTab(el, lang) {
  document.querySelectorAll('.code-example .ct').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  
  const codeContent = document.getElementById('codeContent');
  if(lang === 'curl') {
    codeContent.innerHTML = `<span class="k">curl</span> -X POST http://localhost:3002/v1/scrape \\
  -H <span class="s">"Authorization: Bearer webiii-dev-key-2026"</span> \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"url": "https://example.com", "formats": ["markdown"]}'</span>`;
  } else if (lang === 'node') {
    codeContent.innerHTML = `<span class="k">const</span> response = <span class="k">await</span> fetch('http://localhost:3002/v1/scrape', {
  method: <span class="s">'POST'</span>,
  headers: {
    <span class="s">'Authorization'</span>: <span class="s">'Bearer webiii-dev-key-2026'</span>,
    <span class="s">'Content-Type'</span>: <span class="s">'application/json'</span>
  },
  body: JSON.stringify({ url: <span class="s">'https://example.com'</span>, formats: [<span class="s">'markdown'</span>] })
});
<span class="k">const</span> data = <span class="k">await</span> response.json();`;
  } else if (lang === 'python') {
    codeContent.innerHTML = `<span class="k">import</span> requests

response = requests.post(
    <span class="s">"http://localhost:3002/v1/scrape"</span>,
    headers={<span class="s">"Authorization"</span>: <span class="s">"Bearer webiii-dev-key-2026"</span>},
    json={<span class="s">"url"</span>: <span class="s">"https://example.com"</span>, <span class="s">"formats"</span>: [<span class="s">"markdown"</span>]}
)
data = response.json()`;
  }
}

// Execute request
async function executeRequest() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  const loading = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  loading.style.display = 'flex';

  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  };

  let endpoint, body;
  const start = Date.now();

  try {
    switch (currentTab) {
      case 'scrape': {
        loadingText.textContent = 'Scraping page...';
        const formats = [];
        if (document.getElementById('fmtMarkdown').checked) formats.push('markdown');
        if (document.getElementById('fmtLinks').checked) formats.push('links');
        if (document.getElementById('fmtHtml').checked) formats.push('html');
        if (document.getElementById('fmtScreenshot').checked) formats.push('screenshot');
        endpoint = '/v1/scrape';
        body = { url, formats, onlyMainContent: true };
        break;
      }
      case 'crawl': {
        loadingText.textContent = 'Starting crawl...';
        endpoint = '/v1/crawl';
        body = {
          url,
          limit: parseInt(document.getElementById('crawlLimit').value) || 5,
          maxDepth: parseInt(document.getElementById('crawlDepth').value) || 2,
          scrapeOptions: { formats: ['markdown'], onlyMainContent: true }
        };
        break;
      }
      case 'map': {
        loadingText.textContent = 'Discovering URLs...';
        endpoint = '/v1/map';
        body = {
          url,
          search: document.getElementById('mapSearch').value || undefined,
          limit: parseInt(document.getElementById('mapLimit').value) || 50
        };
        break;
      }
      case 'extract': {
        loadingText.textContent = 'Extracting with AI...';
        endpoint = '/v1/extract';
        body = {
          urls: [url],
          prompt: document.getElementById('extractPrompt').value || 'Extract the main information from this page',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              mainContent: { type: 'string' }
            }
          }
        };
        break;
      }
      case 'search': {
        loadingText.textContent = 'Searching the web...';
        endpoint = '/v1/search';
        body = {
          query: url,
          limit: parseInt(document.getElementById('searchLimit').value) || 5
        };
        break;
      }
    }

    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    let data = await response.json();

    // If crawl, poll for results
    if (currentTab === 'crawl' && data.success && data.id) {
      loadingText.textContent = 'Crawling... polling for results';
      data = await pollCrawl(data.id);
    }

    const elapsed = Date.now() - start;
    showResult(data, elapsed, response.status);
  } catch (err) {
    showResult({ success: false, error: err.message }, Date.now() - start, 0);
  } finally {
    loading.style.display = 'none';
  }
}

// Poll crawl status
async function pollCrawl(jobId) {
  const headers = { 'Authorization': `Bearer ${API_KEY}` };
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const r = await fetch(`/v1/crawl/${jobId}`, { headers });
      const d = await r.json();
      document.getElementById('loadingText').textContent = `Crawling... ${d.completed || 0} pages`;
      if (d.status === 'completed' || d.status === 'failed') return d;
    } catch { /* retry */ }
  }
  return { success: false, error: 'Crawl polling timeout' };
}

// Show result
function showResult(data, elapsed, status) {
  const section = document.getElementById('resultsSection');
  const code = document.getElementById('resultsCode');
  const time = document.getElementById('resultTime');
  const statusEl = document.getElementById('resultStatus');

  lastResult = JSON.stringify(data, null, 2);
  code.textContent = lastResult;
  time.textContent = `[ ${elapsed}ms ]`;
  statusEl.textContent = data.success ? `[ ${status} OK ]` : `[ ERROR ${status} ]`;
  statusEl.style.color = data.success ? '#4ADE80' : '#F87171';
  section.style.display = 'block';
  
  // Smooth scroll
  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// Copy result
function copyResult() {
  navigator.clipboard.writeText(lastResult);
  const btn = document.querySelector('.btn-copy');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

// Init
document.querySelector('.opt[data-for="scrape"]').classList.add('visible');
document.getElementById('urlInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') executeRequest();
});
setCodeTab(document.querySelector('.code-example .ct.active'), 'curl');
