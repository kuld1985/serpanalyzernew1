# Free SERP Analyzer — Part 2 (Low-usage)

This package is optimized to stay within Google CSE free quota (top 10 results only).
Set the following Netlify site environment variables:
- GOOGLE_API_KEY = your Google API key (Custom Search API enabled)
- CSE_ID = your Custom Search Engine ID (cx)

Deploy (recommended via GitHub → Netlify) so functions are picked up automatically.
Publish directory: public
Functions directory: netlify/functions

Quick curl test (after deploy):
curl -s -X POST "https://<your-site>.netlify.app/.netlify/functions/serp" -H "Content-Type: application/json" -d '{"q":"prodentim review 2025","target":"https://www.buyprodentimusa.com"}' | jq .

Notes:
- Paste your Blogger HTML in the textarea for most accurate on-page checks (server fetch may miss client-rendered content).
- This version limits processing to top-10 and reduces heavy parsing to remain fast & low-cost.
