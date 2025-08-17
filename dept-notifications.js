(function(){
  'use strict';

  function createEl(tag, attrs, html){
    const el = document.createElement(tag);
    if (attrs){ Object.keys(attrs).forEach(k=>{ el.setAttribute(k, attrs[k]); }); }
    if (html != null){ el.innerHTML = html; }
    return el;
  }

  function sanitizeBaseUrl(url){
    if (!url) return '';
    return String(url).replace(/\/$/, '');
  }

  async function fetchJson(url){
    try{
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    }catch(_){ return null; }
  }

  function renderNotifItem(n){
    const dateStr = n.date ? new Date(n.date).toLocaleString() : '';
    const badge = (n.priority && n.priority !== 'normal') ? `<span style="font-size:10px; padding:2px 6px; border-radius:9999px; background:${n.priority==='high'?'#fde68a':n.priority==='urgent'?'#fecaca':'#e5e7eb'}; margin-left:6px;">${n.priority}</span>` : '';
    return `
      <div style="padding:10px 12px; border-bottom:1px solid #f1f5f9;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1;">
            <div style="font-weight:600; color:#111; font-size:14px;">${(n.title||'Notification')}${badge}</div>
            <div style="color:#374151; font-size:12px;">${n.message || ''}</div>
            <div style="color:#6b7280; font-size:11px; margin-top:4px;">${dateStr}</div>
          </div>
          ${n.action_url ? `<a href="${n.action_url}" target="_blank" style="font-size:11px; white-space:nowrap;">Open</a>` : ''}
        </div>
      </div>`;
  }

  function initDeptNotifications(opts){
    const options = Object.assign({
      serverBaseUrl: window.location.origin,
      departmentName: '',
      attachTo: null,            // CSS selector or Element
      defaultScope: 'dept',      // 'dept' | 'all'
      pollMs: 15000              // badge refresh interval
    }, opts || {});

    const base = sanitizeBaseUrl(options.serverBaseUrl);
    const deptName = String(options.departmentName || '').trim();
    if (!deptName){ console.warn('[dept-notifications] departmentName is required'); return; }

    let attachEl = null;
    if (options.attachTo){
      attachEl = (typeof options.attachTo === 'string') ? document.querySelector(options.attachTo) : options.attachTo;
    }

    const wrapper = createEl('div', { class: 'dept-notif-wrapper' });
    const wrapperInline = attachEl ? 'position: relative; display: inline-flex; align-items: center;' : 'position: fixed; top: 14px; right: 14px; z-index: 1000; display: inline-flex; align-items: center;';
    wrapper.setAttribute('style', wrapperInline + ' font-family: inherit;');

    const bell = createEl('svg', { viewBox:'0 0 24 24', id:'deptNotifBell', style:'cursor:pointer; width:24px; height:24px; fill:#111;' });
    bell.innerHTML = '<path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 1 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>';

    const badge = createEl('span', { id:'deptNotifBadge', style:'position:absolute; top:-6px; right:-6px; background:#ef4444; color:#fff; border-radius:9999px; padding:0 6px; font-size:11px; line-height:18px; min-width:18px; text-align:center; display:none;' }, '0');

    const pop = createEl('div', { id:'deptNotifPopover', style:'position:absolute; top:32px; right:0; width:360px; max-height:60vh; overflow:auto; background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 10px 24px rgba(0,0,0,0.15); display:none; z-index:1001; font-family: inherit; font-size: 12px;' });

    const header = createEl('div', null,
      '<div style="padding:10px 12px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; gap:8px;">\
        <strong>Notifications</strong>\
        <div style="display:flex; align-items:center; gap:6px; font-size:12px;">\
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="radio" name="deptNotifScope" value="dept"> My Dept</label>\
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="radio" name="deptNotifScope" value="all"> All</label>\
          <button type="button" id="deptNotifCloseBtn" style="padding:4px 8px; border:none; background:#f3f4f6; border-radius:6px; cursor:pointer;">✕</button>\
        </div>\
      </div>'
    );

    const list = createEl('div', { id:'deptNotifList' });
    pop.appendChild(header);
    pop.appendChild(list);

    wrapper.appendChild(bell);
    wrapper.appendChild(badge);
    wrapper.appendChild(pop);

    if (attachEl){ attachEl.appendChild(wrapper); } else { document.body.appendChild(wrapper); }

    const scopeInputs = pop.querySelectorAll('input[name="deptNotifScope"]');
    let currentScope = (options.defaultScope === 'all') ? 'all' : 'dept';
    Array.from(scopeInputs).forEach(inp => { inp.checked = (inp.value === currentScope); });

    function hide(){ pop.style.display='none'; }
    function toggle(){ pop.style.display = (pop.style.display==='none' || !pop.style.display) ? 'block' : 'none'; }

    async function fetchNotifications(scope){
      const url = (scope === 'dept')
        ? `${base}/api/notif?dept=${encodeURIComponent(deptName)}`
        : `${base}/api/notif`;
      const list = await fetchJson(url);
      return Array.isArray(list) ? list : [];
    }

    async function loadList(){
      const items = await fetchNotifications(currentScope);
      list.innerHTML = items.length ? items.map(renderNotifItem).join('') : '<div style="padding:12px; color:#6b7280;">No notifications</div>';
    }

    async function refreshBadge(){
      const url = (currentScope === 'dept')
        ? `${base}/api/notif/count?dept=${encodeURIComponent(deptName)}`
        : `${base}/api/notif/count`;
      const data = await fetchJson(url);
      const count = (data && typeof data.count !== 'undefined') ? Number(data.count)||0 : 0;
      if (count > 0){ badge.style.display = 'inline-block'; badge.textContent = String(count); }
      else { badge.style.display = 'none'; }
    }

    bell.addEventListener('click', async ()=>{
      toggle();
      if (pop.style.display==='block') await loadList();
    });

    pop.querySelector('#deptNotifCloseBtn').addEventListener('click', hide);
    document.addEventListener('click', (e)=>{
      if (!wrapper.contains(e.target)) hide();
    });

    scopeInputs.forEach(inp => inp.addEventListener('change', async (e)=>{
      currentScope = (e.target.value === 'all') ? 'all' : 'dept';
      await loadList();
      await refreshBadge();
    }));

    // Kick off badge polling
    refreshBadge();
    const poll = setInterval(refreshBadge, Math.max(5000, Number(options.pollMs)||15000));

    return {
      destroy(){
        try { clearInterval(poll); } catch(_){ }
        try { wrapper.remove(); } catch(_){ }
      }
    };
  }

  if (!window.initDeptNotifications){
    window.initDeptNotifications = initDeptNotifications;
  }
})();