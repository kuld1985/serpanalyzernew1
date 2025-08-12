async function postJSON(url, body){
  const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  if(!res.ok){ const txt = await res.text(); throw new Error('Server error: '+res.status+' - '+txt); }
  return await res.json();
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('run').addEventListener('click', async ()=>{
  const apiUrl = document.getElementById('apiUrl').value.trim() || '/.netlify/functions/serp';
  const keyword = document.getElementById('keyword').value.trim();
  const target = document.getElementById('target').value.trim();
  const myHtml = document.getElementById('myHtml').value || '';
  if(!keyword){ alert('Enter keyword'); return; }
  document.getElementById('status').textContent = 'Calling server...';
  try{
    const data = await postJSON(apiUrl, { q: keyword, target });
    document.getElementById('raw').style.display='block'; document.getElementById('raw').textContent = JSON.stringify(data, null,2);
    renderResults(data, myHtml);
    document.getElementById('status').textContent = 'Analysis complete';
  }catch(e){ document.getElementById('status').textContent = 'Error: '+e.message; alert('Error: '+e.message); }
});

function renderResults(data, myHtml){
  const out = document.getElementById('results');
  if(!data.success){ out.innerHTML = '<div class="result-card">Error: '+escapeHtml(data.error||'Unknown')+'</div>'; return; }
  const comp = data.competitor, targ = data.target;
  let html = `<div class="result-card"><h3>Summary</h3>
    <p><strong>Keyword:</strong> ${escapeHtml(data.keyword)}</p>
    <p><strong>Competitor:</strong> <a href="${escapeHtml(comp.url)}" target="_blank">${escapeHtml(comp.url)}</a></p>
    <p><strong>Competitor Score:</strong> ${comp.score} / 100</p>
    <p><strong>Your Score:</strong> ${targ.score} / 100</p>
  </div>`;

  html += `<div class="result-card"><h3>Checks</h3><table><tr><th>Metric</th><th>Competitor</th><th>Your Page</th></tr>
    <tr><td>Title includes</td><td>${comp.checks.titleIncludes?'<span class="ok">✅</span>':'<span class="bad">❌</span>'}</td><td>${targ.checks.titleIncludes?'<span class="ok">✅</span>':'<span class="bad">❌</span>'}</td></tr>
    <tr><td>Meta includes</td><td>${comp.checks.metaIncludes?'<span class="ok">✅</span>':'<span class="bad">❌</span>'}</td><td>${targ.checks.metaIncludes?'<span class="ok">✅</span>':'<span class="bad">❌</span>'}</td></tr>
    <tr><td>H1 includes</td><td>${comp.checks.h1Includes?'<span class="ok">✅</span>':'<span class="bad">❌</span>'}</td><td>${targ.checks.h1Includes?'<span class="ok">✅</span>':'<span class="bad">❌</span>'}</td></tr>
    <tr><td>Keyword density (%)</td><td>${comp.checks.density}</td><td>${targ.checks.density}</td></tr>
    <tr><td>Word count</td><td>${comp.checks.wordCount}</td><td>${targ.checks.wordCount}</td></tr>
    </table></div>`;

  const recs = [];
  if(!targ.checks.titleIncludes) recs.push('Include keyword in <title> (40-70 chars)');
  if(!targ.checks.metaIncludes) recs.push('Add keyword to meta description (110-160 chars)');
  if(!targ.checks.h1Includes) recs.push('Make H1 contain the keyword');
  if(!targ.checks.first100) recs.push('Place keyword in first 100 words');
  if(!targ.checks.densityOk) recs.push('Adjust keyword density to 0.6–2.5%');
  if(!targ.checks.imgAltsOk) recs.push('Add descriptive alt text to images');
  if(!targ.checks.schema) recs.push('Add JSON-LD schema (Article/Product/FAQ)');
  if(targ.checks.wordCount < 800) recs.push('Increase content depth (word count) and cover related subtopics');
  if(recs.length===0) recs.push('On-page looks good — focus on backlinks & UX');

  html += `<div class="result-card"><h3>Recommendations</h3><ul>${recs.map(r=>'<li>'+escapeHtml(r)+'</li>').join('')}</ul></div>`;

  html += `<div class="result-card"><h3>Gap terms (competitor terms you are missing)</h3><div class="chips">${(data.gap_terms||[]).slice(0,40).map(t=>'<span class="chip">'+escapeHtml(t)+'</span>').join('')}</div></div>`;

  out.innerHTML = html;
}

// preview/autofix
document.getElementById('preview').addEventListener('click', ()=>{
  const kw = document.getElementById('keyword').value.trim();
  const myHtml = document.getElementById('myHtml').value || '';
  const suggestedTitle = myHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || (kw.charAt(0).toUpperCase()+kw.slice(1)+' — Honest Review & Results');
  const suggestedMeta = myHtml.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || (kw + ' — In-depth review, benefits, side-effects & money-back info.');
  const suggestedH1 = myHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || ('ProDentim Review 2025 — ' + kw);
  const preview = `<!-- Suggested edits (paste into Blogger HTML) -->\n<title>${suggestedTitle}</title>\n<meta name="description" content="${suggestedMeta}" />\n<h1>${suggestedH1}</h1>`;
  const w = window.open('','_blank'); w.document.write('<pre style="font-family:monospace;padding:12px;">'+escapeHtml(preview)+'</pre>');
});
