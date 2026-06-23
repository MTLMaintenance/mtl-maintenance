const masterState = { 
    equipment: [], 
    tasks: [], 
    schedules: [], 
    parts: [], 
    suppliers: [], 
    documents: [], 
    partUsage: [], 
    tools: [], 
    wishlist: [], 
    observations: [] 
};

// 2. THE BRIDGE: Attach it to the window so ALL files see it as "state"
window.state = masterState;

// 3. Export it for the files that use imports
export const state = masterState;

export let chatSub = null;
export let chatChannel = null;
export let currentEditingToolId = null;
export let selectedLoginUser = null;
export let enteredPin = "";
export let lastClickedDate = "";
export let currentDetailId = null;
export let selectedAbsenceType = 'all'; 
export let staffAbsences = [];
export let zerkPinMode = 'dot'; // 'dot' or 'line'
export let zerkDrawingStep = 1; 
export let currentWOTab = 'details'; 
export let woPartsTemp = [];
export let currentZerkView = 'side_1';
export let allMachineZerks = [];
export let tempZerkCoords = { x: 0, y: 0 };
export let calDate = new Date();
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export let currentCalEntryType = 'one-time';   
export let _currentDocEditId = null; 
export let _tempFileData = null; 
export let taskPinEntry = "";
export let currentTargetTaskId = null;

export const ICONS = {
    Excavator:'🦾', Tractor:'🚜', 'Wheel Loader':'⚙', 'Skid Steer':'🔧', 
    Compressor:'💨', Crane:'🏗', Compactor:'🔩', Truck:'🚛', Forklift:'🏭'
};

// Photo Storage
export let pendingPhotos = { task: [], equip: [], memorial: [], obs: [] };
export let pendingDocFile = null;

// Temporary Form Storage
export let customFieldsTemp = {};
export let assignedUsersTemp = [];
export let woPartsAdded = [];

// App Control
export let activeGroupFilter = 'all';
export let equipGroupFilter = 'all';
