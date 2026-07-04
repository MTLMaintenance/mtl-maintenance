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
    // 1. EMERGENCY SAFETY CHECK
    if (!e) {
        console.error("Error: buildEquipDetailHTML received no data.");
        return `<div style="padding:20px; color:red;">Error: Machine data could not be loaded.</div>`;
    }

    // 2. Safely grab hours
    const displayHours = (e.hours || 0).toLocaleString();

    // 3. THE FIX: Everything must be inside ONE set of backticks
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
                <div class="bold">${e.status || 'Unknown'}</div>
                <div class="widget-val">${displayHours} hrs</div>
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
        <div style="padding:15px; background:#f9f9f9; border-radius:8px; margin-bottom:15px;">
            <label style="display:block; font-size:11px; font-weight:bold; margin-bottom:5px;">ADD OBSERVATION</label>
            <textarea id="obs-input-${e.id}" class="form-textarea" style="width:100%; height:60px;" placeholder="What do you see?"></textarea>
            <button class="btn-primary btn-sm" style="margin-top:8px;" onclick="window.addObservation('${e.id}')">Post Note</button>
        </div>
        <div id="obs-list-${e.id}"></div>
    </div>
    `; 
}



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

    // 5. Build and Inject the HTML Layout
    document.getElementById('detail-body').innerHTML = `
        <div class="tab-bar">
          <button class="tab ${activeTab === 'dt-info' ? 'active' : ''}" onclick="window.switchTaskTab('dt-info',this)">Info</button>
          <button class="tab ${activeTab === 'dt-checklist' ? 'active' : ''}" onclick="window.switchTaskTab('dt-checklist',this)">Checklist (${done}/${totalCheck})</button>
          <button class="tab ${activeTab === 'dt-parts' ? 'active' : ''}" onclick="window.switchTaskTab('dt-parts',this)">Parts (${partsUsed.length})</button>
          <button class="tab ${activeTab === 'dt-comments' ? 'active' : ''}" onclick="window.switchTaskTab('dt-comments',this)">Comments (${comments.length})</button>
        </div>

        <div id="dt-info" class="dt-section" style="display:${activeTab === 'dt-info' ? 'block' : 'none'}">
            <div class="task-info-grid">
                <div><span>Machine:</span> <b>${equipName(t.equipId || t.equip_id, state)}</b></div>
                <div><span>Assigned:</span> ${t.assign || '—'}</div>
                <div><span>Priority:</span> ${badge(t.priority)}</div>
                <div><span>Due:</span> <b style="color:${isOverdue(t.due) ? 'red' : 'inherit'}">${fmtDate(t.due)}</b></div>
            </div>
            <div class="task-notes-display">${t.notes || 'No notes.'}</div>
        </div>

        <div id="dt-checklist" class="dt-section" style="display:${activeTab === 'dt-checklist' ? 'block' : 'none'}">
            <div class="flex-gap-10">
                <input type="text" id="new-check-item" placeholder="Add step..." class="form-input">
                <button class="btn-primary" onclick="window.addTaskCheckItem('${t.id}')">Add</button>
            </div>
            <div class="checklist-list">
                ${(t.checklist || []).map((c, i) => `
                    <div class="check-item" onclick="window.toggleTaskCheck('${t.id}', ${i})">
                        <div class="check-box ${c.done ? 'done' : ''}">${c.done ? '✓' : ''}</div>
                        <span>${c.text}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div id="dt-parts" class="dt-section" style="display:${activeTab === 'dt-parts' ? 'block' : 'none'}">
            <button class="btn-secondary" onclick="window.addPartToActiveTask('${t.id}')">+ Log Part Usage</button>
            <div class="parts-usage-list">
                ${partsUsed.map(p => `
                    <div class="usage-row">
                        <div><b>${p.part_name}</b> x${p.qty_used}</div>
                        <button class="btn-danger" onclick="window.removePartUsage('${p.id}', '${t.id}')">✕</button>
                    </div>
                `).join('')}
            </div>
        </div>

        <div id="dt-comments" class="dt-section" style="display:${activeTab === 'dt-comments' ? 'block' : 'none'}">
            <textarea id="dt-comment-input-large" class="form-textarea" placeholder="Update..."></textarea>
            <button class="btn-primary" onclick="window.addTaskComment('${t.id}')">Post</button>
            <div class="comment-list">
                ${comments.map(c => `<div class="comment-card"><b>${c.author}:</b> ${c.body}</div>`).join('')}
            </div>
        </div>

        <div class="modal-footer-btns">
            ${isManager ? `<button class="btn-danger" onclick="window.deleteTask('${t.id}')">Delete WO</button>` : ''}
            <button class="btn-primary" onclick="window.openTaskSignoff('${t.id}')">Finalize Work</button>
        </div>
    `;

    openModal('detail-modal');
}


