// equipment.js - The Machine & Health Module
import { supabase, persist } from './db.js';
import { fmtDate, isOverdue, badge, showToast } from './utils.js';
import { openModal } from './ui.js';

// 1. Health Color Logic (The source of your current error!)
// I have merged your logic into one clean function.
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
import { compressImage, showToast } from './utils.js';

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
