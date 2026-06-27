// equipment.js - The Machine & Health Module
import { supabase, persist } from './db.js';
import { fmtDate, isOverdue, badge, showToast,compressImage,uid} from './utils.js';
import { openModal, } from './ui.js';
import { renderQuickSpecs } from './views.js';
import { buildEquipDetailHTML } from './details.js';

// merged  logic into one clean function.
export function healthColor(score) {
    if (score >= 80) return '#3B6D11'; // Dark Green
    if (score >= 50) return '#BA7517'; // Orange
    return '#E24B4A'; // Red
}

// 2. Calculate Health Score (0-100)
export function calcHealth(equipId, tasks, equipment) {
    const machineTasks = tasks.filter(t => t.equipId === equipId);
    const e = equipment.find(x => x.id === equipId);
    
    if (e?.status === 'Down' || e?.is_locked) return 20;

    let score = 100;
    const overdue = machineTasks.filter(t => t.status !== 'Completed' && isOverdue(t.due)).length;
    const open = machineTasks.filter(t => t.status === 'Open').length;

    score -= (overdue * 20);
    score -= (open * 5);
    
    return Math.max(0, Math.min(100, score));
}

// 3. Helper to get the last service date
export function getLastService(equipId, tasks) {
    const done = tasks.filter(t => t.equipId === equipId && t.status === 'Completed');
    if (!done.length) return '—';
    const sorted = done.sort((a, b) => new Date(b.due) - new Date(a.due));
    return fmtDate(sorted[0].due);
}

// 4. Update Machine Status (Up/Down)
export async function updateEquipStatus(equipId, newStatus, equipment) {
    const e = equipment.find(x => x.id === equipId);
    if (!e) return;

    const oldStatus = e.status;
    e.status = newStatus;

    try {
        await persist('equipment', 'upsert', e);
        showToast(`${e.name} is now ${newStatus}`);
        return true;
    } catch (err) {
        showToast("Status update failed");
        return false;
    }
}

export async function uploadZerkView(input, state) {
    const file = input.files[0]; if(!file) return;
    const equipId = window._currentDetailEquipId;
    const e = state.equipment.find(x => x.id === equipId);
    if(!e) return;

    showToast("⚙️ Processing image...");
    
    try {
        const reader = new FileReader();
        const dataUrl = await new Promise(res => {
            reader.onload = ev => res(ev.target.result); 
            reader.readAsDataURL(file);
        });
        
        const base64 = await compressImage(dataUrl, 1200, 0.8);
        if(!e.zerk_photos) e.zerk_photos = [];
        e.zerk_photos.push(base64);

        const { error } = await window._mpdb.from('equipment').update({ zerk_photos: e.zerk_photos }).eq('id', equipId);
        if (error) throw error;

        showToast("View added ✓");
        if (typeof window.refreshZerkMap === 'function') window.refreshZerkMap(equipId);
    } catch(err) { showToast("Upload failed"); }
    input.value = "";
}

export function openEquipDetail(id, state) {
  const e = state.equipment.find(x => x.id === id); 
  if(!e) return;
  
  window._currentDetailEquipId = id; // Store for other functions
  const score = calcHealth(id, state.tasks, state.equipment);

  // 1. Set the Title
  const titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = e.name;
  
  // 2. Build and Inject the HTML
  const bodyEl = document.getElementById('detail-body');
  if (bodyEl) {
      bodyEl.innerHTML = buildEquipDetailHTML(e, score, healthColor);
  }

  // 3. Open the Modal
  openModal('detail-modal');

  // 4. Trigger sub-renders (Fill in the specs and timeline)
  renderQuickSpecs(id, state);
}
export async function addObservation(equipId, state, currentUser) {
    const input = document.getElementById(`obs-input-${equipId}`);
    const severitySelect = document.getElementById(`obs-severity-${equipId}`);
    
    if (!input) return;
    
    const body = input.value.trim();
    const severity = severitySelect ? severitySelect.value : 'info';

    if (!body) {
        showToast("Enter a note first");
        return;
    }

    const record = {
        id: uid(),
        equip_id: equipId,
        author: currentUser.name,
        body: body,
        severity: severity,
        created_at: new Date().toISOString()
    };

    try {
        // 1. Save to Supabase
        const { error } = await supabase.from('observations').insert(record);
        if (error) throw error;

        // 2. Update local memory
        if (!state.observations) state.observations = [];
        state.observations.unshift(record);

        // 3. UI Refresh
        // We call the renderer we moved to details.js earlier
        if (typeof window.renderObservationsList === 'function') {
            window.renderObservationsList(equipId);
        }
        
        // 4. Cleanup
        input.value = '';
        showToast("Observation added ✓");
        return true;
    } catch (e) {
        console.error("Observation error:", e);
        showToast("Error saving note");
        return false;
    }
}

