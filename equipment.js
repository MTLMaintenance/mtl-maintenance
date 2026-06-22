// equipment.js - The Machine & Health Module
import { supabase, persist } from './db.js';
import { fmtDate, isOverdue, badge, showToast,compressImage} from './utils.js';
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
