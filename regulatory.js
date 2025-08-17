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
      const nextReview = r.next_review || r.next_review_date || null;
      const lastReview = r.last_review || r.last_accessed_date || null;
      const dept = r.department || r.dept_responsible || r.dept || '';
      const name = r.name || r.regulation_name || r.title || '—';
      const riskLevel = r.risk_level || 'Medium';
      
      // Use database status if available, otherwise calculate based on review dates
      let status = r.status;
      if (!status){
        const daysUntil = nextReview ? Math.floor((new Date(nextReview).getTime() - nowMs) / (1000*60*60*24)) : null;
        status = daysUntil !== null && daysUntil < 0 ? 'non-compliant' : 'compliant';
      }
      
      return { 
        id: r.regulation_id, 
        name, 
        department: dept, 
        status, 
        risk_level: riskLevel,
        last_review: lastReview, 
        next_review: nextReview 
      };
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
      
      // Create status class for styling
      const statusClass = `status-${r.status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${Array.isArray(r.departments) ? r.departments.join(', ') : (r.department || 'Not Assigned')}</td>
        <td><span class="${statusClass}">${r.status}</span></td>
        <td><span class="${riskLevelClass}">${riskLevel}</span></td>
        <td>${r.last_review ? new Date(r.last_review).toISOString().slice(0,10) : 'Not Reviewed'}</td>
        <td>${r.next_review ? new Date(r.next_review).toISOString().slice(0,10) : 'Not Scheduled'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-view" onclick="viewRegulation(${r.id})">View</button>
            <button class="btn-edit" onclick="editRegulation(${r.id})">Edit</button>
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
    const active = rows.filter(r=> String(r.status||'').toLowerCase()==='active').length;
    const pending = rows.filter(r=> String(r.status||'').toLowerCase()==='pending').length;
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

    // Calculate proper width for chart to accommodate all labels
    const perCategoryWidth = 140; // Increased width per bar to accommodate longer department names
    const minBarWidth = 60; // Minimum width for each bar
    const labelPadding = 20; // Extra padding for labels
    
    const inner = document.querySelector('.chart-inner');
    if (inner) {
      const container = inner.parentElement;
      const containerWidth = container ? container.clientWidth : 0;
      const minWidth = 700;
      const dynamicWidth = Math.max(minWidth, labels.length * perCategoryWidth + labelPadding);
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
            borderWidth: 1,
            maxBarThickness: 60
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { 
          y: { 
            beginAtZero: true, 
            ticks: { precision: 0, font: { size: 13 } },
            title: {
              display: true,
              text: 'Number of Risks'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Departments'
            },
            ticks: {
              // Prevent label rotation - keep them horizontal
              maxRotation: 0,
              minRotation: 0,
              // Show all labels even if they overlap
              autoSkip: false,
              // Ensure labels are readable
              font: {
                size: 13
              },
              // Add some padding between bars and labels
              padding: 8,
              // Ensure proper spacing
              callback: function(value, index, values) {
                // Return the label text
                return labels[index];
              }
            },
            // Ensure proper spacing for labels
            grid: {
              display: false
            },
            // Add some space for labels
            afterFit: function(scale) {
              scale.paddingBottom = 15;
            }
          }
        },
        plugins: { 
          legend: { position: 'top', labels: { font: { size: 12 } } },
          title: {
            display: true,
            text: currentDeptFilter ? `Risk Distribution - ${currentDeptFilter}` : 'Risk Distribution by Department',
            font: { size: 18 }
          }
        },
        // Ensure proper spacing between bars
        layout: {
          padding: {
            left: 20,
            right: 20,
            top: 20,
            bottom: 72 // Increased bottom padding for labels
          }
        },
        // Ensure bars are properly spaced
        elements: {
          bar: {
            borderWidth: 1,
            borderRadius: 4
          }
        },
        // Responsive behavior
        responsive: true,
        maintainAspectRatio: false
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

  async function fetchNotifications(scope){
    try{
      const dept = 'Compliance & Risk Management';
      const url = scope === 'dept' ? `http://localhost:3000/api/notif?dept=${encodeURIComponent(dept)}` : `http://localhost:3000/api/notif`;
      const res = await fetch(url);
      if(!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list : [];
    }catch(_){ return []; }
  }

  function renderNotifItem(n){
    const dateStr = n.date ? new Date(n.date).toLocaleString() : '';
    const badge = (n.priority && n.priority !== 'normal') ? `<span style="font-size:10px; padding:2px 6px; border-radius:9999px; background:${n.priority==='high'?'#fde68a':n.priority==='urgent'?'#fecaca':'#e5e7eb'}; margin-left:6px;">${n.priority}</span>` : '';
    return `
      <div style="padding:10px 12px; border-bottom:1px solid #f1f5f9;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1;">
            <div style="font-weight:600; color:#111; font-size:14px;">${n.title || 'Notification'}${badge}</div>
            <div style="color:#374151; font-size:12px;">${n.message || ''}</div>
            <div style="color:#6b7280; font-size:11px; margin-top:4px;">${dateStr}</div>
          </div>
          ${n.action_url ? `<a href="${n.action_url}" target="_blank" style="font-size:11px; white-space:nowrap;">Open</a>` : ''}
        </div>
      </div>`;
  }

  async function initNotificationsUI(){
    const bell = document.getElementById('notifBell');
    const pop = document.getElementById('notifPopover');
    const listEl = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    const closeBtn = document.getElementById('notifCloseBtn');
    const scopeInputs = document.querySelectorAll('input[name="notifScope"]');
    if(!bell || !pop || !listEl || !badge || !closeBtn) return;

    let currentScope = 'dept';
    function hide(){ pop.style.display='none'; }
    function toggle(){ pop.style.display = (pop.style.display==='none' || !pop.style.display) ? 'block' : 'none'; }

    async function loadList(){
      const items = await fetchNotifications(currentScope);
      listEl.innerHTML = items.length ? items.map(renderNotifItem).join('') : '<div style="padding:12px; color:#6b7280;">No notifications</div>';
    }

    bell.addEventListener('click', async ()=>{
      toggle();
      if(pop.style.display==='block'){
        await loadList();
      }
    });

    scopeInputs.forEach(inp => inp.addEventListener('change', async (e)=>{
      currentScope = e.target.value === 'all' ? 'all' : 'dept';
      await loadList();
      // Update badge to reflect current scope
      await refreshBadge();
    }));
    closeBtn.addEventListener('click', hide);
    document.addEventListener('click', (e)=>{
      const wrap = bell.closest('.notif-wrapper');
      if (wrap && !wrap.contains(e.target)) hide();
    });

    async function refreshBadge(){
      try{
        const dept = 'Compliance & Risk Management';
        const url = currentScope === 'dept' ? `http://localhost:3000/api/notif/count?dept=${encodeURIComponent(dept)}` : `http://localhost:3000/api/notif/count`;
        const res = await fetch(url);
        const data = await res.json();
        const count = Number(data.count)||0;
        if(count>0){ badge.style.display='inline-block'; badge.textContent = String(count); }
        else { badge.style.display='none'; }
      }catch(_){ badge.style.display='none'; }
    }
    await refreshBadge();
    setInterval(refreshBadge, 15000);
  }

  async function load(){
    const regs = await fetchRegs();
    renderRegs(regs);
    renderTopCards(regs);
    renderPending(await fetchPending());
    await populateDeptFilter();
    
    // Add event listener for Add New Regulation button
    const addRegulationBtn = document.getElementById('addRegulationBtn');
    if (addRegulationBtn) {
      addRegulationBtn.addEventListener('click', openAddRegulationModal);
    }
  }

  load();
  renderChart();
  initNotificationsUI();
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
  // Expose globally for sidebar onclick
  try { window.logout = logout; } catch(_){}

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
  window.viewRegulation = async function(id) {
    try {
      // Fetch regulation details
      const regResponse = await fetch(`${API}/api/regulations`);
      const regulations = await regResponse.json();
      const regulation = regulations.find(r => r.regulation_id == id);
      
      if (!regulation) {
        alert('Regulation not found');
        return;
      }
      
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
              modal.innerHTML = `
          <div class="modal-header"><h3>View Regulation</h3><button class="modal-close">&times;</button></div>
          <div class="modal-body">
            <p><strong>Regulation ID:</strong> ${regulation.regulation_id}</p>
            <p><strong>Name:</strong> ${regulation.title || regulation.name}</p>
            <p><strong>Department:</strong> ${regulation.department || 'Not Assigned'}</p>
            <p><strong>Status:</strong> <span class="status-${(regulation.status || 'Active').toLowerCase().replace(/[^a-z0-9]/g, '-')}">${regulation.status || 'Active'}</span></p>
            <p><strong>Risk Level:</strong> ${regulation.risk_level || 'Medium'}</p>
            <p><strong>Last Review:</strong> ${regulation.last_review ? new Date(regulation.last_review).toISOString().slice(0,10) : 'Not Reviewed'}</p>
            <p><strong>Next Review:</strong> ${regulation.next_review ? new Date(regulation.next_review).toISOString().slice(0,10) : 'Not Scheduled'}</p>
            <p><strong>Description:</strong> ${regulation.description || 'No description available'}</p>
          </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      overlay.style.display = 'flex';
      
      const close = () => { try { document.body.removeChild(overlay); } catch(e){} };
      modal.querySelector('.modal-close').onclick = close;
      overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
      document.addEventListener('keydown', function onKey(e) { if(e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
    } catch (error) {
      console.error('Error viewing regulation:', error);
      alert('Error loading regulation details');
    }
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

  async function openAddRegulationModal() {
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
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Department(s):</label>
            <div id="deptMultiContainer" style="display: flex; flex-direction: column; gap: 8px;"></div>
            <button type="button" id="addDeptRowBtn" class="btn" style="width: auto;">+ Add Department</button>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Status:</label>
            <select id="regStatus" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="Active" selected>Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
              <option value="Under Review">Under Review</option>
              <option value="Compliant">Compliant</option>
              <option value="Non-Compliant">Non-Compliant</option>
            </select>
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
            <label style="display: block; font-weight: 600; margin-bottom: 5px;">Last Review Date:</label>
            <input type="date" id="regLastReview" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
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

    // Populate departments from audit.html's New form options
    try {
      const resp = await fetch('audit.html');
      const html = await resp.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const deptSelect = tmp.querySelector('#department');
      const opts = deptSelect ? Array.from(deptSelect.querySelectorAll('option')) : [];
      const choices = opts
        .map(o => o.textContent.trim())
        .filter(v => v && v.toLowerCase() !== 'select department');
      const fallback = (Array.isArray(deptChoices) ? deptChoices : []).filter(v => v);
      const source = (choices.length ? choices : fallback).filter((v, i, a) => a.indexOf(v) === i);

      const container = modal.querySelector('#deptMultiContainer');
      const addBtn = modal.querySelector('#addDeptRowBtn');

      function getSelectedValues(){
        return Array.from(container.querySelectorAll('.regDeptSelect'))
          .map(sel => sel.value)
          .filter(Boolean);
      }

      function updateAddBtnState(){
        const selects = Array.from(container.querySelectorAll('.regDeptSelect'));
        const selectedCount = getSelectedValues().length;
        const available = source.length - selectedCount;
        const hasUnchosen = selects.some(sel => !sel.value);
        if (addBtn){
          addBtn.disabled = available <= 0 || hasUnchosen;
          addBtn.style.opacity = addBtn.disabled ? '0.6' : '1';
          addBtn.style.cursor = addBtn.disabled ? 'not-allowed' : 'pointer';
        }
      }

      function refreshAllSelects(){
        const selected = getSelectedValues();
        const selects = Array.from(container.querySelectorAll('.regDeptSelect'));
        selects.forEach(sel => {
          const current = sel.value;
          Array.from(sel.options).forEach(opt => {
            if (opt.value === '') { opt.disabled = false; return; }
            opt.disabled = selected.includes(opt.value) && opt.value !== current;
          });
          // Keep placeholder if nothing chosen; otherwise ensure current remains valid
          if (!current) {
            sel.value = '';
          } else if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) {
            const firstAvail = Array.from(sel.options).find(o => !o.disabled && o.value !== '');
            sel.value = firstAvail ? firstAvail.value : '';
          }
        });
        updateAddBtnState();
      }

      function createRow() {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.innerHTML = `
          <select class="regDeptSelect" style="flex:1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="" disabled selected>Select Department</option>
            ${source.map(v => `<option value="${v}">${v}</option>`).join('')}
          </select>
          <button type="button" class="btn" data-role="remove" style="background:#eee;">✕</button>
        `;
        const sel = row.querySelector('.regDeptSelect');
        sel.addEventListener('change', refreshAllSelects);
        const removeBtn = row.querySelector('[data-role="remove"]');
        removeBtn.addEventListener('click', () => {
          container.removeChild(row);
          refreshAllSelects();
          ensureAtLeastOneRow();
        });
        container.appendChild(row);
        // Ensure placeholder remains if no selection yet
        refreshAllSelects();
      }

      function ensureAtLeastOneRow(){
        if (!container.querySelector('.regDeptSelect')) {
          createRow();
        } else {
          refreshAllSelects();
        }
      }

      if (container && addBtn && source.length) {
        addBtn.addEventListener('click', createRow);
        createRow();
      }
    } catch (_) { /* ignore */ }

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
    const departments = Array.from(document.querySelectorAll('.regDeptSelect')).map(s => s.value).filter(Boolean);
    const status = document.getElementById('regStatus').value;
    const riskLevel = document.getElementById('regRiskLevel').value;
    const lastReview = document.getElementById('regLastReview').value;
    const nextReview = document.getElementById('regNextReview').value;
    
    if (!name || !departments.length || !nextReview) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      // This would typically send data to your backend API
      // For demo, just show success and close modal
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
    const perCategoryWidth = 140;
    const labelPadding = 20;
    const minWidth = 700;
    const dynamicWidth = Math.max(minWidth, labels.length * perCategoryWidth + labelPadding);
    inner.style.width = dynamicWidth + 'px';
  });
})();