export async function deleteObservation(obsId, equipId) {
    if (!confirm("Permanently delete this observation?")) return;

    try {
        await window._mpdb.from('observations').delete().eq('id', obsId);
        
        // Remove from local memory
        state.observations = state.observations.filter(o => o.id !== obsId);
        
        // Refresh UI
        renderObservationsList(equipId);
        renderDashboard();
        showToast("Deleted ✓");
    } catch (e) { showToast("Delete failed"); }
}

export async function editQuickSpec(equipId, key) {
    const e = state.equipment.find(x => x.id === equipId);
    if(!e || !e.custom_fields) return;

    const currentVal = e.custom_fields[key];
    const newVal = prompt(`Update value for "${key}":`, currentVal);

    // If user clicks cancel or enters nothing, do nothing
    if (newVal === null || newVal.trim() === "") return;

    // Update local state and redraw
    e.custom_fields[key] = newVal.trim();
    renderQuickSpecs(equipId);

    // Save to DB
    try {
        await persist('equipment', 'upsert', e);
        showToast("Updated ✓");
    } catch(err) { console.error(err); }
}


// 1. Safety Lockout: Disables a machine and alerts the team
export async function toggleLockout(equipId, isLocked, currentUser) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;

    let reason = "";
    if (isLocked) {
        reason = prompt("REASON FOR SAFETY LOCKOUT:\n(This will be shown on the dashboard)");
        if (!reason) return false; // Cancel if no reason given
        e.status = 'Down'; 
    } else {
        if (!confirm("Clear safety lockout? Ensure all repairs are verified.")) return true;
        e.status = 'Operational';
    }

    e.is_locked = isLocked;
    e.lock_reason = reason;

    try {
        await persist('equipment', 'upsert', e);
        
        // Log the safety event
        const alertMsg = isLocked ? 
            `🚨 SAFETY LOCKOUT: ${currentUser.name} locked out ${e.name}. Reason: ${reason}` : 
            `✅ LOCKOUT CLEARED: ${e.name} is back in service.`;
        
        // Use your existing log function
        if (typeof window.logAuditAction === 'function') {
            window.logAuditAction("Safety Update", alertMsg, currentUser);
        }

        showToast(isLocked ? "Machine LOCKED" : "Lockout Cleared");
        return true;
    } catch(err) {
        showToast("Update failed");
        return false;
    }
}

// 2. Manage Quick Specs (Oil types, Tire PSI, etc.)
export async function addQuickSpec(equipId) {
    const e = window.state.equipment.find(x => x.id === equipId);
    if(!e) return;

    const key = prompt("Spec Name (e.g. Engine Oil, Front Tire PSI)");
    if (!key) return;
    const val = prompt(`Value for ${key}`);
    if (!val) return;

    if (!e.custom_fields) e.custom_fields = {};
    e.custom_fields[key] = val;

    await persist('equipment', 'upsert', e);
    showToast("Spec saved ✓");
    return true;
}

export async function deleteQuickSpec(equipId, key) {
    if (!confirm(`Delete the spec "${key}"?`)) return;
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e || !e.custom_fields) return;

    delete e.custom_fields[key];
    await persist('equipment', 'upsert', e);
    showToast("Spec deleted");
    return true;
}
 export async function setManualLink(equipId) {
    const url = prompt("Enter the URL for this machine's parts manual or manufacturer catalog:");
    if (!url) return;

    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;
    
    e.manual_url = url;
    try {
        await persist('equipment', 'upsert', e);
        openEquipDetail(equipId); // Refresh the card to show the new button
        showToast("Catalog link saved ✓");
    } catch(err) {
        showToast("Failed to save link");
    }
}

