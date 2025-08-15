(function(){
  const API='http://localhost:3000';
  const regsBody=document.getElementById('regsBody');
  const pendingList=document.getElementById('pendingList');
  const viewAllLink=document.querySelector('.view-all');
  let latestPending = [];

  async function fetchRegs(){
    const res=await fetch(`${API}/api/regulations`);
    if(!res.ok) return [];
    return await res.json();
  }
  async function fetchIncStatus(){
    const res=await fetch(`${API}/api/dashboard/compliance-status`);
    if(!res.ok) return {compliant:0, non_compliant:0};
    return await res.json();
  }
  async function fetchPending(){
    const res=await fetch(`${API}/api/dashboard/pending`);
    if(!res.ok) return [];
    return await res.json();
  }

  function renderRegs(rows){
    regsBody.innerHTML='';
    rows.forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.department}</td>
        <td>${r.status}</td>
        <td>${r.last_review ? new Date(r.last_review).toISOString().slice(0,10) : ''}</td>
        <td>${r.next_review ? new Date(r.next_review).toISOString().slice(0,10) : ''}</td>
      `;
      regsBody.appendChild(tr);
    });
  }

  function renderTopCards(rows){
    const total = rows.length;
    const compliant = rows.filter(r=> String(r.status||'').toLowerCase()==='compliant').length;
    const nonCompliant = rows.filter(r=> String(r.status||'').toLowerCase()==='non-compliant').length;
    const soon = rows.filter(r=> r.next_review && (new Date(r.next_review)-new Date())/(1000*60*60*24) <= 30).length;
    document.getElementById('totalRegs').textContent = total;
    document.getElementById('compliant').textContent = compliant;
    document.getElementById('nonCompliant').textContent = nonCompliant;
    document.getElementById('reviewSoon').textContent = soon;
  }

  async function renderChart(){
    const regs = await fetchRegs();
    const departments = [
      'Human Resources',
      'Project Management',
      'Sales & CRM',
      'Manufacturing & Production Mgmt.',
      'Inventory & Warehouse Mgmt.',
      'Procurement',
      'Finance and Accounting',
      'B.I. and Analytics',
      'Compliance & Risk Mangement'
    ];
    const toLower = (v) => String(v || '').toLowerCase();
    const compliantData = departments.map(d => regs.filter(r => r.department === d && toLower(r.status) === 'compliant').length);
    const nonCompliantData = departments.map(d => regs.filter(r => r.department === d && toLower(r.status) === 'non-compliant').length);
    const ctx = document.getElementById('complianceChart').getContext('2d');
    if (window._regComplianceChart) {
      window._regComplianceChart.destroy();
    }
    // Set dynamic inner width so each category gets a fixed pixel width
    const perCategoryWidth = 110; // px/bar label area
    const inner = document.querySelector('.chart-inner');
if (inner) {
  const container = inner.parentElement;
  const containerWidth = container ? container.clientWidth : 0;
  const dynamicWidth = Math.max(containerWidth, departments.length * perCategoryWidth);
  inner.style.width = dynamicWidth + 'px';
}

    window._regComplianceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: departments,
        datasets: [
          { label: 'Compliant', data: compliantData, backgroundColor: '#4caf50' },
          { label: 'Non-Compliant', data: nonCompliantData, backgroundColor: '#f44336' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  function renderPending(rows){
    latestPending = Array.isArray(rows) ? rows.slice() : [];
    pendingList.innerHTML='';
    rows.slice(0,4).forEach(p=>{
      const li=document.createElement('li');
      li.className='task-item blue';
      li.innerHTML = `
        <span class="color-bar"></span>
        <div class="task-details">
          <strong>${p.type.toUpperCase()}: ${p.title}</strong>
          <p>Due: ${p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}</p>
        </div>
        <span class="menu-icon">⋮</span>
      `;
      li.addEventListener('click', ()=> openPendingModal(p));
      pendingList.appendChild(li);
    });
  }

  function openPendingModal(item){
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    const modal=document.createElement('div');
    modal.className='modal';
    const typeLabel=String(item.type||'').toUpperCase();
    const title=String(item.title||'—');
    const due=item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—';
    const statusRow = (typeof item.status !== 'undefined') ? `<p><strong>Status:</strong> ${item.status || '—'}</p>` : '';
    const progressRow = (typeof item.progress !== 'undefined') ? `<p><strong>Progress:</strong> ${item.progress}%</p>` : '';
    modal.innerHTML=`
      <div class="modal-header"><h3>${typeLabel} Details</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Due:</strong> ${due}</p>
        ${statusRow}
        ${progressRow}
      </div>
      <div class="modal-actions"><button class="btn btn-primary">Close</button></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display='flex';
    const close=()=>{ try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick=close;
    modal.querySelector('.btn').onclick=close;
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
    document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
  }

  function openAllPendingModal(items){
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    const modal=document.createElement('div');
    modal.className='modal';
    const rows = Array.isArray(items) ? items : [];
    const tableRows = rows.map(it=>{
      const type = String(it.type||'').toUpperCase();
      const title = String(it.title||'—');
      const due = it.dueDate ? new Date(it.dueDate).toLocaleDateString() : '—';
      const status = (typeof it.status !== 'undefined') ? (it.status || '—') : '—';
      const progress = (typeof it.progress !== 'undefined') ? `${it.progress}%` : '—';
      return `<tr><td>${type}</td><td>${title}</td><td>${due}</td><td>${status}</td><td>${progress}</td></tr>`;
    }).join('');
    modal.innerHTML = `
      <div class="modal-header"><h3>All Pending Tasks</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <table class="pending-table">
          <thead><tr><th>Type</th><th>Title</th><th>Due</th><th>Status</th><th>Progress</th></tr></thead>
          <tbody>${tableRows || '<tr><td colspan="5">No pending tasks</td></tr>'}</tbody>
        </table>
      </div>
      <div class="modal-actions"><button class="btn btn-primary">Close</button></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display='flex';
    const close=()=>{ try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick=close;
    modal.querySelector('.btn').onclick=close;
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
    document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
  }

  function badgePopups(){
    const info={
      SOX: 'Sarbanes-Oxley Act (SOX) establishes auditing and financial regulations for public companies to protect shareholders and the general public. It mandates internal controls and reporting accuracy.',
      AML: 'Anti-Money Laundering (AML) comprises laws and regulations to prevent criminals from disguising illegally obtained funds as legitimate income.',
      GDPR: 'General Data Protection Regulation (GDPR) is the EU law on data protection and privacy, providing individuals control over their personal data.',
      ISO: 'ISO standards ensure quality, safety, and efficiency across products, services, and systems.',
      FDA: 'Food and Drug Administration (FDA) regulates food, drugs, medical devices, cosmetics and more to ensure safety and efficacy.',
      DPA: 'Data Privacy Act provides protection of personal information collected by organizations.',
      BIR: 'Bureau of Internal Revenue regulations for taxation compliance and reporting.',
      ECA: 'ECA outlines consumer protection and trade compliance frameworks.'
    };
    document.querySelectorAll('.card-badge').forEach(el=>{
      el.addEventListener('click', ()=>{
        const code=el.getAttribute('data-code');
        const overlay=document.createElement('div');
        overlay.className='modal-overlay';
        const modal=document.createElement('div');
        modal.className='modal';
        modal.innerHTML=`
          <div class="modal-header"><h3>${code} Overview</h3><button class="modal-close">&times;</button></div>
          <div class="modal-body"><p>${info[code]||'No description available.'}</p></div>
          <div class="modal-actions"><button class="btn btn-primary">Close</button></div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.style.display='flex';
        const close=()=>document.body.removeChild(overlay);
        modal.querySelector('.modal-close').onclick=close;
        modal.querySelector('.btn').onclick=close;
      });
    });
  }

  async function load(){
    const regs = await fetchRegs();
    renderRegs(regs);
    renderTopCards(regs);
    renderPending(await fetchPending());
    badgePopups();
  }

  load();
  renderChart();
  setInterval(async()=>{
    renderTopCards(await fetchRegs());
    renderPending(await fetchPending());
  }, 5000);

  if(viewAllLink){
    viewAllLink.addEventListener('click', async (e)=>{
      e.preventDefault();
      try{
        if(!latestPending.length){ latestPending = await fetchPending(); }
        openAllPendingModal(latestPending);
      }catch(err){ /* no-op */ }
    });
  }

  // Recompute chart inner width on resize
  window.addEventListener('resize', ()=>{
    const inner = document.querySelector('.chart-inner');
    if (!inner) return;
    const labels = [
      'Human Resources','Project Management','Sales & CRM','Manufacturing & Production Mgmt.',
      'Inventory & Warehouse Mgmt.','Procurement','Finance and Accounting',
      'B.I. and Analytics','Compliance & Risk Mangement'
    ];
    const container = inner.parentElement;
    const containerWidth = container ? container.clientWidth : 0;
    const perCategoryWidth = 110;
    const dynamicWidth = Math.max(containerWidth, labels.length * perCategoryWidth);
    inner.style.width = dynamicWidth + 'px';
  });
})();
