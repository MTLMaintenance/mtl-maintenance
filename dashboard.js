// dashboard.js - Home Screen & Analytics Rendering
import { fmtDate, badge, isOverdue } from './utils.js';
import { supabase } from './db.js';

// 1. Update the big numbers at the top (Open, Overdue, Total)
export function updateMetrics() {
    const tasks = window.state.tasks || [];
    const now = new Date().toISOString().split('T')[0];

    const openTasks = tasks.filter(t => (t.status || "").toLowerCase() !== "completed");
    const overdueTasks = openTasks.filter(t => t.due && t.due < now);

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
    .filter(t => t.status !== 'Completed' && t.due)
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
