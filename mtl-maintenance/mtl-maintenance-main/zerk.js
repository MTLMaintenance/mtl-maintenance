// zerk.js - Interactive Grease Map Logic
import { supabase, persist } from './db.js';
import { uid, showToast,compressImage  } from './utils.js';


export async function handleZerkMapClick(event, viewIdx) {
    const equipId = window._currentDetailEquipId;
    const e = window.state.equipment.find(x => x.id === equipId);
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const note = prompt("Instructions:");
    if (note === null) return;

    // A. Update local memory immediately
    if (!e.zerk_points) e.zerk_points = [];
    e.zerk_points.push({ id: uid(), x: x.toFixed(2), y: y.toFixed(2), note, view_index: viewIdx });

    // B. REDRAW THE SCREEN NOW (Instant)
    renderZerkOS(equipId);

    // C. Save to cloud in background
    await window._mpdb.from('equipment').update({ zerk_points: e.zerk_points }).eq('id', equipId);
}

export async function deleteZerk(pointId) {
    const equipId = window._currentDetailEquipId;
    const e = window.state.equipment.find(x => x.id === equipId);
    
    if (!confirm("Delete this point?")) return;

    // A. Update memory immediately
    e.zerk_points = e.zerk_points.filter(p => p.id !== pointId);

    // B. Redraw instantly
    renderZerkOS(equipId);

    // C. Save in background
    await window._mpdb.from('equipment').update({ zerk_points: e.zerk_points }).eq('id', equipId);
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

    const viewName = prompt("View Name (e.g. Boom):");
    if (!viewName) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const compressed = await compressImage(event.target.result, 1200, 0.8);
            
            // A. Update memory
            equip.zerk_photos = equip.zerk_photos || [];
            equip.zerk_names = equip.zerk_names || [];
            equip.zerk_photos.push(compressed);
            equip.zerk_names.push(viewName);

            // B. Switch to new view and Redraw
            window._currentZerkViewIdx = equip.zerk_photos.length - 1;
            renderZerkOS(equipId);

            // C. Save
            await window._mpdb.from('equipment').update({ zerk_photos: equip.zerk_photos, zerk_names: equip.zerk_names }).eq('id', equipId);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}



