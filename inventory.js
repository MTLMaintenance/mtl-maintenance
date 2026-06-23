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

export async function removePartUsage(usageId, taskId, state) {
    if (!confirm("Remove this part and return it to stock?")) return;

    const usage = state.partUsage.find(u => u.id === usageId);
    if (!usage) return;

    try {
        // 1. Return the quantity to inventory stock
        const part = state.parts.find(p => p.id === usage.part_id);
        if (part) {
            part.qty = (part.qty || 0) + usage.qty_used;
            await supabase.from('parts').update({ qty: part.qty }).eq('id', part.id);
        }

        // 2. Delete the usage record from Supabase
        await supabase.from('part_usage').delete().eq('id', usageId);
        state.partUsage = state.partUsage.filter(u => u.id !== usageId);

        // 3. Update the Work Order cost (subtracting this part)
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.cost = Math.max(0, (task.cost || 0) - (usage.line_total || 0));
            await supabase.from('tasks').update({ cost: task.cost }).eq('id', taskId);
        }

        showToast("Part returned to stock ✓");
        return true; // Signal the UI to refresh
    } catch (e) {
        console.error("Error removing part:", e);
        return false;
    }
}
// Updates the "Low Parts" number on the home screen
export function updateDashboardParts(state) {
    const bigNumber = document.getElementById('dash-low-parts');
    const listContainer = document.getElementById('dash-low-parts-list');
    
    if (!bigNumber || !listContainer) return;

    // Filter for parts below reorder point
    const lowParts = (state.parts || []).filter(p => {
        const qty = parseInt(p.qty) || 0;
        const reorder = parseInt(p.reorder) || 0;
        return qty <= reorder;
    });

    bigNumber.textContent = lowParts.length;
    bigNumber.style.color = lowParts.length > 0 ? '#dc3545' : 'inherit';

    if (lowParts.length === 0) {
        listContainer.innerHTML = '<div style="color: #aaa; font-style: italic;">All stock OK</div>';
        return;
    }

    listContainer.innerHTML = lowParts.map(p => `
        <div class="low-stock-row">
            • ${p.name}: <b style="color:#fd7e14">${p.qty} left</b>
        </div>`).join('');
}

export function addPartToWO(){
  const partId=document.getElementById('wo-part-select').value;
  const qty=parseInt(document.getElementById('wo-part-qty').value)||1;
  const part=state.parts.find(p=>p.id===partId); if(!part) return;
  if(qty>part.qty){ showToast('Not enough stock! ('+part.qty+' available)'); return; }
  const unitCost = parseFloat(part.cost)||0;
  const existing=woPartsAdded.find(p=>p.part_id===partId);
  if(existing){ existing.qty_used+=qty; } else { woPartsAdded.push({id:uid(),part_id:partId,part_name:part.name,qty_used:qty,unit_cost:unitCost}); }
  updateWOCostFromParts();
  renderWOPartsList();
}
// 1. Fetch supplies from Supabase
export async function fetchConsumables(state) {
    try {
        const { data, error } = await supabase.from('consumables').select('*').order('name');
        if (error) throw error;
        state.consumables = data || [];
        return state.consumables;
    } catch (e) {
        console.error("Consumable fetch error:", e);
        return [];
    }
}

// 2. Open modal to EDIT a supply item
export function editConsumable(id, state) {
    const item = state.consumables.find(c => c.id === id);
    if (!item) return;

    document.getElementById('c-modal-title').textContent = "Edit Item: " + (item.name || "Unnamed");
    document.getElementById('c-edit-id').value = item.id;
    document.getElementById('c-name').value = item.name || "";
    document.getElementById('c-num').value = item.num || "";
    document.getElementById('c-cost').value = item.cost || 0;
    document.getElementById('c-qty').value = item.qty || 0;
    document.getElementById('c-reorder').value = item.reorder || 0;
    document.getElementById('c-supplier-select').value = item.supplier_id || "";

    const delBtn = document.getElementById('btn-delete-consumable');
    if (delBtn) delBtn.style.display = 'block';
    
    openModal('consumable-modal');
}

// 3. Save Supply Item
export async function saveConsumable(state) {
    const editId = document.getElementById('c-edit-id').value;
    const record = {
        id: (editId && editId !== "") ? editId : uid(),
        name: document.getElementById('c-name').value.trim(),
        num: document.getElementById('c-num').value,
        supplier_id: document.getElementById('c-supplier-select').value || null,
        qty: parseInt(document.getElementById('c-qty').value) || 0,
        reorder: parseInt(document.getElementById('c-reorder').value) || 0,
        cost: parseFloat(document.getElementById('c-cost').value) || 0,
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('consumables').upsert([record]);
        if (error) throw error;
        
        await fetchConsumables(state); 
        closeModal('consumable-modal');
        showToast("Supply item saved ✓");
        return true;
    } catch(e) {
        alert("Save failed: " + e.message);
        return false;
    }
}

export function openSupplierDetail(id, state) {
  const s = state.suppliers.find(x => x.id === id); 
  if(!s) return;
  
  const parts = state.parts.filter(p => p.supplier_id === id);
  document.getElementById('detail-title').textContent = s.name;
  
  document.getElementById('detail-body').innerHTML = `
    <div class="sup-grid">
      <div><span class="label">Contact:</span> ${s.contact||'—'}</div>
      <div><span class="label">Phone:</span> ${s.phone||'—'}</div>
      <div><span class="label">Email:</span> ${s.email||'—'}</div>
    </div>
    <div class="sup-parts-list">
        ${parts.map(p => `<div class="parts-row"><b>${p.name}</b> (Stock: ${p.qty})</div>`).join('')}
    </div>`;

  window.openModal('detail-modal');
}

export async function deleteInvoice(invoiceId, equipId) {
  if(!confirm('Delete this invoice?')) return;
  try {
    await window._mpdb.from('invoices').delete().eq('id', invoiceId);
    window.showToast('Invoice deleted');
    if (typeof window.renderInvoicesList === 'function') window.renderInvoicesList(equipId);
  } catch(e) { window.showToast('Failed to delete'); }
}
