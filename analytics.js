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
