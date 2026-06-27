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

    const viewName = prompt("Name this view (e.g. Front Loader, Boom, Left Side):");
    if (!viewName) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            // Compress and save
            const compressed = await window.utils.compressImage(event.target.result, 1200, 0.8);
            
            equip.zerk_photos = equip.zerk_photos || [];
            equip.zerk_names = equip.zerk_names || [];
            
            equip.zerk_photos.push(compressed);
            equip.zerk_names.push(viewName);

            // Update Supabase
            await window._mpdb.from('equipment').update({ 
                zerk_photos: equip.zerk_photos, 
                zerk_names: equip.zerk_names 
            }).eq('id', equipId);

            window._currentZerkViewIdx = equip.zerk_photos.length - 1;
            renderZerkTab(equipId);
            window.showToast("View Added ✓");
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// 2. Delete the current photo view and all its points
export async function deleteZerkView() {
    const equipId = window._currentDetailEquipId;
    const idx = window._currentZerkViewIdx || 0;
    const equip = window.state.equipment.find(x => x.id === equipId);

    if (!equip || !equip.zerk_photos) return;

    const viewName = (equip.zerk_names && equip.zerk_names[idx]) ? equip.zerk_names[idx] : `View ${idx + 1}`;
    if (!confirm(`Delete the view "${viewName}" and ALL its grease points?`)) return;

    try {
        // Remove from photos and names arrays
        equip.zerk_photos.splice(idx, 1);
        if (equip.zerk_names) equip.zerk_names.splice(idx, 1);

        // Remove all dots that belonged to this specific view
        if (equip.zerk_points) {
            equip.zerk_points = equip.zerk_points.filter(p => p.view_index !== idx);
            // Re-index remaining points so they don't shift
            equip.zerk_points.forEach(p => {
                if (p.view_index > idx) p.view_index--;
            });
        }

        // Save back to Supabase
        await window._mpdb.from('equipment').update({ 
            zerk_photos: equip.zerk_photos, 
            zerk_names: equip.zerk_names,
            zerk_points: equip.zerk_points 
        }).eq('id', equipId);

        window._currentZerkViewIdx = 0; // Go back to first view
        renderZerkTab(equipId);
        window.showToast("View removed ✓");
    } catch (e) {
        console.error("Delete view failed:", e);
    }
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
    // These IDs must exist in your index.html or the detail card builder
    const switcher = document.getElementById('zerk-view-switcher');
    const container = document.getElementById('tab-content-zerk');

    if (!equip || !container) return;

    const viewIdx = window._currentZerkViewIdx || 0;

    // 1. BUILD THE VIEW SWITCHER (Tabs at the top of the map)
    if (switcher) {
        let viewButtons = (equip.zerk_photos || []).map((_, i) => {
            const name = (equip.zerk_names && equip.zerk_names[i]) ? equip.zerk_names[i] : `View ${i + 1}`;
            const activeClass = viewIdx === i ? 'btn-primary' : 'btn-secondary';
            return `<button class="btn ${activeClass} btn-sm" onclick="window._currentZerkViewIdx=${i}; window.renderZerkTab('${equipId}')">${name}</button>`;
        }).join('');

        // THE "+" BUTTON: Restored here!
        switcher.innerHTML = `
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                ${viewButtons}
                <button class="btn btn-outline-primary btn-sm" onclick="window.addZerkViewWithTitle()" title="Add New Map">+</button>
            </div>
        `;
    }

    // 2. CHECK FOR CONTENT
    if (!equip.zerk_photos || equip.zerk_photos.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px; color:#888; border:2px dashed #ddd; border-radius:12px; margin-top:15px">
                <p>No grease maps added for this machine.</p>
                <button class="btn btn-primary" onclick="window.addZerkViewWithTitle()">+ Add First Map View</button>
            </div>`;
        return;
    }

    // 3. DRAW THE ACTIVE MAP
    const currentPhoto = equip.zerk_photos[viewIdx];
    const points = (equip.zerk_points || []).filter(p => p.view_index === viewIdx);

    container.innerHTML = `
    <div class="zerk-main-layout">
        <div id="zerk-map-container" style="position:relative; background:#000; border-radius:8px; overflow:hidden" onclick="window.handleZerkMapClick(event, ${viewIdx})">
            <img src="${currentPhoto}" style="width:100%; display:block; opacity:0.9">
            <div id="zerk-dots-overlay" style="position:absolute; inset:0;">
                ${points.map((p, idx) => `
                    <div class="zerk-dot" style="left:${p.lx || p.x}%; top:${p.ly || p.y}%" 
                         onclick="event.stopPropagation(); window.editZerkNote('${p.id}')">
                        ${idx + 1}
                    </div>`).join('')}
            </div>
        </div>

        <div id="zerk-sidebar-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                <h4 style="margin:0; font-size:14px;">Grease Points</h4>
                <!-- THE DELETE VIEW BUTTON: Restored here! -->
                <button class="btn btn-outline-danger btn-sm" style="font-size:10px" onclick="window.deleteZerkView()">Delete View</button>
            </div>
            <table class="zerk-sidebar-table">
                <thead><tr><th>#</th><th>Instructions</th><th></th></tr></thead>
                <tbody>
                    ${points.map((p, idx) => `
                        <tr>
                            <td><div class="zerk-num-list">${idx + 1}</div></td>
                            <td onclick="window.editZerkNote('${p.id}')" style="cursor:pointer">${p.note || 'Click to add note...'}</td>
                            <td><button onclick="window.deleteZerk('${p.id}')" style="background:none; border:none; color:red; cursor:pointer">✕</button></td>
                        </tr>`).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px; color:#aaa">Click map to add points</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>`;
}
