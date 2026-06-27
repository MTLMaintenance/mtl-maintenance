// zerk.js - Interactive Grease Map Logic
import { supabase, persist } from './db.js';
import { uid, showToast } from './utils.js';

// 1. Handle clicking on the image to add a new point
export async function handleZerkMapClick(event, viewIdx, equipId, zerkPinMode, state) {
    // Only admins/managers can add points
    if (window.currentUser.role === 'viewer') return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const equip = state.equipment.find(e => e.id === equipId);
    if (!equip) return;

    // MODE 1: SIMPLE DOT
    if (zerkPinMode === 'dot') {
        const note = prompt("Grease Instructions (e.g. 2 Pumps, EP2):");
        if (note === null) return;

        if (!equip.zerk_points) equip.zerk_points = [];
        equip.zerk_points.push({
            id: uid(),
            x: x.toFixed(2),
            y: y.toFixed(2),
            lx: null, ly: null, // No line offset
            note: note || "",
            view_index: viewIdx
        });
    } 
    // MODE 2: POINTER LINE (Uses Drawing Steps)
    else {
        if (!window.zerkDrawingStep || window.zerkDrawingStep === 1) {
            window.tempZerkCoords = { x, y };
            window.zerkDrawingStep = 2;
            showToast("Fitting set! Now click where the number should sit.");
            return;
        } else {
            const note = prompt("Grease Instructions:");
            if (note === null) { window.zerkDrawingStep = 1; return; }

            equip.zerk_points.push({
                id: uid(),
                x: window.tempZerkCoords.x.toFixed(2), // Fitting location
                y: window.tempZerkCoords.y.toFixed(2),
                lx: x.toFixed(2),                      // Label location
                ly: y.toFixed(2),
                note: note || "",
                view_index: viewIdx
            });
            window.zerkDrawingStep = 1;
        }
    }

    // Save and Refresh
    await persist('equipment', 'upsert', equip);
    return true; // Signal UI to redraw
}

// 2. Delete a grease point
export async function deleteZerk(id, equipId, state) {
    if (!confirm("Delete this grease point?")) return;

    const equip = state.equipment.find(x => x.id === equipId);
    if (!equip || !equip.zerk_points) return;

    equip.zerk_points = equip.zerk_points.filter(p => p.id !== id);

    try {
        const { error } = await supabase.from('equipment').update({ zerk_points: equip.zerk_points }).eq('id', equipId);
        if (error) throw error;
        showToast("Point removed ✓");
        return true;
    } catch (e) {
        showToast("Error deleting point");
        return false;
    }
}

// 3. Rename a Photo View
export async function renameZerkView(idx, equipId, state) {
    const equip = state.equipment.find(x => x.id === equipId);
    if (!equip) return;

    const currentName = (equip.zerk_names && equip.zerk_names[idx]) ? equip.zerk_names[idx] : `View ${idx + 1}`;
    const newName = prompt("Rename this view:", currentName);

    if (newName && newName.trim() !== "") {
        if (!equip.zerk_names) equip.zerk_names = [];
        equip.zerk_names[idx] = newName.trim();
        await persist('equipment', 'upsert', equip);
        showToast("Renamed ✓");
        return true;
    }
    return false;
}

export function renderZerkTab(equipId) {
    const equip = window.state.equipment.find(x => x.id === equipId);
    const switcher = document.getElementById('zerk-view-switcher');
    const container = document.getElementById('tab-content-zerk');
    const modal = document.getElementById('detail-modal');

    if (!equip || !container) return;

    // 1. Setup UI States
    const viewIdx = window._currentZerkViewIdx || 0;
    const currentMode = window.zerkPinMode || 'dot';
    const showAllLines = window.showZerkLines || false;

    // 2. Build View Switcher (The buttons at the top)
    if (switcher && equip.zerk_photos) {
        switcher.innerHTML = equip.zerk_photos.map((_, i) => {
            const name = (equip.zerk_names && equip.zerk_names[i]) ? equip.zerk_names[i] : `View ${i + 1}`;
            return `<button class="btn ${viewIdx === i ? 'btn-primary' : 'btn-secondary'} btn-sm" 
                    onclick="window._currentZerkViewIdx=${i}; window.renderZerkTab('${equipId}')">${name}</button>`;
        }).join('') + `<button class="btn btn-secondary btn-sm" onclick="window.addZerkViewWithTitle()">+</button>`;
    }

    // 3. Build the Map and Sidebar
    if (!equip.zerk_photos || equip.zerk_photos.length === 0) {
        container.innerHTML = `<div class="empty-text">No photo maps added yet.</div>`;
        return;
    }

    const currentPhoto = equip.zerk_photos[viewIdx];
    const points = (equip.zerk_points || []).filter(p => p.view_index === viewIdx);

    container.innerHTML = `
    <div class="zerk-main-layout">
        <div id="zerk-map-container" style="position:relative;" onclick="window.handleZerkMapClick(event, ${viewIdx})">
            <img src="${currentPhoto}" style="width:100%; display:block; border-radius:8px;">
            <div id="zerk-dots-overlay" style="position:absolute; inset:0;">
                ${points.map((p, idx) => `
                    <div class="zerk-dot" style="left:${p.lx || p.x}%; top:${p.ly || p.y}%" 
                         onclick="event.stopPropagation(); window.editZerkNote('${p.id}')">
                        ${idx + 1}
                    </div>`).join('')}
            </div>
        </div>
        <div id="zerk-sidebar-container">
            <table class="zerk-sidebar-table">
                <thead><tr><th>#</th><th>Instructions</th><th></th></tr></thead>
                <tbody>
                    ${points.map((p, idx) => `
                        <tr>
                            <td><div class="zerk-num-list">${idx + 1}</div></td>
                            <td onclick="window.editZerkNote('${p.id}')">${p.note || 'Add instructions...'}</td>
                            <td><button onclick="window.deleteZerk('${p.id}')">🗑</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}
