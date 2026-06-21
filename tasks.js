// tasks.js - Work Orders, Checklists, and Sign-offs
import { supabase, persist } from './db.js';
import { uid, showToast, fmtDate, badge, isOverdue } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { logAuditAction } from './admin.js';

// 1. Render the main Work Orders table
export function renderTasksTable(containerId, filter = 'all') {
    const container = document.getElementById(containerId);
    if (!container || !window.state.tasks) return;

    let tasks = [...window.state.tasks];
    const now = new Date().toISOString().split('T')[0];

    // Filter Logic
    if (filter === 'active') tasks = tasks.filter(t => t.status !== 'Completed');
    else if (filter === 'overdue') tasks = tasks.filter(t => isOverdue(t.due) && t.status !== 'Completed');

    // Sort: Overdue first, then Open, then Completed
    tasks.sort((a, b) => {
        const order = { 'Overdue': 0, 'Open': 1, 'Pending Approval': 2, 'Completed': 3 };
        return (order[a.status] || 1) - (order[b.status] || 1);
    });

    container.innerHTML = tasks.map(t => `
        <tr onclick="window.openTaskDetail('${t.id}')" style="cursor:pointer;">
            <td><b>${t.name}</b></td>
            <td>${t.priority}</td>
            <td style="color:${isOverdue(t.due) ? 'var(--danger)' : 'inherit'}">${fmtDate(t.due)}</td>
            <td>${t.assign || '—'}</td>
            <td>${badge(t.status)}</td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px;">No work orders found.</td></tr>';
}

// 2. Save a new Work Order
export async function saveTask(record) {
    try {
        const { error } = await supabase.from('tasks').insert(record);
        if (error) throw error;

        window.state.tasks.push(record);
        showToast("Work Order Created ✓");
        return true;
    } catch (e) {
        console.error(e);
        showToast("Failed to save task");
        return false;
    }
}

// 3. Checklist Logic: Toggle an item
export async function toggleChecklistItem(taskId, index) {
    const task = window.state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    task.checklist[index].done = !task.checklist[index].done;

    try {
        await persist('tasks', 'upsert', task);
        return true;
    } catch (e) {
        showToast("Update failed");
        return false;
    }
}

// 4. Finalize/Sign-off Logic
export async function finalizeTask(taskId, currentUser) {
    const task = window.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';

    if (task.status === 'Pending Approval') {
        if (!isManager) {
            alert("Only a manager can finalize this task.");
            return false;
        }
        task.status = 'Completed';
        await logAuditAction("WO Approved", `Finalized: ${task.name}`, currentUser);
    } else {
        task.status = 'Pending Approval';
        await logAuditAction("WO Sign-off", `Tech completed: ${task.name}`, currentUser);
    }

    await persist('tasks', 'upsert', task);
    showToast("Status Updated ✓");
    return true;
}
