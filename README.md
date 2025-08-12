# SERP Analyzer — Part 2 (Netlify ready)

## What it does
- Uses Google Custom Search (CSE) to fetch top 10 results for a keyword.
- Skips marketplace/irrelevant domains (configurable).
- Picks the first relevant competitor and fetches its page content server-side.
- Optionally fetches your target URL and compares metrics.
- Calculates a lightweight SERP Score (0-100) and returns suggestions.

## Files
- `public/` — frontend (index.html, style.css, script.js)
- `netlify/functions/analyze.js` — serverless function (main)
- `netlify/functions/helpers.js` — helper utilities (parsing, scoring)
- `package.json` — dependencies
- `README.md` — this file

## Environment variables (set these on Netlify)
- `CSE_ID` — Google Custom Search Engine ID
- `GOOGLE_API_KEY` — Google API Key
- Optional: `SKIP_DOMAINS` — comma separated (defaults to amazon.in,amazon.com,flipkart.com,youtube.com)

## Deploy steps (quick)
1. Replace your repo files with this project structure or add these files.
2. Commit & push to GitHub.
3. On Netlify create site from GitHub (or update existing site's repo).
4. Set environment variables in Site settings → Build & deploy → Environment.
5. Trigger deploy → Clear cache and deploy site.
6. Open the site and use the UI to run analysis.

## Notes & limits
- This tool is optimized for light use to stay within free CSE quotas. Avoid bulk automated runs.
- If your target page blocks scraping or uses heavy JS rendering, the raw HTML fetch may not reveal full content.
- Scoring weights are conservative; you can tweak weights in `analyze.js`.

