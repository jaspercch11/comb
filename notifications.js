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
    modal.style.maxWidth='520px';
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
      item.style.padding='10px';
      item.style.border='1px solid #eee';
      item.style.borderRadius='8px';
      item.style.marginBottom='8px';
      const iconMap = { incident:'❗', audit:'📋', document:'📄', risk:'⚠️' };
      const badge = document.createElement('div');
      badge.textContent = iconMap[n.type] || '🔔';
      badge.style.fontSize='18px';
      const text = document.createElement('div');
      text.innerHTML = `<strong>${n.title}</strong><div style="color:#555; font-size:13px;">${n.message || ''}</div>`;
      const when = document.createElement('div');
      when.textContent = timeAgo(n.date);
      when.style.color = '#666';
      when.style.fontSize='12px';
      list.appendChild(item);
      item.appendChild(badge);
      item.appendChild(text);
      item.appendChild(when);
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

  function wire(){
    document.querySelectorAll('.bell-icon').forEach(b=>{
      b.style.cursor='pointer';
      b.addEventListener('click', openNotifications);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', wire);
  }else{
    wire();
  }
})();