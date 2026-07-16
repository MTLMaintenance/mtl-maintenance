// ui.js - The App Skeleton (Modals, Panels, and Tabs)

// 1. Open a Modal
export function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        el.classList.add('open');
        if (id === 'task-modal') {
            populateSelects();}
        // Safety: If the modal needs specific data loaded when it opens, 
        // we can trigger that here or in the specific module.
    } else {
        console.error("Modal not found:", id);
    }
}

// 2. Close a Modal
export function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'none';
        el.classList.remove('active');
        el.classList.remove('open');
    }
}

export function showPanel(id) {
    console.log("🖥️ Opening Room:", id);
    
    // 1. Force the scrollbar to the very top
    window.scrollTo(0, 0);

    // 2. Hide every panel
    const panels = document.querySelectorAll('.panel');
    panels.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none'; // Ensure it is physically removed
    });

    // 3. Show the requested panel
    const target = document.getElementById('panel-' + id);
    if (target) {
        target.classList.add('active');
        target.style.display = ""; 
    }

    // 3b. Keep the mobile bottom nav's active tab in sync
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === id);
    });

    // 4. Trigger the Painter for that specific room
    if (id === 'calendar' && typeof window.renderCalendar === 'function') window.renderCalendar();
    if (id === 'tools' && typeof window.renderTools === 'function') window.renderTools();
    if (id === 'parts' && typeof window.renderPartsTable === 'function') window.renderPartsTable();
    if (id === 'tasks' && typeof window.renderTasksTable === 'function') window.renderTasksTable();
    if (id === 'dashboard' && typeof window.refreshDashboard === 'function') window.refreshDashboard();
}
// 4. Switch Tabs inside a modal or panel
export function switchTab(group, tab, btn) {
  const modal = btn.closest('.modal-card') || btn.closest('.modal');
  if (!modal) return;
  const eqSections = ['details-eq', 'custom-eq', 'assign-eq'];
  eqSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(tab);
  if (target) target.style.display = 'block';
  modal.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'assign-eq' && typeof window.renderAssignUsers === 'function') window.renderAssignUsers();
  if (tab === 'custom-eq' && typeof window.renderCustomFields === 'function') window.renderCustomFields();
}
export async function refreshAllDropdowns() {
    try {
        const [supRes, equipRes, userRes] = await Promise.all([
            window._mpdb.from('suppliers').select('id, name').order('name'),
            window._mpdb.from('equipment').select('id, name').order('name'),
            window._mpdb.from('profiles').select('id, full_name, username').eq('status', 'approved').order('full_name')
        ]);

        const supHTML = '<option value="">— Select Supplier —</option>' + 
            supRes.data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        const equipHTML = '<option value="">— Select Equipment —</option>' + 
            equipRes.data.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        const userHTML = '<option value="">— Select User —</option>' + 
            userRes.data.map(u => `<option value="${u.id}">${u.full_name || u.username}</option>`).join('');

        const selectors = {
            'p-supplier-select': supHTML,
            'task-equip-select': equipHTML,
            'task-assign-select': userHTML,
            'role-user-select': userHTML
        };

        for (const [id, html] of Object.entries(selectors)) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        }
    } catch (e) { console.error("Load Error:", e); }
}
export function showMobileZerkCard(pointId, displayNum) {
    const equip = state.equipment.find(e => e.id === window._currentDetailEquipId);
    const point = equip.zerk_points.find(p => p.id === pointId);
    if (!point) return;

    const card = document.getElementById('mobile-zerk-info-card');
    
    // 1. Set text
    document.getElementById('m-card-title').textContent = `Grease Point #${displayNum}`;
    document.getElementById('m-card-note').textContent = point.note || "No info provided.";

    // 2. Link buttons
    document.getElementById('m-card-edit-btn').onclick = (e) => { e.stopPropagation(); editZerkNote(pointId); };
    document.getElementById('m-card-del-btn').onclick = (e) => { e.stopPropagation(); deleteZerk(pointId); closeMobileZerkCard(); };

    // 3. Show card
    card.style.display = 'block';
}

export function closeMobileZerkCard() {
    const card = document.getElementById('mobile-zerk-info-card');
    if (card) card.style.display = 'none';
}

window.showMobileZerkCard = showMobileZerkCard;
window.closeMobileZerkCard = closeMobileZerkCard;

