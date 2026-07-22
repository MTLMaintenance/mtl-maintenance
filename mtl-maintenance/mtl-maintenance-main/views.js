// views.js - Table and List Renderers
import { fmtDate, badge, isOverdue } from './utils.js';

// 1. Render the main Equipment Table
export function renderEquipmentTable() {
    const container = document.getElementById('equip-table-body');
    if (!container) return;

    // Use window.state to be 100% sure we are looking at the global data
    const state = window.state;
    
    // Safety check: if data isn't loaded, don't just stay blank, show a message
    if (!state || !state.equipment || state.equipment.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#888;">No machines found in database. Click "+ Add Equipment" to start.</td></tr>';
        return;
    }

    // Simplify the list for testing (Remove the filter for a moment)
    const list = state.equipment;

    container.innerHTML = list.map(e => {
        // We use window. functions to ensure they are found
        const score = calcHealth(e.id, state.tasks, state.equipment);
        const service = getLastService(e.id, state.tasks);
        const icon = (e.photos && e.photos.length) ? `<img src="${e.photos[0]}" style="width:30px; height:30px; object-fit:cover; border-radius:4px"/>` : (ICONS[e.type] || '⚙');

        return `
        <tr id="equip-row-${e.id}" onclick="window.openEquipDetail('${e.id}')" style="cursor:pointer; border-bottom:1px solid #eee;">
            <td data-label="Equipment">
                <div style="display:flex; align-items:center; gap:10px">
                    <div class="equip-icon-wrap">${icon}</div>
                    <div><b>${e.name}</b><br><small>${e.serial || 'N/A'}</small></div>
                </div>
            </td>
            <td data-label="Status">${badge(e.status)}</td>
           <td data-label="Hours"><b>${(e.hours || 0).toLocaleString()}</b> hrs</td>
            <td data-label="Health">
                <div class="health-bar" style="width:100px; background:#eee; height:8px; border-radius:4px; overflow:hidden;">
                    <div class="health-fill" style="width:${score}%; background:${healthColor(score)}; height:100%;"></div>
                </div>
                <span style="font-size:11px; color:${healthColor(score)}; font-weight:700;">${score}%</span>
            </td>
            <td data-label="Assigned To">${e.op || '—'}</td>
            <td data-label="Last Service">${service}</td>
            <td data-label="Next Due">${typeof window.getNextDue === 'function' ? window.getNextDue(e.id) : '—'}</td>
        </tr>`;
    }).join('');
}
// 2. Render the Parts Table
export function renderPartsTable() {
    const container = document.getElementById('parts-table-body');
    if (!container) return;

    // 1. THE FIX: Grab state and the supplier tool from the window hallway
    const state = window.state;
    const getSupplier = window.supplierName; // We bridged this in app.js earlier

    if (!state || !state.parts) {
        console.warn("Parts data not loaded yet.");
        return;
    }

    // 2. Build the rows
    container.innerHTML = state.parts.map(p => {
        const qty = parseInt(p.qty) || 0;
        const reorder = parseInt(p.reorder) || 0;
        const out = qty <= 0;
        const low = qty <= reorder;

        return `
        <tr id="part-row-${p.id}" onclick="window.editPart('${p.id}')" style="cursor:pointer;">
            <td data-label="Part Name"><b>${p.name || 'Unnamed'}</b></td>
            <td data-label="Part #" style="font-size:12px; color:#666;">${p.num || '—'}</td>
            <td data-label="Supplier">${typeof getSupplier === 'function' ? getSupplier(p.supplier_id) : '—'}</td>
            <td data-label="In Stock" style="font-weight:700; color:${out ? '#dc3545' : low ? '#fd7e14' : 'inherit'}">${qty}</td>
            <td data-label="Reorder">${reorder}</td>
            <td data-label="Cost">$${parseFloat(p.cost || 0).toFixed(2)}</td>
            <td data-label="Total">$${(qty * parseFloat(p.cost || 0)).toLocaleString()}</td>
            <td data-label="Status"><span class="badge ${out ? 'bd' : low ? 'bw' : 'bs'}">${out ? 'Out' : low ? 'Low' : 'OK'}</span></td>
        </tr>`;
    }).join('');
}

