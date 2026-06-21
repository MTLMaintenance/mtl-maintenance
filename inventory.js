// inventory.js - Parts, Supplies, and Consumables
import { supabase, persist } from './db.js';
import { uid, showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';

// 1. Open the "Add Part" modal (The function causing your error!)
export function openAddPart() {
    resetPartForm(); 
    // We update the title so the user knows they are ADDING, not EDITING
    const title = document.getElementById('part-modal-title');
    if (title) title.textContent = "Add New Part";
    
    openModal('part-modal');
}

// 2. Clear the part form fields
export function resetPartForm() {
    const idField = document.getElementById('part-edit-id');
    if (idField) idField.value = ""; 

    const ids = ['edit-p-name', 'p-num', 'p-cost', 'p-qty', 'p-reorder'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'p-cost' || id === 'p-qty') ? 0 : '';
    });

    // Hide delete button for new parts
    const delBtn = document.getElementById('btn-delete-part');
    if (delBtn) delBtn.style.display = 'none';
}

// 3. Open modal to EDIT an existing part
export function editPart(id, state) {
    const part = state.parts.find(p => p.id === id);
    if (!part) return;

    const idInput = document.getElementById('part-edit-id');
    if (idInput) idInput.value = id;

    document.getElementById('part-modal-title').textContent = "Edit Part: " + part.name;
    document.getElementById('edit-p-name').value = part.name || "";
    document.getElementById('p-num').value = part.num || "";
    document.getElementById('p-cost').value = part.cost || 0;
    document.getElementById('p-qty').value = part.qty || 0;
    document.getElementById('p-reorder').value = part.reorder || 0;
    document.getElementById('p-supplier-select').value = part.supplier_id || "";

    const delBtn = document.getElementById('btn-delete-part');
    if (delBtn) delBtn.style.display = 'block';

    openModal('part-modal');
}

// 4. Save/Update Part in Supabase
export async function savePart(record, state) {
    try {
        const { error } = await supabase.from('parts').upsert(record);
        if (error) throw error;

        // Update local memory list
        const idx = state.parts.findIndex(p => p.id === record.id);
        if (idx !== -1) state.parts[idx] = record;
        else state.parts.push(record);

        showToast("Part saved ✓");
        closeModal('part-modal');
        return true;
    } catch (e) {
        alert("Error saving: " + e.message);
        return false;
    }
}

// 5. Delete a Part
export async function deletePart(id, state) {
    const part = state.parts.find(p => p.id === id);
    if (!confirm(`Permanently delete "${part ? part.name : 'this part'}"?`)) return;

    try {
        await supabase.from('parts').delete().eq('id', id);
        state.parts = state.parts.filter(p => p.id !== id);
        showToast("Part deleted");
        closeModal('part-modal');
        return true;
    } catch (e) {
        alert("Delete failed: " + e.message);
        return false;
    }
}
export async function addPartToTask(taskId, partId, qtyUsed, currentUser, state) {
    const part = state.parts.find(p => p.id === partId);
    if (!part || part.qty < qtyUsed) return { success: false, msg: "Insufficient stock" };

    const usage = {
        id: uid(),
        task_id: taskId,
        part_id: partId,
        part_name: part.name,
        qty_used: qtyUsed,
        unit_cost: parseFloat(part.cost || 0),
        line_total: parseFloat(part.cost || 0) * qtyUsed,
        used_by: currentUser.name,
        used_at: new Date().toISOString()
    };

    try {
        await supabase.from('part_usage').insert(usage);
        
        // Update Stock
        part.qty -= qtyUsed; 
        await supabase.from('parts').update({ qty: part.qty }).eq('id', partId);

        state.partUsage.push(usage);
        return { success: true, usage };
    } catch (e) { return { success: false, msg: e.message }; }
}
