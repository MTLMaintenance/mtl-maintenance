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
        chatMessages: [],       // Drawer for chat history
        users_list_cache: []    // Drawer for team member list
    };
}

// 2. EXPORT THE MASTER STATE
export const state = window.state;

// 3. EXPORT ALL UI VARIABLES
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

// 4. EXPORT CONSTANTS
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const ICONS = {
    Excavator:'🦾', Tractor:'🚜', 'Wheel Loader':'⚙', 'Skid Steer':'🔧', 
    Compressor:'💨', Crane:'🏗', Compactor:'🔩', Truck:'🚛', Forklift:'🏭'
};

// 5. PHOTO & TEMP STORAGE
// We attach these to the window so all modules can access them instantly
export let pendingPhotos = { task: [], equip: [], memorial: [], obs: [] };
window.pendingPhotos = pendingPhotos;

export let pendingDocFile = null;

export let customFieldsTemp = {};
window.customFieldsTemp = customFieldsTemp;

export let assignedUsersTemp = [];

export let woPartsAdded = [];
window.woPartsAdded = woPartsAdded;

// 6. APP FILTERS
export let activeGroupFilter = 'all';
export let equipGroupFilter = 'all';

console.log("✅ state.js initialized successfully.");


export async function loadState() {
  const state = window.state;
  if (!state) return console.error("Global state folder not found!");

  setSyncStatus('syncing');

  try {
    console.log("📥 Syncing all data from Supabase...");

    // 1. THE VITAL FIX: Added 'con' to this list below
    const [eq, tk, sc, pt, sup, docs, pu, rr, tr, obs, wiki, msgs, con] = await Promise.all([
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
      window._mpdb.from('consumables').select('*') // This must be the 13th item
    ]);

    // 2. Now 'con' is defined, so these lines will work:
    state.equipment = eq.data || [];
    state.tasks = (tk.data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules = sc.data || [];
    state.parts = pt.data || [];
    state.suppliers = sup.data || [];
    state.documents = docs.data || [];
    state.partUsage = pu.data || [];
    state.recurrenceRules = rr.data || [];
    state.tools = tr.data || [];
    state.observations = obs.data || [];
    state.wiki = wiki.data || [];
    state.chatMessages = msgs.data || [];
    state.consumables = con.data || []; // <--- SUCCESS

    console.log(`✅ Sync complete. Found ${state.equipment.length} machines.`);

    // 3. Trigger Redraws
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