// 3. Render Quick Specs (The machine specs in the detail view)
export function renderQuickSpecs(equipId) {
    // 1. THE FIX: Grab state from the window instead of waiting for a parameter
    const state = window.state;
    const container = document.getElementById('eq-quick-specs');
    
    if(!container || !state || !state.equipment) return;

    // 2. Find the machine
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;

    const specs = e.custom_fields || {};
    const entries = Object.entries(specs);

    if (entries.length === 0) {
        container.innerHTML = '<div style="color:#888; font-style:italic; padding: 10px 0;">No specs added yet.</div>';
        return;
    }

    // 3. Build the HTML
    container.innerHTML = entries.map(([key, val]) => `
        <div class="spec-row" style="display:flex; justify-content:space-between; padding: 5px 0; border-bottom: 1px solid rgba(0,0,0,0.05)">
            <span style="color:#666">${key}:</span>
            <b style="cursor:pointer" onclick="window.editQuickSpec('${equipId}', '${key.replace(/'/g, "\\'")}')">${val}</b>
        </div>
    `).join('');
}
export function renderConsumablesTable() {
    const body = document.getElementById('consumables-table-body');
    if (!body) return;

    // 1. THE FIX: Reach out to the global hallway to find the data
    const state = window.state;

    // 2. SAFETY CHECK: If state or the consumables drawer is missing, stop the crash
    if (!state || !state.consumables) {
        console.warn("⚠️ Consumables drawer not found in state yet.");
        return;
    }

    if (state.consumables.length === 0) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">No supplies found in database.</td></tr>';
        return;
    }

    // 3. Draw the table
    body.innerHTML = state.consumables.map(c => {
        const isLow = c.qty <= c.reorder;
        // Logic uses the global window.supplierName helper
        const sName = typeof window.supplierName === 'function' ? window.supplierName(c.supplier_id) : '—';
        
        return `
            <tr id="consumable-row-${c.id}" onclick="window.editConsumable('${c.id}')" style="cursor:pointer;">
                <td data-label="Item Name"><b>${c.name}</b></td>
                <td data-label="Reference #">${c.num || '—'}</td>
                <td data-label="Supplier">${sName}</td>
                <td data-label="In Stock" style="font-weight:700; color:${isLow ? '#dc3545' : 'inherit'};">${c.qty}</td>
                <td data-label="Reorder">${c.reorder}</td>
                <td data-label="Cost">$${parseFloat(c.cost || 0).toFixed(2)}</td>
                <td data-label="Total">$${(c.qty * (c.cost || 0)).toLocaleString()}</td>
                <td data-label="Status"><span class="badge ${isLow ? 'bd' : 'bs'}">${isLow ? 'LOW' : 'OK'}</span></td>
            </tr>`;
    }).join('');
}

export function refreshObsList(equipId, state, currentUser) {
    const container = document.getElementById('obs-list-' + equipId);
    if (!container) return;

    const obs = (state.observations || []).filter(o => o.equip_id === equipId);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

    container.innerHTML = obs.map(o => {
        const sevClass = o.severity === 'critical' ? 'obs-critical' : o.severity === 'watch' ? 'obs-watch' : 'obs-info';
        return `
        <div class="card" style="margin-bottom: 12px; border-left: 5px solid ${o.severity === 'critical' ? 'var(--danger)' : 'var(--border)'}">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                <span class="badge ${sevClass}">${o.severity.toUpperCase()}</span>
                <span style="font-size:11px; color:var(--text3)">${o.author}</span>
            </div>
            <div style="font-size:13px;">${o.body}</div>
        </div>`;
    }).join('') || '<div class="empty-text">No observations yet.</div>';
}

export function renderRecentObservations(state, equipNameFunc) {
  const listEl = document.getElementById('recent-obs-list');
  if (!listEl) return;

  const validIds = new Set(state.equipment.map(e => e.id));
  const obs = (state.observations || []).filter(o => validIds.has(o.equip_id)).slice(0, 6);

  listEl.innerHTML = obs.map(o => `
    <div class="obs-row" onclick="window.openEquipDetail('${o.equip_id}')">
        <div style="flex:1">
            <div class="bold">${o.body}</div>
            <div class="text-mini">${equipNameFunc(o.equip_id, state)} · ${o.author}</div>
        </div>
        <span class="badge ${o.severity === 'critical' ? 'bd' : 'bs'}">${o.severity}</span>
    </div>`).join('') || '<div class="empty-text">No observations yet</div>';
}