export function switchDetailTab(tab, btn) {
  const modal = document.getElementById('detail-modal');
  if (!modal) return;

  // 1. RESET MODAL WIDTH
  // If we are leaving the Zerk Map, shrink the modal back to normal size
  if (tab !== 'eq-zerks') {
      modal.classList.remove('modal-zerk-wide');
      const histBtn = document.getElementById('btn-history-report');
      if (histBtn) histBtn.style.display = 'block';
  }

  // 2. HIDE ALL TAB CONTENT
  // We look for every div with the class 'tab-content' and hide it
  const contents = modal.querySelectorAll('.tab-content');
  contents.forEach(c => {
      c.style.display = 'none';
      c.classList.remove('active');
  });

  // 3. SHOW THE CLICKED TAB
  const el = document.getElementById(tab);
  if (el) {
      el.style.display = 'block';
      el.classList.add('active');
  }

  // 4. UPDATE BUTTON HIGHLIGHTS
  modal.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // 5. TRIGGER DATA RELOADS
  const id = window._currentDetailEquipId;
  if (!id) return;

  if (tab === 'eq-overview') { renderMiniTimeline(id); renderQuickSpecs(id); }
  if (tab === 'eq-zerks') window.renderZerkTab(id); // This function will handle widening the modal
  if (tab === 'eq-history') window.renderFullHistoryList(id);
  if (tab === 'eq-obs') window.renderObservationsList(id);
  if (tab === 'eq-invoices') window.renderInvoicesList(id);
  if (tab === 'eq-docs') window.renderDocsList(id);
  
}

export function switchPartsSubTab(tab) {
    const invView = document.getElementById('parts-inventory-view');
    const consView = document.getElementById('parts-consumables-view');

    if (tab === 'inventory') {
        if (invView) invView.style.display = 'block';
        if (consView) consView.style.display = 'none'; // Hide the other
        if (typeof window.renderPartsTable === 'function') window.renderPartsTable();
    } else {
        if (invView) invView.style.display = 'none'; // Hide the other
        if (consView) consView.style.display = 'block';
        if (typeof window.fetchConsumables === 'function') window.fetchConsumables();
    }

    // Update button highlights
    document.querySelectorAll('#panel-parts .tab').forEach(b => b.classList.remove('active'));
    const btnId = tab === 'inventory' ? 'btn-parts-inv' : 'btn-parts-cons';
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');
}

export function switchAdminTab(tab, btn) {
  document.querySelectorAll('[id^="admin-"]').forEach(el => el.style.display = 'none');
  const target = document.getElementById('admin-' + tab);
  if (target) target.style.display = 'block';
  btn.parentElement.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

export function populateSelects() {
    // Check if the machine list exists
    if (!state.equipment || state.equipment.length === 0) {
        console.warn("PopulateSelects: No equipment in state yet.");
    }

    // 1. Define the option strings
    const equipOpts = state.equipment.map(e => 
        `<option value="${e.id}">${e.name}</option>`
    ).join('') || '<option value="">No equipment found</option>';

    const users = state.users_list_cache || [];
    const userOpts = '<option value="">— Unassigned —</option>' +
        users.map(u => `<option value="${u.full_name}">${u.full_name}</option>`).join('');

    // 2. Targets for Work Order Modal
    const tEquip = document.getElementById('t-equip');
    const tAssign = document.getElementById('t-assign');
    if (tEquip) { tEquip.innerHTML = equipOpts; }
    if (tAssign) { tAssign.innerHTML = userOpts; }

    // 3. Targets for Calendar/Entry Modal
    const ceEquip = document.getElementById('ce-equip');
    const ceAssign = document.getElementById('ce-assign');
    if (ceEquip) { ceEquip.innerHTML = equipOpts; }
    if (ceAssign) { ceAssign.innerHTML = userOpts; }

    // 4. Target for Equipment Filter
    const taskFilter = document.getElementById('task-equip-filter');
    if (taskFilter) {
        taskFilter.innerHTML = `<option value="all">All Equipment</option>` + equipOpts;
    }

    // 5. Target for Parts Select
    const pSel = document.getElementById('wo-part-select');
    if (pSel) {
        pSel.innerHTML = state.parts.map(p => 
            `<option value="${p.id}">${p.name} (Stock: ${p.qty})</option>`
        ).join('');
    }
}

// 1. Mobile Sidebar Toggle
export function toggleChatSidebar() {
    const s = document.getElementById('chat-sidebar');
    const o = document.getElementById('chat-sidebar-overlay');
    if (!s) return;
    const isOpen = s.classList.contains('open');
    if (isOpen) {
        s.classList.remove('open');
        if (o) o.style.display = 'none';
    } else {
        s.classList.add('open');
        if (o) o.style.display = 'block';
    }
}

export function closeChatSidebarMobile() {
    if (window.innerWidth <= 768) {
        const s = document.getElementById('chat-sidebar');
        const o = document.getElementById('chat-sidebar-overlay');
        if (s) s.classList.remove('open');
        if (o) o.style.display = 'none';
    }
}

// 2. Adjust Layout for Mobile (Calculates topbar height)
export function adjustMobileLayout() {
    if (window.innerWidth <= 768) {
        const topbar = document.querySelector('.topbar');
        if (topbar) {
            document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
        }
    } else {
        document.documentElement.style.setProperty('--topbar-h', '60px');
    }
}

export function initLazyImages() {
    const lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                if(src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                    lazyObserver.unobserve(img);
                }
            }
        });
    }, { rootMargin: '100px' });

    document.querySelectorAll('img.lazy-img[data-src]').forEach(img => lazyObserver.observe(img));
}