export function globalEditObs(id, state) {
    const obs = state.observations.find(o => o.id === id);
    if (!obs) return alert("Error: Observation data not found.");

    const idField = document.getElementById('edit-obs-id');
    const sevField = document.getElementById('edit-obs-sev');
    const bodyField = document.getElementById('edit-obs-body');
    const modalBackdrop = document.getElementById('obs-edit-modal-backdrop');

    if (idField && sevField && bodyField && modalBackdrop) {
        idField.value = id;
        sevField.value = obs.severity;
        bodyField.value = obs.body;
        modalBackdrop.style.display = 'flex';
    }
}

export async function saveObservationChange(state) {
    const idEl = document.getElementById('edit-obs-id');
    const bodyEl = document.getElementById('edit-obs-body');
    const sevEl = document.getElementById('edit-obs-sev');

    const obsId = idEl.value;
    const newBody = bodyEl.value.trim();
    const newSev = sevEl.value;

    try {
        const { error } = await window._mpdb.from('observations').update({ body: newBody, severity: newSev }).eq('id', obsId);
        if (error) throw error;

        const obsIndex = state.observations.findIndex(o => o.id === obsId);
        if (obsIndex !== -1) {
            state.observations[obsIndex].body = newBody;
            state.observations[obsIndex].severity = newSev;
        }
        
        document.getElementById('obs-edit-modal-backdrop').style.display = 'none';
        showToast("Update saved ✓");
        return true;
    } catch (e) {
        alert("Save failed");
        return false;
    }
}

export async function saveEquipment(state, currentUser, pendingPhotos, customFieldsTemp) {
  const name = document.getElementById('e-name').value.trim(); 
  if(!name) {
      showToast('Please enter a name');
      return { success: false };
  }
  
  const record = {
    id: uid(), 
    name,
    type:         document.getElementById('e-type').value,
    serial:       document.getElementById('e-serial').value,
    manufacturer: document.getElementById('e-manufacturer')?.value.trim() || '',
    hours:        parseInt(document.getElementById('e-hours').value) || 0,
    status:       document.getElementById('e-status').value,
    op:           document.getElementById('e-op').value,
    notes:        document.getElementById('e-notes').value,
    group_tag:    document.getElementById('e-group')?.value || 'outside',
    monthly_budget: parseFloat(document.getElementById('e-budget-monthly')?.value) || 0,
    yearly_budget:  parseFloat(document.getElementById('e-budget-yearly')?.value) || 0,
    photos:         pendingPhotos.equip.slice(),
    custom_fields:  { ...customFieldsTemp }, 
    health_score:   100
  };

  try {
    // 1. Save to Supabase
    await persist('equipment', 'upsert', record);

    
    // This ensures that all files (app.js, views.js, dashboard.js) see the new machine
    if (!window.state.equipment) window.state.equipment = [];
    window.state.equipment.push(record);
    
    // 3. Log the action
    await logAuditAction("Added Machine", `Added "${name}" to the fleet.`, currentUser);

    // 4. Cleanup UI State
    pendingPhotos.equip = [];
    Object.keys(customFieldsTemp).forEach(key => delete customFieldsTemp[key]);

    return { success: true }; // Send success signal back to app.js

  } catch (e) {
    console.error("Save Equipment Failed:", e);
    showToast("Error saving machine");
    return { success: false };
  }
}

export function getNextDue(id, tasks) {
  const openTasks = tasks.filter(t => (t.equipId === id || t.equip_id === id) && t.status !== 'Completed');
  if(!openTasks.length) return '—';
  
  const sorted = openTasks.sort((a, b) => new Date(a.due) - new Date(b.due));
  const next = sorted[0];
  
  return `<span style="color:${window.isOverdue(next.due) ? 'var(--danger)' : 'inherit'}">${fmtDate(next.due)}</span>`;
}
