/* ============================================
   >>> LOAD AUDITS AND UPDATE DASHBOARD <<<
   ============================================ */
  let allAudits = [];
  let auditFilters = { dept: '', status: '' };

  function renderAudits() {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const normalized = allAudits.map(a => ({
      ...a,
      status_norm: (a.status || '').toLowerCase().trim(),
    }));

    const filtered = normalized.filter(a => {
      const deptOk = !auditFilters.dept || a.dept_audited === auditFilters.dept;
      const statusOk = !auditFilters.status || a.status_norm === auditFilters.status.toLowerCase();
      return deptOk && statusOk;
    });

    filtered.forEach(audit => {
      const row = document.createElement("tr");
      row.setAttribute('data-audit-id', audit.audit_id);
      row.innerHTML = `
          <td>${audit.audit_name || "N/A"}</td>
          <td>${audit.dept_audited || "N/A"}</td>
          <td>${audit.auditor || "N/A"}</td>
          <td>${audit.audit_date ? new Date(audit.audit_date).toLocaleDateString() : "N/A"}</td>
          <td><span class="badge ${getStatusColor(audit.status_norm)}">${formatStatus(audit.status_norm)}</span></td>
          <td class="table-actions">
            <button class="btn view">View</button>
            <button class="btn edit">Edit</button>
          </td>
        `;
      tbody.appendChild(row);
    });
  }

  async function loadAudits() {
    try {
      const res = await fetch("http://localhost:3000/audits");
      const audits = await res.json();

      allAudits = audits;
      renderAudits();

      const today = new Date();
      const currentYear = today.getFullYear();

      // Count only audits with audit_date in current year
      let totalAudits = audits.filter(audit => {
        if (!audit.audit_date) return false;
        const auditYear = new Date(audit.audit_date).getFullYear();
        return auditYear === currentYear;
      }).length;

      let upcomingAudits = 0;
      let openFindings = 0;
      let highRiskIssues = 0;

      audits.forEach(audit => {
        const status = (audit.status || "").toLowerCase().trim();

        // Metrics Calculation
        if (audit.audit_date && new Date(audit.audit_date) > today) {
          upcomingAudits++;
        }
        if (status === "completed") {
          openFindings++;
        }
        if (status === "pending") {
          highRiskIssues++;
        }
        if (status === "in progress") {
          upcomingAudits++;
        }
      });

      // Update Dashboard Widgets
      document.getElementById("totalAudits").textContent = totalAudits;
      document.getElementById("upcomingAudits").textContent = upcomingAudits;
      document.getElementById("openFindings").textContent = openFindings;
      document.getElementById("highRiskIssues").textContent = highRiskIssues;

      // Skip populating dept options dynamically; static list is provided in HTML

    } catch (err) {
      console.error("Error fetching audits:", err);
    }
  }

/* ============================================
   >>> STATUS COLOR AND LABEL FORMATTERS <<<
   ============================================ */
function getStatusColor(statusRaw) {
  const status = (statusRaw || "").toLowerCase().trim();
  if (status === "completed") return "green";
  if (status === "scheduled") return "yellow";
  if (status === "pending") return "red";
  if (status === "in progress") return "manta";
  return "";
}

function formatStatus(statusRaw) {
  const status = (statusRaw || "").toLowerCase().trim();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* ============================================
   >>> LOAD PIE CHART OF AUDIT STATUS SUMMARY <<<
   ============================================ */
async function loadChart() {
  try {
    const res = await fetch("http://localhost:3000/audit-status-summary");
    const data = await res.json();

    // ==== Normalize and Group Statuses ====
    const statusCounts = {};
    data.forEach(({ status, count }) => {
      const normalized = (status || "").toLowerCase().trim();
      statusCounts[normalized] = (statusCounts[normalized] || 0) + parseInt(count);
    });

    const labels = Object.keys(statusCounts).map(s => formatStatus(s));
    const counts = Object.values(statusCounts);

    // ==== Chart Colors Mapping ====
    const colorMap = {
      "completed": "#33cc33",
      "scheduled": "#fdd835",
      "in progress": "#253f49ff",
      "pending": "#F44336"
    };

    const backgroundColor = Object.keys(statusCounts).map(status => colorMap[status] || "#ccc");

    // ==== Create Pie Chart ====
    const ctx = document.getElementById("auditStatusChart").getContext("2d");
    new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: backgroundColor
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "top"
          }
        }
      }
    });
  } catch (err) {
    console.error("Error loading chart:", err);
  }
}

