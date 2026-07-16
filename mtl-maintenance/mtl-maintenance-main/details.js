// details.js - Popup Detail Card Builders
import { fmtDate, badge, isOverdue, equipName } from './utils.js';
import { openModal } from './ui.js';

// 1. Render Machine Observations (The notes list)
export function renderObservationsList(equipId) {
    // 1. Grab state from window automatically
    const state = window.state;
    const listContainer = document.getElementById(`obs-list-${equipId}`);
    if (!listContainer || !state) return;

    // 2. This line was crashing because 'state' was undefined. Now it works!
    const obs = (state.observations || []).filter(o => o.equip_id === equipId);
    obs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    listContainer.innerHTML = obs.map(o => `
        <div class="obs-card">
            <span class="badge ${o.severity === 'critical' ? 'bd' : 'bg'}">${o.severity}</span>
            <div style="flex:1">
                <b>${o.body}</b>
                <div class="text-mini">${o.author} · ${new Date(o.created_at).toLocaleDateString()}</div>
            </div>
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
                <div class="widget-val" onclick="window.quickLogHours('${e.id}')" style="cursor:pointer;" title="Click to log new hours">
                    ${e.hours.toLocaleString()} hrs ✏️
                </div>
                <div style="font-size:11px; color:var(--text3);">
                    ${e.hours_updated_at ? `Last updated ${fmtDate(e.hours_updated_at)}` : 'Hours never logged'}
                </div>
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

// 1. Build the chronological history (Work Orders + Notes)
export function renderEquipTimeline(equipId) {
  const state = window.state;
  const container = document.getElementById('eq-timeline-content');
  if(!container || !state) return;

  const tasks = state.tasks.filter(t => t.equipId === equipId).map(t => ({ 
      date: t.due, title: t.name, body: t.notes, type: 'WO'
  }));
  
  const timeline = [...tasks].sort((a,b) => new Date(b.date) - new Date(a.date));

  if (!timeline.length) {
    container.innerHTML = '<div class="empty-text">No history found.</div>';
    return;
  }

  container.innerHTML = timeline.map(item => `
    <div class="timeline-item">
      <div class="timeline-dot ${item.type}"></div>
      <div class="timeline-date">${fmtDateFunc(item.date)}</div>
      <div class="timeline-title">${item.title}</div>
      <div class="timeline-body">${item.body || ''}</div>
    </div>`).join('');
}

// 2. Render the tiny "Recent Activity" list on the machine card
export function renderMiniTimeline(equipId, state, fmtDateFunc, badgeFunc) {
    const container = document.getElementById('eq-timeline-content-mini');
    if(!container) return;

    const items = state.tasks.filter(t => t.equipId === equipId).slice(0, 5);
    container.innerHTML = items.map(t => `
        <div class="mini-row">
            <div class="text-mini">${fmtDateFunc(t.due)}</div>
            <div class="bold">${t.name}</div>
            <div>${badgeFunc(t.status)}</div>
        </div>`).join('') || '<div class="empty-text">No recent activity</div>';
}

export function renderFullHistoryList(equipId, state) {
    const container = document.getElementById('eq-history-list');
    if (!container) return;

    // Filter for completed tasks linked to this machine
    const history = state.tasks.filter(t => (t.equipId === equipId || t.equip_id === equipId) && t.status === 'Completed');
    
    // Sort newest first
    history.sort((a,b) => new Date(b.completed_at || b.due) - new Date(a.completed_at || a.due));

    container.innerHTML = history.map(t => `
        <div class="history-item-row">
            <div>
                <div class="bold">${t.name}</div>
                <div class="text-mini">${new Date(t.completed_at || t.due).toLocaleDateString()}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.openTaskDetail('${t.id}')">Details</button>
        </div>`).join('') || '<div class="empty-text">No service history recorded yet.</div>';
}
export async function openTaskDetail(id, state) {
    const t = state.tasks.find(x => x.id === id); 
    if (!t) return;

    // 1. Remember which tab the user was on
    const activeTab = window._activeTaskTab || 'dt-info';
    const isManager = (window.currentUser?.role === 'admin' || window.currentUser?.role === 'manager');

    // 2. Fetch comments from Supabase live
    let comments = [];
    try { 
        const { data } = await window._mpdb.from('wo_comments').select('*').eq('task_id', id).order('created_at', { ascending: true }); 
        comments = data || []; 
    } catch (e) { console.error(e); }

    // 3. Gather linked data
    const partsUsed = (state.partUsage || []).filter(p => p.task_id === id);
    const done = t.checklist ? t.checklist.filter(c => c.done).length : 0;
    const totalCheck = t.checklist ? t.checklist.length : 0;

    // 4. Update the Modal Header
    document.getElementById('detail-title').textContent = t.name;

    // 5. Build and Inject the HTML Layout — styled to match the New Work Order modal
    document.getElementById('detail-body').innerHTML = `
        <div class="tab-bar" style="padding: 10px 20px; background: #fafafa; border-bottom: 1px solid #eee;">
          <button class="tab ${activeTab === 'dt-info' ? 'active' : ''}" onclick="window.switchTaskTab('dt-info',this)">Details</button>
          <button class="tab ${activeTab === 'dt-checklist' ? 'active' : ''}" onclick="window.switchTaskTab('dt-checklist',this)">Checklist (${done}/${totalCheck})</button>
          <button class="tab ${activeTab === 'dt-parts' ? 'active' : ''}" onclick="window.switchTaskTab('dt-parts',this)">Parts Used (${partsUsed.length})</button>
          <button class="tab ${activeTab === 'dt-comments' ? 'active' : ''}" onclick="window.switchTaskTab('dt-comments',this)">Comments (${comments.length})</button>
        </div>

        <div style="padding: 20px; max-height: 70vh; overflow-y: auto;">

            <div id="dt-info" class="dt-section" style="display:${activeTab === 'dt-info' ? 'block' : 'none'}">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" style="color: #666 !important;">Machine</label>
                        <div style="color: black !important; font-weight: 700;">${equipName(t.equipId || t.equip_id, state)}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="color: #666 !important;">Assigned To</label>
                        <div style="color: black !important;">${t.assign || '—'}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="color: #666 !important;">Priority</label>
                        <div>${badge(t.priority)}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" style="color: #666 !important;">Due Date</label>
                        <div style="color:${isOverdue(t.due) ? '#dc3545' : 'black'} !important; font-weight: 700;">${fmtDate(t.due)}</div>
                    </div>
                    <div class="form-group full">
                        <label class="form-label" style="color: #666 !important;">Notes</label>
                        <div class="form-textarea" style="height:auto; min-height:60px; color: black !important; border: 1px solid #ddd; padding: 10px; border-radius: 8px; background: #fafafa;">${t.notes || 'No notes provided.'}</div>
                    </div>
                </div>
            </div>

            <div id="dt-checklist" class="dt-section" style="display:${activeTab === 'dt-checklist' ? 'block' : 'none'}">
                <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin-bottom:15px">
                    <label class="form-label" style="color: #666 !important;">Add a Step</label>
                    <div style="display:flex; gap:8px">
                        <input type="text" id="new-check-item" placeholder="e.g. Torque bolts to spec" class="form-input" style="flex:1; color: black !important; border: 1px solid #ddd;">
                        <button class="btn btn-secondary btn-sm" onclick="window.addTaskCheckItem('${t.id}')">Add</button>
                    </div>
                </div>
                <div class="checklist-list">
                    ${(t.checklist || []).map((c, i) => `
                        <div class="check-item" onclick="window.toggleTaskCheck('${t.id}', ${i})" style="cursor:pointer;">
                            <div class="check-box ${c.done ? 'done' : ''}">${c.done ? '✓' : ''}</div>
                            <span>${c.text}</span>
                        </div>
                    `).join('') || '<div style="color:#999; font-size:13px; text-align:center">No checklist steps yet</div>'}
                </div>
            </div>

            <div id="dt-parts" class="dt-section" style="display:${activeTab === 'dt-parts' ? 'block' : 'none'}">
                <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin-bottom:15px">
                    <button class="btn btn-secondary btn-sm" onclick="window.addPartToActiveTask('${t.id}')">+ Log Part Usage</button>
                </div>
                <div class="parts-usage-list">
                    ${partsUsed.map(p => `
                        <div class="usage-row">
                            <div><b>${p.part_name}</b> x${p.qty_used}</div>
                            <button class="btn-danger btn-sm" onclick="window.removePartUsage('${p.id}', '${t.id}')">✕</button>
                        </div>
                    `).join('') || '<div style="color:#999; font-size:13px; text-align:center">No parts added yet</div>'}
                </div>
            </div>

            <div id="dt-comments" class="dt-section" style="display:${activeTab === 'dt-comments' ? 'block' : 'none'}">
                <div class="comment-list" style="margin-bottom:12px; color: black !important;">
                    ${comments.map(c => `<div class="comment-card"><b>${c.author}:</b> ${c.body}</div>`).join('') || '<div style="color:#999; font-size:13px">No comments yet</div>'}
                </div>
                <textarea id="dt-comment-input-large" class="form-textarea" placeholder="Add an update..." style="color: black !important; border: 1px solid #ddd;"></textarea>
                <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                    <button class="btn btn-primary btn-sm" onclick="window.addTaskComment('${t.id}')">Post</button>
                </div>
            </div>

        </div>

        <div class="form-row" style="padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; border-radius: 0 0 12px 12px; justify-content: flex-end;">
            ${isManager ? `<button class="btn btn-secondary" style="color:#dc3545; border-color:#dc3545;" onclick="window.deleteTask('${t.id}')">Delete WO</button>` : ''}
            <button class="btn btn-primary" onclick="window.openTaskSignoff('${t.id}')">Finalize Work</button>
        </div>
    `;

    openModal('detail-modal');
}
