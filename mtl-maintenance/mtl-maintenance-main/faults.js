// faults.js - The Mechanic's Diagnostic Library
import { uid, showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';

export function openFaultCodeDetail(code) {
    const titleEl = document.getElementById('detail-title');
    const bodyEl = document.getElementById('detail-body');

    // 1. We simulate the "Shop Wisdom" for this code
    // Later, this can come from a Supabase table called 'fault_library'
    const library = {
        '3252-0': {
            desc: "DPF Inlet Temperature Sensor - Erratic Data",
            cause: "Corroded pins in the boom harness connector.",
            fix: "DO NOT replace sensor first. Check connector J2. Clean pins with contact cleaner and apply dielectric grease.",
            parts: "Contact Cleaner, Dielectric Grease"
        }
    };

    const info = library[code] || { desc: "Unknown Code", cause: "Check Manual", fix: "Ask Lead Mechanic", parts: "N/A" };

    // 2. Build the "Troubleshooting Card"
    titleEl.textContent = `Diagnostic: ${code}`;
    bodyEl.innerHTML = `
        <div style="padding:15px; color:black !important;">
            <div style="background:#fff3cd; border-left:5px solid #ffc107; padding:15px; border-radius:8px; margin-bottom:15px;">
                <h4 style="margin:0 0 5px 0;">ISSUE</h4>
                <p style="margin:0; font-size:14px;">${info.desc}</p>
            </div>
            
            <div style="margin-bottom:15px;">
                <label style="font-size:10px; font-weight:bold; color:#888;">PROBABLE CAUSE</label>
                <p style="margin:5px 0; font-size:14px;">${info.cause}</p>
            </div>

            <div style="background:#e8f5e9; padding:15px; border-radius:8px; margin-bottom:15px;">
                <h4 style="margin:0 0 5px 0; color:#2e7d32;">✅ KNOWN SHOP FIX</h4>
                <p style="margin:0; font-size:14px; line-height:1.4;">${info.fix}</p>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-size:10px; font-weight:bold; color:#888;">PARTS TO GRAB FROM SHOP</label>
                <p style="margin:5px 0; font-weight:700;">${info.parts}</p>
            </div>

            <button class="btn btn-primary" style="width:100%; padding:15px;" onclick="window.openJobWorkflow('repair', window._currentDetailEquipId)">
                🛠 Start Repair Order
            </button>
        </div>
    `;

    openModal('detail-modal');
}

// 1. Open the entry box
export function openAddFaultModal(equipId) {
    document.getElementById('fault-equip-id').value = equipId;
    document.getElementById('fault-code-input').value = "";
    window.openModal('fault-entry-modal');
    // Auto-focus the input for speed
    setTimeout(() => document.getElementById('fault-code-input').focus(), 100);
}

// 2. Save the code to Supabase
export async function saveActiveFault() {
    const equipId = document.getElementById('fault-equip-id').value;
    const code = document.getElementById('fault-code-input').value.trim();

    if (!code) return;

    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return;

    // Update locally and in DB
    e.active_faults = code;
    e.status = 'Down'; // Automatically mark machine as Down if it has a fault

    try {
        await window._mpdb.from('equipment').update({ 
            active_faults: code,
            status: 'Down'
        }).eq('id', equipId);

        window.closeModal('fault-entry-modal');
        window.showToast("Fault Reported: " + code);
        
        // Refresh the OS card to show the red box
        window.renderPerfectCard(equipId);
        window.renderEquipmentTable(); // Update main list too
    } catch (err) {
        console.error(err);
    }
}
export function openFaultList(equipId) {
    window._currentDetailEquipId = equipId;
    const activeFaults = window.state.faults.filter(f => f.equip_id === equipId && f.status === 'active');
    
    const container = document.getElementById('fault-list-container');
    document.getElementById('fault-list-count').textContent = activeFaults.length;

    container.innerHTML = activeFaults.map(f => `
        <div class="fault-list-item" onclick="window.openFaultEditor('${f.id}')">
            <div style="flex:1">
                <b style="font-size:16px; color:red;">${f.code}</b>
                <div style="font-size:12px; color:#666;">${f.description || 'No description'}</div>
            </div>
            <span style="color:#aaa;">Edit 〉</span>
        </div>
    `).join('') || '<p style="text-align:center; padding:20px; color:#888;">No active faults found.</p>';

    openModal('fault-list-modal');
}

// 2. Open the Editor for a specific fault (or a new one)
export function openFaultEditor(faultId = null) {
    // Clear the form
    document.getElementById('f-edit-id').value = faultId || "";
    document.getElementById('f-code').value = "";
    document.getElementById('f-desc').value = "";
    document.getElementById('f-cause').value = "";
    document.getElementById('f-fix').value = "";
    document.getElementById('f-parts').value = "";

    if (faultId) {
        const f = window.state.faults.find(x => x.id === faultId);
        if (f) {
            document.getElementById('f-code').value = f.code;
            document.getElementById('f-desc').value = f.description;
            document.getElementById('f-cause').value = f.cause;
            document.getElementById('f-fix').value = f.shop_fix;
            document.getElementById('f-parts').value = f.parts_needed;
        }
    }
    openModal('fault-edit-modal');
}

// 3. Save the full fault details to Supabase
export async function saveFaultRecord() {
    const id = document.getElementById('f-edit-id').value || uid();
    const equipId = window._currentDetailEquipId;

    const record = {
        id: id,
        equip_id: equipId,
        code: document.getElementById('f-code').value.trim(),
        description: document.getElementById('f-desc').value.trim(),
        cause: document.getElementById('f-cause').value.trim(),
        shop_fix: document.getElementById('f-fix').value.trim(),
        parts_needed: document.getElementById('f-parts').value.trim(),
        status: 'active'
    };

    try {
        await window._mpdb.from('fault_logs').upsert(record);
        
        // Update local memory
        const idx = window.state.faults.findIndex(f => f.id === id);
        if (idx !== -1) window.state.faults[idx] = record;
        else window.state.faults.push(record);

        closeModal('fault-edit-modal');
        openFaultList(equipId); // Go back to the list
        window.renderPerfectCard(equipId); // Update the counter on the main card
        showToast("Fault Log Updated ✓");
    } catch (e) { console.error(e); }
}

export function getActiveFaultsCount(equipId) {
    const state = window.state;
    if (!state || !state.faults) return 0;

    // Look in the 'faults' drawer and filter for this machine + 'active' status
    const machineFaults = state.faults.filter(f => 
        f.equip_id === equipId && f.status === 'active'
    );

    return machineFaults.length;
}
