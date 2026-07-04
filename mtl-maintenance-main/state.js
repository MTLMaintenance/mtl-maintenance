import { supabase, setSyncStatus, validateSession } from './db.js';
import { fetchAllProfiles } from './profiles.js';
import { fetchAbsences } from './calendar.js';
import { showPinLogin } from './auth.js';
import { updateMetrics } from './dashboard.js';

console.log("🛠️ init.js VERSION 2.0 LOADED");

export async function loadState() {
  const state = window.state;
  if (!state) return console.error("Global state folder not found!");

  setSyncStatus('syncing');

  try {
    console.log("📥 Syncing all data from Supabase...");

    // 1. Fetch exactly 13 tables
    const results = await Promise.all([
      window._mpdb.from('equipment').select('*'),
      window._mpdb.from('tasks').select('*'),
      window._mpdb.from('schedules').select('*'),
      window._mpdb.from('parts').select('*'),
      window._mpdb.from('suppliers').select('*'),
      window._mpdb.from('documents').select('*'),
      window._mpdb.from('part_usage').select('*'),
      window._mpdb.from('recurrence_rules').select('*'),
      window._mpdb.from('tool_requests').select('*'),
      window._mpdb.from('observations').select('*').order('created_at', { ascending: false }),
      window._mpdb.from('shop_wiki').select('*'),
      window._mpdb.from('chat_messages').select('*').order('created_at', { ascending: true }),
      window._mpdb.from('consumables').select('*')
    ]);

    // 2. Assign data manually (This avoids the 'con' definition error)
    state.equipment       = results[0].data || [];
    state.tasks           = (results[1].data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules       = results[2].data || [];
    state.parts           = results[3].data || [];
    state.suppliers       = results[4].data || [];
    state.documents       = results[5].data || [];
    state.partUsage       = results[6].data || [];
    state.recurrenceRules = results[7].data || [];
    state.tools           = results[8].data || [];
    state.observations    = results[9].data || [];
    state.wiki            = results[10].data || [];
    state.chatMessages    = results[11].data || [];
    state.consumables     = results[12].data || []; // <--- NO MORE REFERENCE ERROR

    console.log(`✅ Sync complete. Found ${state.equipment.length} machines.`);

    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (typeof window.renderTools === 'function') window.renderTools();
    if (typeof window.renderPartsTable === 'function') window.renderPartsTable();
    if (typeof window.renderConsumablesTable === 'function') window.renderConsumablesTable();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    
    setSyncStatus('online');
    return true;

  } catch(e) { 
    console.error('❌ Data load failed:', e); 
    setSyncStatus('offline');
    return false;
  }
}

export function teleportModals() {
    const modalIds = ['user-perms-modal', 'cal-action-modal', 'absence-detail-modal', 'part-modal', 'tool-modal','review-modal','consumable-modal'];
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) document.body.appendChild(el);
    });
}

export async function startApp() {
  console.log("--- Starting Application Init ---");
  try {
    await fetchAllProfiles(); 
    const sessionData = await validateSession();
    if(sessionData) {
      window.currentUser = sessionData.profiles;
      await loadState(); 
      if (typeof window.enterApp === 'function') window.enterApp(); 
    } else {
      showPinLogin();
    }
  } catch(e) { 
    console.error("Startup error:", e);
    showPinLogin(); 
  }
}
