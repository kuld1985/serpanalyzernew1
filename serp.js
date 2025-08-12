// netlify/functions/serp.js
// Free-quota-optimized Netlify Function for SERP Analyzer (Part 2)
// Requires site-level env vars: GOOGLE_API_KEY and CSE_ID (cx)
let fetchLib = global.fetch;
try { if (!fetchLib) fetchLib = require('node-fetch'); } catch(e){}

exports.handler = async function(event) {
  const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type,Accept" };
  if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:CORS };

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch(e){ return { statusCode:400, headers:CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  const q = (body.q||'').trim();
  const target = (body.target||'').trim() || null;
  if (!q) return { statusCode:400, headers:CORS, body: JSON.stringify({ error: "Missing q (keyword)" }) };

  const API_KEY = process.env.GOOGLE_API_KEY || process.env.API_KEY;
  const CSE_ID  = process.env.CSE_ID || process.env.GOOGLE_CSE_ID;
  if (!API_KEY || !CSE_ID) return { statusCode:500, headers:CORS, body: JSON.stringify({ error: "Set GOOGLE_API_KEY and CSE_ID in Netlify site settings" }) };

  // helper: call Google CSE (top 10)
  async function fetchCSE(query) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=10`;
    const r = await fetchLib(url);
    if (!r.ok) {
      const t = await r.text();
      throw new Error('CSE error: '+r.status+' '+t);
    }
    return await r.json();
  }

  // helper: simple HTML fetch
  async function fetchHtml(url) {
    try {
      const r = await fetchLib(url, { headers: { "User-Agent":"Mozilla/5.0 (SERP-Analyzer)" }, redirect: 'follow' });
      const text = await r.text();
      return { ok:true, html:text };
    } catch(e){ return { ok:false, error: String(e) }; }
  }

  function extractBasic(html='', url='') {
    const out = { url, title:'', metaDesc:'', h1:'', h2:[], imgs:[], bodyText:'', first100:'', wordCount:0, jsonLd:false };
    try {
      const titleM = html.match(/<title[^>]*>([^<]*)<\/title>/i); out.title = titleM?titleM[1].trim():'';
      const metaM = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']*)["']/i);
      out.metaDesc = metaM?metaM[1].trim():'';
      const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); out.h1 = h1M? h1M[1].replace(/<[^>]*>/g,'').trim():'';
      out.h2 = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map(m=>m[1].replace(/<[^>]*>/g,'').trim());
      out.imgs = Array.from(html.matchAll(/<img[^>]*>/gi)).map(tag=>{ const src=(tag[0].match(/src=(?:"([^"]+)"|'([^']+)'|([^>\s]+))/i)||[])[1]||''; const alt=(tag[0].match(/alt=(?:"([^"]+)"|'([^']+)'|([^>\s]+))/i)||[])[1]||''; return {src,alt}; });
      out.jsonLd = /<script[^>]+type=(?:'|")application\/ld\+json(?:'|")/i.test(html);
      const bodyM = html.match(/<body[^>]*>([\s\S]*)<\/body>/i); const body = bodyM?bodyM[1].replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,''):html;
      const text = body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      out.bodyText = text; out.first100 = text.split(/\s+/).slice(0,100).join(' '); out.wordCount = text? text.split(/\s+/).length:0;
    } catch(e){}
    return out;
  }

  function phraseStats(text, phrase) {
    if (!text || !phrase) return { count:0, density:0, totalWords:0 };
    const totalWords = (text.match(/\w+/g)||[]).length;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'), 'gi');
    const count = (text.match(re)||[]).length;
    const density = totalWords? (count/totalWords)*100:0;
    return { count, density: parseFloat(density.toFixed(3)), totalWords };
  }

  function scoreFromChecks(checks) {
    const weights = { title:15, meta:12, url:8, h1:10, density:15, words:20, schema:5, imgs:5 };
    let score = 0;
    if (checks.titleIncludes) score += weights.title; else if (checks.titleLenOk) score += Math.round(weights.title*0.6);
    if (checks.metaIncludes) score += weights.meta; else if (checks.metaLenOk) score += Math.round(weights.meta*0.6);
    if (checks.urlIncludes) score += weights.url;
    if (checks.h1Includes) score += weights.h1;
    if (checks.densityOk) score += weights.density;
    if (checks.wordCount >= 600) score += weights.words; else score += Math.round((checks.wordCount/600)*weights.words);
    if (checks.schema) score += weights.schema;
    if (checks.imgAltsOk) score += weights.imgs;
    if (score>100) score=100;
    return Math.round(score);
  }

  function computeChecks(parsed, phrase, pageUrl='') {
    const p = phrase.toLowerCase();
    const title = (parsed.title||'').toLowerCase();
    const meta = (parsed.metaDesc||'').toLowerCase();
    const h1 = (parsed.h1||'').toLowerCase();
    const body = (parsed.bodyText||'').toLowerCase();
    const urlLower = (pageUrl||parsed.url||'').toLowerCase();
    const ps = phraseStats(body, phrase);
    const checks = {
      titleLenOk: (parsed.title||'').length >= 40 && (parsed.title||'').length <= 70,
      titleIncludes: title.includes(p),
      metaLenOk: (parsed.metaDesc||'').length >= 110 && (parsed.metaDesc||'').length <= 160,
      metaIncludes: meta.includes(p),
      urlIncludes: urlLower.includes(p.split(' ')[0]),
      h1Present: !!parsed.h1,
      h1Includes: h1.includes(p),
      densityOk: ps.density >= 0.6 && ps.density <= 2.5,
      density: ps.density,
      densityCount: ps.count,
      imgAltsOk: (parsed.imgs||[]).length===0 || ((parsed.imgs||[]).every(i=>i.alt && i.alt.trim().length>0)),
      schema: !!parsed.jsonLd,
      wordCount: parsed.wordCount || 0
    };
    checks.score = scoreFromChecks(checks);
    return checks;
  }

  try {
    const cse = await fetchCSE(q);
    const items = (cse.items||[]).slice(0,10).map((it,i)=>({pos:i+1,title:it.title||'',link:it.link||'',snippet:it.snippet||it.htmlSnippet||'',display:it.displayLink||''}));

    // pick first non-amazon competitor not same as target
    let competitorUrl='';
    for (const it of items) {
      const host = (it.link||'').toLowerCase();
      if (host.includes('amazon.')||host.includes('amzn.')) continue;
      if (target) { try { const tgtHost = (new URL(target)).hostname; if (host.includes(tgtHost)) continue; } catch(e) {} }
      competitorUrl = it.link; break;
    }
    if (!competitorUrl && items.length) competitorUrl = items[0].link||'';

    const [compFetch, targetFetch] = await Promise.all([ fetchHtml(competitorUrl), target?fetchHtml(target):Promise.resolve({ok:false}) ]);
    const compExtract = compFetch.ok? extractBasic(compFetch.html, competitorUrl) : { title: items.find(i=>i.link===competitorUrl)?.title||'', snippet: items.find(i=>i.link===competitorUrl)?.snippet||'' };
    const targetExtract = targetFetch.ok? extractBasic(targetFetch.html, target) : { title:'', metaDesc:'', bodyText:'', first100:'', wordCount:0, h1:'', h2:[], imgs:[] };

    const compChecks = computeChecks(compExtract, q, competitorUrl);
    const targetChecks = computeChecks(targetExtract, q, target);

    // top terms & gap terms (limited to keep processing light)
    function topTerms(text, limit=40) {
      const freq={}; const words = (text||'').toLowerCase().match(/[a-z0-9]{3,}/g)||[];
      words.forEach(w=>{ if(/^[0-9]+$/.test(w)) return; freq[w]=(freq[w]||0)+1; });
      return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>({term:x[0],count:x[1]}));
    }
    const compTop = topTerms(compExtract.bodyText||compExtract.snippet||'',50);
    const targetTop = topTerms(targetExtract.bodyText||'',200);
    const missing = compTop.filter(t=>!targetTop.find(x=>x.term===t.term)).slice(0,30).map(x=>x.term);

    const out = {
      success:true, keyword:q, serp:items, chosen_competitor:competitorUrl,
      competitor:{url:competitorUrl, parsed:compExtract, checks:compChecks, score:compChecks.score},
      target:{url:target, parsed:targetExtract, checks:targetChecks, score:targetChecks.score},
      gap_terms:missing, notes:{free_quota:true, tip:'This version is optimized for low usage (top10 only). Paste HTML for best on-page checks'}, timestamp:new Date().toISOString()
    };
    return { statusCode:200, headers:CORS, body: JSON.stringify(out, null,2) };
  } catch(err) {
    return { statusCode:500, headers:CORS, body: JSON.stringify({ error: String(err) }, null,2) };
  }

  // helper to call CSE (declared after to avoid hoist issues)
  async function fetchCSE(query) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=10`;
    const r = await fetchLib(url);
    if (!r.ok) { const t = await r.text(); throw new Error('CSE error: '+r.status+' '+t); }
    return await r.json();
  }
};
