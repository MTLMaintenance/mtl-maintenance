import { supabase, setSyncStatus, validateSession } from './db.js';
import { fetchAllProfiles } from './profiles.js';
import { fetchAbsences } from './calendar.js';
import { showPinLogin } from './auth.js';
import { updateMetrics } from './dashboard.js';

console.log("🛠️ init.js VERSION 2.0 LOADED");

if (!window.state) {
    window.state = {
        equipment: [],
        tasks: [],
        schedules: [],
        parts: [],
        suppliers: [],
        documents: [],
        partUsage: [],
        tools: [],
        wishlist: [],
        observations: [],
        checklistTemplates: [],
        profiles: [],
        wiki: [],
        consumables: [],
        chatMessages: [],
        users_list_cache: []
    };
}

export const state = window.state;

// --- VITAL EXPORTS FOR CALENDAR ---
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const ICONS = {
    Excavator:'🦾', Tractor:'🚜', 'Wheel Loader':'⚙', 'Skid Steer':'🔧', 
    Compressor:'💨', Crane:'🏗', Compactor:'🔩', Truck:'🚛', Forklift:'🏭'
};

// Application State
export let chatSub = null;
export let chatChannel = 'general';
export let currentEditingToolId = null;
export let selectedLoginUser = null;
export let enteredPin = "";
export let lastClickedDate = "";
export let currentDetailId = null;
export let selectedAbsenceType = 'all'; 
export let staffAbsences = [];
export let zerkPinMode = 'dot'; 
export let zerkDrawingStep = 1; 
export let currentWOTab = 'details'; 
export let woPartsTemp = [];
export let currentZerkView = 'side_1';
export let allMachineZerks = [];
export let tempZerkCoords = { x: 0, y: 0 };
export let calDate = new Date();
export let currentCalEntryType = 'one-time';   
export let _currentDocEditId = null; 
export let _tempFileData = null; 
export let taskPinEntry = "";
export let currentTargetTaskId = null;

// Photo & Temp Storage
export let pendingPhotos = { task: [], equip: [], memorial: [], obs: [] };
window.pendingPhotos = pendingPhotos;

export let pendingDocFile = null;

export let customFieldsTemp = {};
window.customFieldsTemp = customFieldsTemp;

export let assignedUsersTemp = [];

export let woPartsAdded = [];
window.woPartsAdded = woPartsAdded;

// App Filters
export let activeGroupFilter = 'all';
export let equipGroupFilter = 'all';

console.log("✅ state.js fully initialized with MONTHS and ICONS.");


export async function loadState() {
  const state = window.state;
  if (!state) return console.error("Global state folder not found!");

  setSyncStatus('syncing');

  try {
    console.log("📥 Syncing all data from Supabase...");

    // 1. Fetch exactly 13 tables into one big results box
    const results = await Promise.all([
      window._mpdb.from('equipment').select('*'),           // [0]
      window._mpdb.from('tasks').select('*'),               // [1]
      window._mpdb.from('schedules').select('*'),           // [2]
      window._mpdb.from('parts').select('*'),               // [3]
      window._mpdb.from('suppliers').select('*'),           // [4]
      window._mpdb.from('documents').select('*'),           // [5]
      window._mpdb.from('part_usage').select('*'),          // [6]
      window._mpdb.from('recurrence_rules').select('*'),    // [7]
      window._mpdb.from('tool_requests').select('*'),       // [8]
      window._mpdb.from('observations').select('*').order('created_at', { ascending: false }), // [9]
      window._mpdb.from('shop_wiki').select('*'),           // [10]
      window._mpdb.from('chat_messages').select('*').order('created_at', { ascending: true }), // [11]
      window._mpdb.from('consumables').select('*')          // [12]
    ]);

    // 2. Assign the data by their position in the list (0 to 12)
    // This method is better because we don't need 'con' or 'msgs' variables anymore
    state.equipment       = results[0].data  || [];
    state.tasks           = (results[1].data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules       = results[2].data  || [];
    state.parts           = results[3].data  || [];
    state.suppliers       = results[4].data  || [];
    state.documents       = results[5].data  || [];
    state.partUsage       = results[6].data  || [];
    state.recurrenceRules = results[7].data  || [];
    state.tools           = results[8].data  || [];
    state.observations    = results[9].data  || [];
    state.wiki            = results[10].data || [];
    state.chatMessages    = results[11].data || [];
    state.consumables     = results[12].data || []; // <--- The 13th table

    console.log(`✅ Sync complete. Found ${state.equipment.length} machines and ${state.consumables.length} supplies.`);

    // 3. Trigger UI Redraws
    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (typeof window.renderTools === 'function') window.renderTools();
    if (typeof window.renderPartsTable === 'function') window.renderPartsTable();
    if (typeof window.renderConsumablesTable === 'function') window.renderConsumablesTable();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof updateMetrics === 'function') updateMetrics();
    
    setSyncStatus('online');
    return true;

  } catch(e) { 
    console.error('❌ Data load failed:', e); 
    setSyncStatus('offline');
    return false;
  }
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

export function teleportModals() {
    const modalIds = ['user-perms-modal', 'cal-action-modal', 'absence-detail-modal', 'part-modal', 'tool-modal','review-modal','consumable-modal'];
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) document.body.appendChild(el);
    });
}
