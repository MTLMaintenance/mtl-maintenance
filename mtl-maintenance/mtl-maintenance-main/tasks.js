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
export async function saveTask() {
    const name = document.getElementById('t-name').value.trim();
    const equipId = document.getElementById('t-equip').value;
    const due = document.getElementById('t-due').value;

    if (!name || !equipId) return showToast("Name and Equipment required");

    const record = {
        id: uid(),
        name: name,
        equip_id: equipId,
        due: due,
        priority: document.getElementById('t-priority').value,
        assign: document.getElementById('t-assign').value,
        notes: document.getElementById('t-notes').value,
        status: 'Open',
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await window._mpdb.from('tasks').insert(record);
        if (error) throw error;

        // 1. Update State
        window.state.tasks.push({ ...record, equipId: record.equip_id });

        // 2. THE SEAMLESS REFRESH
        window.closeModal('task-modal');
        
        // Redraw EVERYTHING
        if (typeof window.renderTasksTable === 'function') window.renderTasksTable();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        if (typeof window.updateMetrics === 'function') window.updateMetrics();
        if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
        
        showToast("Work Order Saved ✓");
    } catch (e) { console.error(e); }
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
    if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
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
    if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
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

export async function deleteChecklistItem(taskId, index) {
    // 1. Confirm with user
    if (!confirm("Remove this item from the checklist?")) return;

    // 2. Find the task in local memory
    const task = window.state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    // 3. Remove the specific item from the array
    task.checklist.splice(index, 1);

    try {
        // 4. Update the database
        await persist('tasks', 'upsert', task);
        
        // 5. Log the action for accountability
        if (typeof logAuditAction === 'function') {
            logAuditAction("Checklist Item Removed", `Deleted a step from task: ${task.name}`);
        }

        // 6. Refresh the modal live so the item vanishes
        if (typeof window.openTaskDetail === 'function') window.openTaskDetail(taskId);
        showToast("Item removed ✓");

    } catch (e) {
        console.error("Failed to delete checklist item:", e);
        showToast("Error updating checklist");
    }
}

// 1. Post a new comment to a work order
export async function addTaskComment(taskId, body, currentUser) {
    if (!body.trim()) return false;

    const comment = {
        id: uid(),
        task_id: taskId,
        author: currentUser.name,
        body: body.trim(),
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('wo_comments').insert(comment);
        if (error) throw error;
        showToast("Comment posted ✓");
        return true;
    } catch (e) {
        console.error("Comment failed:", e);
        return false;
    }
}

// 2. Delete a comment
export async function deleteTask(id) {
    if (!confirm("Delete this work order?")) return;

    try {
        await window._mpdb.from('tasks').delete().eq('id', id);
        
        // Remove from local memory
        window.state.tasks = window.state.tasks.filter(t => t.id !== id);

        // Redraw EVERYTHING
        if (typeof window.renderTasksTable === 'function') window.renderTasksTable();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
        
        showToast("Work Order Removed");
    } catch (e) { console.error(e); }
}

export async function deleteTaskComment(commentId, taskId) {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
        // 1. Delete from Supabase
        const { error } = await window._mpdb
            .from('wo_comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;

        // 2. Refresh the UI
        // Since we are likely inside the detail modal, we redraw it
        if (typeof window.openTaskDetail === 'function') {
            window.openTaskDetail(taskId);
        }

        window.showToast("Comment deleted");
    } catch (e) {
        console.error("Failed to delete comment:", e);
        window.showToast("Error deleting comment");
    }
}

export async function addPartToActiveTask(taskId) {
    const partId = prompt("Enter Part ID or Scan QR:"); // You can replace this with a dropdown later
    if (!partId) return;

    const qty = parseInt(prompt("How many used?")) || 1;
    const part = window.state.parts.find(p => p.id === partId || p.num === partId);

    if (!part) return alert("Part not found in inventory.");

    const usage = {
        id: uid(),
        task_id: taskId,
        part_id: part.id,
        part_name: part.name,
        qty_used: qty,
        used_by: window.currentUser.name,
        used_at: new Date().toISOString()
    };

    // 1. Save usage
    window.state.partUsage.push(usage);
    await window._mpdb.from('part_usage').insert(usage);

    // 2. Update stock
    part.qty = Math.max(0, part.qty - qty);
    await persist('parts', 'upsert', part);

    // 3. Refresh the modal view
    if (typeof window.openTaskDetail === 'function') window.openTaskDetail(taskId);
    if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
    showToast("Part logged live ✓");
}

export function switchPartsTab(tabType) {
    const partBtn = document.getElementById('add-part-btn');
    const consumableBtn = document.getElementById('add-consumable-btn');

    if (tabType === 'inventory') {
        // Show Part button, Hide Consumable button
        if (partBtn) partBtn.style.display = 'inline-flex';
        if (consumableBtn) consumableBtn.style.display = 'none';
        
        // Your existing logic to show the inventory table
        renderParts(); 
    } else {
        // Hide Part button, Show Consumable button
        if (partBtn) partBtn.style.display = 'none';
        if (consumableBtn) consumableBtn.style.display = 'inline-flex';
        
        // Your existing logic to show consumables table 
    }
}

export function updateTotalCostDisplay() {
  const costEl = document.getElementById('t-cost');
  const partsCost = (window.woPartsAdded || []).reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0);
  const otherEl = document.getElementById('t-other-cost');
  const partsEl = document.getElementById('t-parts-cost');
  const totalEl = document.getElementById('t-total-cost');
  const breakdown = document.getElementById('t-cost-breakdown');

  const total = parseFloat(costEl?.value) || 0;
  const otherCost = Math.max(0, total - partsCost);

  if(breakdown) breakdown.style.display = partsCost > 0 ? 'block' : 'none';
  if(partsEl) partsEl.textContent = '$' + partsCost.toFixed(2);
  if(otherEl) otherEl.textContent = '$' + otherCost.toFixed(2);
  if(totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

export function startJobWorkflow(jobType, equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;

    // 1. Reset the form to clear old data
    if (typeof window.resetPartForm === 'function') window.resetPartForm();

    // 2. Open the modal
    window.openModal('task-modal');

    // 3. Pre-fill the data
    const nameInput = document.getElementById('t-name');
    const equipSelect = document.getElementById('t-equip');
    
    if (nameInput) {
        // Set name to "REPAIR: CAT 289D - " so they just type the problem
        nameInput.value = `${jobType.toUpperCase()}: ${e.name} - `;
        nameInput.focus();
    }

    if (equipSelect) {
        // We run this to make sure the dropdown HAS the machines in it first
        if (typeof window.populateSelects === 'function') window.populateSelects();
        equipSelect.value = equipId;
    }

    window.showToast(`Starting ${jobType} workflow...`);
}