async function loadActivities(){
  try{
    const res = await fetch('http://localhost:3000/activities?limit=6');
    const items = await res.json();
    const container = document.querySelector('.recent-activity');
    if (!container) return;
    // remove old items (keep heading)
    container.querySelectorAll('.activity-item').forEach(el=> el.remove());
    (items || []).forEach(it => {
      const wrap = document.createElement('div');
      wrap.className = 'activity-item';
      const when = new Date(it.at);
      const timeEl = document.createElement('time');
      timeEl.innerHTML = `${when.toLocaleDateString()}<br>${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const p = document.createElement('p');
      p.textContent = it.message;
      wrap.appendChild(timeEl);
      wrap.appendChild(p);
      wrap.style.cursor = 'pointer';
      wrap.addEventListener('click', () => openActivityModal(it));
      container.appendChild(wrap);
    });
  }catch(err){ /* no-op */ }
}

function openActivityModal(activity){
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  const modal = document.createElement('div');
  modal.className = 'modal-content styled-form';
  const when = activity.at ? new Date(activity.at) : null;
  const dateStr = when && !isNaN(when.getTime()) ? `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—';
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Activity Details</h3>
      <button class="close-btn" type="button">✕</button>
    </div>
    <div>
      <p><strong>Department:</strong> ${activity.dept || '—'}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Message:</strong> ${activity.message || '—'}</p>
    </div>
    <div class="modal-buttons">
      <button type="button" class="upload-btn">Notify Department</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
  const close = () => { try { document.body.removeChild(overlay); } catch(e){} };
  modal.querySelector('.close-btn').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
}

/* ============================================
   >>> FORM SUBMISSION HANDLER <<<
   ============================================ */
document.getElementById('auditForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  // ==== Collect Form Data ====
  const auditData = {
    audit_id: this.auditId.value.trim(),
    audit_name: this.auditName.value.trim(),
    dept_audited: this.department.value,
    auditor: this.auditor.value.trim(),
    audit_date: this.auditDate.value,
    status: this.status.value.trim().toLowerCase(), // normalized to lowercase for case-insensitive
    actor: this.auditor.value.trim() || 'User'
  };

  try {
    const response = await fetch('http://localhost:3000/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditData),
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ Audit added successfully!');
      this.reset();
      closeFloatingTab();

      // ==== Reload page to show new entry ====
      setTimeout(() => {
        window.location.href = 'audit.html';
      }, 1000);
    } else {
      alert('❌ Failed to add audit: ' + (result.message || 'Unknown error'));
    }
  } catch (err) {
    alert('⚠️ Error submitting audit: ' + err.message);
  }
});

/* ============================================
   >>> FILTER MODAL WIRING <<<
   ============================================ */
function closeAuditFilterModal() {
  const modal = document.getElementById('auditFilterModal');
  if (modal) modal.style.display = 'none';
}

function resetAuditFilters() {
  auditFilters = { dept: '', status: '' };
  const form = document.getElementById('auditFilterForm');
  if (form) form.reset();
  renderAudits();
  closeAuditFilterModal();
}

function openAuditViewModal(audit){
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  const modal = document.createElement('div');
  modal.className = 'modal-content styled-form';
  modal.innerHTML = `
    <div class="modal-header">
      <h3>📄 Audit Details</h3>
      <button class="close-btn" type="button">✕</button>
    </div>
    <div>
      <p><strong>ID:</strong> ${audit.audit_id || '—'}</p>
      <p><strong>Name:</strong> ${audit.audit_name || '—'}</p>
      <p><strong>Department:</strong> ${audit.dept_audited || '—'}</p>
      <p><strong>Auditor:</strong> ${audit.auditor || '—'}</p>
      <p><strong>Date:</strong> ${audit.audit_date ? new Date(audit.audit_date).toLocaleDateString() : '—'}</p>
      <p><strong>Status:</strong> ${formatStatus((audit.status || '').toLowerCase().trim())}</p>
    </div>
    <div class="modal-buttons">
      <button class="cancel-btn" type="button">Close</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.style.display='flex';
  const close=()=>{ try{ document.body.removeChild(overlay);}catch(e){} };
  modal.querySelector('.close-btn').onclick=close;
  modal.querySelector('.cancel-btn').onclick=close;
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
}

function openAuditEditModal(audit){
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  const modal = document.createElement('div');
  modal.className = 'modal-content styled-form';
  modal.innerHTML = `
    <div class="modal-header">
      <h3>✏️ Edit Audit</h3>
      <button class="close-btn" type="button">✕</button>
    </div>
    <div>
      <p><strong>Name:</strong> ${audit.audit_name || ''}</p>
      <p><strong>Department:</strong> ${audit.dept_audited || ''}</p>
      <p><strong>Auditor:</strong> ${audit.auditor || ''}</p>
    </div>
    <form id="auditEditForm" style="margin-top: 8px;">
      <label><span>Date</span>
        <input type="date" name="audit_date" value="${audit.audit_date ? new Date(audit.audit_date).toISOString().slice(0,10) : ''}" required />
      </label>
      <label><span>Status</span>
        <select name="status" required>
          <option${((audit.status||'').toLowerCase()==='completed')?' selected':''}>Completed</option>
          <option${((audit.status||'').toLowerCase()==='scheduled')?' selected':''}>Scheduled</option>
          <option${((audit.status||'').toLowerCase()==='pending')?' selected':''}>Pending</option>
          <option${((audit.status||'').toLowerCase()==='in progress')?' selected':''}>In Progress</option>
        </select>
      </label>
      <div class="modal-buttons">
        <button type="button" class="cancel-btn">Cancel</button>
        <button type="submit" class="upload-btn">Save</button>
      </div>
    </form>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.style.display='flex';
  const close=()=>{ try{ document.body.removeChild(overlay);}catch(e){} };
  modal.querySelector('.close-btn').onclick=close;
  modal.querySelector('.cancel-btn').onclick=close;
  modal.querySelector('#auditEditForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.target;
    const payload = {
      audit_name: audit.audit_name || '',
      dept_audited: audit.dept_audited || '',
      auditor: audit.auditor || '',
      audit_date: form.audit_date.value,
      status: form.status.value.trim().toLowerCase(),
      actor: (audit.auditor || 'User')
    };
    try{
      const resp = await fetch(`http://localhost:3000/audits/${encodeURIComponent(audit.audit_id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if(!resp.ok || !result.success){ throw new Error(result.error || 'Failed'); }
      await loadAudits();
      await loadActivities();
      close();
    }catch(err){
      alert('Failed to update audit');
    }
  });
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
}

function wireAuditInteractions(){
  // Filter modal wiring
  const filterBtn = document.querySelector('.btn.btn-filter');
  const modal = document.getElementById('auditFilterModal');
  const form = document.getElementById('auditFilterForm');
  if (filterBtn && modal && form) {
    filterBtn.addEventListener('click', () => {
      document.getElementById('auditFilterDept').value = auditFilters.dept;
      document.getElementById('auditFilterStatus').value = auditFilters.status;
      modal.style.display = 'flex';
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAuditFilterModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeAuditFilterModal(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      auditFilters.dept = document.getElementById('auditFilterDept').value;
      auditFilters.status = document.getElementById('auditFilterStatus').value.toLowerCase();
      renderAudits();
      closeAuditFilterModal();
    });
  }
  // View/Edit delegation
  const tbody = document.querySelector('tbody');
  if (tbody) {
    tbody.addEventListener('click', (e)=>{
      const viewBtn = e.target.closest('button.btn.view');
      const editBtn = e.target.closest('button.btn.edit');
      if (!viewBtn && !editBtn) return;
      const tr = e.target.closest('tr');
      const id = tr && tr.getAttribute('data-audit-id');
      const audit = allAudits.find(a => String(a.audit_id) === String(id));
      if (!audit) return;
      if (viewBtn) return openAuditViewModal(audit);
      if (editBtn) return openAuditEditModal(audit);
    });
  }
}

/* ============================================
   >>> INITIAL LOAD ON PAGE READY <<<
   ============================================ */
loadAudits();
loadChart();
wireAuditInteractions();

loadActivities();

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