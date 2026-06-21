// details.js - Popup Detail Card Builders
import { fmtDate, badge, isOverdue } from './utils.js';
import { openModal } from './ui.js';

// 1. Render Machine Observations (The notes list)
export function renderObservationsList(equipId, state, currentUser) {
    const listContainer = document.getElementById(`obs-list-${equipId}`);
    if (!listContainer) return;

    const obs = (state.observations || []).filter(o => o.equip_id === equipId);
    obs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    listContainer.innerHTML = obs.map(o => `
        <div class="obs-card">
            <span class="badge ${o.severity === 'critical' ? 'bd' : 'bg'}">${o.severity}</span>
            <div style="flex:1">
                <b>${o.body}</b>
                <div class="text-mini">${o.author} · ${new Date(o.created_at).toLocaleDateString()}</div>
            </div>
            <button class="btn-sm" onclick="window.globalEditObs('${o.id}')">Edit</button>
        </div>`).join('') || '<div class="empty-text">No history recorded yet.</div>';
}

// 2. The Big Machine Popup (openEquipDetail)
export function buildEquipDetailHTML(e, score, healthColor) {
    // This function returns the massive HTML string for the Machine Detail modal
    return `
    <div class="tab-bar">
      <button class="tab active" onclick="window.switchDetailTab('eq-overview',this)">Overview</button>
      <button class="tab" onclick="window.switchDetailTab('eq-zerks',this)">Zerk Map</button>
      <button class="tab" onclick="window.switchDetailTab('eq-history',this)">History</button>
      <button class="tab" onclick="window.switchDetailTab('eq-obs',this)">Observations</button>
    </div>

    <div id="eq-overview" class="tab-content active">
        <div class="eq-dash-grid">
            <div class="eq-widget" style="border-left: 5px solid ${healthColor(score)}">
                <div class="widget-label">Machine Status</div>
                <div class="bold">${badge(e.status)}</div>
                <div class="widget-val">${e.hours.toLocaleString()} hrs</div>
            </div>
            <div class="eq-widget">
                <div class="widget-label">Quick Specs</div>
                <div id="eq-quick-specs"></div>
            </div>
        </div>
    </div>
    
    <div id="eq-zerks" class="tab-content" style="display:none">
        <div id="tab-content-zerk"></div>
    </div>

    <div id="eq-obs" class="tab-content" style="display:none">
        <textarea id="obs-input-${e.id}" class="form-textarea" placeholder="New observation..."></textarea>
        <button class="btn-primary" onclick="window.addObservation('${e.id}')">Post Note</button>
        <div id="obs-list-${e.id}"></div>
    </div>
    `;
}

// 3. The Work Order Popup (openTaskDetail)
export function buildTaskDetailHTML(t, equipName) {
    return `
    <div class="task-detail-header">
        <h2>${t.name}</h2>
        <div>${badge(t.status)}</div>
    </div>
    <div class="task-grid">
        <div><b>Equipment:</b> ${equipName}</div>
        <div><b>Assigned:</b> ${t.assign || 'Unassigned'}</div>
        <div><b>Due:</b> ${fmtDate(t.due)}</div>
    </div>
    <div class="task-notes-box">
        <label>Notes</label>
        <div>${t.notes || 'No notes provided.'}</div>
    </div>
    `;
}
