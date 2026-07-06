// suppliers.js - Vendor & Ordering Logic
import { supabase, persist } from './db.js';
import { uid, showToast } from './utils.js';
import { closeModal } from './ui.js';

export async function saveSupplier(state) {
  const name = document.getElementById('sup-name').value.trim(); 
  if(!name){ showToast('Please enter a name'); return; }
  
  const record = {
    id: uid(), name,
    contact: document.getElementById('sup-contact').value,
    email:   document.getElementById('sup-email').value,
    phone:   document.getElementById('sup-phone').value,
    website: document.getElementById('sup-website').value,
    notes:   document.getElementById('sup-notes').value,
  };

  try {
    state.suppliers.push(record);
    await persist('suppliers', 'upsert', record);
    closeModal('supplier-modal');
    return true;
  } catch (e) { return false; }
}

export async function deleteSupplier(id, state) {
    if(!confirm('Delete this supplier?')) return;
    try {
        await supabase.from('suppliers').delete().eq('id', id);
        state.suppliers = state.suppliers.filter(s => s.id !== id);
        showToast("Supplier removed");
        return true;
    } catch(e) { return false; }
}

// The logic that finds which suppliers provide parts for a specific machine
export function pullEquipSuppliers(equipId, state) {
  const cont = document.getElementById('equip-suppliers-content');
  if(!cont) return;

  const equipTaskIds = new Set(state.tasks.filter(t => t.equipId === equipId).map(t => t.id));
  const usageForEquip = state.partUsage.filter(p => equipTaskIds.has(p.task_id));
  
  const supplierMap = {};
  usageForEquip.forEach(u => {
    const part = state.parts.find(p => p.id === u.part_id);
    if(part?.supplier_id) {
        if(!supplierMap[part.supplier_id]) supplierMap[part.supplier_id] = new Set();
        supplierMap[part.supplier_id].add(part.name);
    }
  });

  cont.innerHTML = Object.entries(supplierMap).map(([sId, parts]) => {
    const s = state.suppliers.find(sup => sup.id === sId);
    return s ? `
        <div class="sup-mini-card">
            <b>${s.name}</b> - ${Array.from(parts).join(', ')}
            <div class="text-mini">${s.phone || s.email || ''}</div>
        </div>` : '';
  }).join('') || '<div class="empty-text">No supplier history for this machine.</div>';
}
