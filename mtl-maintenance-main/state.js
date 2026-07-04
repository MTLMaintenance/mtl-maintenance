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

    // 1. THE MAPPING: There are exactly 13 names in this list
    const [eq, tk, sc, pt, sup, docs, pu, rr, tr, obs, wiki, msgs, con] = await Promise.all([
      window._mpdb.from('equipment').select('*'),           // 1
      window._mpdb.from('tasks').select('*'),               // 2
      window._mpdb.from('schedules').select('*'),           // 3
      window._mpdb.from('parts').select('*'),               // 4
      window._mpdb.from('suppliers').select('*'),           // 5
      window._mpdb.from('documents').select('*'),           // 6
      window._mpdb.from('part_usage').select('*'),          // 7
      window._mpdb.from('recurrence_rules').select('*'),    // 8
      window._mpdb.from('tool_requests').select('*'),       // 9
      window._mpdb.from('observations').select('*').order('created_at', { ascending: false }), // 10
      window._mpdb.from('shop_wiki').select('*'),           // 11
      window._mpdb.from('chat_messages').select('*').order('created_at', { ascending: true }), // 12
      window._mpdb.from('consumables').select('*')          // 13
    ]);

    // 2. SAVING TO STATE: This is where Line 48 was failing
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
    state.consumables = con.data || []; // <--- Variable 'con' now exists!

    console.log(`✅ Sync complete. ${state.equipment.length} machines and ${state.consumables.length} supplies loaded.`);

    // 3. Trigger UI Painters
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
