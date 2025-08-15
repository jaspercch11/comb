(function(){
  const API='http://localhost:3000';
  const regsBody=document.getElementById('regsBody');
  const pendingList=document.getElementById('pendingList');

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
        <td>${r.dept_responsible || r.department || 'N/A'}</td>
        <td>${r.status || 'Active'}</td>
        <td>${r.last_review ? new Date(r.last_review).toISOString().slice(0,10) : ''}</td>
        <td>${r.next_review_date ? new Date(r.next_review_date).toISOString().slice(0,10) : ''}</td>
      `;
      regsBody.appendChild(tr);
    });
  }

  function renderTopCards(rows){
    const total = rows.length;
    const compliant = rows.filter(r=> String(r.status||'').toLowerCase()==='compliant').length;
    const nonCompliant = rows.filter(r=> String(r.status||'').toLowerCase()==='non-compliant').length;
    const soon = rows.filter(r=> r.next_review_date && (new Date(r.next_review_date)-new Date())/(1000*60*60*24) <= 30).length;
    document.getElementById('totalRegs').textContent = total;
    document.getElementById('compliant').textContent = compliant;
    document.getElementById('nonCompliant').textContent = nonCompliant;
    document.getElementById('reviewSoon').textContent = soon;
  }

  async function renderChart(){
    try {
      const cs = await fetchIncStatus();
      const ctx = document.getElementById('complianceChart').getContext('2d');
      
      // Destroy existing chart if it exists
      if (window.complianceChart) {
        window.complianceChart.destroy();
      }
      
      window.complianceChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Compliance Status'],
          datasets: [
            { 
              label: 'Compliant', 
              data: [cs.compliant || 0], 
              backgroundColor: '#4caf50',
              borderColor: '#4caf50',
              borderWidth: 1
            },
            { 
              label: 'Non-Compliant', 
              data: [cs.non_compliant || 0], 
              backgroundColor: '#f44336',
              borderColor: '#f44336',
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
              ticks: {
                stepSize: 1
              }
            } 
          },
          plugins: {
            legend: {
              position: 'top'
            }
          }
        } 
      });
    } catch (error) {
      console.error('Error rendering chart:', error);
    }
  }

  function renderPending(rows){
    pendingList.innerHTML='';
    if (rows.length === 0) {
      const li = document.createElement('li');
      li.className = 'task-item empty';
      li.innerHTML = '<p>No pending tasks</p>';
      pendingList.appendChild(li);
      return;
    }
    
    rows.slice(0,6).forEach(p=>{
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
      pendingList.appendChild(li);
    });
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
    try {
      const regs = await fetchRegs();
      renderRegs(regs);
      renderTopCards(regs);
      renderPending(await fetchPending());
      await renderChart();
      badgePopups();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  load();
  setInterval(async()=>{
    try {
      renderTopCards(await fetchRegs());
      renderPending(await fetchPending());
    } catch (error) {
      console.error('Error updating data:', error);
    }
  }, 5000);
})();
