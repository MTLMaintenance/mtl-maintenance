// ============================================================
// 1. GLOBAL STATE & VARIABLES (Consolidated)
// ============================================================
let state = { 
    equipment:[], tasks:[], schedules:[], parts:[], suppliers:[], 
    documents:[], partUsage:[], recurrenceRules:[], monthlyCosts:[0,0,0,0], 
    tools:[], wishlist: [], observations: [], consumables: [] 
}; 

let currentUser = null;
let currentEditingToolId = null;
let selectedLoginUser = null;
let enteredPin = "";
let lastClickedDate = "";
let currentDetailId = null;
let selectedAbsenceType = 'all'; 
let staffAbsences = [];
let zerkPinMode = 'dot'; 
let zerkDrawingStep = 1; 
let currentWOTab = 'details'; 
let woPartsTemp = [];
let currentZerkView = 'side_1';
let allMachineZerks = [];
let tempZerkCoords = { x: 0, y: 0 };
let calDate = new Date();
let offlineQueue = JSON.parse(localStorage.getItem('mp_offline_queue') || '[]');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ICONS = {Excavator:'🦾',Tractor:'🚜','Wheel Loader':'⚙','Skid Steer':'🔧',Compressor:'💨',Crane:'🏗',Compactor:'🔩',Truck:'🚛',Forklift:'🏭'};
const TODAY = new Date(); TODAY.setHours(0,0,0,0);

// ============================================================
// 2. CORE APP INIT
// ============================================================
async function startApp() {
    console.log("🚀 Starting MTL Maintenance System...");
    const SUPABASE_URL = 'https://ldxryhgovspckypqoqvf.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeHJ5aGdvdnNwY2t5cHFvcXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODk2MTksImV4cCI6MjA4OTI2NTYxOX0.rI_PLHYbp_tat5vsXDHXbc0zbokhGrBq_Tg9vFrWuSc';
    
    try {
        window._mpdb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabase = window._mpdb;
        console.log("✅ Supabase Connected");
    } catch(e) {
        console.error("❌ Connection failed", e);
    }

    // Check for session
    const sessionToken = localStorage.getItem('mp_session_token');
    if (sessionToken) {
        const sessionData = await validateSession();
        if (sessionData) {
            currentUser = sessionData.profiles;
            await enterApp();
            return;
        }
    }
    
    // If no session, show login
    showPinLogin();
}

async function enterApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-chip-name').textContent = currentUser.full_name || currentUser.username;
    
    await loadState();
    await fetchAbsences();
    await fetchTools();
    await refreshAllDropdowns();
    
    showPanel('dashboard');
}

// ============================================================
// 3. AUTHENTICATION (PIN LOGIN)
// ============================================================
async function showPinLogin() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('pin-login-container').style.display = 'block';
    document.getElementById('login-stage-names').style.display = 'block';
    document.getElementById('login-stage-pin').style.display = 'none';

    const { data: users } = await window._mpdb
        .from('profiles')
        .select('id, username, full_name')
        .eq('status', 'approved')
        .order('full_name');

    const list = document.getElementById('user-name-list');
    if (list && users) {
        list.innerHTML = users.map(u => `
            <button class="user-select-btn" onclick="selectUserForLogin(${JSON.stringify(u).replace(/"/g, '&quot;')})">
                ${u.full_name || u.username}
            </button>
        `).join('');
    }
}

function selectUserForLogin(user) {
    selectedLoginUser = user;
    enteredPin = "";
    document.getElementById('selected-user-display').textContent = "Hello, " + (user.full_name || user.username);
    document.getElementById('login-stage-names').style.display = 'none';
    document.getElementById('login-stage-pin').style.display = 'block';
}

function pressPin(num) {
    if (num === 'clear') {
        enteredPin = "";
    } else {
        if (enteredPin.length < 4) enteredPin += num;
    }
    document.getElementById('pin-display').textContent = "•".repeat(enteredPin.length);
    if (enteredPin.length === 4) verifyUserPin();
}

async function verifyUserPin() {
    const { data, error } = await window._mpdb
        .from('profiles')
        .select('*')
        .eq('id', selectedLoginUser.id)
        .eq('pin_code', enteredPin)
        .single();

    if (data) {
        currentUser = data;
        await createSession(data.username, data.id);
        enterApp();
    } else {
        alert("Incorrect PIN");
        enteredPin = "";
        document.getElementById('pin-display').textContent = "";
    }
}

// ============================================================
// 4. OFFLINE & PERSISTENCE
// ============================================================
async function persist(table, action, record) {
    if(!navigator.onLine) {
        offlineQueue.push({ table, action, record, ts: Date.now() });
        localStorage.setItem('mp_offline_queue', JSON.stringify(offlineQueue));
        document.getElementById('offline-queue-banner').style.display = 'block';
        return;
    }
    try {
        if(action==='upsert') await window._mpdb.from(table).upsert(record);
        if(action==='delete') await window._mpdb.from(table).delete().eq('id', record.id);
    } catch(e) { console.error("Persist error", e); }
}

async function syncOfflineQueue() {
    if(!offlineQueue.length) return;
    for(const item of offlineQueue) {
        try {
            if(item.action==='upsert') await window._mpdb.from(item.table).upsert(item.record);
            if(item.action==='delete') await window._mpdb.from(item.table).delete().eq('id', item.record.id);
        } catch(e) {}
    }
    offlineQueue = [];
    localStorage.removeItem('mp_offline_queue');
    document.getElementById('offline-queue-banner').style.display = 'none';
    showToast("Synced all offline changes ✓");
}

// ============================================================
// 5. GLOBAL HELPERS
// ============================================================
function showPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + id).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    // Link navigation buttons to active state
    if (id === 'dashboard') renderDashboard();
    if (id === 'calendar') renderCalendar();
    if (id === 'equipment') renderEquipmentTable();
    if (id === 'parts') renderParts();
    if (id === 'tools') renderTools();
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================================
// 6. DELETE LOGIC (The one your error was about)
// ============================================================
async function deleteGeneralItem(id, tableType) {
    const tableMap = {
        'tasks': 'tasks',
        'schedules': 'schedules',
        'absences': 'staff_absences'
    };
    const tableName = tableMap[tableType];
    if (!tableName || !confirm("Are you sure?")) return;

    try {
        const { error } = await window._mpdb.from(tableName).delete().eq('id', id);
        if (error) throw error;

        // Clear local memory
        if (state.tasks) state.tasks = state.tasks.filter(t => t.id !== id);
        if (state.schedules) state.schedules = state.schedules.filter(s => s.id !== id);
        if (staffAbsences) staffAbsences = staffAbsences.filter(a => a.id !== id);

        closeModal('cal-action-modal');
        renderCalendar();
        showToast("Deleted ✓");
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// ============================================================
// 7. REMAINING CORE UTILITIES
// ============================================================
async function loadState() {
    const [eq, tk, sc, pt, sup] = await Promise.all([
        window._mpdb.from('equipment').select('*'),
        window._mpdb.from('tasks').select('*'),
        window._mpdb.from('schedules').select('*'),
        window._mpdb.from('parts').select('*'),
        window._mpdb.from('suppliers').select('*')
    ]);
    state.equipment = eq.data || [];
    state.tasks = tk.data || [];
    state.schedules = sc.data || [];
    state.parts = pt.data || [];
    state.suppliers = sup.data || [];
}

// Initialize the app on load
document.addEventListener('DOMContentLoaded', startApp);
