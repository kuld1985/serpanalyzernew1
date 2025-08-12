document.getElementById('runBtn').addEventListener('click', async ()=>{
  const url = document.getElementById('targetUrl').value.trim();
  const keyword = document.getElementById('keyword').value.trim();
  const status = document.getElementById('status');
  const report = document.getElementById('report');
  report.textContent = '';
  if(!keyword){ alert('Please enter a target keyword'); return; }
  status.textContent = 'Running analysis… (this may take 5–10 seconds)';
  try{
    const resp = await fetch(`/.netlify/functions/analyze?keyword=${encodeURIComponent(keyword)}&url=${encodeURIComponent(url||'')}`);
    const data = await resp.json();
    status.textContent = 'Done';
    report.textContent = JSON.stringify(data, null, 2);
  }catch(err){
    status.textContent = 'Error: '+err.message;
  }
});