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

    // Clear the form so the next "+ Add Supplier" starts fresh
    ['sup-name', 'sup-contact', 'sup-email', 'sup-phone', 'sup-website', 'sup-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (typeof window.renderSuppliersTable === 'function') window.renderSuppliersTable();
    showToast("Supplier added ✓");
    return true;
  } catch (e) { return false; }
}

export async function deleteSupplier(id, state) {
    if(!confirm('Delete this supplier?')) return;
    try {
        await supabase.from('suppliers').delete().eq('id', id);
        state.suppliers = state.suppliers.filter(s => s.id !== id);
        if (typeof window.renderSuppliersTable === 'function') window.renderSuppliersTable();
        showToast("Supplier removed");
        return true;
    } catch(e) { return false; }
}

// Renders the Suppliers table (#supplier-table-body). This didn't exist
// before, so the table was always empty regardless of how many suppliers
// were saved.
export function renderSuppliersTable() {
    const container = document.getElementById('supplier-table-body');
    if (!container) return;

    const state = window.state;
    if (!state || !state.suppliers || state.suppliers.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">No suppliers added yet.</td></tr>';
        return;
    }

    container.innerHTML = state.suppliers.map(s => {
        const partsCount = (state.parts || []).filter(p => p.supplier_id === s.id).length;
        return `
        <tr>
            <td data-label="Supplier Name"><b>${s.name}</b></td>
            <td data-label="Contact">${s.contact || '—'}</td>
            <td data-label="Email">${s.email ? `<a href="mailto:${s.email}">${s.email}</a>` : '—'}</td>
            <td data-label="Phone">${s.phone || '—'}</td>
            <td data-label="Website">${s.website ? `<a href="${s.website}" target="_blank" rel="noopener">${s.website}</a>` : '—'}</td>
            <td data-label="Parts">${partsCount}</td>
            <td data-label="" style="text-align:right;"><button class="btn btn-danger btn-sm" onclick="window.deleteSupplier('${s.id}')">✕</button></td>
        </tr>`;
    }).join('');
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
