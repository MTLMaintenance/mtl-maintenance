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
        <tr onclick="window.openEquipDetail('${e.id}')" style="cursor:pointer; border-bottom:1px solid #eee;">
            <td>
                <div style="display:flex; align-items:center; gap:10px">
                    <div class="equip-icon-wrap">${icon}</div>
                    <div><b>${e.name}</b><br><small>${e.serial || 'N/A'}</small></div>
                </div>
            </td>
            <td>${badge(e.status)}</td>
            <td><b>${e.hours.toLocaleString()}</b> hrs</td>
            <td>
                <div class="health-bar" style="width:100px; background:#eee; height:8px; border-radius:4px; overflow:hidden;">
                    <div class="health-fill" style="width:${score}%; background:${healthColor(score)}; height:100%;"></div>
                </div>
                <span style="font-size:11px; color:${healthColor(score)}; font-weight:700;">${score}%</span>
            </td>
            <td>${e.op || '—'}</td>
            <td>${service}</td>
            <td>—</td>
        </tr>`;
    }).join('');
}
// 2. Render the Parts Table
export function renderPartsTable(state, supplierNameFunc) {
    const container = document.getElementById('parts-table-body');
    if (!container) return;

    container.innerHTML = state.parts.map(p => {
        const out = (p.qty || 0) <= 0;
        const low = (p.qty || 0) <= (p.reorder || 0);
        return `
        <tr onclick="window.editPart('${p.id}')" style="cursor:pointer;">
            <td><b>${p.name}</b></td>
            <td>${p.num || '—'}</td>
            <td>${supplierNameFunc(p.supplier_id)}</td>
            <td style="font-weight:700; color:${out ? '#dc3545' : low ? '#fd7e14' : 'inherit'}">${p.qty}</td>
            <td>$${parseFloat(p.cost || 0).toFixed(2)}</td>
            <td><span class="badge ${out ? 'bd' : low ? 'bw' : 'bs'}">${out ? 'Out' : low ? 'Low' : 'OK'}</span></td>
        </tr>`;
    }).join('');
}

// 3. Render Quick Specs (The machine specs in the detail view)
export function renderQuickSpecs(equipId, state) {
    const container = document.getElementById('eq-quick-specs');
    if(!container) return;
    const e = state.equipment.find(x => x.id === equipId);
    const specs = e.custom_fields || {};
    
    container.innerHTML = Object.entries(specs).map(([key, val]) => `
        <div class="spec-row" style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee">
            <span style="color:#666">${key}:</span>
            <b onclick="window.editQuickSpec('${equipId}', '${key}')" style="cursor:pointer">${val}</b>
        </div>
    `).join('') || '<div style="color:#aaa">No specs added</div>';
}
export function renderConsumablesTable(state, supplierNameFunc) {
    const body = document.getElementById('consumables-table-body');
    if (!body || !state.consumables) return;

    if (state.consumables.length === 0) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No supplies found.</td></tr>';
        return;
    }

    body.innerHTML = state.consumables.map(c => {
        const isLow = c.qty <= c.reorder;
        return `
            <tr onclick="window.editConsumable('${c.id}')" style="cursor:pointer;">
                <td><b>${c.name}</b></td>
                <td>${c.num || '—'}</td>
                <td>${supplierNameFunc(c.supplier_id)}</td>
                <td style="font-weight:700; color:${isLow ? '#dc3545' : 'inherit'};">${c.qty}</td>
                <td>$${parseFloat(c.cost || 0).toFixed(2)}</td>
                <td><span class="badge ${isLow ? 'bd' : 'bs'}">${isLow ? 'LOW' : 'OK'}</span></td>
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
    <div class="card" style="margin-bottom:10px">
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
