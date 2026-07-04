// analytics.js - Charts, Graphs, and Forecasting
import { healthColor } from './equipment.js';

// 1. Render the Monthly Spend chart (The blue bars)
export function renderCostChart(monthlyCosts, MONTHS) {
    const container = document.getElementById('cost-chart-large');
    if (!container) return;

    const costs = monthlyCosts || [0, 0, 0, 0];
    const max = Math.max(...costs, 1);
    const colors = ['#B5D4F4', '#85B7EB', '#378ADD', '#185FA5'];
    const now = new Date();

    container.innerHTML = costs.map((v, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
        return `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px">
            <div style="font-size:11px; font-weight:700">$${v.toLocaleString()}</div>
            <div style="width:100%; border-radius:4px; height:${Math.round(v / max * 100)}px; background:${colors[i]}"></div>
            <div style="font-size:11px; color:var(--text2)">${MONTHS[d.getMonth()].slice(0,3)}</div>
        </div>`;
    }).join('');
}

// 2. Render Health Scores (The machine health bars)
export function renderHealthScores(state, calcHealthFunc) {
    const el = document.getElementById('health-scores');
    if(!el) return;
    el.innerHTML = state.equipment.map(e => {
        const s = calcHealthFunc(e.id, state.tasks, state.equipment);
        return `
        <div class="stat-row">
            <div style="flex:1; font-size:12px">${e.name}</div>
            <div class="stat-bar-wrap" style="width:100px"><div class="stat-bar" style="width:${s}%; background:${healthColor(s)}"></div></div>
            <div style="width:40px; text-align:right; font-weight:600">${s}%</div>
        </div>`;
    }).join('');
}

// 3. Planned vs Unplanned Logic
export function renderPlannedVsUnplanned(tasks) {
    const el = document.getElementById('planned-vs-unplanned');
    if (!el) return;

    const planned = tasks.filter(t => t.notes && t.notes.includes('auto-generated')).length;
    const total = tasks.length || 1;
    const pct = Math.round((planned / total) * 100);

    el.innerHTML = `
        <div class="stat-row">
            <div style="width:100px;">Planned</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%; background:var(--success)"></div></div>
            <div style="width:30px; text-align:right;">${planned}</div>
        </div>`;
}

export function renderTaskBreakdown(tasks, badgeFunc) {
    const el = document.getElementById('task-breakdown');
    if(!el) return;
    const stats = [
        { label: 'Completed', count: tasks.filter(t => t.status === 'Completed').length, color: 'var(--success)' },
        { label: 'Open', count: tasks.filter(t => t.status === 'Open').length, color: 'var(--accent)' },
        { label: 'Overdue', count: tasks.filter(t => t.status === 'Overdue').length, color: 'var(--danger)' }
    ];
    const total = tasks.length || 1;
    el.innerHTML = stats.map(s => `
        <div class="stat-row">
            <div style="width:80px">${s.label}</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${(s.count/total)*100}%; background:${s.color}"></div></div>
            <div style="width:30px; text-align:right"><b>${s.count}</b></div>
        </div>`).join('');
}

// analytics.js additions
import { equipName } from './utils.js';

// 1. Calculate Uptime % and Draw Downtime Bars
export async function renderDowntimeStats(state) {
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    const { data: logs } = await window._mpdb.from('downtime_logs').select('*').gte('created_at', thirtyDaysAgo);
    if (!logs) return;

    const totalPossibleMins = state.equipment.length * 30 * 24 * 60;
    const totalDownMins = logs.reduce((sum, l) => sum + (l.total_minutes || 0), 0);
    const uptime = totalPossibleMins > 0 ? Math.max(0, Math.min(100, ((totalPossibleMins - totalDownMins) / totalPossibleMins) * 100)) : 100;

    const uptimeEl = document.getElementById('r-uptime');
    if(uptimeEl) uptimeEl.textContent = uptime.toFixed(1) + '%';

    const chart = document.getElementById('downtime-chart');
    if(!chart) return;
    const machineMap = {};
    logs.forEach(l => { const name = equipName(l.equip_id, state); machineMap[name] = (machineMap[name] || 0) + (l.total_minutes / 60); });
    const entries = Object.entries(machineMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const maxH = Math.max(...Object.values(machineMap), 1);
    
    chart.innerHTML = entries.map(([name, hrs]) => `
        <div class="stat-col">
            <div class="stat-val-mini">${hrs.toFixed(1)}h</div>
            <div class="stat-bar-vertical" style="height:${Math.round(hrs/maxH * 80)}px;"></div>
            <div class="stat-label-mini">${name}</div>
        </div>`).join('') || '<div class="empty-text">No downtime logged</div>';
}

// 2. Top Parts Consumed Chart
export function renderTopPartsUsed(state) {
    const el = document.getElementById('parts-consumed');
    if (!el) return;
    const partMap = {};
    (state.partUsage || []).forEach(p => { partMap[p.part_name] = (partMap[p.part_name] || 0) + p.qty_used; });
    const topParts = Object.entries(partMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxQty = Math.max(...topParts.map(x => x[1]), 1);

    el.innerHTML = topParts.map(([name, qty]) => `
        <div class="stat-row">
            <div class="stat-name-wide">${name}</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${(qty/maxQty)*100}%; background:#BA7517"></div></div>
            <div class="stat-qty">${qty}</div>
        </div>`).join('');
}

export function renderCostByEquip() {
    const el = document.getElementById('cost-by-equip');
    if(!el) return;
    const ec = state.equipment.map(e => {
        const c = state.tasks.filter(t => t.equipId === e.id).reduce((a, t) => a + (t.cost || 0), 0);
        return { name: e.name.split(' ').slice(0, 2).join(' '), cost: c };
    }).filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 6);
    const mc = Math.max(...ec.map(x => x.cost), 1);
    el.innerHTML = ec.map(x => `
        <div class="stat-row"><div style="width:100px; font-size:12px; color:var(--text2)">${x.name}</div>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(x.cost/mc*100)}%; background:var(--accent)"></div></div>
        <div style="width:60px; text-align:right; font-weight:600">$${x.cost.toLocaleString()}</div></div>`
    ).join('');
}
