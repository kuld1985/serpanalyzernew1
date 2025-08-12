const cheerio = require('cheerio');

function extractText(html){
  const $ = cheerio.load(html || '');
  // remove scripts and styles
  $('script, style, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function getTitle(html){
  const $ = cheerio.load(html||'');
  return ($('title').first().text() || '').trim();
}

function getMetaDescription(html){
  const $ = cheerio.load(html||'');
  return ($('meta[name="description"]').attr('content') || '').trim();
}

function getHeadings(html){
  const $ = cheerio.load(html||'');
  const h1 = $('h1').map((i,el)=>$(el).text().trim()).get();
  const h2 = $('h2').map((i,el)=>$(el).text().trim()).get();
  return { h1, h2 };
}

function countLinks(html, baseDomain){
  const $ = cheerio.load(html||'');
  const links = $('a').map((i,el)=> $(el).attr('href') || '').get();
  let internal = 0, external = 0;
  links.forEach(l => {
    if(!l) return;
    try{
      if(l.startsWith('#')) { internal++; return; }
      const url = new URL(l, baseDomain);
      if(url.hostname.includes(baseDomain.replace(/^https?:\/\//,''))) internal++;
      else external++;
    }catch(e){ /* ignore */ }
  });
  return { internal, external, total: links.length };
}

function wordCount(text){
  if(!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function keywordDensity(text, keyword){
  if(!keyword) return 0;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const kw = keyword.toLowerCase();
  // simple count of keyword appearances (including multi-word)
  let count = 0;
  const joined = text.toLowerCase();
  let idx = joined.indexOf(kw);
  while(idx !== -1){
    count++;
    idx = joined.indexOf(kw, idx + kw.length);
  }
  const density = (count / Math.max(1, words.length)) * 100;
  return { count, density };
}

// simple title relevance score: 0-25
function scoreTitle(title, keyword){
  if(!title) return 0;
  const t = title.toLowerCase();
  const kw = keyword.toLowerCase();
  if(t === kw) return 25;
  if(t.includes(kw)) return 20;
  const parts = t.split(/\s+/);
  if(parts[0] && parts[0].includes(kw)) return 18;
  return t.includes(kw.split(' ')[0]) ? 10 : 0;
}

module.exports = {
  extractText, getTitle, getMetaDescription, getHeadings, countLinks, wordCount, keywordDensity, scoreTitle
};