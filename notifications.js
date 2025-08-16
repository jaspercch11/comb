(function(){
  const API='http://localhost:3000';
  function timeAgo(dateStr){
    if(!dateStr) return '';
    const then = new Date(dateStr).getTime();
    if(isNaN(then)) return '';
    const diff = Date.now()-then;
    const mins = Math.floor(diff/60000);
    if(mins<1) return 'just now';
    if(mins<60) return mins+'m ago';
    const hrs = Math.floor(mins/60);
    if(hrs<24) return hrs+'h ago';
    const days = Math.floor(hrs/24);
    return days+'d ago';
  }

  function createPanel(notifs){
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    const modal=document.createElement('div');
    modal.className='modal';
    modal.style.maxWidth='600px';
    modal.innerHTML = `
      <div class="modal-header"><h3>Notifications</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        ${notifs.length ? '' : '<p>No notifications</p>'}
        <div class="notif-list"></div>
      </div>
    `;
    const list = modal.querySelector('.notif-list');
    
    notifs.forEach(n=>{
      const item = document.createElement('div');
      item.style.display='grid';
      item.style.gridTemplateColumns='32px 1fr auto';
      item.style.gap='10px';
      item.style.alignItems='center';
      item.style.padding='12px';
      item.style.border='1px solid #eee';
      item.style.borderRadius='8px';
      item.style.marginBottom='8px';
      item.style.cursor='pointer';
      item.style.transition='all 0.2s ease';
      
      // Add visual indicators for unread notifications
      if (!n.isSystem && !n.is_read) {
        item.style.borderLeft='4px solid #2196F3';
        item.style.backgroundColor='#f8f9fa';
      }
      
      const iconMap = { 
        incident:'❗', 
        audit:'📋', 
        document:'📄', 
        risk:'⚠️',
        notification:'🔔',
        info:'ℹ️'
      };
      
      const badge = document.createElement('div');
      badge.textContent = iconMap[n.type] || '🔔';
      badge.style.fontSize='18px';
      
      const text = document.createElement('div');
      let deptInfo = '';
      if (n.dept && !n.isSystem) {
        deptInfo = `<div style="color:#2196F3; font-size:11px; font-weight:600;">To: ${n.dept}</div>`;
      }
      if (n.sender_dept && !n.isSystem) {
        deptInfo += `<div style="color:#666; font-size:11px;">From: ${n.sender_dept}</div>`;
      }
      
      text.innerHTML = `
        <strong>${n.title}</strong>
        <div style="color:#555; font-size:13px;">${n.message || ''}</div>
        ${deptInfo}
      `;
      
      const when = document.createElement('div');
      when.textContent = timeAgo(n.date);
      when.style.color = '#666';
      when.style.fontSize='12px';
      
      list.appendChild(item);
      item.appendChild(badge);
      item.appendChild(text);
      item.appendChild(when);
      
      // Add click handler for custom notifications to mark as read
      if (!n.isSystem && !n.is_read) {
        item.addEventListener('click', async () => {
          try {
            const notifId = n.id.replace('notif-', '');
            await fetch(`${API}/api/notifications/${notifId}/read`, {
              method: 'PUT'
            });
            item.style.borderLeft='1px solid #eee';
            item.style.backgroundColor='#fff';
            n.is_read = true;
          } catch (e) {
            console.error('Failed to mark notification as read:', e);
          }
        });
      }
    });
    
    overlay.appendChild(modal);
    overlay.style.display='flex';
    document.body.appendChild(overlay);

    const close=()=>{ try { document.body.removeChild(overlay); } catch(e){} };
    modal.querySelector('.modal-close').onclick=close;
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
    document.addEventListener('keydown', function onKey(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onKey); } });
  }

  async function openNotifications(){
    try{
      const res = await fetch(`${API}/api/notifications`);
      if(!res.ok) throw new Error('failed');
      const data = await res.json();
      createPanel(Array.isArray(data)?data:[]);
    }catch(e){
      createPanel([]);
    }
  }

  async function updateNotificationCount() {
    try {
      const res = await fetch(`${API}/api/notifications/count`);
      if (res.ok) {
        const data = await res.json();
        const count = data.count || 0;
        
        document.querySelectorAll('.bell-icon').forEach(bell => {
          // Remove existing badge
          const existingBadge = bell.querySelector('.notification-badge');
          if (existingBadge) {
            existingBadge.remove();
          }
          
          // Add new badge if there are unread notifications
          if (count > 0) {
            const badge = document.createElement('div');
            badge.className = 'notification-badge';
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.cssText = `
              position: absolute;
              top: -5px;
              right: -5px;
              background: #f44336;
              color: white;
              border-radius: 50%;
              width: 18px;
              height: 18px;
              font-size: 11px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              border: 2px solid white;
            `;
            bell.style.position = 'relative';
            bell.appendChild(badge);
          }
        });
      }
    } catch (e) {
      console.error('Failed to update notification count:', e);
    }
  }

  function wire(){
    document.querySelectorAll('.bell-icon').forEach(b=>{
      b.style.cursor='pointer';
      b.addEventListener('click', openNotifications);
    });
    
    // Update notification count initially and set up periodic updates
    updateNotificationCount();
    setInterval(updateNotificationCount, 30000); // Update every 30 seconds
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', wire);
  }else{
    wire();
  }
})();