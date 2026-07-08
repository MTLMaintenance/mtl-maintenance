// This ensures window.state exists the microsecond this file is read.
if (!window.state) {
    window.state = {
        equipment: [], tasks: [], schedules: [], parts: [], suppliers: [], 
        documents: [], partUsage: [], tools: [], wishlist: [], observations: [],
        checklistTemplates: [], wiki: [], chatMessages: [], users_list_cache: [], consumables: [],faults: []
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
// We attach these to the window too, just to be 100% safe for your bridges
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