export function renderChecklistTemplates() {
  const list = document.getElementById('tpl-list');
  if(!list) return;

  const state = window.state;
  
  // Build the HTML for the cards
  list.innerHTML = state.checklistTemplates.map(tpl => `
    <div class="card" id="tpl-row-${tpl.id}" style="margin-bottom:10px">
      <div class="card-header">
        <div>
          <div style="font-weight:600;font-size:14px">${tpl.name}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">
            <span class="badge bi">${tpl.model || 'General'}</span> 
            <span style="margin-left:8px">${tpl.items.length} items</span>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="window.editTemplate('${tpl.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="window.deleteTpl('${tpl.id}')">Delete</button>
        </div>
      </div>
    </div>`).join('') || '<div class="empty-text">No templates found. Click "+ Add Template" to start.</div>';
}

export function renderDocuments() {
  const state = window.state;
  const warrantyContainer = document.getElementById('warranty-list');
  const docContainer = document.getElementById('doc-list');
  
  if (!state || !state.documents || !warrantyContainer || !docContainer) return;

  const warranties = state.documents.filter(d => d.type === 'warranty');
  const others = state.documents.filter(d => d.type !== 'warranty');

  const buildDocHTML = d => `
    <div class="doc-item" id="doc-row-${d.id}" onclick="window.openDocDetail('${d.id}')" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; color:black;">
      <div>
        <div style="font-weight:600;">${d.name}</div>
        <div style="font-size:11px; color:#666;">${d.type} ${d.expiry_date ? '· Expires: ' + window.fmtDate(d.expiry_date) : ''}</div>
      </div>
      <div style="display:flex; gap:5px">
          <button class="btn-sm" onclick="event.stopPropagation(); window.openEditDocModal('${d.id}')">Edit</button>
          <button class="btn-sm btn-danger" onclick="event.stopPropagation(); window.deleteDoc('${d.id}')">✕</button>
      </div>
    </div>`;

  warrantyContainer.innerHTML = warranties.map(buildDocHTML).join('') || '<div style="padding:20px; color:#999; text-align:center;">No warranties</div>';
  docContainer.innerHTML = others.map(buildDocHTML).join('') || '<div style="padding:20px; color:#999; text-align:center;">No documents</div>';
}

export function renderMachineTimeline(equipId, componentFilter = 'all') {
    const container = document.getElementById('mtl-timeline-stream');
    if (!container) return;

    const state = window.state;
    let events = [];

    // 1. Gather Work Orders (Match both ID formats)
    const machineTasks = state.tasks.filter(t => t.equipId === equipId || t.equip_id === equipId);
    
    machineTasks.forEach(t => {
        events.push({
            date: t.completed_at || t.due || t.created_at,
            type: 'work-order',
            title: t.name,
            body: t.notes || '',
            // If component is missing, we label it 'General'
            component: (t.component || 'general').toLowerCase()
        });
    });

    // 2. Gather Wiki Tips
    const machineWiki = (state.wiki || []).filter(w => w.equip_id === equipId);
    machineWiki.forEach(w => {
        events.push({
            date: w.created_at,
            type: 'wiki',
            title: '💡 Shop Wisdom',
            body: w.body,
            component: (w.component || 'general').toLowerCase()
        });
    });

    // 3. THE SMART FILTER
    if (componentFilter !== 'all') {
        // Only show items that match the specific component (Engine, Hydraulic, etc)
        events = events.filter(ev => ev.component.includes(componentFilter.toLowerCase()));
    }

    // 4. Sort and Build HTML
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (events.length === 0) {
        container.innerHTML = `<div class="empty-text">No ${componentFilter} history found yet.</div>`;
        return;
    }

    container.innerHTML = events.map(ev => `
        <div class="os-timeline-card ${ev.type}">
            <div class="os-timeline-meta">
                <span>${new Date(ev.date).toLocaleDateString()}</span>
                <span class="badge bi">${ev.component.toUpperCase()}</span>
            </div>
            <h4>${ev.title}</h4>
            <p>${ev.body}</p>
        </div>
    `).join('');
}

