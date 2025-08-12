const fetch = require('node-fetch');
const { extractText, getTitle, getMetaDescription, getHeadings, countLinks, wordCount, keywordDensity, scoreTitle } = require('./helpers');
const { URL } = require('url');

const SKIP_DEFAULT = 'amazon.in,amazon.com,flipkart.com,youtube.com';

function domainFromUrl(u){
  try{ return (new URL(u)).hostname; }catch(e){ return ''; }
}

exports.handler = async function(event, context){
  try{
    const query = event.queryStringParameters || {};
    const keyword = (query.keyword || '').trim();
    const targetUrl = (query.url || '').trim();

    if(!keyword){
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing keyword parameter' }) };
    }

    const CSE_ID = process.env.CSE_ID;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if(!CSE_ID || !GOOGLE_API_KEY){
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing CSE_ID or GOOGLE_API_KEY in env' }) };
    }

    const skipDomains = (process.env.SKIP_DOMAINS || SKIP_DEFAULT).split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);

    // 1) call Google CSE (top 10)
    const cseUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(keyword)}&num=10`;
    const cseRes = await fetch(cseUrl);
    const cseJson = await cseRes.json();

    const items = cseJson.items || [];

    // 2) filter out skip domains and find first relevant competitor
    let competitor = null;
    for(const it of items){
      try{
        const host = domainFromUrl(it.link).toLowerCase();
        if(skipDomains.some(sd => host.includes(sd))) continue;
        // require title or snippet contains keyword
        const t = (it.title || '').toLowerCase();
        const s = (it.snippet || '').toLowerCase();
        if(t.includes(keyword.toLowerCase()) || s.includes(keyword.toLowerCase())){
          competitor = { link: it.link, title: it.title, snippet: it.snippet };
          break;
        }
        // fallback: first non-skipped result
        if(!competitor) competitor = { link: it.link, title: it.title, snippet: it.snippet };
      }catch(e){ continue; }
    }

    // 3) fetch competitor page and target page (if provided)
    let competitorHtml = null, targetHtml = null;
    if(competitor){
      try{
        const r = await fetch(competitor.link, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SERPAnalyzer/1.0)' } });
        competitorHtml = await r.text();
      }catch(e){ competitorHtml = null; }
    }

    if(targetUrl){
      try{
        const r2 = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SERPAnalyzer/1.0)' } });
        targetHtml = await r2.text();
      }catch(e){ targetHtml = null; }
    }

    // 4) analyze competitor and target
    function analyzeHtml(html, urlForDomain){
      if(!html) return null;
      const title = getTitle(html);
      const meta = getMetaDescription(html);
      const headings = getHeadings(html);
      const text = extractText(html);
      const wc = wordCount(text);
      const kd = keywordDensity(text, keyword);
      const links = countLinks(html, urlForDomain || '');
      const tscore = scoreTitle(title, keyword);
      return { title, meta, headings, wordCount: wc, keywordCount: kd.count, keywordDensityPercent: kd.density, links, titleScore: tscore };
    }

    const compDomain = competitor ? domainFromUrl(competitor.link) : '';
    const compAnalysis = competitorHtml ? analyzeHtml(competitorHtml, compDomain) : null;
    const targetDomain = targetUrl ? domainFromUrl(targetUrl) : '';
    const targetAnalysis = targetHtml ? analyzeHtml(targetHtml, targetDomain) : null;

    // 5) scoring (weights)
    function weightedScore(a){
      if(!a) return 0;
      const w = {
        title: 25, keywordDensity: 20, meta: 10, headings: 15, length: 15, links: 15
      };
      let score = 0;
      // title (0-25)
      score += a.titleScore || 0;
      // keyword density -> ideal 0.8% - 2.5% => scaled to 0-20
      const kd = Math.min(10, a.keywordDensityPercent) ; // simple cap
      score += (kd/2) * (w.keywordDensity/10); // normalization conservative
      // meta presence (10)
      score += (a.meta && a.meta.toLowerCase().includes(keyword.toLowerCase())) ? w.meta : (a.meta?5:0);
      // headings (h1+h2 count)
      const hcount = ((a.headings && a.headings.h1? a.headings.h1.length:0) + (a.headings && a.headings.h2? a.headings.h2.length:0));
      score += Math.min(15, hcount*3); // up to 15
      // length (wordcount) ideal 800-2500 -> scaled
      const wc = a.wordCount || 0;
      if(wc >= 800 && wc <= 2500) score += 15;
      else if(wc >=500 && wc<800) score += 8;
      // links (internal+external)
      const ln = (a.links && a.links.total) || 0;
      score += Math.min(15, ln/5); // each 5 links ~1 point, cap 15
      // normalize to 0-100 (approx)
      return Math.min(100, Math.round(score));
    }

    const compScore = compAnalysis ? weightedScore(compAnalysis) : 0;
    const targetScore = targetAnalysis ? weightedScore(targetAnalysis) : 0;

    // 6) suggestions (simple heuristics)
    const suggestions = [];
    if(targetAnalysis){
      if(targetAnalysis.wordCount < 800) suggestions.push('Increase content length to 800-2000 words for better competitiveness.');
      if(targetAnalysis.keywordDensityPercent < 0.5) suggestions.push('Increase keyword usage naturally (aim ~0.8% - 2.0%).');
      if(!targetAnalysis.meta) suggestions.push('Add a meta description that includes the target keyword.');
      if((targetAnalysis.headings.h1||[]).length === 0) suggestions.push('Add an H1 that includes the target keyword.');
      if(targetAnalysis.links.total < 3) suggestions.push('Add a few internal/external links (3-8 recommended).');
    } else {
      suggestions.push('Target page not fetched. Ensure the URL is public and accessible.');
    }

    const result = {
      keyword, targetUrl, competitor: competitor||null, compAnalysis, targetAnalysis, compScore, targetScore, suggestions, rawCSE: { itemsCount: items.length }
    };

    return { statusCode: 200, body: JSON.stringify(result) };

  }catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};