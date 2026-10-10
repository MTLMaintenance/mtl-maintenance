// dashboard.js - Home Screen & Analytics Rendering
import { fmtDate, badge, isOverdue } from './utils.js';
import { supabase } from './db.js';
import { updateDashboardParts } from './inventory.js';

// Helper: look up an equipment's display name from its ID.
// (Was called in renderRecentTasks/renderSchedule but never defined/imported.)
function equipName(equipId) {
    const eq = (window.state.equipment || []).find(e => e.id === equipId);
    return eq ? eq.name : 'Unknown Equipment';
}

// 1. Update the big numbers at the top (Open, Overdue, Total)
export function updateMetrics() {
    const tasks = window.state.tasks || [];
    const now = new Date(); now.setHours(0,0,0,0);

    const openTasks = tasks.filter(attentionOpen);
    const overdueTasks = openTasks.filter(t => { const due = attentionDate(t.due || t.due_date); return due && due < now; });

    const openEl = document.getElementById('m-open');
    const overdueEl = document.getElementById('m-overdue');
    const totalEq = document.getElementById('m-total');

    if (openEl) openEl.textContent = openTasks.length;
    if (totalEq) totalEq.textContent = window.state.equipment.length;
    if (overdueEl) {
        overdueEl.textContent = overdueTasks.length;
        overdueEl.style.color = overdueTasks.length > 0 ? "#dc3545" : "#28a745";
    }
}

// 2. Render the mini machine list on the dashboard
export async function renderEquipListDash() {
  const el = document.getElementById('equip-list-dash');
  if(!el) return;

  const list = window.state.equipment.slice(0, 8); // Just show top 8
  
  el.innerHTML = list.map(e => `
    <div class="equip-row" onclick="window.openEquipDetail('${e.id}')" style="cursor:pointer;">
      <div class="equip-info">
        <div class="equip-name">${e.is_locked ? '🚨 ' : ''}${e.name}</div>
        <div class="equip-meta">${e.hours.toLocaleString()} hrs · ${badge(e.status)}</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.quickLogHours('${e.id}')">⏱ Log</button>
    </div>`).join('');
}

// 3. Render Upcoming Schedule
export function renderSchedDash() {
  const el = document.getElementById('sched-list-dash');
  if (!el) return;

  const combined = [...window.state.tasks]
    .filter(t => attentionOpen(t) && (t.due || t.due_date))
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 6);

  el.innerHTML = combined.map(s => `
    <div class="sched-item" onclick="window.openTaskDetail('${s.id}')" style="cursor:pointer">
      <div class="sched-body">
        <div class="sched-title">${s.name} ${badge(s.status)}</div>
        <div class="sched-detail">${s.assign || 'Unassigned'} · Due: ${fmtDate(s.due)}</div>
      </div>
    </div>`).join('') || '<div>No upcoming work.</div>';
}

// 4. Adaptive Prediction Logic (The "Smart" part of your dashboard)
export async function getAdaptivePrediction(equipId) {
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e || e.status === 'Down') return { status: 'PAUSED' };

    const { data: history } = await supabase.from('meter_history')
        .select('reading, created_at')
        .eq('equip_id', equipId)
        .order('created_at', { ascending: false }).limit(7);

    if (!history || history.length < 2) return null;

    const newest = history[0];
    const oldest = history[history.length - 1];
    const hoursUsed = Number(newest.reading) - Number(oldest.reading);
    const daysPassed = (new Date(newest.created_at) - new Date(oldest.created_at)) / 86400000;
    
    const burnRate = hoursUsed / (daysPassed || 0.1); 
    const hoursRemaining = 500 - (e.hours % 500); // Example 500hr interval

    return {
        status: 'ACTIVE',
        hoursRemaining: Math.round(hoursRemaining),
        predictedDate: new Date(Date.now() + (hoursRemaining / burnRate) * 86400000)
    };
}
export function renderRecentTasks(){
  const tasks = window.state.tasks || [];
  const partUsage = window.state.partUsage || [];
  const recent = [...tasks].sort((a,b)=>new Date(b.due)-new Date(a.due)).slice(0,5);

  const badgeEl = document.getElementById('task-count-badge');
  if (badgeEl) badgeEl.textContent = tasks.length+' work orders';

  const el = document.getElementById('recent-tasks');
  if (!el) return;

  el.innerHTML = recent.map(t=>{
    const partsUsed = partUsage.filter(p=>p.task_id===t.id).length;
    return `<div class="parts-row" onclick="openTaskDetail('${t.id}')">
      <div style="flex:1"><div style="font-weight:500">${t.name}</div><div style="font-size:11px;color:var(--text2)">${equipName(t.equipId)}${partsUsed?` · ${partsUsed} part(s) used`:''}</div></div>
      ${badge(t.status)}<div style="font-size:12px;color:var(--text2);min-width:52px;text-align:right">$${(t.cost||0).toLocaleString()}</div>
    </div>`;
  }).join('') || '<div style="color:var(--text3);font-size:12px;padding:8px 0">No work orders yet.</div>';
}