export function renderComponentSpecs(equipId, componentFilter = 'all') {
    const container = document.getElementById('mtl-component-specs');
    if (!container) return;

    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;

    const allSpecs = Object.entries(e.custom_fields || {});
    const filtered = allSpecs.filter(([key]) => {
        if (componentFilter === 'all') return true;
        return key.toLowerCase().includes(componentFilter.toLowerCase());
    });

    // --- THE UI CHANGE ---
    // We add a header with an ADD button that knows which component we are in
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; font-size:12px; color:#888; text-transform:uppercase;">
                ${componentFilter} Specifications
            </h4>
            <button class="btn-add-spec" onclick="window.openSpecModal('${equipId}', '${componentFilter}')">
            + Add Spec
            </button>
        </div>
        <div class="os-spec-grid">
            ${filtered.map(([key, val]) => `
                <div class="spec-card-os">
                    <label>${key.split(':').pop().trim().toUpperCase()}</label>
                    <b onclick="window.editQuickSpec('${equipId}', '${key.replace(/'/g, "\\'")}')">${val}</b>
                </div>
            `).join('') || `<p class="empty-text">No specs for ${componentFilter}</p>`}
        </div>
    `;
}

export function openSpecModal(equipId, componentName) {
    document.getElementById('spec-equip-id').value = equipId;
    document.getElementById('spec-component').value = componentName;
    document.getElementById('spec-original-key').value = ''; // '' = ADD mode
    document.getElementById('spec-name-input').value = "";
    document.getElementById('spec-value-input').value = "";
 
    document.getElementById('spec-modal-title').textContent = `Add ${componentName} Spec`;
 
    window.openModal('spec-modal');
}
 
// NEW — opens the same modal, pre-filled, in EDIT mode.
export function editQuickSpec(equipId, fullKey) {
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e || !e.custom_fields || !(fullKey in e.custom_fields)) return;
 
    const value = e.custom_fields[fullKey];
    const splitAt = fullKey.indexOf(':');
    const componentName = splitAt >= 0 ? fullKey.slice(0, splitAt).trim() : fullKey.trim();
    const fieldName = splitAt >= 0 ? fullKey.slice(splitAt + 1).trim() : '';
 
    document.getElementById('spec-equip-id').value = equipId;
    document.getElementById('spec-component').value = componentName;
    document.getElementById('spec-original-key').value = fullKey; // marks EDIT mode
    document.getElementById('spec-name-input').value = fieldName;
    document.getElementById('spec-value-input').value = value;
 
    document.getElementById('spec-modal-title').textContent = `Edit ${componentName} Spec`;
 
    window.openModal('spec-modal');
}
 
// NEW — renamed to saveNewSpec to match your existing
// "Save Spec" button (onclick="window.saveNewSpec()").
// Handles both Add and Edit through one non-destructive path.
export function saveNewSpec() {
    const equipId = document.getElementById('spec-equip-id').value;
    const componentName = document.getElementById('spec-component').value.trim();
    const originalKey = document.getElementById('spec-original-key').value;
    const fieldName = document.getElementById('spec-name-input').value.trim();
    const fieldValue = document.getElementById('spec-value-input').value.trim();
 
    if (!fieldName) return;
 
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;
 
    if (!e.custom_fields) e.custom_fields = {};
 
    const newKey = `${componentName}: ${fieldName}`;
 
    // EDIT + renamed → drop the old key so we don't leave a stale duplicate.
    if (originalKey && originalKey !== newKey) {
        delete e.custom_fields[originalKey];
    }
 
    e.custom_fields[newKey] = fieldValue;
 
    if (typeof window.saveState === 'function') window.saveState();
    if (typeof window.closeModal === 'function') window.closeModal('spec-modal');
 
    if (typeof window.renderComponentSpecs === 'function') {
        window.renderComponentSpecs(equipId, componentName);
    }
}
 
 
// ---------------------------------------------------------
// COMPONENT MANAGER (add/edit/delete components THEMSELVES —
// e.g. Engine, Hydraulics, Tracks — per machine)
// ---------------------------------------------------------
 
const DEFAULT_COMPONENTS = ['engine', 'hydraulics', 'tracks'];
 
const COMPONENT_ICONS = {
    engine: '⚙️',
    hydraulics: '💧',
    tracks: '🚜'
};
 
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
 
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
 
// Lazily gives a machine its own component list, seeded from the
// current defaults, WITHOUT overwriting anything if it already exists.
function getComponentsForEquip(e) {
    if (!Array.isArray(e.components)) {
        e.components = [...DEFAULT_COMPONENTS];
    }
    return e.components;
}
 
// Renders the chip row. Replaces the old hardcoded 5 divs in
// machine-os-ui.js — see the snippet provided separately for that change.
export function renderComponentChips(equipId) {
    const container = document.getElementById('mtl-comp-chip-area');
    if (!container) return;
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;
 
    const components = getComponentsForEquip(e);
 
    const chipsHtml = components.map(compId => {
        const icon = COMPONENT_ICONS[compId] || '🔧';
        return `<div class="comp-card-grey" onclick="window.filterOS('${compId}', this)">${icon} ${capitalize(compId)}</div>`;
    }).join('');
 
    container.innerHTML = `
        <div class="comp-card-grey" onclick="window.filterOS('all', this)">🌍 All</div>
        ${chipsHtml}
        <div class="comp-card-grey" onclick="window.openZerkOS('${equipId}', this)">⛽ Grease Map</div>
        <div class="comp-card-grey" style="background:#e5e7eb; font-weight:bold;" onclick="window.openComponentManagerModal('${equipId}')">⚙️ Manage</div>
    `;
}
 
export function openComponentManagerModal(equipId) {
    document.getElementById('comp-manager-equip-id').value = equipId;
    renderComponentManageList(equipId);
    window.openModal('component-manager-modal');
}
 
export function renderComponentManageList(equipId) {
    const container = document.getElementById('comp-manage-list');
    if (!container) return;
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;
 
    const components = getComponentsForEquip(e);
 
    container.innerHTML = components.map(compId => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #eee;">
            <input type="text" value="${capitalize(compId)}"
                   class="form-input comp-rename-input"
                   style="flex:1; border:1px solid #ddd; padding:6px; border-radius:6px; color:black;">
            <button class="btn btn-secondary btn-sm" onclick="window.saveComponentRename('${equipId}', '${compId}', this)">Save</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteComponent('${equipId}', '${compId}')">Delete</button>
        </div>
    `).join('') || `<p class="empty-text">No components yet.</p>`;
}
 
