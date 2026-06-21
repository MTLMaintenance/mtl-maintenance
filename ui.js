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

