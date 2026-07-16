// meter.js - Meter Readings & Hour Tracking
import { supabase, persist } from './db.js';
import { showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { logAuditAction } from './admin.js';

export function quickLogHours(equipId, state) {
  const e = state.equipment.find(x => x.id === equipId);
  if (!e) return;

  document.getElementById('lh-equip-id').value = equipId;
  document.getElementById('lh-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('lh-val').value = e.hours;
  document.getElementById('lh-current-display').textContent = `Current: ${e.hours.toLocaleString()} hrs`;
  
  openModal('log-hours-modal');
}

export async function saveQuickLogHours(state, currentUser) {
  const equipId = document.getElementById('lh-equip-id').value;
  const val = parseInt(document.getElementById('lh-val').value);
  const date = document.getElementById('lh-date').value;
  const e = state.equipment.find(x => x.id === equipId);
  
  if (!e || isNaN(val)) return;

  try {
    e.hours = val;
    e.hours_updated_at = new Date(date).toISOString();
    await persist('equipment', 'upsert', e);
    await supabase.from('meter_history').insert({ 
        equip_id: equipId, reading: val, created_at: new Date(date).toISOString() 
    });
    
    logAuditAction("Meter Update", `${e.name} set to ${val} hrs`, currentUser);
    closeModal('log-hours-modal');
    showToast("Hours updated ✓");

    // Refresh anything showing hours: dashboard, equipment table, and the
    // detail modal widget if this machine's popup is currently open.
    if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (window._currentDetailEquipId === equipId && typeof window.openEquipDetail === 'function') {
        window.openEquipDetail(equipId);
    }

    return true;
  } catch (err) { return false; }
}
