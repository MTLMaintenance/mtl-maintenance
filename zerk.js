// zerk.js - Interactive Grease Map Logic
import { supabase, persist } from './db.js';
import { uid, showToast } from './utils.js';

// 1. Handle clicking on the image to add a new point
export async function handleZerkMapClick(event, viewIdx) {
    const state = window.state; // Grab state from window
    const equipId = window._currentDetailEquipId; // Grab ID from window
    const zerkPinMode = window.zerkPinMode;

    if (window.currentUser.role === 'viewer') return;

    // Find the machine
    const equip = state.equipment.find(e => e.id === equipId);
    if (!equip) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (zerkPinMode === 'dot') {
        const note = prompt("Grease Instructions:");
        if (note === null) return;

        equip.zerk_points = equip.zerk_points || [];
        equip.zerk_points.push({
            id: uid(), x: x.toFixed(2), y: y.toFixed(2),
            lx: null, ly: null, note: note || "", view_index: viewIdx
        });
    } else {
        // Line Logic
        if (!window.zerkDrawingStep || window.zerkDrawingStep === 1) {
            window.tempZerkCoords = { x, y };
            window.zerkDrawingStep = 2;
            showToast("Fitting set! Click for label.");
            return;
        } else {
            const note = prompt("Grease Instructions:");
            if (note === null) { window.zerkDrawingStep = 1; return; }
            equip.zerk_points.push({
                id: uid(), x: window.tempZerkCoords.x.toFixed(2), y: window.tempZerkCoords.y.toFixed(2),
                lx: x.toFixed(2), ly: y.toFixed(2), note: note || "", view_index: viewIdx
            });
            window.zerkDrawingStep = 1;
        }
    }

    await persist('equipment', 'upsert', equip);
    renderZerkTab(equipId);
}
// 2. Delete a grease point
export async function deleteZerk(id) {
    const state = window.state;
    const equipId = window._currentDetailEquipId;
    if (!confirm("Delete this grease point?")) return;

    const equip = state.equipment.find(x => x.id === equipId);
    if (!equip || !equip.zerk_points) return;

    equip.zerk_points = equip.zerk_points.filter(p => p.id !== id);

    try {
        await supabase.from('equipment').update({ zerk_points: equip.zerk_points }).eq('id', equipId);
        showToast("Point removed ✓");
        renderZerkTab(equipId);
    } catch (e) { console.error(e); }
}


// 3. Rename a Photo View
export async function renameZerkView(idx) {
    const state = window.state;
    const equipId = window._currentDetailEquipId;
    const equip = state.equipment.find(x => x.id === equipId);
    if (!equip) return;

    const currentName = (equip.zerk_names && equip.zerk_names[idx]) ? equip.zerk_names[idx] : `View ${idx + 1}`;
    const newName = prompt("Rename this view:", currentName);

    if (newName && newName.trim() !== "") {
        equip.zerk_names = equip.zerk_names || [];
        equip.zerk_names[idx] = newName.trim();
        await persist('equipment', 'upsert', equip);
        renderZerkTab(equipId);
        showToast("Renamed ✓");
    }
}
export async function addZerkViewWithTitle() {
    const equipId = window._currentDetailEquipId;
    const equip = window.state.equipment.find(x => x.id === equipId);
    if (!equip) return;

    const viewName = prompt("Name this view (e.g. Front Loader, Boom):");
    if (!viewName) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const compressed = await compressImage(event.target.result, 1200, 0.8);
            equip.zerk_photos = equip.zerk_photos || [];
            equip.zerk_names = equip.zerk_names || [];
            equip.zerk_photos.push(compressed);
            equip.zerk_names.push(viewName);
            await persist('equipment', 'upsert', equip);
            window._currentZerkViewIdx = equip.zerk_photos.length - 1;
            renderZerkTab(equipId);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// 3. Edit instructions for a specific dot
export async function editZerkNote(id) {
    const equipId = window._currentDetailEquipId;
    const equip = window.state.equipment.find(e => e.id === equipId);
    const point = equip.zerk_points.find(p => p.id === id);
    if (!point) return;

    const newNote = prompt("Edit grease instructions:", point.note || "");
    if (newNote === null) return;

    point.note = newNote;
    await persist('equipment', 'upsert', equip);
    renderZerkTab(equipId);
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