export function addNewComponent() {
    const equipId = document.getElementById('comp-manager-equip-id').value;
    const input = document.getElementById('new-comp-name');
    const raw = input.value.trim();
    if (!raw) return;
 
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;
 
    const components = getComponentsForEquip(e);
    const newId = raw.toLowerCase();
 
    if (components.some(c => c.toLowerCase() === newId)) {
        alert(`"${raw}" already exists.`);
        return;
    }
 
    components.push(newId);
    input.value = '';
 
    if (typeof window.saveState === 'function') window.saveState();
    renderComponentManageList(equipId);
    renderComponentChips(equipId);
}
 
// Non-destructive: deleting a component only removes it from the
// chip list. Any specs already saved under it are left alone and
// stay visible under "All".
export function deleteComponent(equipId, compId) {
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;
 
    if (!confirm(`Remove "${capitalize(compId)}" from the component list? Specs already saved under it will stay safe and remain visible under "All".`)) {
        return;
    }
 
    const components = getComponentsForEquip(e);
    e.components = components.filter(c => c !== compId);
 
    if (typeof window.saveState === 'function') window.saveState();
    renderComponentManageList(equipId);
    renderComponentChips(equipId);
}
 
// Renaming migrates any specs saved under the old key prefix so
// nothing gets orphaned (e.g. "engine: Oil Filter" -> "motor: Oil Filter").
export function saveComponentRename(equipId, oldId, buttonEl) {
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;
 
    const row = buttonEl.closest('div');
    const input = row.querySelector('.comp-rename-input');
    const newLabel = input.value.trim();
    if (!newLabel) return;
 
    const newId = newLabel.toLowerCase();
    const components = getComponentsForEquip(e);
 
    if (newId !== oldId && components.some(c => c.toLowerCase() === newId)) {
        alert(`"${newLabel}" already exists.`);
        return;
    }
 
    const idx = components.indexOf(oldId);
    if (idx !== -1) components[idx] = newId;
 
    if (e.custom_fields && newId !== oldId) {
        const prefixRe = new RegExp('^' + escapeRegex(oldId) + '\\s*:', 'i');
        Object.keys(e.custom_fields).forEach(key => {
            if (prefixRe.test(key)) {
                const fieldPart = key.slice(key.indexOf(':') + 1).trim();
                const migratedKey = `${newId}: ${fieldPart}`;
                if (migratedKey !== key) {
                    e.custom_fields[migratedKey] = e.custom_fields[key];
                    delete e.custom_fields[key];
                }
            }
        });
    }
 
    if (typeof window.saveState === 'function') window.saveState();
    renderComponentManageList(equipId);
    renderComponentChips(equipId);
 
    if (typeof window.renderComponentSpecs === 'function') {
        window.renderComponentSpecs(equipId, newId);
    }
}