export function switchToolTab(tab) {
    console.log("Switching Tool Tab to:", tab);
    
    // 1. Get the three main view containers
    const inventory = document.getElementById('tool-inventory-view');
    const wishlist = document.getElementById('tool-wishlist-view');
    const denied = document.getElementById('tool-denied-view');

    // 2. Toggle visibility (Only show the one that matches the 'tab' name)
    if (inventory) inventory.style.display = tab === 'inventory' ? 'block' : 'none';
    if (wishlist) wishlist.style.display = tab === 'wishlist' ? 'block' : 'none';
    if (denied) denied.style.display = tab === 'denied' ? 'block' : 'none';

    // 3. Update Button Highlighting
    // Find all buttons in the Tool panel and remove the 'active' class
    document.querySelectorAll('#panel-tools .tab').forEach(b => b.classList.remove('active'));
    
    // Add 'active' class to the button that was clicked
    let btnId = 'tool-inv-tab';
    if (tab === 'wishlist') btnId = 'tool-wish-tab';
    if (tab === 'denied') btnId = 'tool-denied-tab';
    
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    // 4. Trigger the data refresh for that specific tab
    if (tab === 'inventory' && typeof window.renderTools === 'function') window.renderTools();
    if (tab === 'wishlist' && typeof window.renderToolWishlist === 'function') window.renderToolWishlist();
    if (tab === 'denied' && typeof window.renderToolDeniedHistory === 'function') window.renderToolDeniedHistory();
}

export function switchWOTab(tabId, btn) {
    console.log("Switching Work Order tab to:", tabId);

    // 1. Find ALL containers inside the modal that have the class 'wo-tab-content'
    const containers = document.querySelectorAll('.wo-tab-content');
    
    // 2. Hide every single one of them
    containers.forEach(div => {
        div.style.display = 'none';
    });

    // 3. Show ONLY the one that matches the ID we clicked
    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
    } else {
        console.error("Tab ID not found:", tabId);
    }

    // 4. Update the button highlights (Active vs Inactive)
    const parent = btn.parentElement;
    parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

export function switchTaskTab(tabId, btn) {
    // 1. Save the choice globally so if the modal refreshes, it stays on this tab
    window._activeTaskTab = tabId;

    // 2. Find all sections inside the detail modal
    const sections = document.querySelectorAll('.dt-section');
    
    // 3. Hide all of them
    sections.forEach(s => {
        s.style.display = 'none';
    });

    // 4. Show the one we clicked
    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
    }

    // 5. Update the button highlights
    const tabBar = btn.parentElement;
    tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

export function switchToolModalTab(tab) {
    const details = document.getElementById('tool-tab-details');
    const obs = document.getElementById('tool-tab-obs');
    if (tab === 'observations') {
        renderToolObsList(); 
    }
    if (tab === 'details') {
        details.style.display = 'block';
        obs.style.display = 'none';
    } else {
        details.style.display = 'none';
        // We use flex for the notes tab so the list stays on top and input stays on bottom
        obs.style.display = 'flex'; 
        if (typeof renderToolObsList === 'function') renderToolObsList();
    }

    // Highlighting the buttons
    document.getElementById('btn-tool-details')?.classList.toggle('active', tab === 'details');
    document.getElementById('btn-tool-obs')?.classList.toggle('active', tab === 'observations');
}

export function switchChannel(channel, btn) {
    console.log("🔌 Switching to channel:", channel);
    window.currentChannel = channel;

    // 1. Update the UI: Active button highlight
    document.querySelectorAll('.chat-channel-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // 2. Update the Header Title
    const title = document.getElementById('chat-header-title');
    if (title) {
        if (channel.startsWith('dm-')) {
            // Find the other person's name for the header
            const parts = channel.replace('dm-', '').split('-');
            const otherUser = parts.find(u => u !== window.currentUser.username);
            title.textContent = `@ ${otherUser}`;
        } else {
            title.textContent = `# ${channel}`;
        }
    }

    // 3. Load the history for this specific channel
    if (typeof window.loadChatMessages === 'function') {
        window.loadChatMessages(channel);
    }
    
    // 4. Close mobile sidebar if open
    if (window.innerWidth <= 768 && typeof window.toggleChatSidebar === 'function') {
        window.toggleChatSidebar();
    }
}

export async function fetchConsumables() {
    // 1. THE FIX: Grab the master folder from the window
    const state = window.state;
    
    if (!state) {
        console.error("Global state not found while fetching consumables.");
        return [];
    }

    try {
        console.log("📥 Syncing consumables from Supabase...");
        const { data, error } = await window._mpdb
            .from('consumables')
            .select('*')
            .order('name');
            
        if (error) throw error;

        // 2. Save into the global folder
        state.consumables = data || [];
        
        // 3. Redraw the table if the painter exists
        if (typeof window.renderConsumablesTable === 'function') {
            window.renderConsumablesTable();
        }

        return state.consumables;
    } catch (e) {
        console.error("Consumable fetch error:", e);
        return [];
    }
}
