(function() {
  const API_BASE = 'http://localhost:3000';
  let allIncidents = [];
  let currentFilters = { status: '', severity: '' };

  // DOM elements
  const incidentTableBody = document.getElementById('incident-table-body');
  const cardOpen = document.getElementById('cardOpen');
  const cardCritical = document.getElementById('cardCritical');
  const cardInProgress = document.getElementById('cardInProgress');
  const cardResolved = document.getElementById('cardResolved');

  // API functions
  async function fetchIncidents() {
    try {
      const response = await fetch(`${API_BASE}/api/incidents`);
      if (!response.ok) {
        throw new Error('Failed to fetch incidents');
      }
      const incidents = await response.json();
      return Array.isArray(incidents) ? incidents : [];
    } catch (error) {
      console.error('Error fetching incidents:', error);
      return [];
    }
  }

  async function fetchIncident(id) {
    try {
      const response = await fetch(`${API_BASE}/api/incidents/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch incident');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching incident:', error);
      return null;
    }
  }

  async function updateIncidentStatus(id, status) {
    try {
      const response = await fetch(`${API_BASE}/api/incidents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error('Failed to update incident');
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating incident:', error);
      return null;
    }
  }

  // Render functions
  function updateDashboardCards(incidents) {
    const open = incidents.filter(i => i.status === 'Open').length;
    const critical = incidents.filter(i => i.severity_level === 'Critical').length;
    const investigating = incidents.filter(i => i.status === 'Investigating').length;
    const inProgress = incidents.filter(i => i.status === 'In Progress').length;
    const resolved = incidents.filter(i => i.status === 'Resolved').length;

    cardOpen.textContent = open;
    cardCritical.textContent = critical;
    cardInProgress.textContent = inProgress + investigating; // Show combined count
    cardResolved.textContent = resolved;

    // Add clickable styling and click handlers to the whole cards
    const cardElements = document.querySelectorAll('.card');
    cardElements.forEach((card, index) => {
      card.style.cursor = 'pointer';
      card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
      
      // Store the original box-shadow
      const originalBoxShadow = card.style.boxShadow || '0 2px 8px rgba(0,0,0,0.08)';
      
      // Add hover effects
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = originalBoxShadow;
      });
      
      // Add click handlers based on card index
      card.addEventListener('click', () => {
        switch(index) {
          case 0: // Open Incidents
            showIncidentsByStatus('Open', incidents);
            break;
          case 1: // Critical Priority
            showIncidentsBySeverity('Critical', incidents);
            break;
          case 2: // In Progress
            showIncidentsByStatus(['In Progress', 'Investigating'], incidents);
            break;
          case 3: // Resolved
            showIncidentsByStatus('Resolved', incidents);
            break;
        }
      });
    });
  }

  function renderIncidents(incidents = allIncidents) {
    if (!incidentTableBody) return;

    incidentTableBody.innerHTML = '';
    
    if (incidents.length === 0) {
      incidentTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
            No incidents found
          </td>
        </tr>
      `;
      return;
    }

    incidents.forEach(incident => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-incident-id', incident.incident_id);
      
      const statusClass = getStatusClass(incident.status);
      const severityClass = getSeverityClass(incident.severity_level);
      
      tr.innerHTML = `
        <td>${incident.incident_type || 'N/A'}</td>
        <td>${incident.date_reported ? new Date(incident.date_reported).toLocaleDateString() : 'N/A'}</td>
        <td><span class="status-badge ${statusClass}">${incident.status || 'Open'}</span></td>
        <td><span class="severity-badge ${severityClass}">${incident.severity_level || 'Medium'}</span></td>
        <td>
          <button class="btn btn-view view-btn" onclick="viewIncident(${incident.incident_id})">View</button>
          <button class="btn btn-edit" onclick="editIncidentStatus(${incident.incident_id})">Edit</button>
        </button>
        </td>
      `;
      
      incidentTableBody.appendChild(tr);
    });
  }

  function getStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'resolved') return 'status-resolved';
    if (s === 'in progress' || s === 'investigating') return 'status-progress';
    if (s === 'open') return 'status-open';
    return 'status-open';
  }

  function getSeverityClass(severity) {
    const s = String(severity || '').toLowerCase();
    if (s === 'critical') return 'severity-critical';
    if (s === 'high') return 'severity-high';
    if (s === 'medium') return 'severity-medium';
    if (s === 'low') return 'severity-low';
    return 'severity-medium';
  }

  // Filter functions
  function applyFilters() {
    let filtered = allIncidents;
    
    if (currentFilters.status) {
      filtered = filtered.filter(i => String(i.status || '').toLowerCase() === currentFilters.status.toLowerCase());
    }
    
    if (currentFilters.severity) {
      filtered = filtered.filter(i => String(i.severity_level || '').toLowerCase() === currentFilters.severity.toLowerCase());
    }
    
    renderIncidents(filtered);
  }

  function resetFilters() {
    currentFilters = { status: '', severity: '' };
    renderIncidents();
  }

  // Functions to show incidents by category
  function showIncidentsByStatus(status, incidents = allIncidents) {
    let filteredIncidents;
    if (Array.isArray(status)) {
      filteredIncidents = incidents.filter(i => status.includes(i.status));
    } else {
      filteredIncidents = incidents.filter(i => i.status === status);
    }
    showIncidentsModal(filteredIncidents, `Incidents - ${Array.isArray(status) ? status.join(' & ') : status}`);
  }

  function showIncidentsBySeverity(severity, incidents = allIncidents) {
    const filteredIncidents = incidents.filter(i => i.severity_level === severity);
    showIncidentsModal(filteredIncidents, `Incidents - ${severity} Priority`);
  }

  function showIncidentsModal(incidents, title) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'modal-content styled-form';
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 90%;
      width: 800px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Create modal header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    `;

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.margin = '0';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'close-btn';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 4px;
    `;
    closeBtn.onclick = () => document.body.removeChild(overlay);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Create incidents table
    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    `;

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #eee; background: #f8f9fa;">Incident Type</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #eee; background: #f8f9fa;">Date Reported</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #eee; background: #f8f9fa;">Status</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #eee; background: #f8f9fa;">Severity</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #eee; background: #f8f9fa;">Department</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #eee; background: #f8f9fa;">Actions</th>
      </tr>
    `;

    // Table body
    const tbody = document.createElement('tbody');
    if (incidents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px; color: #666;">
            No incidents found in this category
          </td>
        </tr>
      `;
    } else {
      incidents.forEach(incident => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        
        const statusClass = getStatusClass(incident.status);
        const severityClass = getSeverityClass(incident.severity_level);
        
        tr.innerHTML = `
          <td style="padding: 12px;">${incident.incident_type || 'N/A'}</td>
          <td style="padding: 12px;">${incident.date_reported ? new Date(incident.date_reported).toLocaleDateString() : 'N/A'}</td>
          <td style="padding: 12px;"><span class="status-badge ${statusClass}">${incident.status || 'Open'}</span></td>
          <td style="padding: 12px;"><span class="severity-badge ${severityClass}">${incident.severity_level || 'Medium'}</span></td>
          <td style="padding: 12px;">${incident.department || 'N/A'}</td>
          <td style="padding: 12px;">
            <button class="btn btn-view" onclick="viewIncident(${incident.incident_id})" style="margin-right: 5px;">View</button>
            <button class="btn btn-edit" onclick="editIncidentStatus(${incident.incident_id})">Edit</button>
          </td>
        `;
        
        tbody.appendChild(tr);
      });
    }

    table.appendChild(thead);
    table.appendChild(tbody);

    // Add summary
    const summary = document.createElement('div');
    summary.style.cssText = `
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 4px solid #007bff;
    `;
    summary.innerHTML = `
      <strong>Summary:</strong> ${incidents.length} incident${incidents.length !== 1 ? 's' : ''} found
    `;

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(table);
    modal.appendChild(summary);
    overlay.appendChild(modal);

    // Add click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // Add to page
    document.body.appendChild(overlay);
  }

  // Modal functions
  function openFilterModal() {
    const modal = document.getElementById('filterModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  function closeFilterModal() {
    const modal = document.getElementById('filterModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function openViewModal(incident) {
    const modal = document.getElementById('viewIncidentModal');
    if (!modal) return;

    // Populate modal with incident data
    document.getElementById('viewIncidentType').textContent = incident.incident_type || '—';
    document.getElementById('viewDateReported').textContent = incident.date_reported ? new Date(incident.date_reported).toLocaleDateString() : '—';
    document.getElementById('viewStatus').textContent = incident.status || '—';
    document.getElementById('viewSeverity').textContent = incident.severity_level || '—';
    document.getElementById('viewDepartment').textContent = incident.department || '—';
    document.getElementById('viewDescription').textContent = incident.description || '—';
    
    const evSpan = document.getElementById('viewEvidence');
    if (incident.evidence) {
      evSpan.innerHTML = `<a href="${API_BASE}/api/incidents/${incident.incident_id}/evidence">Download</a>`;
    } else {
      evSpan.textContent = '—';
    }

    // Set up send to risk button
    document.getElementById('sendToRiskBtn').onclick = () => sendToRisk(incident);
    
    modal.style.display = 'flex';
  }

  function closeViewModal() {
    const modal = document.getElementById('viewIncidentModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function openEditModal(incidentId) {
    const modal = document.getElementById('editStatusModal');
    if (!modal) return;

    // Set current status in form
    const statusSelect = modal.querySelector('select[name="status"]');
    const incident = allIncidents.find(i => String(i.incident_id) === String(incidentId));
    if (statusSelect && incident) {
      statusSelect.value = incident.status || 'Open';
    }

    // Set up form submission
    const form = document.getElementById('editStatusForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newStatus = statusSelect.value;
      
      try {
        await updateIncidentStatus(incidentId, newStatus);
        await loadIncidents();
        closeEditModal();
      } catch (error) {
        alert('Failed to update incident status');
      }
    };

    modal.style.display = 'flex';
  }

  function closeEditModal() {
    const modal = document.getElementById('editStatusModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async function sendToRisk(incident) {
    try {
      const payload = {
        risk_title: (incident.incident_type || 'Incident').slice(0, 200),
        dept: incident.department || 'Unassigned',
        review_date: incident.date_reported || new Date().toISOString().slice(0, 10),
        tasks: []
      };

      const res = await fetch(`${API_BASE}/api/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to send to risk register');
      
      const created = await res.json();
      
      // Update incident with risk_id
      await fetch(`${API_BASE}/api/incidents/${incident.incident_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_type: incident.incident_type,
          date_reported: incident.date_reported,
          status: 'Investigating',
          severity_level: incident.severity_level,
          risk_id: created.id
        })
      });

      await loadIncidents();
      alert('Sent to Risk Register');
      closeViewModal();
    } catch (error) {
      console.error('Error sending to risk:', error);
      alert('Failed to send to Risk Register');
    }
  }

  // Main load function
  async function loadIncidents() {
    try {
      allIncidents = await fetchIncidents();
      updateDashboardCards(allIncidents);
      renderIncidents();
    } catch (error) {
      console.error('Error loading incidents:', error);
    }
  }

  // Event listeners
  function initializeEventListeners() {
    // Filter modal
    const filterBtn = document.querySelector('.btn-filter');
    if (filterBtn) {
      filterBtn.addEventListener('click', openFilterModal);
    }

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });

    // Filter form
    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
      filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(filterForm);
        currentFilters.status = formData.get('status');
        currentFilters.severity = formData.get('severity');
        applyFilters();
        closeFilterModal();
      });
    }

    // Reset filters
    const resetBtn = document.querySelector('.cancel-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }
  }

  // Global functions for onclick handlers
  window.viewIncident = function(incidentId) {
    const incident = allIncidents.find(i => String(i.incident_id) === String(incidentId));
    if (incident) {
      openViewModal(incident);
    }
  };

  window.editIncidentStatus = function(incidentId) {
    openEditModal(incidentId);
  };

  window.closeFilterModal = closeFilterModal;
  window.closeViewModal = closeViewModal;
  window.closeEditModal = closeEditModal;
  window.resetIncidentFilters = resetFilters;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', async () => {
    await loadIncidents();
    initializeEventListeners();
    
    // Initialize logout functionality
    initializeLogout();
  });

  // Logout functionality
  function initializeLogout() {
    const userSection = document.getElementById('userSection');
    const logoutDropdown = document.getElementById('logoutDropdown');
    
    if (userSection && logoutDropdown) {
      userSection.addEventListener('click', (e) => {
        e.stopPropagation();
        logoutDropdown.classList.toggle('show');
      });
      
      document.addEventListener('click', (e) => {
        if (!userSection.contains(e.target)) {
          logoutDropdown.classList.remove('show');
        }
      });
    }
  }

  window.logout = function() {
    window.location.href = 'index.html';
  };

})();