// TODO/BROKEN: This function references undefined names (TODAY, MONTHS,
// state.schedules) and builds an `mk()` template that is never appended
// anywhere — nothing in this function writes to the DOM. It does NOT
// populate the dashboard's #sched-list-dash (that's renderSchedDash, above,
// which works fine). This looks like it belongs to a separate, unfinished
// full-schedule/calendar panel. Left untouched until we know its intended
// container and where TODAY/MONTHS/state are supposed to come from.
export function renderSchedule(){
  const nw = new Date(TODAY); nw.setDate(nw.getDate() + 7);
  const n30 = new Date(TODAY); n30.setDate(n30.getDate() + 30);
  const sorted = [...state.schedules].sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const mk = s => {
    const d = new Date(s.date);
    return `
    <div class="sched-item">
      <!-- Left: Blue Date Badge -->
      <div class="sched-date">
        <div class="sched-day">${d.getDate()}</div>
        <div class="sched-month">${MONTHS[d.getMonth()].slice(0,3)}</div>
      </div>
      
      <!-- Middle: Task Info -->
      <div class="sched-body">
        <div class="sched-title">${s.name}</div>
        <div class="sched-detail">
            ${equipName(s.equipId)} · <span style="font-weight:600; color:#555;">${s.tech||'Unassigned'}</span>
        </div>
      </div>
      
      <!-- Right: Subtle Delete Icon -->
      <button class="btn-delete-sched" title="Delete" onclick="deleteSched('${s.id}')">×</button>
    </div>`;
  };
}

// Per-equipment observations list (e.g. equipment detail view).
// Fixed: was referencing bare `state` instead of `window.state`.
export function renderDashboardObs(equipId) {
    const container = document.getElementById('eq-obs-list-dash');
    if(!container) return;
    const obs = (window.state.observations || []).filter(o => o.equip_id === equipId).slice(0, 3);
    container.innerHTML = obs.map(o => `
        <div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
            <div style="color:var(--text3); font-size:10px">${o.author} · ${fmtDate(o.created_at)}</div>
            <div>${o.body.slice(0, 50)}${o.body.length > 50 ? '...' : ''}</div>
        </div>
    `).join('') || '<div style="color:var(--text3); font-size:11px">No notes</div>';
}

// NEW: Single entry point to redraw the entire dashboard.
// Call this any time data changes anywhere in the app (after saving/
// deleting equipment, tasks, parts, observations, etc.) so the home
// screen actually reflects the update instead of going stale.
export function refreshDashboard() {
    updateMetrics();
    renderEquipListDash();
    renderSchedDash();
    renderRecentTasks();
    renderRecentObsDash();
    updateDashboardParts(window.state);
    renderNeedsAttention();
}

// NEW: Recent Observations card on the main dashboard.
// The old renderDashboardObs() targeted #eq-obs-list-dash and required an
// equipId — neither matches the dashboard's #recent-obs-list container,
// which needs the latest notes across ALL equipment. This fills that gap.
export function renderRecentObsDash() {
    const container = document.getElementById('recent-obs-list');
    if (!container) return;

    const allObs = window.state.observations || [];
    const recent = [...allObs]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

    const badgeEl = document.getElementById('obs-count-badge');
    if (badgeEl) badgeEl.textContent = allObs.length + ' notes';

    container.innerHTML = recent.map(o => `
        <div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
            <div style="color:var(--text3); font-size:10px">${o.author} · ${equipName(o.equip_id)} · ${fmtDate(o.created_at)}</div>
            <div>${o.body.slice(0, 50)}${o.body.length > 50 ? '...' : ''}</div>
        </div>
    `).join('') || '<div style="color:var(--text3); font-size:11px; padding:8px 0">No observations yet.</div>';
}
    


