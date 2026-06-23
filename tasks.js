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

// 1. Open the PIN Pad for a specific task
export function openTaskSignoff(taskId, currentUser) {
    window.currentTargetTaskId = taskId;
    window.taskPinEntry = "";
    
    const display = document.getElementById('task-pin-display');
    if (display) display.textContent = "";
    
    const task = window.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('task-pin-user-name').textContent = currentUser.name;
    
    if (task.status === 'Pending Approval') {
        document.getElementById('task-pin-title').textContent = "Manager Approval";
        document.getElementById('task-pin-instruction').textContent = "Manager PIN required to finalize";
    } else {
        document.getElementById('task-pin-title').textContent = "Technician Sign-off";
        document.getElementById('task-pin-instruction').textContent = "Enter your PIN to verify work";
    }

    // Force the PIN modal to sit on top of the detail modal
    const pinModal = document.getElementById('task-pin-modal');
    if (pinModal) pinModal.style.display = 'flex';
}

// 2. Verify the PIN typed for the task
export async function verifyTaskPinAction(currentUser) {
    const task = window.state.tasks.find(t => t.id === window.currentTargetTaskId);
    const now = new Date().toISOString();

    // PIN SECURITY CHECK
    if (window.taskPinEntry !== currentUser.pin_code) {
        alert("Incorrect PIN for " + currentUser.name);
        window.taskPinEntry = "";
        document.getElementById('task-pin-display').textContent = "";
        return false;
    }

    if (task.status === 'Pending Approval') {
        // Manager Approval Flow
        if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
            alert("Access Denied: Only a Manager can approve this task.");
            return false;
        }
        task.status = 'Completed';
        task.manager_user_name = currentUser.name;
        task.manager_signed_at = now;
    } else {
        // Technician Sign-off Flow
        task.status = 'Pending Approval';
        task.tech_user_name = currentUser.name;
        task.tech_signed_at = now;
    }

    await persist('tasks', 'upsert', task);
    return true;
}

// 3. Add a new step to a checklist
export async function addTaskCheckItem(taskId, text) {
  const t = window.state.tasks.find(x => x.id === taskId);
  if (!t.checklist) t.checklist = [];
  t.checklist.push({ text: text, done: false });
  await persist('tasks', 'upsert', t);
  return true;
}
