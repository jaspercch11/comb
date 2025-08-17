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
    const inProgress = incidents.filter(i => i.status === 'In Progress' || i.status === 'Investigating').length;
    const resolved = incidents.filter(i => i.status === 'Resolved').length;

    cardOpen.textContent = open;
    cardCritical.textContent = critical;
    cardInProgress.textContent = inProgress;
    cardResolved.textContent = resolved;
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
          <button class="btn btn-view view-btn" onclick="viewIncident(${incident.incident_id})">👁️ View</button>
          <button class="btn btn-edit" onclick="editIncidentStatus(${incident.incident_id})">✏️ Edit</button>
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