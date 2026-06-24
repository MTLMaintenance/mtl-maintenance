// ui.js - The App Skeleton (Modals, Panels, and Tabs)

// 1. Open a Modal
export function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        el.classList.add('open');
        
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

// 3. Switch between main screens (Dashboard, Calendar, etc.)
export function showPanel(id) {
    // Scroll to top
    window.scrollTo(0, 0);

    // Hide all panels
    const panels = document.querySelectorAll('.panel');
    panels.forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });

    // Deactivate all nav buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(b => b.classList.remove('active'));

    // Show the requested panel
    const targetPanel = document.getElementById('panel-' + id);
    if (targetPanel) {
        targetPanel.style.display = 'block';
        targetPanel.classList.add('active');
    }

    // Highlight the button
    navButtons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + id + "'")) {
            btn.classList.add('active');
        }
    });
}

// 4. Switch Tabs inside a modal or panel
export function switchTab(group, tabId, btn) {
    const parent = btn.parentElement;
    // Remove active class from all buttons in this tab group
    parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    // Add active class to clicked button
    btn.classList.add('active');

    // Logic to show/hide content could be added here or kept in modules
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
  if (tab === 'eq-zerks') renderZerkTab(id); // This function will handle widening the modal
  if (tab === 'eq-history') renderFullHistoryList(id);
  if (tab === 'eq-obs') renderObservationsList(id);
  if (tab === 'eq-invoices') renderInvoicesList(id);
  if (tab === 'eq-docs') renderDocsList(id);
}

function switchPartsSubTab(tab) {
    const invView = document.getElementById('parts-inventory-view');
    const consView = document.getElementById('parts-consumables-view');
    const partBtn = document.getElementById('add-part-btn');
    const consBtn = document.getElementById('add-consumable-btn');

    if (tab === 'inventory') {
        invView.style.display = 'block';
        consView.style.display = 'none';
        partBtn.style.display = 'block';
        consBtn.style.display = 'none';
        renderParts();
    } else {
        invView.style.display = 'none';
        consView.style.display = 'block';
        partBtn.style.display = 'none';
        consBtn.style.display = 'block';
        fetchConsumables(); // Load data when clicking the tab
    }

    // Update button highlighting
    document.getElementById('btn-parts-inv').classList.toggle('active', tab === 'inventory');
    document.getElementById('btn-parts-cons').classList.toggle('active', tab === 'consumables');
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
