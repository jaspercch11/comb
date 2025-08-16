(function(){
  const API='http://localhost:3000';
  const regsBody=document.getElementById('regsBody');
  const pendingList=document.getElementById('pendingList');
  const viewAllLink=document.querySelector('.view-all');
  let latestPending = [];

  let currentDeptFilter = '';
  let deptChoices = [];

  async function fetchRegs(){
    const res=await fetch(`${API}/api/regulations`);
    if(!res.ok) return [];
    const rows = await res.json();
    const nowMs = Date.now();
    const normalize = (r)=>{
      const nextReview = r.next_review_date || r.next_review || null;
      const lastReview = r.last_review || r.last_accessed_date || null;
      const dept = r.department || r.dept_responsible || r.dept || '';
      const name = r.name || r.regulation_name || r.title || '—';
      const daysUntil = nextReview ? Math.floor((new Date(nextReview).getTime() - nowMs) / (1000*60*60*24)) : null;
      const status = daysUntil !== null && daysUntil < 0 ? 'non-compliant' : 'compliant';
      return { name, department: dept, status, last_review: lastReview, next_review: nextReview };
    };
    return Array.isArray(rows) ? rows.map(normalize) : [];
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
      const riskLevel = r.risk_level || 'Medium';
      const riskLevelClass = riskLevel.toLowerCase();
      
      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.department}</td>
        <td>${r.status}</td>
        <td><span class="${riskLevelClass}">${riskLevel}</span></td>
        <td>${r.last_review ? new Date(r.last_review).toISOString().slice(0,10) : ''}</td>
        <td>${r.next_review ? new Date(r.next_review).toISOString().slice(0,10) : ''}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-view" onclick="viewRegulation(${r.id || r.regulation_id})">👁️ View</button>
            <button class="btn-edit" onclick="editRegulation(${r.id || r.regulation_id})">✏️ Edit</button>
          </div>
        </td>
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

  async function populateDeptFilter(){
    const btn = document.getElementById('deptFilterBtn');
    if(!btn) return;
    try{
      const [audits, incidents, documents, regs, risks] = await Promise.all([
        fetch('http://localhost:3000/audits').then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetch('http://localhost:3000/api/incidents').then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetch('http://localhost:3000/documents').then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetchRegs(),
        fetch('http://localhost:3000/api/risks').then(r=>r.ok?r.json():[]).catch(()=>[])
      ]);
      const norm = (s)=> String(s||'').trim();
      const set = new Set();
      audits.forEach(a=>{ const v=norm(a.dept_audited); if(v) set.add(v); });
      incidents.forEach(i=>{ const v=norm(i.department); if(v) set.add(v); });
      documents.forEach(d=>{ const v=norm(d.owner_dept); if(v) set.add(v); });
      regs.forEach(r=>{ const v=norm(r.department); if(v) set.add(v); });
      risks.forEach(r=>{ const v=norm(r.dept); if(v) set.add(v); });
      deptChoices = [''].concat(Array.from(set).sort());
      btn.addEventListener('click', openDeptFilterModal);
    }catch(_){ /* no-op */ }
  }

  function openDeptFilterModal(){
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    const modal=document.createElement('div');
    modal.className='modal';
    const options = deptChoices.map(v=>`<option value="${v}">${v||'All Departments'}</option>`).join('');
    modal.innerHTML = `
      <div class="modal-header"><h3>Select Department</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <label style="display:block; font-weight:600; margin-bottom:6px;">Department</label>
        <select id="deptSelectModal" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
          ${options}
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn" id="deptClearBtn">Clear</button>
        <button class="btn btn-primary" id="deptApplyBtn">Apply</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display='flex';

    const close=()=>{ try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick=close;
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
    document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });

    const selectEl = modal.querySelector('#deptSelectModal');
    selectEl.value = currentDeptFilter || '';
    modal.querySelector('#deptClearBtn').onclick = ()=>{ currentDeptFilter=''; renderChart(); close(); };
    modal.querySelector('#deptApplyBtn').onclick = ()=>{ currentDeptFilter = selectEl.value || ''; renderChart(); close(); };
  }

  async function renderChart(){
    async function fetchArray(url){
      try{
        const res = await fetch(url);
        if(!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }catch(_){
        return [];
      }
    }

    // Fetch risks data to get department-based risk counts
    const risks = await fetchArray(`${API}/api/risks`);
    
    // Group risks by department and count them
    const deptRiskCounts = {};
    risks.forEach(risk => {
      const dept = risk.dept || 'Unknown Department';
      if (!deptRiskCounts[dept]) {
        deptRiskCounts[dept] = 0;
      }
      deptRiskCounts[dept]++;
    });

    // Apply department filter if set
    if (currentDeptFilter) {
      const filteredDeptRiskCounts = {};
      if (deptRiskCounts[currentDeptFilter]) {
        filteredDeptRiskCounts[currentDeptFilter] = deptRiskCounts[currentDeptFilter];
      }
      deptRiskCounts = filteredDeptRiskCounts;
    }

    // Convert to arrays for chart
    const labels = Object.keys(deptRiskCounts);
    const counts = Object.values(deptRiskCounts);

    // If no departments found, show a default message
    if (labels.length === 0) {
      labels.push('No Departments');
      counts.push(0);
    }

    const ctx = document.getElementById('complianceChart').getContext('2d');
    if (window._regComplianceChart) {
      window._regComplianceChart.destroy();
    }

    const perCategoryWidth = 110; // px/bar label area
    const inner = document.querySelector('.chart-inner');
    if (inner) {
      const container = inner.parentElement;
      const containerWidth = container ? container.clientWidth : 0;
      const dynamicWidth = Math.max(containerWidth, labels.length * perCategoryWidth);
      inner.style.width = dynamicWidth + 'px';
    }

    window._regComplianceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: currentDeptFilter ? `Risks (${currentDeptFilter})` : 'Risk Count by Department',
            data: counts,
            backgroundColor: '#ef5350',
            borderColor: '#d32f2f',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { 
          y: { 
            beginAtZero: true, 
            ticks: { precision: 0 },
            title: {
              display: true,
              text: 'Number of Risks'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Departments'
            }
          }
        },
        plugins: { 
          legend: { position: 'top' },
          title: {
            display: true,
            text: currentDeptFilter ? `Risk Distribution - ${currentDeptFilter}` : 'Risk Distribution by Department'
          }
        }
      }
    });
  }

  function renderPending(rows){
    latestPending = Array.isArray(rows) ? rows.slice() : [];
    pendingList.innerHTML='';
    rows.slice(0,3).forEach(p=>{
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
    await populateDeptFilter();
    
    // Add event listener for Add New Regulation button
    const addRegulationBtn = document.getElementById('addRegulationBtn');
    if (addRegulationBtn) {
      addRegulationBtn.addEventListener('click', openAddRegulationModal);
    }
  }

  load();
  renderChart();
  setInterval(async()=>{
    renderTopCards(await fetchRegs());
    renderPending(await fetchPending());
  }, 5000);

  // Initialize logout functionality
  initializeLogout();

  // Logout functionality
  function initializeLogout() {
    const userSection = document.getElementById('userSection');
    const logoutDropdown = document.getElementById('logoutDropdown');
    
    if (userSection && logoutDropdown) {
      // Show logout dropdown on user section click
      userSection.addEventListener('click', (e) => {
        e.stopPropagation();
        logoutDropdown.classList.toggle('show');
      });
      
      // Hide logout dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userSection.contains(e.target)) {
          logoutDropdown.classList.remove('show');
        }
      });
    }
  }

  // Logout function
  function logout() {
    // You can add any cleanup logic here (clear session, etc.)
    window.location.href = 'index.html';
  }

  if(viewAllLink){
    viewAllLink.addEventListener('click', async (e)=>{
      e.preventDefault();
      try{
        if(!latestPending.length){ latestPending = await fetchPending(); }
        openAllPendingModal(latestPending);
      }catch(err){ /* no-op */ }
    });
  }

  // Regulation management functions
  window.viewRegulation = function(id) {
    // For now, show a simple view modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header"><h3>View Regulation</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p><strong>Regulation ID:</strong> ${id}</p>
        <p>This is a placeholder for the regulation view functionality.</p>
        <p>In a full implementation, this would show detailed regulation information.</p>
      </div>
      <div class="modal-actions"><button class="btn btn-primary">Close</button></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';
    
    const close = () => { try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick = close;
    modal.querySelector('.btn').onclick = close;
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    document.addEventListener('keydown', function onKey(e) { if(e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  };

  window.editRegulation = function(id) {
    // For now, show a simple edit modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header"><h3>Edit Regulation</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p><strong>Regulation ID:</strong> ${id}</p>
        <p>This is a placeholder for the regulation edit functionality.</p>
        <p>In a full implementation, this would show an edit form.</p>
      </div>
      <div class="modal-actions"><button class="btn btn-primary">Close</button></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';
    
    const close = () => { try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick = close;
    modal.querySelector('.btn').onclick = close;
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    document.addEventListener('keydown', function onKey(e) { if(e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  };

  function openAddRegulationModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header"><h3>Add New Regulation</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <form id="addRegulationForm">
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Regulation Name:</label>
            <input type="text" id="regName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Department:</label>
            <input type="text" id="regDepartment" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Risk Level:</label>
            <select id="regRiskLevel" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="Low">Low</option>
              <option value="Medium" selected>Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Next Review Date:</label>
            <input type="date" id="regNextReview" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
        </form>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeAddRegulationModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitAddRegulation()">Add Regulation</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';
    
    const close = () => { try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick = close;
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    document.addEventListener('keydown', function onKey(e) { if(e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('regNextReview').value = tomorrow.toISOString().slice(0, 10);
  }

  function closeAddRegulationModal() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      try { document.body.removeChild(overlay); } catch(e){}
    }
  }

  async function submitAddRegulation() {
    const name = document.getElementById('regName').value;
    const department = document.getElementById('regDepartment').value;
    const riskLevel = document.getElementById('regRiskLevel').value;
    const nextReview = document.getElementById('regNextReview').value;
    
    if (!name || !department || !nextReview) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      // This would typically send data to your backend API
      // For now, we'll just show a success message and close the modal
      alert('Regulation added successfully! (This is a demo - data would be saved to database in production)');
      closeAddRegulationModal();
      
      // Refresh the regulations list
      const regs = await fetchRegs();
      renderRegs(regs);
      renderTopCards(regs);
    } catch (error) {
      alert('Error adding regulation: ' + error.message);
    }
  }

  // Recompute chart inner width on resize
  window.addEventListener('resize', ()=>{
    const inner = document.querySelector('.chart-inner');
    if (!inner) return;
    const labels = (window._regComplianceChart && window._regComplianceChart.data && window._regComplianceChart.data.labels) || [];
    const container = inner.parentElement;
    const containerWidth = container ? container.clientWidth : 0;
    const perCategoryWidth = 110;
    const dynamicWidth = Math.max(containerWidth, labels.length * perCategoryWidth);
    inner.style.width = dynamicWidth + 'px';
  });
})();