// Central read-only action queue. Uses existing in-memory data and existing navigation.
// No extra queries or database migrations required.
const attentionEscape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attentionOpen = task => !['completed','closed','cancelled','canceled','done','approved'].includes(String(task.status || '').toLowerCase());
const attentionDate = value => {
    if (!value) return null;
    const raw = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(raw + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? null : date;
};
export function renderNeedsAttention() {
    const root = document.getElementById('needs-attention-dashboard');
    if (!root) return;
    const state = window.state || {};
    const today = new Date(); today.setHours(0,0,0,0);
    const tasks = (state.tasks || []).filter(attentionOpen);
    const overdue = tasks.filter(t => { const d = attentionDate(t.due || t.due_date); return d && d < today; });
    const criticalEquipment = (state.equipment || []).filter(e => e.is_locked || ['down','out of service','out-of-service'].includes(String(e.status || '').toLowerCase()));
    const activeFaults = (state.faults || []).filter(f => String(f.status || '').toLowerCase() === 'active');
    const parts = (state.parts || []).filter(p => { const threshold = Number(p.reorder_qty ?? p.reorder ?? 0); return threshold > 0 && Number(p.qty ?? 0) <= threshold; });
    const tools = (state.tools || []).filter(t => ['available','in shop','checked out',''].includes(String(t.status ?? '').toLowerCase()));
    const badTools = tools.filter(t => t.is_lost || Number(t.health ?? 100) < 75);
    const pending = (state.tools || []).filter(t => ['pending','requested'].includes(String(t.status || '').toLowerCase()));
    const groups = [
        {key:'overdue',title:'Overdue Work Orders',count:overdue.length,panel:'tasks',items:overdue.map(t => ({label:t.name || 'Work order',detail:`Due ${String(t.due || t.due_date).slice(0,10)}`,id:t.id,kind:'task'}))},
        {key:'equipment',title:'Equipment Down / Locked',count:criticalEquipment.length,panel:'equipment',items:criticalEquipment.map(e => ({label:e.name || 'Equipment',detail:e.status || 'Locked',id:e.id,kind:'equipment'}))},
        {key:'faults',title:'Active Faults',count:activeFaults.length,panel:'equipment',items:activeFaults.map(f => ({label:(state.equipment || []).find(e => String(e.id) === String(f.equip_id))?.name || 'Equipment fault',detail:f.description || f.code || 'Active fault',id:f.equip_id,kind:'equipment'}))},
        {key:'parts',title:'Parts to Reorder',count:parts.length,panel:'parts',items:parts.map(p => ({label:p.name || 'Part',detail:`${Number(p.qty || 0)} in stock · reorder at ${Number(p.reorder_qty ?? p.reorder ?? 0)}`}))},
        {key:'tools',title:'Tools Needing Attention',count:badTools.length,panel:'tools',items:badTools.map(t => ({label:t.name || t.tool_name || 'Tool',detail:t.is_lost ? 'Missing' : Number(t.health ?? 100) <= 0 ? 'Out of service' : 'Needs repair'}))},
        {key:'requests',title:'Pending Tool Requests',count:pending.length,panel:'tools',items:pending.map(t => ({label:t.name || t.tool_name || 'Tool request',detail:t.request_reason || t.notes || 'Awaiting review'}))}
    ];
    const count = groups.reduce((sum,g) => sum + g.count,0);
    const totalEl = document.getElementById('needs-attention-total');
    if (totalEl) totalEl.textContent = `${count} item${count === 1 ? '' : 's'} requiring attention`;
    root.innerHTML = groups.map(g => `<section class="attention-group" data-attention="${g.key}">
      <button type="button" class="attention-group-heading" onclick="window.showPanel('${g.panel === 'tasks' ? 'tasks' : g.panel}')">
        <span>${attentionEscape(g.title)}</span><strong class="${g.count ? 'attention-has-items' : ''}">${g.count}</strong>
      </button>
      ${g.count ? `<div class="attention-entries">${g.items.slice(0,4).map(item => `<button type="button" class="attention-entry" ${item.id && item.kind ? `onclick="window.showPanel('${g.panel === 'tasks' ? 'tasks' : g.panel}');${item.kind==='task' ? `window.openTaskDetail?.('${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '')}')` : `window.openEquipDetail?.('${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '')}')`}"` : `onclick="window.showPanel('${g.panel === 'tasks' ? 'tasks' : g.panel}')"`}><span>${attentionEscape(item.label)}</span><small>${attentionEscape(item.detail)}</small></button>`).join('')}${g.count > 4 ? `<div class="attention-more">+${g.count-4} more — open ${attentionEscape(g.title)}</div>` : ''}</div>` : '<div class="attention-empty">Nothing needs attention</div>'}
    </section>`).join('');
}