// 2. Delete the current photo view and all its points
export async function deleteZerkView() {
    const equipId = window._currentDetailEquipId;
    const idx = window._currentZerkViewIdx;
    const e = window.state.equipment.find(x => x.id === equipId);

    if (!confirm("Delete this entire map view?")) return;

    // A. Update local arrays
    e.zerk_photos.splice(idx, 1);
    e.zerk_names.splice(idx, 1);
    e.zerk_points = e.zerk_points.filter(p => p.view_index !== idx);

    // B. Reset index and redraw
    window._currentZerkViewIdx = 0;
    renderZerkOS(equipId);

    // C. Save
    await window._mpdb.from('equipment').update({ 
        zerk_photos: e.zerk_photos, 
        zerk_names: e.zerk_names, 
        zerk_points: e.zerk_points 
    }).eq('id', equipId);
}
// 3. Edit instructions for a specific dot
export async function editZerkNote(pointId) {
    const equipId = window._currentDetailEquipId;
    const e = window.state.equipment.find(x => x.id === equipId);
    const point = e.zerk_points.find(p => p.id === pointId);
    
    const newNote = prompt("Edit instructions:", point.note || "");
    if (newNote === null) return;

    // A. Update memory
    point.note = newNote;

    // B. Redraw instantly
    renderZerkOS(equipId);

    // C. Save in background
    await window._mpdb.from('equipment').update({ zerk_points: e.zerk_points }).eq('id', equipId);
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

export function showZerkInfo(event, zerkId) {
    event.stopPropagation(); // Prevents adding a new dot when clicking an existing one
     window.activeZerkId = zerkId; 
    // Find the specific dot data
    const z = allMachineZerks.find(x => x.id === zerkId);
    if(!z) return;

    const box = document.getElementById('zerk-detail-box');
    if(!box) return;
    
    // Fill the text
    document.getElementById('zerk-label').textContent = z.label;
    document.getElementById('zerk-instr').textContent = z.instructions || "No special instructions.";
    
    // Setup the Delete button
    const delBtn = document.getElementById('zerk-delete-btn');
    if(delBtn) {
        // Only show delete button for Admins/Managers
        delBtn.style.display = (currentUser.role === 'admin' || currentUser.role === 'manager') ? 'block' : 'none';
        
        // This connects the button to the function we just added
        delBtn.onclick = () => deleteZerk(z.id);
    }
    
    box.style.display = 'block';
}


export function renderZerkDots() {
    const equip = state.equipment.find(x => x.id === window._currentDetailEquipId);
    const viewIdx = window._currentZerkViewIdx || 0;
    const overlay = document.getElementById('zerk-dots-overlay');
    const sidebar = document.getElementById('zerk-sidebar-container');

    // Filter points belonging ONLY to this specific photo
    const points = (equip.zerk_points || []).filter(p => p.view_index === viewIdx);

    // Draw the Numbers on the Image
    if (overlay) {
        overlay.innerHTML = points.map((p, idx) => `
            <div class="zerk-dot" style="left:${p.x}%; top:${p.y}%" onclick="event.stopPropagation(); editZerkNote(${idx})">
                ${idx + 1}
            </div>
        `).join('');
    }

    // Draw the Instruction Table on the Right
    if (sidebar) {
        sidebar.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                <h4 style="margin:0; font-size:14px;">Grease Points</h4>
                <button class="btn btn-danger btn-sm" onclick="deleteZerkView()">Delete View</button>
            </div>
            <table class="zerk-sidebar-table">
                <thead><tr><th style="width:40px">#</th><th>Instructions</th></tr></thead>
                <tbody>
                    ${points.map((p, idx) => `
                        <tr onclick="editZerkNote(${idx})">
                            <td style="color:#ffec00; font-weight:bold">#${idx + 1}</td>
                            <td>${p.note || '<span style="opacity:0.4">No instructions</span>'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="2" style="text-align:center; padding:20px; opacity:0.5">Click map to add points</td></tr>'}
                </tbody>
            </table>
        `;
    }
}

export function highlightZerk(id, shouldHighlight) {
    const line = document.getElementById(`line-${id}`);
    const dot = document.querySelector(`.zerk-dot[data-id="${id}"]`); // Add data-id to your dots
    
    if (line) {
        if (shouldHighlight) {
            line.classList.add('highlight');
            line.style.opacity = "1";
        } else {
            line.classList.remove('highlight');
            line.style.opacity = window.showZerkLines ? "0.3" : "0";
        }
    }
}
window.highlightZerk = highlightZerk;

export function setZerkMode(mode) {
    zerkPinMode = mode;
    zerkDrawingStep = 1; // Reset steps
    document.getElementById('mode-dot')?.classList.toggle('active', mode === 'dot');
    document.getElementById('mode-line')?.classList.toggle('active', mode === 'line');
    renderZerkDots(); // Clear any temp dots
}

export function renderZerkOS(equipId) {
    const e = window.state.equipment.find(x => x.id === equipId);
    const container = document.getElementById('mtl-zerk-os-area');
    if (!e || !container) return;

    const viewIdx = window._currentZerkViewIdx || 0;
    const points = (e.zerk_points || []).filter(p => p.view_index === viewIdx);

    container.innerHTML = `
        <div class="os-zerk-wrapper">
            <!-- SUB-NAV: Views and Management -->
            <div class="os-zerk-subnav">
                <div class="os-zerk-view-tabs">
                    ${e.zerk_photos.map((_, i) => {
                        const name = (e.zerk_names && e.zerk_names[i]) ? e.zerk_names[i] : `View ${i + 1}`;
                        const active = viewIdx === i ? 'background:#3b82f6; color:white;' : 'background:white; color:#666; border:1px solid #ddd;';
                        return `<button class="btn-sm" style="${active} padding:6px 15px; border-radius:8px; cursor:pointer; font-weight:600;" 
                                        onclick="window._currentZerkViewIdx=${i}; window.renderZerkOS('${equipId}')">${name}</button>`;
                    }).join('')}
                </div>
                <div class="os-zerk-view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="window.addZerkViewWithTitle()">+ Add View</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteZerkView()">🗑 Delete View</button>
                </div>
            </div>

            <!-- MAIN CONTENT: Image and Table -->
            <div class="os-zerk-grid">
                
                <!-- LEFT: IMAGE -->
                <div id="os-zerk-map" class="os-zerk-image"
                     onclick="window.handleZerkMapClick(event, ${viewIdx})">
                    <img class="os-zerk-map-image" src="${e.zerk_photos[viewIdx]}" alt="Grease fitting map" style="width:100%; height:100%; object-fit:contain; display:block; opacity:0.9;">
                    <div id="zerk-dots-overlay" style="position:absolute; inset:0;">
                        ${points.map((p, idx) => `
                            <div class="zerk-dot" style="left:${p.lx || p.x}%; top:${p.ly || p.y}%" onclick="event.stopPropagation(); window.editZerkNote('${p.id}')">
                                ${idx + 1}
                            </div>`).join('')}
                    </div>
                </div>

                <!-- RIGHT: LIST (Stretches to match image height) -->
                <div class="os-zerk-list">
                    <div class="os-zerk-list-header">REQUIRED FITTINGS</div>
                    <div class="os-zerk-list-body">
                        <table class="os-zerk-fittings-table">
                            ${points.map((p, idx) => `
                                <tr style="border-bottom:1px solid #f8f8f8;">
                                    <td style="padding:12px 5px; font-weight:bold; color:#3b82f6; width:30px;">#${idx + 1}</td>
                                    <td style="padding:12px 5px; color:#333; cursor:pointer;" onclick="window.editZerkNote('${p.id}')">${p.note || 'Grease fitting'}</td>
                                    <td style="text-align:right;"><button onclick="window.deleteZerk('${p.id}')" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:18px;">✕</button></td>
                                </tr>`).join('') || '<tr><td colspan="3" style="text-align:center; padding:40px; color:#bbb;">Click the map image to mark a grease fitting</td></tr>'}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}
