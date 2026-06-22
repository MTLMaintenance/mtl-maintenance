import { 
    chatSub, chatChannel, currentEditingToolId, selectedLoginUser, 
    enteredPin, lastClickedDate, currentDetailId, selectedAbsenceType, 
    staffAbsences, zerkPinMode, zerkDrawingStep, currentWOTab, 
    woPartsTemp, currentZerkView, allMachineZerks, tempZerkCoords, 
    calDate, MONTHS, currentCalEntryType, _currentDocEditId, 
    _tempFileData, taskPinEntry, currentTargetTaskId,state 
} from './state.js';


// --- INITIALIZATION BRIDGES ---
import { loadState, teleportModals } from './init.js';
window.loadState = () => loadState(state);

// --- SEARCH BRIDGES ---
import { handleGlobalSearch } from './search.js';
import { showPinLogin, selectUserForLogin, pressPin, verifyUserPin, updatePinDots, backToNames } from './auth.js';
import { updateLastSeen, renderDmList, renderOnlineUsers, updateAvatarPreview } from './profiles.js';
import { runRecurrenceEngine, createBulkWO } from './automation.js';
import { buildEquipDetailHTML, buildTaskDetailHTML, renderObservationsList } from './details.js';
import { quickLogHours, saveQuickLogHours } from './meter.js';
import { scanInvoiceWithAI, submitBugReport } from './services.js';
import { uid, fmtDate, isOverdue, badge, showToast, compressImage } from './utils.js';
import { supabase, persist, setSyncStatus, createSession, validateSession, destroySession,syncOfflineQueue } from './db.js';
import { initChat, sendChatMessage, buildChatMsgHtml } from './chat.js';
import { openModal, closeModal, showPanel, switchTab, refreshAllDropdowns, showMobileZerkCard, closeMobileZerkCard,switchDetailTab  } from './ui.js';
import { healthColor, calcHealth, getLastService, updateEquipStatus, uploadZerkView, openEquipDetail, addObservation, deleteObservation, editQuickSpec, toggleLockout  } from './equipment.js';
import { approveUser, denyUser, deleteUser, logAuditAction,  autoCleanupAuditLogs, blockChatUser, unblockChatUser } from './admin.js';
import { deleteDoc, openDocDetail, saveDoc } from './docs.js';
import {  fetchTools, saveTool, deleteTool, addToolNote, deleteToolObservation, handleWishAction, editToolObservation, processReview  } from './tools.js';
import { openAddPart, resetPartForm, editPart, savePart, deletePart, addPartToTask, removePartUsage  } from './inventory.js';
import { renderTasksTable, saveTask, toggleChecklistItem, finalizeTask } from './tasks.js';
import { updateMetrics, renderEquipListDash, renderSchedDash, getAdaptivePrediction, renderRecentTasks } from './dashboard.js';
import { fetchAbsences, renderCalendar, saveAbsence, isUserOutOnDate, setAbsenceType, deleteAbsence, openAbsenceModal,closeAbsenceModal } from './calendar.js'
import { exportCSV, exportPDF, exportHealthCSV } from './reports.js';
import { applyUserPreferences, saveUserProfile, toggleDarkMode } from './settings.js';
import { saveTpl, deleteTpl } from './checklists.js';
import { handleZerkMapClick, deleteZerk, renameZerkView } from './zerk.js';
import { renderEquipmentTable, renderPartsTable, renderQuickSpecs } from './views.js';
import { saveSupplier, deleteSupplier, pullEquipSuppliers } from './suppliers.js';
import { startQRScanner, stopQRScanner } from './scanner.js';
import { formatDuration, getEquipDowntime, logStatusChange } from './downtime.js';
import { renderCostChart, renderHealthScores, renderPlannedVsUnplanned } from './analytics.js';

window.showLogin = () => {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('register-view').style.display = 'none';
    if (typeof backToNames === 'function') backToNames();
};

window.showRegister = () => {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('register-view').style.display = 'grid';
    document.getElementById('auth-sub').textContent = 'Request access to MTL Maintenance';
};

window.pressPin = pressPin;
window.verifyUserPin = verifyUserPin;
window.selectUserForLogin = selectUserForLogin;
window.backToNames = backToNames;
window.showPinLogin = showPinLogin;

window.backToNames = backToNames;
window.updatePinDots = updatePinDots;
window.showPinLogin = showPinLogin;
window.pressPin = pressPin;
window.verifyUserPin = verifyUserPin;
window.selectUserForLogin = selectUserForLogin;
window.handleGlobalSearch = () => handleGlobalSearch(state);
window.formatDuration = formatDuration;
window.deleteZerk = deleteZerk;
window.handleZerkMapClick = handleZerkMapClick;
window.renameZerkView = renameZerkView;
window.zerkPinMode = 'dot';   // Start in simple dot mode
window.zerkDrawingStep = 1;   // Start at the first click
window.tempZerkCoords = null; // Store the first click for lines
window.deleteChecklistItem = deleteChecklistItem; 
window.deleteTaskComment = deleteTaskComment;
window._currentTaskTab = 'dt-info';
window.openEquipDetail = (id) => openEquipDetail(id, state);
window.savePart = savePart;
window.openModal = openModal;
window.closeModal = closeModal;
window.showPanel = showPanel;
window.deleteDoc = deleteDoc;
window.quickLogHours = (id) => quickLogHours(id, state);
window.saveQuickLogHours = () => saveQuickLogHours(state, currentUser);
window.addObservation = (id) => addObservation(id, state, currentUser);
window.runRecurrenceEngine = () => runRecurrenceEngine(state);
window.exportHealthCSV = () => exportHealthCSV(state, calcHealth);
window.createBulkWO = createBulkWO;

window.removePartUsage = (usageId, taskId) => {
    removePartUsage(usageId, taskId, state).then(success => {
        if (success) window.openTaskDetail(taskId); // Refresh the popup
    });
};

window.openTaskDetail = (id) => openTaskDetail(id, state);
window.deleteTask = (id) => deleteTask(id, state);
window.editPart = (id) => editPart(id, state);

window.globalEditObs = function(id) {
  
    console.log("Opening Edit for ID:", id);
    
    const obs = state.observations.find(o => o.id === id);
    if (!obs) return alert("Error: Observation data not found.");

    // 1. Define the elements FIRST (This fixes the 'idField' error)
    const idField = document.getElementById('edit-obs-id');
    const sevField = document.getElementById('edit-obs-sev');
    const bodyField = document.getElementById('edit-obs-body');
    const modalBackdrop = document.getElementById('obs-edit-modal-backdrop');

    // 2. Check if they exist before setting values
    if (idField && sevField && bodyField && modalBackdrop) {
        idField.value = id;
        sevField.value = obs.severity;
        bodyField.value = obs.body;
        
        // 3. Show the modal
        modalBackdrop.style.display = 'flex';
    } else {
        console.error("HTML Error: One or more IDs are missing from the page.");
        alert("System error: Edit modal is not properly linked.");
    }
};









function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    // Shows one asterisk for every digit typed
    display.textContent = "•".repeat(enteredPin.length);
}


function checkDateSelection(val) {
    if(val) document.getElementById('abs-options').style.display = 'block';
}



async function checkUpcomingAbsences() {
    const today = new Date().toISOString().split('T')[0];
    const lastCheck = localStorage.getItem('last_absence_check');
    if (lastCheck === today) return; // Don't spam, only check once a day

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const upcoming = staffAbsences.filter(a => a.start_date.split('T')[0] === tomorrowStr);

    for (let abs of upcoming) {
        const detail = abs.is_private ? abs.reason_private : abs.reason_public;
        
        // Insert a message into the Admin channel
        await window._mpdb.from('chat_messages').insert([{
            channel: 'admin',
            author: 'SYSTEM',
            author_name: 'Reminder Bot 🤖',
            body: `⚠️ REMINDER: ${abs.user_name} is scheduled to be out tomorrow. Reason: ${detail}`,
            created_at: new Date().toISOString()
        }]);
    }
    localStorage.setItem('last_absence_check', today);
}

function openAbsenceDetail(id) {
    console.log("Opening details for absence:", id);
    const abs = (window.staffAbsences || []).find(a => a.id === id);
    if (!abs) return;
    
    window.currentDetailId = id; // Store for deletion

    // 1. Fill the Information
    document.getElementById('det-user').textContent = `👤 ${abs.user_name}`;
    document.getElementById('det-reason').textContent = abs.reason_public || "No reason provided.";
    
    const timeDisplay = abs.is_all_day ? "All Day" : (abs.partial_time || "Scheduled");
    document.getElementById('det-time').textContent = timeDisplay;

    // 2. PERMISSION CHECK
    // Only the creator OR an Admin can delete/edit
    const isOwner = (abs.author === currentUser.username || abs.user_id === String(currentUser.id));
    const isAdmin = (currentUser.role === 'Admin');

    const delBtn = document.getElementById('det-delete-btn');
    if (delBtn) {
        if (isOwner || isAdmin) {
            delBtn.style.display = 'block';
        } else {
            delBtn.style.display = 'none'; // Hide if not their request
        }
    }

    // 3. Show Private Info (Admins Only)
    const privBox = document.getElementById('det-private-section');
    if (privBox) {
        if (isAdmin) {
            privBox.style.display = 'block';
            document.getElementById('det-private-text').textContent = abs.reason_private || "None";
        } else {
            privBox.style.display = 'none';
        }
    }

    // 4. Force Show the Modal
    const modal = document.getElementById('absence-detail-modal');
    if (modal) {
        modal.style.display = 'flex'; // Use flex for centering
        modal.classList.add('active'); 
    }
}

function togglePrivateReason(show) {
    const privBox = document.getElementById('priv-box');
    if (privBox) {
        if (show) {
            privBox.style.display = 'block';
            // Optional: Scroll to bottom of modal so they see the new box
        } else {
            privBox.style.display = 'none';
        }
    }
}

const ADMIN_USERNAME = 'tangal99';
let currentUser = null;


// ============================================================
// INIT
// ============================================================
async function startApp() {
  console.log("--- Starting Application Init ---");
  try { localStorage.removeItem('mp_users'); } catch(e) {}
  
  try {
    window._mpdb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { 'x-app-token': 'mtl-maint-2026-secure-token-x7k9p' } }
    });
    window.supabase = window._mpdb;
    setSyncStatus('online');
    if (typeof teleportModals === 'function') teleportModals(); 
  } catch(e) { console.warn('Supabase init failed:', e); }

  try {
    // --- ADDED: Load all users/profiles so Chat Dots work ---
    if (typeof fetchAllProfiles === 'function') {
        await fetchAllProfiles(); 
    }

    const sessionData = await validateSession();
    
    if(sessionData) {
      const { data: profile } = await window._mpdb.from('profiles').select('*').eq('username', sessionData.username).single();

      if(profile && profile.status === 'approved') {
        currentUser = { ...profile, name: profile.full_name || sessionData.username };
       window._geminiKey = profile.gemini_key || localStorage.getItem('mp_gemini_key') || '';
       localStorage.setItem('mp_session', JSON.stringify(currentUser));
        if (typeof applyUserPreferences === 'function') applyUserPreferences();
        await fetchAbsences(); 
       await enterApp(); 
        return; 
      }
    }

    console.log("No session found. Running showPinLogin...");
    showPinLogin();

  } catch(e) { 
    console.error("Startup error:", e);
    showPinLogin(); 
 

  }

  window.addEventListener('online', () => setSyncStatus('online'));
  window.addEventListener('offline', () => setSyncStatus('offline'));
}
// ============================================================
// AUTH
// ============================================================
function togglePassVis(inputId, btnId) {
  const input = document.getElementById(inputId);
  document.getElementById(btnId).style.opacity = input.type==='password' ? '1' : '0.6';
  input.type = input.type==='password' ? 'text' : 'password';
}

function showLogin() {
    // This is the main function that resets the auth screen
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('register-view').style.display = 'none';
    document.getElementById('pending-view').style.display = 'none';
    
    // Go back to the Name List by default
    backToNames();
    showPinLogin();
}
function showRegister() {
    // Hide everything else
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('login-stage-names').style.display = 'none';
    document.getElementById('login-stage-pin').style.display = 'none';
    document.getElementById('pending-view').style.display = 'none';

    // Show registration
    document.getElementById('register-view').style.display = 'grid';
    document.getElementById('auth-sub').textContent = 'Request access to MTL Maintenance';
}
function showPending() {
  document.getElementById('login-view').style.display='none';
  document.getElementById('register-view').style.display='none';
  document.getElementById('pending-view').style.display='block';
}
function showErr(msg) { const e=document.getElementById('auth-err'); e.textContent=msg; e.style.display='block'; }

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function doLogin() {
  const username = document.getElementById('auth-user').value.trim();
  const pass = document.getElementById('auth-pass').value;
  document.getElementById('auth-err').style.display='none';
  if (!username||!pass) { showErr('Please enter your username and password.'); return; }
  const btn = document.getElementById('auth-btn');
  btn.textContent='Signing in...'; btn.disabled=true;
  try {
    const { data: profile, error } = await window._mpdb.from('profiles').select('*').eq('username', username).single();
    if (error||!profile) { showErr('Username not found.'); btn.textContent='Sign In'; btn.disabled=false; return; }

    // Check if account is locked
    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(profile.locked_until) - new Date()) / 60000);
      showErr('Account locked due to too many failed attempts. Try again in ' + mins + ' minute' + (mins!==1?'s':'') + '.');
      btn.textContent='Sign In'; btn.disabled=false; return;
    }

    // Check password
    const hashedInput = await hashPassword(pass);
    const storedHash = profile.password_hash || '';
    let passwordMatch = false;
    if (storedHash.length === 64) {
      passwordMatch = storedHash === hashedInput;
    } else {
      try { passwordMatch = atob(storedHash.replace(/\s/g,'')) === pass; } catch(e) {}
    }

    if (!passwordMatch) {
      const attempts = (profile.login_attempts || 0) + 1;
      const updateData = { login_attempts: attempts };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        updateData.locked_until = lockUntil;
        updateData.login_attempts = 0;
        showErr('Too many failed attempts. Account locked for ' + LOCKOUT_MINUTES + ' minutes.');
      } else {
        const remaining = MAX_LOGIN_ATTEMPTS - attempts;
        showErr('Incorrect password. ' + remaining + ' attempt' + (remaining!==1?'s':'') + ' remaining.');
      }
      await window._mpdb.from('profiles').update(updateData).eq('username', username);
      btn.textContent='Sign In'; btn.disabled=false; return;
    }

    // Success — reset attempts
    await window._mpdb.from('profiles').update({ login_attempts: 0, locked_until: null }).eq('username', username);

    if (profile.status==='pending') { showErr('Your account is pending admin approval.'); btn.textContent='Sign In'; btn.disabled=false; return; }
    if (profile.status==='denied') { showErr('Access denied. Contact your administrator.'); btn.textContent='Sign In'; btn.disabled=false; return; }

    const isAdmin = username.toLowerCase()===ADMIN_USERNAME.toLowerCase();
    currentUser = { id: profile.id, name: profile.full_name||username, role: isAdmin?'admin':'tech', username };
    // Create secure session token
    await createSession(username, profile.id);
    enterApp();
  } catch(e) { showErr('Login failed. Try again.'); btn.textContent='Sign In'; btn.disabled=false; }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-user').value.trim();
  const pin = document.getElementById('reg-pin').value.trim(); // Changed from reg-pass to reg-pin
  
  // Clear any old errors
  document.getElementById('auth-err').style.display = 'none';

  // 1. Validation
  if (!name || !username || !pin) { 
      showErr('Please fill in all fields.'); 
      return; 
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { 
      showErr('Username: letters, numbers and underscores only.'); 
      return; 
  }

  try {
    // 2. Check if username is already taken
    const { data: existing } = await window._mpdb
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
    
    if (existing) { 
        showErr('That username is already taken.'); 
        return; 
    }

    // 3. Insert the new user into the database
    const { error } = await window._mpdb.from('profiles').insert({
      id: crypto.randomUUID(), 
      username: username, 
      full_name: name, 
      role: 'tech', 
      status: 'pending',
      pin_code: pin // Saves ly to the new PIN column
    });

    if (error) { 
        showErr('Could not submit: ' + error.message); 
        return; 
    }

    // 4. Success - show the pending screen
    showPending();

  } catch(e) { 
    console.error(e);
    showErr('Registration failed. Try again.'); 
  }
}


async function signOut() {
  await destroySession();
  localStorage.removeItem('mp_session');
  currentUser=null;
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  showLogin();
}
 let html5QrCode = null;



function computeMonthlyCosts() {
  const now=new Date();
  return [3,2,1,0].map(ago=>{
    const d=new Date(now.getFullYear(),now.getMonth()-ago,1);
    const y=d.getFullYear(), m=d.getMonth();
    return state.tasks.filter(t=>{
      if(!t.due) return false;
      const td=new Date(t.due);
      return td.getFullYear()===y && td.getMonth()===m;
    }).reduce((a,t)=>a+(t.cost||0),0);
  });
}

/// ============================================================
// HELPERS
// ============================================================
const ICONS={Excavator:'🦾',Tractor:'🚜','Wheel Loader':'⚙','Skid Steer':'🔧',Compressor:'💨',Crane:'🏗',Compactor:'🔩',Truck:'🚛',Forklift:'🏭'};
const TODAY=new Date(); TODAY.setHours(0,0,0,0);

function equipName(id){ const e=state.equipment.find(x=>x.id===id); return e?e.name:'—'; }
function supplierName(id){ const s=state.suppliers.find(x=>x.id===id); return s?s.name:'—'; }


function viewPhoto(src){ document.getElementById('pv-img').src=src; document.getElementById('photo-viewer').classList.add('open'); }
function closePhotoViewer(){ document.getElementById('photo-viewer').classList.remove('open'); }


// --- THE DROPDOWN PAINTER ---

function populateSelects() {
    // Check if the machine list exists
    if (!state.equipment || state.equipment.length === 0) {
        console.warn("PopulateSelects: No equipment in state yet.");
    }

    // 1. Define the option strings
    const equipOpts = state.equipment.map(e => 
        `<option value="${e.id}">${e.name}</option>`
    ).join('') || '<option value="">No equipment found</option>';

    const users = state.users_list_cache || [];
    const userOpts = '<option value="">— Unassigned —</option>' +
        users.map(u => `<option value="${u.full_name}">${u.full_name}</option>`).join('');

    // 2. Targets for Work Order Modal
    const tEquip = document.getElementById('t-equip');
    const tAssign = document.getElementById('t-assign');
    if (tEquip) { tEquip.innerHTML = equipOpts; }
    if (tAssign) { tAssign.innerHTML = userOpts; }

    // 3. Targets for Calendar/Entry Modal
    const ceEquip = document.getElementById('ce-equip');
    const ceAssign = document.getElementById('ce-assign');
    if (ceEquip) { ceEquip.innerHTML = equipOpts; }
    if (ceAssign) { ceAssign.innerHTML = userOpts; }

    // 4. Target for Equipment Filter
    const taskFilter = document.getElementById('task-equip-filter');
    if (taskFilter) {
        taskFilter.innerHTML = `<option value="all">All Equipment</option>` + equipOpts;
    }

    // 5. Target for Parts Select
    const pSel = document.getElementById('wo-part-select');
    if (pSel) {
        pSel.innerHTML = state.parts.map(p => 
            `<option value="${p.id}">${p.name} (Stock: ${p.qty})</option>`
        ).join('');
    }
} // <--- Ensure this bracket is here!
function switchWOTab(tabId, btn) {
    // 1. Hide all WO tab content divs
    const tabs = ['wo-details', 'wo-checklist', 'wo-parts-tab', 'wo-comments'];
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. Show the one we clicked
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    // 3. Update button highlights
    const parent = btn.parentElement;
    parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

// ============================================================
// PHOTOS
// ============================================================
let pendingPhotos = { task: [], equip: [], memorial: [], obs: [] };
let pendingDocFile=null;
function refreshPhotoGrid(key){
  const gridId = key==='task'?'task-photo-grid':'equip-photo-grid';
  const grid = document.getElementById(gridId); if(!grid) return;
  
  grid.innerHTML = pendingPhotos[key].map((src, i) => `
    <div style="position:relative; width:72px; height:72px">
      <img class="photo-thumb" src="${src}" onclick="viewPhoto('${src}')" style="width:100%; height:100%"/>
      <!-- THE MARKUP BUTTON -->
      <button onclick="initMarkup('${src}', '${key}', ${i})" 
              style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:3px; font-size:10px; padding:2px 4px; cursor:pointer">
              ✏️
      </button>
    </div>
  `).join('') +
  `<div class="photo-add" onclick="document.getElementById('${key}-photo-input').click()">+</div>` +
  `<input type="file" id="${key}-photo-input" accept="image/*" multiple style="display:none" onchange="handlePhotoUpload(this,'${key}')"/>`;
}
function handleDocUpload(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    pendingDocFile={data:e.target.result, type:file.type, name:file.name};
    document.getElementById('doc-file-preview').textContent='📎 '+file.name;
  };
  reader.readAsDataURL(file); input.value='';
}

function formatTime(timeStr) {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hrs = parseInt(h);
    const suffix = hrs >= 12 ? 'PM' : 'AM';
    return `${((hrs + 11) % 12 + 1)}:${m} ${suffix}`;
}

async function fillAdaptiveCalendarMarkers(year, month) {
    for (let e of state.equipment) {
        try {
            // We only look for predictions if the machine has a rule
            const hasRule = state.recurrenceRules.some(r => r.equip_id === e.id && r.type === 'hours');
            if (!hasRule) continue;

            const pred = await getAdaptivePrediction(e.id);
            if (pred && pred.status === 'ACTIVE') {
                const predDateStr = pred.predictedDate.toISOString().split('T')[0];
                const container = document.getElementById(`forecast-box-${predDateStr}`);
                if (container) {
                    container.innerHTML += `<div class="cal-event" style="background:#FAEEDA; color:#854F0B; border:1px dashed #BA7517; font-size:9px; padding:2px">📈 Forecast: ${e.name}</div>`;
                }
            }
        } catch (err) {
            console.warn("Forecast skipped for:", e.name);
        }
    }
}
// Background function to add orange boxes
async function fillAdaptiveForecasts() {
    for (let e of state.equipment) {
        const pred = await getAdaptivePrediction(e.id);
        if (pred && pred.status === 'ACTIVE') {
            const dateStr = pred.predictedDate.toISOString().split('T')[0];
            const target = document.getElementById(`forecast-container-${dateStr}`);
            if (target) {
                target.innerHTML += `<div class="cal-event" style="background:#FAEEDA; color:#854F0B; border:1px dashed #BA7517; font-size:9px">📈 Forecast: ${e.name}</div>`;
            }
        }
    }
}
function renderMonthSchedList() {
    const list = document.getElementById('sched-month-list');
    if(!list) return;
    
    // Sort by date
    const sorted = [...state.schedules].sort((a,b) => new Date(a.date) - new Date(b.date));

    list.innerHTML = sorted.map(s => `
        <div class="sched-item" style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <div class="sched-body">
                <div style="font-weight:600; font-size:13px">${s.name}</div>
                <div style="font-size:11px; color:var(--text3)">${equipName(s.equipId)} · ${fmtDate(s.date)}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteSched('${s.id}')">✕</button>
        </div>`).join('') || '<div style="color:var(--text3); font-size:12px; padding:10px">Nothing scheduled.</div>';
}


 window.triggerAddEntryFromCal = function() {
    closeModal('cal-action-modal');
    const dateInput = document.getElementById('t-due');
    if (dateInput) dateInput.value = window.lastClickedDate;
    openModal('task-modal');
};

window.triggerAbsenceFromCal = function() {
    // 1. Close the small day card
    closeModal('cal-action-modal');

    // 2. --- THE FIX: Clear the inputs so they don't show old data ---
    const startInp = document.getElementById('abs-start-date');
    const endInp = document.getElementById('abs-end-date');
    const reasonInp = document.getElementById('abs-public');
    const privateInp = document.getElementById('abs-private');
    const privateCheck = document.getElementById('abs-is-private');

    // Reset End Date to empty (shows mm/dd/yyyy)
    if (endInp) endInp.value = ""; 
    
    // Clear text and reasons
    if (reasonInp) reasonInp.value = "";
    if (privateInp) privateInp.value = "";
    if (privateCheck) privateCheck.checked = false;
    
    // Ensure the private box is hidden
    const privBox = document.getElementById('priv-box');
    if (privBox) privBox.style.display = 'none';

    // 3. Pre-fill the START date with the day you actually clicked
    if (startInp) startInp.value = window.lastClickedDate;

    // 4. Open the request modal
    openAbsenceModal(); 
};

// Function 1: Open the Work Order Modal with the date filled
function triggerAddEntryFromCal() {
    console.log("Switching from Day Card to Work Order Form...");

    // 1. Physically REMOVE the day card and its dark background
    const actionModal = document.getElementById('cal-action-modal');
    if (actionModal) {
        actionModal.classList.remove('active'); // This is the key fix
        actionModal.style.display = 'none';
    }
    
    // 2. Open the work order modal
    if (typeof openModal === 'function') {
        openModal('calendar-entry-modal'); 
    } else {
        const m = document.getElementById('calendar-entry-modal');
        if (m) m.style.display = 'block';
    }

    // 3. Reset form and AUTO-FILL date
    try {
        if (typeof populateSelects === 'function') populateSelects(); 
        if (typeof resetCalModal === 'function') resetCalModal();
    } catch (e) { console.warn(e); }

    const dateInput = document.getElementById('cal-date') || document.getElementById('task-due');
    if (dateInput) {
        dateInput.value = lastClickedDate;
    }
}

// Function 2: Open the Absence Modal with the date filled
window.triggerAbsenceFromCal = function() {
    closeModal('cal-action-modal');
    
    // Set the date in your Time Off modal automatically
    const dateInput = document.getElementById('abs-start-date'); // Match your HTML ID
    if (dateInput) dateInput.value = window.lastClickedDate;
    
    openModal('absence-modal'); // Match your Modal ID
};
function toggleRecurType(){
  const t=document.getElementById('r-type').value;
  document.getElementById('r-interval-group').style.display=t==='calendar'?'block':'none';
  document.getElementById('r-hours-group').style.display=t==='hours'?'block':'none';
}
function renderRecurList() {
    const list = document.getElementById('recur-list');
    if(!list) return;
    
    list.innerHTML = state.recurrenceRules.map(r => `
        <div class="recur-item" style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <div style="flex:1">
                <div style="font-weight:600; font-size:13px">${r.name}</div>
                <div style="font-size:11px; color:var(--text3)">${equipName(r.equip_id)} · Every ${r.runtime_hours || r.interval_value} ${r.type === 'hours' ? 'hrs' : r.interval_unit}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteRecurRule('${r.id}')">✕</button>
        </div>`).join('') || '<div style="color:var(--text3); font-size:12px; padding:10px">No rules set.</div>';
}


function getNextDue(id){ const o=state.tasks.filter(t=>t.equipId===id&&t.status!=='Completed'); if(!o.length)return'—'; const n=o.sort((a,b)=>new Date(a.due)-new Date(b.due))[0]; return `<span style="color:${isOverdue(n.due)?'var(--danger)':'inherit'}">${fmtDate(n.due)}</span>`; }
async function deleteEquip(id) {
  const e = state.equipment.find(x => x.id === id);
  if (!e) return;

  if (!confirm(`Permanently delete ${e.name}? This will also remove all observations and history.`)) return;

  try {
    // 1. Log the action FIRST while we still have data
    logAuditAction("Deleted Machine", `Removed ${e.name} (S/N: ${e.serial || 'N/A'})`);

    // 2. DELETE LINKED DATA FROM DATABASE (Clean up the ghosts!)
    // This removes all observations associated with this equipment ID
    await window._mpdb.from('observations').delete().eq('equip_id', id);
    
    // 3. DELETE EQUIPMENT FROM DATABASE
    const { error } = await window._mpdb.from('equipment').delete().eq('id', id);
    if (error) throw error;

    // 4. CLEAN LOCAL MEMORY (Remove from state arrays)
    state.equipment = state.equipment.filter(eq => eq.id !== id);
    state.observations = state.observations.filter(o => o.equip_id !== id);
    // Also clear linked tasks if necessary
    state.tasks = state.tasks.filter(t => t.equipId !== id);

    // 5. RE-RENDER UI
    renderEquipmentTable();
    renderDashboard(); // This will now run with the cleaned state.observations
    
    showToast(`${e.name} and all data removed ✓`);
    
  } catch (e) {
    console.error("Delete failed:", e);
    showToast("Delete failed. See console.");
  }
}
// Custom fields
let customFieldsTemp={};
function renderCustomFields(){
  const list=document.getElementById('custom-fields-list'); if(!list)return;
  list.innerHTML=Object.entries(customFieldsTemp).map(([k,v])=>
    `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <input class="form-input" value="${k}" style="flex:1" placeholder="Field name" onchange="customFieldsTemp['${k}']=undefined;delete customFieldsTemp['${k}'];customFieldsTemp[this.value]='${v}'"/>
      <input class="form-input" value="${v}" style="flex:1" placeholder="Value" onchange="customFieldsTemp['${k}']=this.value"/>
      <button class="btn btn-danger" onclick="delete customFieldsTemp['${k}'];renderCustomFields()">✕</button>
    </div>`
  ).join('');
}
function addCustomField(){ customFieldsTemp['New Field '+Object.keys(customFieldsTemp).length]='' ; renderCustomFields(); }

// Assign users
let assignedUsersTemp=[];
function renderAssignUsers(){
  const list=document.getElementById('assign-users-list'); if(!list)return;
  list.innerHTML='<div style="color:var(--text2);font-size:13px">Enter usernames to assign (comma separated):</div><input class="form-input" id="assign-input" placeholder="e.g. mike, sarah" style="margin-top:8px;width:100%" value="'+assignedUsersTemp.join(', ')+'"/>';
}

// ============================================================
// SCHEDULE
// ============================================================
async function deleteSched(id){ state.schedules=state.schedules.filter(s=>s.id!==id); await persist('schedules','delete',{id}); renderSchedule(); renderCalendar(); }



function openEditDocModal(docId = null) {
  _currentDocEditId = docId;
  
  // 1. Fill the "Linked Equipment" dropdown
  const equipSelect = document.getElementById('d-equip');
  if (equipSelect) {
      equipSelect.innerHTML = '<option value="">— None —</option>' + 
        state.equipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  }

  if (docId) {
    // EDIT MODE: Find doc and fill modal
    const doc = state.documents.find(d => d.id === docId);
    if (!doc) return;
    
    document.getElementById('d-name').value = doc.name;
    document.getElementById('d-type').value = doc.type;
    document.getElementById('d-equip').value = doc.equip_id || '';
    document.getElementById('d-expiry').value = doc.expiry_date || '';
    document.getElementById('d-notes').value = doc.notes || '';
    document.getElementById('doc-file-preview').textContent = "Current file attached";
  } else {
    // ADD MODE: Clear modal
    ['d-name','d-expiry','d-notes'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = '';
    });
    // If we're inside a machine's detail view, auto-select it!
    if (window._currentDetailEquipId) {
        document.getElementById('d-equip').value = window._currentDetailEquipId;
    }
  }

  openModal('doc-modal');
}


// Small helper for the downtime display logic inside the detail view
function renderDowntimeTab(equipId) {
    const dtContent = document.getElementById('eq-downtime-content');
    if(dtContent) {
        const dt = getEquipDowntime(equipId);
        const activeMins = dt.activeDown ? Math.round((new Date() - new Date(dt.activeDown.startedAt)) / 60000) : 0;
        dtContent.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px">
                <div class="metric-card"><div class="metric-label">Total Downtime</div><div class="metric-value">${formatDuration(dt.totalMins) || 'None'}</div></div>
                <div class="metric-card"><div class="metric-label">Events</div><div class="metric-value">${dt.entries.length}</div></div>
                <div class="metric-card"><div class="metric-label">Status</div><div class="metric-value">${dt.activeDown ? 'DOWN' : 'Operational'}</div></div>
            </div>
            ${dt.entries.length ? `
                <table style="width:100%; border-collapse:collapse; font-size:13px">
                    <thead><tr><th style="text-align:left; padding:5px">Date</th><th style="text-align:left; padding:5px">Duration</th></tr></thead>
                    <tbody>${dt.entries.map(d => `<tr><td style="padding:6px 5px; border-bottom:1px solid var(--border)">${new Date(d.startedAt).toLocaleDateString()}</td><td style="padding:6px 5px; border-bottom:1px solid var(--border); font-weight:600">${formatDuration(d.downtimeMins)}</td></tr>`).join('')}</tbody>
                </table>` : '<div style="color:var(--text3); font-size:13px; padding:8px 0">No downtime recorded</div>'}`;
    }
}



function openSupplierDetail(id){
  const s = state.suppliers.find(x => x.id === id); 
  if(!s) return;
  
  const parts = state.parts.filter(p => p.supplier_id === id);
  document.getElementById('detail-title').textContent = s.name;
  
  document.getElementById('detail-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:13px">
      <div><span style="color:var(--text2)">Contact:</span> ${s.contact||'—'}</div>
      <div><span style="color:var(--text2)">Phone:</span> ${s.phone||'—'}</div>
      <div><span style="color:var(--text2)">Email:</span> <a href="mailto:${s.email}" style="color:var(--accent)">${s.email||'—'}</a></div>
      <div><span style="color:var(--text2)">Website:</span> ${s.website ? `<a href="${s.website}" target="_blank" style="color:var(--accent)">Visit</a>` : '—'}</div>
    </div>
    ${s.notes ? `<div style="font-size:13px;color:var(--text2);background:var(--bg2);padding:9px 11px;border-radius:var(--radius);margin-bottom:12px">${s.notes}</div>` : ''}
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Parts from this supplier (${parts.length})</div>
    ${parts.map(p => `<div class="parts-row">
        <div style="flex:1"><div style="font-weight:500">${p.name}</div><div style="font-size:11px;color:var(--text2)">${p.num} · Stock: ${p.qty}</div></div>
    </div>`).join('') || '<div style="color:var(--text3);font-size:13px">No parts linked</div>'}
    <div style="margin-top:16px;text-align:right">
        <button class="btn btn-primary" onclick="closeModal('detail-modal')">Close</button>
    </div>`;

  openModal('detail-modal');

}


// ============================================================
// WO PARTS
// ============================================================
let woPartsAdded=[];
function addPartToWO(){
  const partId=document.getElementById('wo-part-select').value;
  const qty=parseInt(document.getElementById('wo-part-qty').value)||1;
  const part=state.parts.find(p=>p.id===partId); if(!part) return;
  if(qty>part.qty){ showToast('Not enough stock! ('+part.qty+' available)'); return; }
  const unitCost = parseFloat(part.cost)||0;
  const existing=woPartsAdded.find(p=>p.part_id===partId);
  if(existing){ existing.qty_used+=qty; } else { woPartsAdded.push({id:uid(),part_id:partId,part_name:part.name,qty_used:qty,unit_cost:unitCost}); }
  updateWOCostFromParts();
  renderWOPartsList();
}
function renderWOPartsList(){
  const total = woPartsAdded.reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0);
  document.getElementById('wo-parts-list').innerHTML=woPartsAdded.length?
    woPartsAdded.map((p,i)=>`<div class="parts-row">
      <div style="flex:1"><div style="font-weight:500">${p.part_name}</div>
        <div style="font-size:11px;color:var(--text2)">$${(p.unit_cost||0).toFixed(2)} each × ${p.qty_used} = <b>$${((p.unit_cost||0)*p.qty_used).toFixed(2)}</b></div>
      </div>
      <button class="btn btn-danger" onclick="woPartsAdded.splice(${i},1);renderWOPartsList();updateWOCostFromParts()">✕</button>
    </div>`).join('')
    :'<div style="color:var(--text3);font-size:13px">No parts added yet</div>';
  // Update cost summary
  const summary = document.getElementById('wo-parts-cost-summary');
  const subtotalEl = document.getElementById('wo-parts-subtotal');
  if(summary) summary.style.display = woPartsAdded.length ? 'block' : 'none';
  if(subtotalEl) subtotalEl.textContent = '$' + total.toFixed(2);
}
function addWOComment(){
  const body=document.getElementById('wo-comment-input').value.trim(); if(!body) return;
  document.getElementById('wo-comment-list').innerHTML+=`<div class="comment"><div class="comment-author">${currentUser.name}<span class="comment-time">Just now</span></div><div class="comment-body">${body}</div></div>`;
  document.getElementById('wo-comment-input').value='';
}

// ============================================================
// SAVE DATA
// ============================================================

async function deleteRecurRule(id){ if(!confirm('Delete this recurrence rule?'))return; state.recurrenceRules=state.recurrenceRules.filter(r=>r.id!==id); await persist('recurrence_rules','delete',{id}); renderCalendar(); }

async function handlePhotoUpload(input, key) {
  const files = Array.from(input.files);
  for(const file of files) {
    const reader = new FileReader();
    const dataUrl = await new Promise(res => { reader.onload = e => res(e.target.result); reader.readAsDataURL(file); });
    const compressed = await compressImage(dataUrl);
    const savings = Math.round((1 - compressed.length/dataUrl.length)*100);
    if(savings > 5) showToast('Photo compressed — saved ' + savings + '% storage');
    pendingPhotos[key].push(compressed);
    refreshPhotoGrid(key);
  }
  input.value = '';
}

let offlineQueue = [];
try { offlineQueue = JSON.parse(localStorage.getItem('mp_offline_queue') || '[]'); } catch(e) {}

function saveOfflineQueue() {
  try { localStorage.setItem('mp_offline_queue', JSON.stringify(offlineQueue)); } catch(e) {}
  document.getElementById('offline-queue-banner').style.display = offlineQueue.length ? 'block' : 'none';
}


// ============================================================
// HOURS AUTO-TRACKER
// ============================================================
async function markComplete(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;

  // 1. Update machine hours (Helpful for maintenance tracking)
  const equip = state.equipment.find(e => e.id === t.equipId);
  const currentHours = equip ? equip.hours : 0;
  
  const newHours = prompt(`Update meter for ${equip?.name || 'machine'}?\nCurrent: ${currentHours.toLocaleString()} hrs\nEnter new reading (or cancel to skip):`);
  
  if (newHours !== null && newHours.trim() !== '') {
    const val = parseInt(newHours);
    if (!isNaN(val) && val >= currentHours) {
      if (equip) {
        equip.hours = val;
        t.meter = val + ' hrs';
        await persist('equipment', 'upsert', equip);
         logAuditAction("Completed WO", `${t.name} on ${equip?.name || 'Unknown'}`);

    const rule = state.recurrenceRules.find(r => r.equip_id === t.equipId && r.type === 'hours');
    if (rule && equip) {
        await window._mpdb.from('recurrence_rules').update({ last_generated_hours: equip.hours }).eq('id', rule.id);
    }
      }
    }
  }

  // 2. Set status to Completed
  t.status = 'Completed';
  t.completed_at = new Date().toISOString();

  // 3. Save to Database
  try {
    await persist('tasks', 'upsert', t);

    // SAFETY CHECK: Only log to audit if the function exists
    if (typeof logAuditAction === 'function') {
        logAuditAction("Completed WO", `${t.name} on ${equip?.name || 'Unknown'}`);
    }

    // 4. Trigger Recurrence (Checks if a new 500hr service etc. needs to be created)
    await runRecurrenceEngine();
    
    // 5. UI Refresh
    closeModal('detail-modal');
    renderDashboard();
    
    // Ensure the task list also refreshes
    if (typeof renderTasks === 'function') {
        renderTasks();
    }
    
    showToast("Work Order Completed ✓");
  } catch (e) {
    console.error("Completion error:", e);
    showToast("Failed to save. Check connection.");
  }

await window._mpdb.from('meter_history').insert({ 
    equip_id: equipId, 
    reading: val, 
    status_at_reading: e.status 
});
}
// OVERDUE EMAIL (weekly, one email per batch)
// ============================================================
const OVERDUE_EMAIL_RECIPIENT = 'tannergalloway75@gmail.com';

function scheduleOverdueCheck(task) {
  // Store when each task was created so we can check 1 week later
  try {
    const schedules = JSON.parse(localStorage.getItem('mp_email_schedule') || '{}');
    if(!schedules[task.id]) {
      const dueDate = new Date(task.due || Date.now());
      const sendDate = new Date(dueDate.getTime() + 7*24*60*60*1000);
      schedules[task.id] = { sendAt: sendDate.toISOString(), taskId: task.id, taskName: task.name };
      localStorage.setItem('mp_email_schedule', JSON.stringify(schedules));
    }
  } catch(e) {}
}

async function checkAndSendOverdueEmails() {
  try {
    const schedules = JSON.parse(localStorage.getItem('mp_email_schedule') || '{}');
    const now = new Date();
    const toSend = [];
    for(const [taskId, info] of Object.entries(schedules)) {
      if(new Date(info.sendAt) <= now) {
        const task = state.tasks.find(t=>t.id===taskId);
        if(task && task.status !== 'Completed') toSend.push(task);
        delete schedules[taskId];
      }
    }
    localStorage.setItem('mp_email_schedule', JSON.stringify(schedules));
    if(toSend.length > 0) {
      await sendOverdueEmailBatch(toSend);
    }
  } catch(e) { console.log('Email check error:', e); }
}

async function sendOverdueEmailBatch(tasks) {
  // Check we haven't sent a similar email in last 6 days (dedup)
  try {
    const { data: recentEmails } = await window._mpdb.from('email_log')
      .select('*').eq('type','overdue')
      .gte('sent_at', new Date(Date.now()-6*24*60*60*1000).toISOString());
    const recentIds = new Set((recentEmails||[]).flatMap(e=>e.task_ids||[]));
    const newTasks = tasks.filter(t=>!recentIds.has(t.id));
    if(!newTasks.length) return;
    // Log the email
    await window._mpdb.from('email_log').insert({
      id: uid(), type:'overdue', recipient: OVERDUE_EMAIL_RECIPIENT,
      subject: 'MTL Maintenance — Overdue Work Orders',
      task_ids: newTasks.map(t=>t.id),
    });
    // Show in-app notification to admin
    if(currentUser?.role==='admin') {
      showToast('📧 Overdue email queued for ' + OVERDUE_EMAIL_RECIPIENT);
    }
  } catch(e) { console.log('Email send error:', e); }
}

// Run email check on app load
setTimeout(checkAndSendOverdueEmails, 3000);


// QR CODES (Admin only)
// ============================================================
function printQRCode(equipId) {
  const equip = state.equipment.find(e=>e.id===equipId); if(!equip) return;
  const url = window.location.origin + window.location.pathname + '?equip=' + equipId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
  const win = window.open('','_blank');
  
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR — ${equip.name}</title>
  <style>
    body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff}
    .card{text-align:center;padding:32px;border:2px solid #1a1a18;border-radius:12px;max-width:300px}
    h2{font-size:18px;margin:16px 0 4px}
    .sub{font-size:13px;color:#666;margin-bottom:8px}
    .serial{font-size:12px;color:#999}
    .url{font-size:10px;color:#aaa;margin-top:12px;word-break:break-all}
    @media print{.no-print{display:none}}
  </style></head><body>
  <div class="card">
    <div style="font-size:28px">⚙</div>
    <h2>${equip.name}</h2>
    <div class="sub">${equip.type||''}</div>
    <div class="serial">S/N: ${equip.serial||'—'}</div>
    <img src="${qrUrl}" style="margin:16px 0;width:220px;height:220px" alt="QR Code"/>
    <div class="url">Scan to view maintenance history</div>
    <div style="margin-top:16px" class="no-print">
      <button onclick="window.print()" style="padding:8px 20px;cursor:pointer;font-size:14px;border:1px solid #000;border-radius:8px;background:#fff">🖨 Print</button>
    </div>
  </div>
  </body></html>`);
  
  win.document.close();
}

// Handle QR code deep link on load
(function() {
  const params = new URLSearchParams(window.location.search);
  const equipId = params.get('equip');
  if(equipId) {
    const checkReady = setInterval(() => {
      if(currentUser && state.equipment.length) {
        clearInterval(checkReady);
        showPanel('equipment');
        openEquipDetail(equipId);
      }
    }, 300);
  }
})();

// ============================================================
// PATCH: saveEquipment — add budget fields
// ============================================================
const _origSaveEquipment = saveEquipment;
async function saveEquipment() {
  const name = document.getElementById('e-name').value.trim(); 
  if(!name){ showToast('Please enter a name'); return; }
  
  const assignInput = document.getElementById('assign-input');
  const assignedUsers = assignInput ? assignInput.value.split(',').map(s=>s.trim()).filter(Boolean) : [];
  
  const record = {
    id:uid(), 
    name,
    type:   document.getElementById('e-type').value,
    serial: document.getElementById('e-serial').value,
    hours:  parseInt(document.getElementById('e-hours').value)||0,
    status: document.getElementById('e-status').value,
    op:     document.getElementById('e-op').value,
    notes:  document.getElementById('e-notes').value,
    photos: pendingPhotos.equip.slice(),
    assigned_users: assignedUsers,
    custom_fields: customFieldsTemp,
    health_score: 100,
    manufacturer: document.getElementById('e-manufacturer')?.value.trim()||'',
    group_tag: document.getElementById('e-group')?.value||'outside',
    monthly_budget: parseFloat(document.getElementById('e-budget-monthly')?.value)||0,
    yearly_budget:  parseFloat(document.getElementById('e-budget-yearly')?.value)||0,
  };

  state.equipment.push(record);
  await persist('equipment','upsert',record);
const isEdit = state.equipment.some(e => e.id === record.id);
await logAuditAction(
  isEdit ? "Updated Equipment" : "Added New Equipment", 
  `Machine: "${name}"`
);
  pendingPhotos.equip=[]; 
  customFieldsTemp={};
  closeModal('equip-modal'); 
  renderEquipmentTable(); 
  updateMetrics();

  ['e-name','e-type','e-serial','e-hours','e-op','e-notes','e-budget-monthly','e-budget-yearly'].forEach(id=>{ 
    const el=document.getElementById(id); 
    if(el) el.value=''; 
  });
}

const _origRenderDashboard = renderDashboard;
const _origEnterApp = enterApp;
const _origRenderEquipmentTable = renderEquipmentTable;
const PERMISSIONS = {
  admin:   {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:true,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  manager: {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:false,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  tech:    {canCreate:true,canEdit:true,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:true},
  viewer:  {canCreate:false,canEdit:false,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:false},
};
(function(){try{const s=JSON.parse(localStorage.getItem('mp_permissions')||'null');if(s){['manager','tech','viewer'].forEach(r=>{if(s[r])PERMISSIONS[r]={...PERMISSIONS[r],...s[r]};});}}catch(e){}})();
function can(permission){
  if(!currentUser)return false;
  if(currentUser.custom_permissions&&currentUser.custom_permissions[permission]!==undefined)return!!currentUser.custom_permissions[permission];
  return!!(PERMISSIONS[currentUser.role||'viewer']?.[permission]);
}

// State additions
state.downtimeLog=[];state.observations=[];state.chatMessages=[];
state.checklistTemplates=[
  {id:'tpl-cat320',name:'CAT 320 Excavator — Daily',model:'CAT 320',type:'Excavator',items:['Check engine oil level','Check hydraulic fluid level','Check coolant level','Check fuel level','Inspect for fluid leaks','Drain water separator','Inspect hydraulic hoses','Check cylinder seals','Inspect undercarriage','Check track tension','Inspect track bolts','Inspect sprocket','Inspect bucket teeth','Check bucket pins','Grease all pivot points','Test lights and horn','Test seat belt','Check control switches','Inspect mirrors','Clean cab','Clean radiator','Monitor display for errors','Test brakes','Listen for abnormal sounds','Test all hydraulic functions','Log hours']},
  {id:'tpl-cat320-500',name:'CAT 320 — 500hr Service',model:'CAT 320',type:'Excavator',items:['Change engine oil and filter','Replace fuel filters','Replace hydraulic return filter','Check and clean air filter','Top up all fluid levels','Grease all lubrication points','Inspect track and undercarriage','Check swing bearing','Inspect cylinder seals','Check all hydraulic hoses','Inspect engine belts','Check battery terminals','Test all safety devices','Check slew ring bolts','Sample hydraulic oil','Sample engine oil','Inspect radiator cores','Log service']},
  {id:'tpl-loader',name:'Wheel Loader — Daily',model:'General',type:'Wheel Loader',items:['Check engine oil','Check hydraulic fluid','Check coolant','Check fuel','Inspect tyres','Check wheel nuts','Inspect bucket teeth','Check bucket pins','Inspect hydraulic hoses','Grease pivot points','Test lights and alarm','Test seat belt','Check mirrors','Test hydraulic functions','Log hours']},
  {id:'tpl-skid',name:'Skid Steer — Daily',model:'General',type:'Skid Steer',items:['Check engine oil','Check hydraulic fluid','Check coolant','Check fuel','Inspect tyres or tracks','Check quick attach','Inspect hydraulic hoses','Grease lubrication points','Test lights and alarm','Test seat bar','Test all controls','Log hours']},
  {id:'tpl-crane',name:'Crane — Daily Pre-Op',model:'General',type:'Crane',items:['Check engine oil','Check hydraulic fluid','Check coolant','Check fuel','Inspect wire rope','Inspect hook and latch','Check load block','Inspect boom','Check outriggers','Test limit switches','Test load indicator','Inspect hydraulic hoses','Grease all points','Test all controls','Verify lift certification','Log hours']},
];
(function(){try{const s=JSON.parse(localStorage.getItem('mp_tpl')||'null');if(s){const ids=new Set(state.checklistTemplates.map(t=>t.id));s.forEach(t=>{if(!ids.has(t.id))state.checklistTemplates.push(t);});}}catch(e){}})();
(function(){try{state.downtimeLog=JSON.parse(localStorage.getItem('mp_downtime')||'[]');}catch(e){}})();



function printMachineHistory(equipId){
  const e=state.equipment.find(x=>x.id===equipId);if(!e)return;
  const tasks=state.tasks.filter(t=>t.equipId===equipId).sort((a,b)=>new Date(b.due)-new Date(a.due));
  const docs=state.documents.filter(d=>d.equip_id===equipId);
  const dt=getEquipDowntime(equipId);const score=calcHealth(equipId);
  const totalCost=tasks.reduce((a,t)=>a+(t.cost||0),0);
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>History — ${e.name}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px}
    h1{font-size:20px;margin-bottom:3px}h2{font-size:13px;font-weight:700;text-transform:uppercase;color:#185FA5;border-bottom:1.5px solid #185FA5;padding-bottom:4px;margin:22px 0 8px}
    .kpis{display:flex;gap:10px;margin-bottom:16px}.kpi{background:#f5f5f3;border-radius:6px;padding:10px 14px;min-width:100px}.kpi-l{font-size:10px;text-transform:uppercase;color:#888}.kpi-v{font-size:18px;font-weight:700;margin-top:2px}
    table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;color:#888;padding:5px 7px;border-bottom:2px solid #eee}td{padding:6px 7px;border-bottom:1px solid #eee;font-size:11px}
    @media print{.no-print{display:none}}
    .btn-print{padding:10px 25px; font-weight:bold; cursor:pointer; background:#fff; border:2px solid #1a1a18; border-radius:8px; margin-top:30px}
  </style></head><body>
  <h1>⚙ ${e.name} History</h1>
  <div class="kpis">
    <div class="kpi"><div class="kpi-l">Total WOs</div><div class="kpi-v">${tasks.length}</div></div>
    <div class="kpi"><div class="kpi-l">Total Cost</div><div class="kpi-v">$${totalCost.toLocaleString()}</div></div>
  </div>
  <table><thead><tr><th>Name</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead><tbody>
  ${tasks.map(t=>`<tr><td><b>${t.name}</b></td><td>${fmtDate(t.due)}</td><td>$${(t.cost||0).toLocaleString()}</td><td>${t.status}</td></tr>`).join('')}
  </tbody></table>
  <div class="no-print" style="text-align:center">
    <button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
  </body></html>`;
  
  const w=window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
}



  function refreshObsList(equipId) {
    const container = document.getElementById('obs-list-' + equipId);
    if (!container) return;

    const obs = (state.observations || []).filter(o => o.equip_id === equipId);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

    container.innerHTML = obs.map(o => {
        const sevClass = o.severity === 'critical' ? 'obs-critical' : o.severity === 'watch' ? 'obs-watch' : 'obs-info';
        const isAuthor = o.author === currentUser.username || o.author === currentUser.name;

        return `
        <div class="card" style="margin-bottom: 12px; border-left: 5px solid ${o.severity === 'critical' ? 'var(--danger)' : 'var(--border)'}">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                <span class="badge ${sevClass}">${o.severity.toUpperCase()}</span>
                <span style="font-size:11px; color:var(--text3)">${o.author} · ${fmtDate(o.created_at)}</span>
            </div>
            <div style="font-size:13px; line-height:1.5">${o.body}</div>
            ${o.photo ? `<img src="${o.photo}" style="width:100%; max-height:200px; object-fit:cover; margin-top:8px; border-radius:4px; cursor:pointer" onclick="viewPhoto('${o.photo}')"/>` : ''}
            
            <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end">
                ${(isAuthor || isAdmin) ? `<button class="btn btn-secondary btn-sm" style="font-size:10px" onclick="editObservation('${o.id}', '${equipId}')">Edit</button>` : ''}
                ${(isAdmin) ? `<button class="btn btn-danger btn-sm" style="font-size:10px" onclick="deleteObservation('${o.id}', '${equipId}')">Delete</button>` : ''}
            </div>
        </div>`;
    }).join('') || '<div style="color:var(--text3); padding:20px; text-align:center">No observations yet.</div>';
}

// ── GROUPS ───────────────────────────────────────────────────
let activeGroupFilter='all',equipGroupFilter='all';
function setGroupFilter(group){activeGroupFilter=group;['all','outside','production'].forEach(g=>{const btn=document.getElementById('grp-'+g);if(!btn)return;if(g===group){btn.style.background='#fff';btn.style.color='#1a1a18';btn.style.fontWeight='700';btn.style.borderColor='#fff';}else{btn.style.background='rgba(255,255,255,0.15)';btn.style.color='#fff';btn.style.fontWeight='500';btn.style.borderColor='rgba(255,255,255,0.6)';}});renderDashboard();}
function setEquipGroupFilter(group){equipGroupFilter=group;['all','outside','production'].forEach(g=>{const btn=document.getElementById('eq-grp-'+g);if(!btn)return;btn.classList.toggle('active',g===group);});renderEquipmentTable();}
function filteredEquipment(filter){const f=filter||activeGroupFilter;if(f==='all')return state.equipment;return state.equipment.filter(e=>e.group_tag===f||e.group_tag==='both');}
function applyUserGroupFilter(){if(!currentUser)return;const g=currentUser.group_tag;if(g&&g!=='all'){setGroupFilter(g);setEquipGroupFilter(g);}}

// ── RECENT OBS + FLEET HEALTH ────────────────────────────────
function renderRecentObservations() {
  const listEl = document.getElementById('recent-obs-list');
  const badgeEl = document.getElementById('obs-count-badge');
  if (!listEl) return;

  // 1. Filter out observations for machines that were deleted
  const validEquipIds = new Set(state.equipment.map(e => e.id));
  let obs = (state.observations || []).filter(o => validEquipIds.has(o.equip_id));

  // 2. Handle Group Filtering (Outside/Production)
  if (typeof activeGroupFilter !== 'undefined' && activeGroupFilter !== 'all') {
    const ids = new Set(filteredEquipment(activeGroupFilter).map(e => e.id));
    obs = obs.filter(o => ids.has(o.equip_id));
  }

  // 3. Update the badge count
  if (badgeEl) badgeEl.textContent = obs.length + ' total';

  // 4. If empty, show message and STOP
  if (obs.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text2);font-size:13px;padding:20px;text-align:center">No observations yet</div>';
    return;
  }

  // 5. THE FIX: Actually draw the items if count > 0
  // We sort by newest first and take the top 6
  listEl.innerHTML = obs
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)
    .map(o => {
      // Determine machine name and severity colors
      const machineName = typeof equipName === 'function' ? equipName(o.equip_id) : 'Machine';
      const sevClass = o.severity === 'critical' ? 'bd' : o.severity === 'watch' ? 'bw' : 'bs';
      
      return `
        <div class="obs-row" onclick="openEquipDetail('${o.equip_id}')" 
             style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid var(--border); transition: background 0.2s;">
          
         
          <!-- Content -->
          <div style="flex:1; min-width:0">
            <div style="font-weight:700; font-size:13px; color:black; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
               ${o.body}
            </div>
            <div style="font-size:11px; color:var(--text2)">
               ${machineName} · ${o.author} · ${new Date(o.created_at).toLocaleDateString()}
            </div>
          </div>

          <!-- Status Badge (The fixed vibrant colors) -->
          <span class="badge ${sevClass}">${o.severity}</span>
        </div>`;
    }).join('');
}
  
function renderFleetHealthDash(){
  const el=document.getElementById('fleet-health-dash');if(!el)return;
  const equip=filteredEquipment(activeGroupFilter).slice(0,6);
  if(!equip.length){el.innerHTML='<div style="color:var(--text2);font-size:13px">No equipment in this group</div>';return;}
  el.innerHTML=equip.map(e=>{const score=calcHealth(e.id);return`<div class="parts-row" onclick="openEquipDetail('${e.id}')" style="cursor:pointer"><div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.name}</div><div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${score}%;background:${healthColor(score)}"></div></div></div><span style="font-size:12px;font-weight:600;color:${healthColor(score)};flex-shrink:0;margin-left:8px">${score}%</span></div>`;}).join('');
}

// ── PERMISSIONS ADMIN ────────────────────────────────────────
const PERM_LABELS = {
  'canCreate': 'Create work orders',
  'canEdit': 'Edit records',
  'canDelete': 'Delete records',
  'canViewReports': 'View reports & analytics',
  'canViewCosts': 'View costs',
  'canManageEquip': 'Manage equipment',
  'canManageParts': 'Manage parts',
  'canManageSuppliers': 'Manage suppliers',
  'canManageUsers': 'Manage users',
  'canManageTools': 'Manage Tool Crib (Add/Edit)' // <--- ADD THIS LINE
};
let editingUserId=null,editingUserRole=null,editingPerms={};
function openUserPerms(userId,userName,userRole,customPerms){editingUserId=userId;editingUserRole=userRole;editingPerms={...PERMISSIONS[userRole]||PERMISSIONS.tech,...(customPerms||{})};document.getElementById('user-perms-title').textContent=userName+' — Permissions';document.getElementById('user-perms-role').textContent=userRole;renderUserPermsList();openModal('user-perms-modal');}
function renderUserPermsList(){const rd=PERMISSIONS[editingUserRole]||PERMISSIONS.tech;document.getElementById('user-perms-list').innerHTML=Object.entries(PERM_LABELS).map(([key,label])=>{const def=!!(rd[key]),cur=!!(editingPerms[key]),ov=cur!==def;return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font-size:13px;font-weight:500">${label}</div><div style="font-size:11px;color:var(--text3)">Default: ${def?'✅':'❌'}${ov?' <span style="color:var(--warning)">● Override</span>':''}</div></div><label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0;margin-left:12px"><span style="font-size:12px;color:${cur?'var(--success)':'var(--danger)'};font-weight:600;min-width:60px;text-align:right">${cur?'Allowed':'Denied'}</span><div style="position:relative;width:40px;height:22px;flex-shrink:0"><input type="checkbox" ${cur?'checked':''} onchange="editingPerms['${key}']=this.checked;renderUserPermsList()" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;margin:0;z-index:2"/><div style="width:40px;height:22px;border-radius:11px;background:${cur?'#3B6D11':'#E24B4A'};position:absolute;top:0;left:0"></div><div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${cur?'21px':'3px'};transition:left .2s;pointer-events:none"></div></div></label></div>`;}).join('');}
async function saveUserPerms() {
    if (!editingUserId) return;

    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ permissions: editingPerms })
            .eq('id', editingUserId);

        if (error) {
            alert("Error saving: " + error.message);
        } else {
            showToast("Permissions updated");
            closeModal('user-perms-modal');
            renderUsersTable(); // Refresh the main table
        }
    } catch (e) { console.error(e); }
}

function resetUserPerms() {
    if (confirm("Reset this user to the default permissions for their role?")) {
        editingPerms = {}; // Clearing the object removes all overrides
        renderUserPermsList();
    }
}
function togglePermission(role,permission,value){if(role==='admin')return;PERMISSIONS[role][permission]=value;try{const c={};['manager','tech','viewer'].forEach(r=>{c[r]={...PERMISSIONS[r]};});localStorage.setItem('mp_permissions',JSON.stringify(c));}catch(e){}showToast('Updated ✓');}
function renderPermissionsMatrix(){const perms=Object.entries(PERM_LABELS);const roles=['admin','manager','tech','viewer'];document.getElementById('permissions-table-body').innerHTML=perms.map(([key,label])=>`<tr><td style="padding-left:16px;font-weight:500">${label}</td>${roles.map(role=>`<td style="text-align:center">${role==='admin'?'✅':`<input type="checkbox" ${PERMISSIONS[role]?.[key]?'checked':''} onchange="togglePermission('${role}','${key}',this.checked)" style="width:16px;height:16px;cursor:pointer"/>`}</td>`).join('')}</tr>`).join('');}
async function openPermissionsCard(userId) {
    const user = state.users_list_cache ? state.users_list_cache.find(u => u.id === userId) : null;
    if (!user) return;

    editingUserId = userId;
    editingUserRole = user.role || 'tech';
    editingPerms = user.permissions || {}; 

    document.getElementById('user-perms-title').textContent = "Perms: " + (user.full_name || user.username);
    document.getElementById('user-perms-role').textContent = editingUserRole.toUpperCase();

    renderUserPermsList();

    const modal = document.getElementById('user-perms-modal');
    if (modal) {
        modal.classList.add('active'); // THE FIX: Adds the class for CSS
        modal.style.display = 'flex';
    }
}
async function quickRoleChange(userId, newRole) {
    showToast("Updating role...");
    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId); // TARGET SPECIFIC USER ONLY
            
        if (error) throw error;
        showToast("Role updated ✓");
        // Update local currentUser if you just edited yourself
        if (currentUser.id === userId) currentUser.role = newRole;
    } catch(e) {
        showToast("Update failed");
        renderUsersTable(); // Revert UI on failure
    }
}

async function quickGroupChange(userId, newGroup) {
    showToast("Updating group...");
    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ group_tag: newGroup || null })
            .eq('id', userId); // TARGET SPECIFIC USER ONLY

        if (error) throw error;
        showToast("Group updated ✓");
    } catch(e) {
        showToast("Update failed");
        renderUsersTable();
    }
}
async function changeUserRole() {
  const userId = document.getElementById('role-user-select').value;
  const newRole = document.getElementById('role-select').value;
  const newGroup = document.getElementById('group-select').value;

  if (!userId) { showToast("Select a user first"); return; }

  try {
    const { error } = await window._mpdb.from('profiles').update({
      role: newRole,
      group_tag: newGroup || null
    }).eq('id', userId);

    if (error) throw error;

    showToast("User permissions updated ✓");
    renderUsersTable(); // Refresh the table to show the change
  } catch(e) {
    showToast("Failed to update user");
  }
}


async function saveUserPermissions() {
    if (!editingUserId) return;

    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ permissions: editingPerms }) // Saves the toggles you switched
            .eq('id', editingUserId);

        if (error) {
            alert("Save failed: " + error.message);
        } else {
            alert("Permissions updated successfully!");
            document.getElementById('user-permissions-modal').style.display = 'none';
            renderUsersTable(); // Refresh the table
        }
    } catch (e) {
        console.error(e);
    }
}
// ── CHAT ─────────────────────────────────────────────────────
let currentChannel='general',chatTagEquipId=null,chatTagTaskId=null,chatPhotoData=null,lastReadAt={};
const CHANNEL_DESCS={general:'General team chat',outside:'Outside crew channel',production:'Production team channel'};
(function(){try{lastReadAt=JSON.parse(localStorage.getItem('mp_chat_read')||'{}');}catch(e){}})();


async function renderChat() {
    console.log("Loading Chat...");
    await renderDmList();     // 1. Load the DM names
    enforceChatMobileLayout();
    updateUnreadBadge();      // 2. Check for red dots
    loadChatMessages(currentChannel); // 3. Load the actual messages
}

function populateChatTagSelects(){
  const esel=document.getElementById('tag-equip-select');const tsel=document.getElementById('tag-task-select');
  if(esel)esel.innerHTML='<option value="">+ Equipment</option>'+state.equipment.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  if(tsel)tsel.innerHTML='<option value="">+ Work Order</option>'+state.tasks.filter(t=>t.status!=='Completed').map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
}
function isMobileViewport(){return window.matchMedia('(max-width: 768px)').matches;}
function shouldStickChatToBottom(container){
  if(!container)return false;
  const threshold=80;
  return container.scrollHeight-container.scrollTop-container.clientHeight<=threshold;
}
async function loadChatMessages(channel) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // 1. SHOW LOCAL DATA INSTANTLY (The "No-Lag" Fix)
  // We look at the messages already in memory so the screen isn't blank
  const localMsgs = (state.chatMessages || [])
    .filter(m => m.channel === channel)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (localMsgs.length > 0) {
    // Show what we have right now
    renderChatMessages(localMsgs, container);
    container.scrollTop = container.scrollHeight;
  } else {
    // Only show "Loading" if we have absolutely zero data for this channel
    container.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px">Opening conversation...</div>';
  }

  // 2. FETCH LATEST FROM DATABASE (Background Sync)
  try {
    const { data, error } = await window._mpdb
      .from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    if (data) {
        // Update our master list with the fresh data from the server
        // This ensures if someone sent a message while you were offline, you get it now
        const otherChannels = state.chatMessages.filter(m => m.channel !== channel);
        state.chatMessages = [...otherChannels, ...data];

        // Final Render with the "Server Verified" data
        renderChatMessages(data, container);
        markChannelRead(channel);
        
        // Final Scroll to ensure we are at the bottom
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
  } catch (e) {
    console.error("Fetch error:", e);
    if (localMsgs.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Could not connect to chat server</div>';
    }
  }
}
      
function renderChatMessages(msgs,container){
  if(!msgs.length){container.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px 20px">No messages yet — say hello! 👋</div>';return;}
  let html='',lastDate='';
  msgs.forEach(msg=>{const msgDate=new Date(msg.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});if(msgDate!==lastDate){html+=`<div style="text-align:center;font-size:11px;color:var(--text3);padding:8px 0;display:flex;align-items:center;gap:8px"><div style="flex:1;height:1px;background:var(--border)"></div>${msgDate}<div style="flex:1;height:1px;background:var(--border)"></div></div>`;lastDate=msgDate;}html+=buildChatMsgHtml(msg);});
  container.innerHTML=html;
}

function chatKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage();}}
function refreshMobileChatChannelOptions(){
    const menu = document.getElementById('chat-channel-mobile-menu');
    if (!menu) return;
    const baseOptions = [
        { value: 'general', label: '# general' },
        { value: 'outside', label: '# outside' },
        { value: 'production', label: '# production' }
    ];
    const dmUsers = (state.users_list_cache || []).filter(u => u.username !== currentUser?.username);
    const dmOptions = dmUsers.map(u => ({
        value: 'dm-' + [currentUser.username, u.username].sort().join('-'),
        label: '@ ' + u.full_name
    }));
    const allOptions = [...baseOptions, ...dmOptions];
    menu.innerHTML = allOptions.map(opt => `<button type="button" class="chat-mobile-menu-item${opt.value===currentChannel?' active':''}" onclick="chooseMobileChatChannel('${opt.value}')">${opt.label}</button>`).join('');
    menu.querySelectorAll('.chat-mobile-menu-item').forEach(btn => {
        btn.style.width = '100%';
        btn.style.border = 'none';
        btn.style.background = 'transparent';
        btn.style.textAlign = 'left';
        btn.style.padding = '8px 10px';
        btn.style.borderRadius = '8px';
        btn.style.fontSize = '13px';
        btn.style.color = 'var(--text)';
        if (btn.classList.contains('active')) {
            btn.style.background = 'var(--accent-bg)';
            btn.style.color = 'var(--accent-text)';
            btn.style.fontWeight = '700';
        }
    });
    updateMobileChatMenuLabel(currentChannel, allOptions);
}
function updateMobileChatMenuLabel(channel, options){
    const label = document.getElementById('chat-channel-menu-label');
    if(!label) return;
    const knownOptions = options || [];
    const match = knownOptions.find(opt => opt.value === channel);
    if(match){ label.textContent = match.label; return; }
    if(channel && channel.startsWith('dm-')) label.textContent = '@  message';
    else label.textContent = '# general';
}
function toggleMobileChatMenu(event){
    if(event) event.stopPropagation();
    const menu = document.getElementById('chat-channel-mobile-menu');
    if(!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
}
function chooseMobileChatChannel(channel){
    if(!channel) return;
    const btn = document.querySelector(`#chat-sidebar .chat-channel-btn[data-channel="${channel}"]`) || document.getElementById(`btn-ch-${channel}`) || null;
    switchChannel(channel, btn);
    const menu = document.getElementById('chat-channel-mobile-menu');
    if(menu) menu.style.display = 'none';
}
function enableHorizontalDragScroll(el){
    if(!el || el.dataset.dragScrollBound === '1') return;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let dragging = false;
    el.addEventListener('touchstart', function(e){
        if(!e.touches || !e.touches[0]) return;
        dragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startScrollLeft = el.scrollLeft;
    }, { passive: true });
    el.addEventListener('touchmove', function(e){
        if(!dragging || !e.touches || !e.touches[0]) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        // Only intercept mostly-horizontal swipes.
        if(Math.abs(dx) > Math.abs(dy)){
            el.scrollLeft = startScrollLeft - dx;
            e.preventDefault();
        }
    }, { passive: false });
    el.addEventListener('touchend', function(){ dragging = false; }, { passive: true });
    el.addEventListener('touchcancel', function(){ dragging = false; }, { passive: true });
    el.dataset.dragScrollBound = '1';
}
function applyDesktopChatHeight(){
    if (window.matchMedia('(max-width: 768px)').matches) return;
    const layout = document.querySelector('#panel-chat .chat-layout');
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    const bottomGap = 14;
    const desired = Math.max(640, Math.floor(window.innerHeight - rect.top - bottomGap));
    layout.style.height = desired + 'px';
    layout.style.minHeight = desired + 'px';
}
function enforceChatMobileLayout(){
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const layout = document.querySelector('#panel-chat .chat-layout');
    const sidebar = document.getElementById('chat-sidebar');
    const mainChat = document.querySelector('#panel-chat .main-chat-window');
    const mobileMenuBtn = document.getElementById('chat-channel-menu-btn');
    const mobileMenu = document.getElementById('chat-channel-mobile-menu');
    const headerTitle = document.getElementById('chat-header-title');
    const mobileToggle = document.getElementById('chat-mobile-toggle');
    const topbar = document.querySelector('.topbar');
    const topbarRight = document.querySelector('.topbar-right');
    const mainNav = document.getElementById('main-nav');
    if(!layout || !sidebar || !mainChat) return;

    if(isMobile){
        layout.style.flexion = 'column';
        layout.style.height = 'calc(100vh - 210px)';
        layout.style.minHeight = 'calc(100vh - 210px)';
        layout.style.gap = '10px';
        sidebar.style.display = 'none';
        mainChat.style.width = '100%';
        mainChat.style.maxWidth = '100%';
        mainChat.style.minWidth = '0';
        if(mobileToggle) mobileToggle.style.display = 'none';
        if(mobileMenuBtn){
            mobileMenuBtn.style.display = 'inline-flex';
            mobileMenuBtn.style.alignItems = 'center';
            mobileMenuBtn.style.gap = '8px';
            mobileMenuBtn.style.marginLeft = '0';
            mobileMenuBtn.style.height = '34px';
            mobileMenuBtn.style.padding = '6px 12px';
            mobileMenuBtn.style.borderRadius = '999px';
            mobileMenuBtn.style.border = '1px solid rgba(255,255,255,0.3)';
            mobileMenuBtn.style.background = 'rgba(0,0,0,0.55)';
            mobileMenuBtn.style.color = '#fff';
            mobileMenuBtn.style.fontSize = '13px';
            mobileMenuBtn.style.fontWeight = '600';
        }
        if(mobileMenu){
            mobileMenu.style.position = 'absolute';
            mobileMenu.style.top = '42px';
            mobileMenu.style.left = '12px';
            mobileMenu.style.right = 'auto';
            mobileMenu.style.zIndex = '30';
            mobileMenu.style.minWidth = '180px';
            mobileMenu.style.maxWidth = '78vw';
            mobileMenu.style.background = '#fff';
            mobileMenu.style.border = '1px solid var(--border)';
            mobileMenu.style.borderRadius = '12px';
            mobileMenu.style.boxShadow = '0 10px 24px rgba(0,0,0,0.16)';
            mobileMenu.style.padding = '6px';
            mobileMenu.style.display = 'none';
        }
        if(topbar){
            topbar.style.overflowX = 'hidden';
        }
        if(topbarRight){
            topbarRight.style.overflowX = 'auto';
            topbarRight.style.webkitOverflowScrolling = 'touch';
            topbarRight.style.touchAction = 'pan-x';
            topbarRight.style.justifyContent = 'flex-start';
            topbarRight.style.flexWrap = 'nowrap';
            topbarRight.style.gap = '8px';
            topbarRight.style.width = '100%';
            topbarRight.style.padding = '0 12px 8px';
            enableHorizontalDragScroll(topbarRight);
        }
        if(mainNav){
            mainNav.style.overflowX = 'auto';
            mainNav.style.webkitOverflowScrolling = 'touch';
            mainNav.style.touchAction = 'pan-x';
            mainNav.style.whiteSpace = 'nowrap';
            mainNav.style.flexWrap = 'nowrap';
            mainNav.style.justifyContent = 'flex-start';
            mainNav.style.width = '100%';
            mainNav.style.padding = '0 12px 8px';
            enableHorizontalDragScroll(mainNav);
        }
        if(headerTitle) headerTitle.style.display = 'none';
    } else {
        layout.style.flexion = '';
        layout.style.height = '';
        layout.style.minHeight = '';
        layout.style.gap = '';
        sidebar.style.display = '';
        mainChat.style.width = '';
        mainChat.style.maxWidth = '';
        mainChat.style.minWidth = '';
        if(mobileToggle) mobileToggle.style.display = 'none';
        if(mobileMenuBtn) mobileMenuBtn.style.display = 'none';
        if(mobileMenu) mobileMenu.style.display = 'none';
        if(headerTitle) headerTitle.style.display = '';
        if(topbar){
            topbar.style.overflowX = '';
        }
        if(topbarRight){
            topbarRight.style.overflowX = '';
            topbarRight.style.webkitOverflowScrolling = '';
            topbarRight.style.touchAction = '';
            topbarRight.style.justifyContent = '';
            topbarRight.style.flexWrap = '';
            topbarRight.style.gap = '';
            topbarRight.style.width = '';
            topbarRight.style.padding = '';
        }
        if(mainNav){
            mainNav.style.overflowX = '';
            mainNav.style.webkitOverflowScrolling = '';
            mainNav.style.touchAction = '';
            mainNav.style.whiteSpace = '';
            mainNav.style.flexWrap = '';
            mainNav.style.justifyContent = '';
            mainNav.style.width = '';
            mainNav.style.padding = '';
        }
        applyDesktopChatHeight();
    }
}
window.addEventListener('resize', enforceChatMobileLayout);
document.addEventListener('click', function(event){
    const menu = document.getElementById('chat-channel-mobile-menu');
    const btn = document.getElementById('chat-channel-menu-btn');
    if(!menu || !btn) return;
    if(menu.contains(event.target) || btn.contains(event.target)) return;
    menu.style.display = 'none';
});
function switchChannel(channel, btn) {
    try {
        window.currentChannel = channel;
        
        // 1. CLEAR THE SCREEN INSTANTLY
        // This prevents 'Ghost Messages' from the previous channel showing up
        const container = document.getElementById('chat-messages');
        if (container) {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text3); font-size:12px;">Loading conversations...</div>';
        }

        // 2. Update button highlights (Desktop Sidebar)
        document.querySelectorAll('.chat-channel-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        // 3. Update the Header Title & Mobile Label
        const header = document.getElementById('chat-header-title');
        const mobileMenuLabel = document.getElementById('chat-channel-menu-label');
        
        let displayName = channel;

        if (channel.startsWith('dm-')) {
            // Find the other person's name for the header
            const parts = channel.replace('dm-', '').split('-');
            const otherUsername = parts.find(u => u !== currentUser.username);
            const otherUser = (state.users_list_cache || []).find(u => u.username === otherUsername);
            displayName = '@ ' + (otherUser ? (otherUser.full_name || otherUser.username) : 'User');
        } else {
            displayName = '# ' + channel;
        }

        if (header) header.textContent = displayName;
        if (mobileMenuLabel) mobileMenuLabel.textContent = displayName;

        // 4. Update the Mobile Toggle Button (The ☰ button)
        const mobileMenuBtn = document.getElementById('chat-channel-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.innerHTML = `<span style="font-size:15px;line-height:1">☰</span> ${displayName}`;
        }

        // 5. RUN THE DATA SYNC
        if (typeof loadChatMessages === 'function') {
            loadChatMessages(channel);
        }
        
        if (typeof markChannelRead === 'function') {
            markChannelRead(channel); // Clears the red unread dots
        }

        // 6. CLOSE SIDEBAR ON MOBILE
        // If the user clicks a channel on their phone, hide the menu automatically
        if (window.innerWidth <= 768 && typeof toggleChatSidebar === 'function') {
            // Only close if it's currently open
            const sidebar = document.getElementById('chat-sidebar');
            if (sidebar && sidebar.style.display === 'block') {
                toggleChatSidebar(); 
            }
        }

    } catch (e) { 
        console.error("Switch error:", e); 
    }
}

function tagEquip(id){if(!id)return;chatTagEquipId=id;const b=document.getElementById('chat-tag-bar');const n=document.getElementById('chat-tag-equip-name');const w=document.getElementById('chat-tag-equip');if(b)b.style.display='flex';if(n)n.textContent='🔧 '+equipName(id);if(w)w.style.display='inline-flex';document.getElementById('tag-equip-select').value='';}
function tagTask(id){if(!id)return;chatTagTaskId=id;const b=document.getElementById('chat-tag-bar');const n=document.getElementById('chat-tag-task-name');const w=document.getElementById('chat-tag-task');const t=state.tasks.find(x=>x.id===id);if(b)b.style.display='flex';if(n)n.textContent='📋 '+(t?.name||'Work Order');if(w)w.style.display='inline-flex';document.getElementById('tag-task-select').value='';}
function clearTag(type){if(type==='equip'){chatTagEquipId=null;const w=document.getElementById('chat-tag-equip');if(w)w.style.display='none';}if(type==='task'){chatTagTaskId=null;const w=document.getElementById('chat-tag-task');if(w)w.style.display='none';}if(!chatTagEquipId&&!chatTagTaskId){const b=document.getElementById('chat-tag-bar');if(b)b.style.display='none';}}
async function handleChatPhoto(input){const file=input.files[0];if(!file)return;const compressed=await compressImage(await new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);}),600,0.7);chatPhotoData=compressed;document.getElementById('chat-photo-preview').textContent='📎 Photo attached';input.value='';}
function markChannelRead(channel) {
    lastReadAt[channel] = new Date().toISOString();
    try {
        localStorage.setItem('mp_chat_read', JSON.stringify(lastReadAt));
    } catch(e) {}
    
    // Refresh the counts immediately
    updateUnreadBadge();
}
function updateUnreadBadge() {
    let totalUnread = 0;
    const channels = ['general', 'outside', 'production'];

    channels.forEach(ch => {
        const lastRead = lastReadAt[ch] ? new Date(lastReadAt[ch]) : new Date(0);
        const unreadCount = (state.chatMessages || []).filter(m => 
            m.channel === ch && 
            new Date(m.created_at) > lastRead && 
            m.author !== currentUser?.username
        ).length;
        
        totalUnread += unreadCount;

        // Force hide/show dots on Sidebar
        const dot = document.getElementById(`dot-ch-${ch}`) || document.getElementById(`dot-dm-${ch}`);
        if (dot) dot.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    });

    // Update Topbar Global Badge
    const topBadge = document.getElementById('chat-unread-top');
    if (topBadge) {
        topBadge.textContent = totalUnread;
        topBadge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    }
}


window.addEventListener('online',()=>{document.getElementById('offline-banner').style.display='none';const cb=document.getElementById('chat-offline-banner');if(cb)cb.style.display='none';setSyncStatus('online');if(document.getElementById('panel-chat')?.classList.contains('active'))renderChat();});
window.addEventListener('offline',()=>{document.getElementById('offline-banner').style.display='block';const cb=document.getElementById('chat-offline-banner');if(cb)cb.style.display='block';setSyncStatus('offline');});

// ── LAZY IMAGES ──────────────────────────────────────────────
const lazyObserver=new IntersectionObserver((entries)=>{entries.forEach(entry=>{if(entry.isIntersecting){const img=entry.target;const src=img.getAttribute('data-src');if(src){img.src=src;img.removeAttribute('data-src');lazyObserver.unobserve(img);}}});},{rootMargin:'100px'});
function initLazyImages(){document.querySelectorAll('img.lazy-img[data-src]').forEach(img=>lazyObserver.observe(img));}

// ── OVERRIDDEN renderDashboard ────────────────────────────────

async function renderDashboard(){
  console.log("Safe Render: Starting Dashboard...");
  try {
      updateMetrics();
      renderAlerts();
      await renderEquipListDash(); // Predictions
      renderRecentTasks();
      renderRecentObservations();
      renderSchedDash();
       updateDashboardParts();
  
  } catch (e) {
      console.error("Dashboard error:", e);
  }
}
// ── OVERRIDDEN renderAlerts ───────────────────────────────────
function renderAlerts(){
  const sec=document.getElementById('alert-section');if(!sec)return;
  const od=state.tasks.filter(t=>t.status!=='Completed'&&isOverdue(t.due));
  const lp=state.parts.filter(p=>p.qty<=p.reorder_qty&&p.reorder_qty>0);
  const exp=state.documents.filter(d=>d.expiry_date&&new Date(d.expiry_date)<=new Date(Date.now()+30*24*60*60*1000));
  const critObs=(state.observations||[]).filter(o=>o.severity==='critical');
  let h='';
  if(od.length)h+=`<div class="alert alert-d"><span class="dot"></span><b>${od.length} overdue:</b> ${od.map(t=>t.name).join(', ')}</div>`;
  if(lp.length)h+=`<div class="alert alert-w">⚠ <b>${lp.length} part${lp.length>1?'s':''} low/out of stock:</b> ${lp.map(p=>p.name).join(', ')}</div>`;
  if(exp.length)h+=`<div class="alert alert-w">📄 <b>${exp.length} document${exp.length>1?'s':''} expiring soon:</b> ${exp.map(d=>d.name).join(', ')}</div>`;
  if(critObs.length)h+=`<div class="alert alert-d">🚨 <b>${critObs.length} critical observation${critObs.length>1?'s':''}:</b> ${critObs.map(o=>equipName(o.equip_id)+' — '+o.body.slice(0,50)).join(' | ')}</div>`;
  sec.innerHTML=h;
}


async function enterApp() {
  console.log("Entering application...");
  
  // 1. Initial UI Setup & Session Persistence
  try { 
      localStorage.setItem('mp_session', JSON.stringify(currentUser)); 
  } catch(e) { console.error("Session save failed", e); }
  
  const authScreen = document.getElementById('auth-screen');
  const appContainer = document.getElementById('app');
  
  // HIDE LOGIN, SHOW APP (This reveals the Topbar since it's inside #app)
  if (authScreen) authScreen.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';

  // 2. Build the Navigation Bar (Alphabetized)
  const nav = document.getElementById('main-nav');
  if (nav) {
      nav.innerHTML = ''; 
      const buttons = [
        { id: 'analytics', label: 'Analytics' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'chat', label: 'Chat' },
        { id: 'checklists', label: 'Checklists' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'documents', label: 'Docs' },
        { id: 'equipment', label: 'Equipment' },
        { id: 'parts', label: 'Parts' },
        { id: 'suppliers', label: 'Suppliers' },
        { id: 'tools', label: 'Tool Crib' },
        { id: 'tasks', label: 'Work Orders' }
      ];

      buttons.sort((a, b) => a.label.localeCompare(b.label));

      buttons.forEach(btn => {
        if (btn.id === 'analytics' && typeof can === 'function' && !can('canViewReports')) return;
        if (btn.id === 'suppliers' && typeof can === 'function' && !can('canManageSuppliers')) return;

        const b = document.createElement('button');
        b.className = 'nav-btn';
        b.onclick = () => showPanel(btn.id);
        b.innerHTML = btn.id === 'chat' ? 
          `Chat <span id="chat-unread-top" class="badge bd" style="display:none">0</span>` : btn.label;
        nav.appendChild(b);
      });

      if (currentUser.role === 'admin') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-btn';
        adminBtn.onclick = () => showPanel('admin');
        adminBtn.textContent = 'Admin';
        nav.appendChild(adminBtn);
      }
  }

  // 3. Load Data & State
  await loadState(); 
  if (typeof fetchTools === 'function') await fetchTools();
  if (typeof runRecurrenceEngine === 'function') await runRecurrenceEngine();
  if (typeof applyUserGroupFilter === 'function') applyUserGroupFilter();
  
  // 4. APPLY PERSONALIZATION (Theme, Status, Name)
  if (typeof applyUserPreferences === 'function') {
      applyUserPreferences(); 
  }

  // 5. RE TO PREFERRED HOME PAGE
  const home = (currentUser.preferences && currentUser.preferences.startPage) 
                 ? currentUser.preferences.startPage 
                 : 'dashboard';
  
  showPanel(home); 

  // 6. Start Background Services
  if (typeof initChat === 'function') await initChat();
  if (typeof autoCleanupAuditLogs === 'function') autoCleanupAuditLogs();
  
  if (typeof updateLastSeen === 'function') {
      updateLastSeen();
      setInterval(updateLastSeen, 2 * 60 * 1000);
  }
  
  // 7. --- MOBILE LAYOUT NUDGE ---
  // This triggers your height detector to snap content under the topbar
  setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        console.log("Forced mobile layout refresh.");
  }, 100);

  console.log(`App ready. Welcome, ${currentUser.name}. Home: ${home}`);
}
// ── CHAT SIDEBAR MOBILE ──────────────────────────────────────
function toggleChatSidebar(){const s=document.getElementById('chat-sidebar');const o=document.getElementById('chat-sidebar-overlay');if(!s)return;const open=s.classList.contains('open');if(open){s.classList.remove('open');if(o)o.style.display='none';}else{s.classList.add('open');if(o)o.style.display='block';}}
function closeChatSidebarMobile(){if(window.innerWidth<=640){const s=document.getElementById('chat-sidebar');const o=document.getElementById('chat-sidebar-overlay');if(s)s.classList.remove('open');if(o)o.style.display='none';}}



// ──  MESSAGES ──────────────────────────────────────────
let activeDmUser=null;

// ── DELETE CHAT MESSAGE ──────────────────────────────────────
async function deleteChatMessage(msgId,channel,author){
  if(!confirm('Delete this message?')) return;
  try{
    const{data:msgs}=await window._mpdb.from('chat_messages').select('*').eq('id',msgId);
    const msg=msgs?.[0];
    if(msg){await window._mpdb.from('deleted_messages').insert({id:uid(),original_id:msgId,channel:msg.channel,author:msg.author,author_name:msg.author_name,body:msg.body,photo:msg.photo,deleted_by:currentUser.username,deleted_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString()});}
    await window._mpdb.from('chat_messages').delete().eq('id',msgId);
    state.chatMessages=state.chatMessages.filter(m=>m.id!==msgId);
    await loadChatMessages(currentChannel);
    showToast('Message deleted');
  }catch(e){showToast('Failed to delete');}
}

// ── ADMIN TAB SWITCHER ────────────────────────────────────────
function switchAdminTab(tab, btn) {
  // Hide all admin sub-panels
  ['admin-approvals', 'admin-users', 'admin-permissions', 'admin-deleted-msgs', 'admin-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Show the one you clicked
  const target = document.getElementById('admin-' + tab);
  if (target) target.style.display = 'block';

  // Highlight the tab button
  document.querySelectorAll('#panel-admin .tab').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  // --- TRIGGER DATA RELOADS ---
  if(tab === 'settings') renderAuditLogs();
    
    if (tab === 'users' || tab === 'permissions') {
    renderUsersTable(); // This fills the dropdown and the table
  }
  if (tab === 'permissions') {
    renderPermissionsMatrix();
  }
  if (tab === 'deleted-msgs') {
    renderDeletedMessages();
  }
  if (tab === 'settings') {
    renderAuditLogs();
  }
}
// ── RESET USER PASSWORD ───────────────────────────────────────
async function resetUserPassword(userId,userName){
  const newPass=prompt('Set a new password for '+userName+':');
  if(!newPass||newPass.trim().length<4){if(newPass!==null)showToast('Password must be at least 4 characters');return;}
  const confirm2=prompt('Confirm new password for '+userName+':');
  if(newPass!==confirm2){showToast('Passwords do not match');return;}
  try{const hashed=await hashPassword(newPass.trim());await window._mpdb.from('profiles').update({password_hash:hashed}).eq('id',userId);showToast(userName+' password reset ✓');}catch(e){showToast('Failed');}
}

// ── PARTS CATALOG ─────────────────────────────────────────────
const PARTS_CATALOG_URLS={'cat':'https://parts.cat.com','caterpillar':'https://parts.cat.com','komatsu':'https://parts.komatsu.com','deere':'https://parts.deere.com','john deere':'https://parts.deere.com','kubota':'https://www.kubotausa.com/parts-and-service','volvo':'https://www.volvoce.com/united-states/en-us/services/parts/','bobcat':'https://www.bobcat.com/en/parts-and-service/parts','case':'https://www.caseparts.com','jcb':'https://parts.jcb.com'};
function getPartsCatalogUrl(name,type,mfr){const text=((mfr||'')+' '+name+' '+(type||'')).toLowerCase();for(const[brand,url]of Object.entries(PARTS_CATALOG_URLS)){if(text.includes(brand))return url;}return 'https://www.google.com/search?q='+encodeURIComponent((mfr||name)+' parts catalog');}
function openPartsCatalog(equipId){if(window.innerWidth<768){showToast('Parts catalog is only available on desktop');return;}const e=state.equipment.find(x=>x.id===equipId);if(!e)return;window.open(getPartsCatalogUrl(e.name,e.type,e.manufacturer),'_blank');}

// ── BUG REPORT ────────────────────────────────────────────────

function printTemplate(id){const tpl=state.checklistTemplates.find(t=>t.id===id);if(!tpl)return;const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${tpl.name}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px;max-width:700px}h1{font-size:18px;margin:0 0 4px}.meta{font-size:11px;color:#888;margin-bottom:20px}.item{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #eee}.checkbox{width:20px;height:20px;border:2px solid #333;border-radius:3px;flex-shrink:0;margin-top:1px}.num{width:20px;font-size:11px;color:#888;text-align:right;flex-shrink:0;margin-top:2px}.label{flex:1;font-size:13px;line-height:1.4}.notes{margin-top:6px;border:1px solid #ddd;border-radius:3px;min-height:30px}.footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#aaa}.sign-row{display:flex;gap:24px;margin-top:24px}.sign-field{flex:1;border-bottom:1px solid #333;padding-bottom:4px;font-size:11px;color:#888}@media print{.no-print{display:none}}</style></head><body><h1>⚙ ${tpl.name}</h1><div class="meta">${tpl.model?'Model: '+tpl.model+' · ':''}${tpl.type?'Type: '+tpl.type+' · ':''}${tpl.items.length} items · MTL Maintenance</div><div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px"><div>Equipment: <span style="border-bottom:1px solid #333;display:inline-block;width:180px">&nbsp;</span></div><div>Date: <span style="border-bottom:1px solid #333;display:inline-block;width:120px">&nbsp;</span></div><div>Technician: <span style="border-bottom:1px solid #333;display:inline-block;width:140px">&nbsp;</span></div></div>${tpl.items.map((item,i)=>`<div class="item"><div class="num">${i+1}</div><div class="checkbox"></div><div class="label">${item}<div class="notes"></div></div></div>`).join('')}<div class="sign-row"><div class="sign-field">Technician signature: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div><div class="sign-field">Supervisor signature: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div></div><div class="footer"><div>MTL Maintenance — ${tpl.name}</div><div>Printed ${date}</div></div><div class="no-print" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:10px 28px;font-size:14px;cursor:pointer">🖨 Print / Save PDF</button></div><script>window.onload=()=>setTimeout(()=>window.print(),600)<\/script></body></html>`;const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}else showToast('Allow popups to print');}

// ── PERMANENT DELETE MESSAGE ──────────────────────────────────
async function permanentDeleteMessage(deletedId) {
  if(!confirm('Permanently delete this message? This cannot be undone.')) return;
  try {
    await window._mpdb.from('deleted_messages').delete().eq('id', deletedId);
    showToast('Message permanently deleted');
    renderDeletedMessages();
  } catch(e) {
    showToast('Failed to delete');
  }
}

// ── AUTO-CREATE WO FROM CRITICAL OBSERVATION ─────────────────
async function autoCreateCriticalWO(obs, equipId) {
  const equip = state.equipment.find(e=>e.id===equipId);
  const today = new Date();
  const due = new Date(today.getTime() + 24*60*60*1000); // Due tomorrow
  const wo = {
    id: uid(),
    name: '🚨 Critical — ' + (equip?.name||'Equipment') + ': ' + obs.body.slice(0,60),
    equipId: equipId,
    type: 'Repair',
    priority: 'High',
    status: 'Open',
    due: due.toISOString().split('T')[0],
    assign: '',
    cost: 0,
    notes: 'Auto-created from critical obs by '+obs.author+': '+obs.body.slice(0,100),
    obs_id: obs.id,
    checklist: '',
    photos: [],
    email_freq: 1,
    created_at: new Date().toISOString(),
  };
  try {
    await persist('tasks', 'upsert', wo);
    state.tasks.push(wo);
    showToast('🚨 Critical WO created — due tomorrow');
    renderTasks && renderTasks();
    renderDashboard();
  } catch(e) {
    console.error('Failed to auto-create WO:', e);
  }
}

// ── WO COST CALCULATOR ───────────────────────────────────────

function updateTotalCostDisplay() {
  const costEl = document.getElementById('t-cost');
  const partsCost = woPartsAdded.reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0);
  const otherEl = document.getElementById('t-other-cost');
  const partsEl = document.getElementById('t-parts-cost');
  const totalEl = document.getElementById('t-total-cost');
  const breakdown = document.getElementById('t-cost-breakdown');

  const total = parseFloat(costEl?.value) || 0;
  const otherCost = Math.max(0, total - partsCost);

  if(breakdown) breakdown.style.display = partsCost > 0 ? 'block' : 'none';
  if(partsEl) partsEl.textContent = '$' + partsCost.toFixed(2);
  if(otherEl) otherEl.textContent = '$' + otherCost.toFixed(2);
  if(totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

// ── EDIT OBSERVATION ─────────────────────────────────────────



async function saveEditObservation(obsId, equipId) {
  const body = document.getElementById('edit-obs-body')?.value.trim();
  const severity = document.getElementById('edit-obs-severity')?.value;
  if(!body) { showToast('Please enter an observation'); return; }

  const obs = state.observations.find(o=>o.id===obsId);
  if(!obs) return;

  const wasCritical = obs.severity === 'critical';
  const nowCritical = severity === 'critical';

  obs.body = body;
  obs.severity = severity;

  try {
    await window._mpdb.from('observations').update({body, severity}).eq('id', obsId);
    showToast('Observation updated ✓');
    document.getElementById('edit-obs-modal-temp')?.remove();
    refreshObsList(equipId);
    renderAlerts();
    if(document.getElementById('recent-obs-list')) renderRecentObservations();

    // Only send email if severity just changed TO critical
    if(nowCritical && !wasCritical) {
      await sendCriticalObsEmail(obs, equipId);
      await autoCreateCriticalWO(obs, equipId);
      showToast('🚨 Critical — email sent and WO created');
    }
  } catch(e) {
    showToast('Failed to update');
  }
}

async function sendCriticalObsEmail(obs, equipId) {
  const equip = state.equipment.find(e=>e.id===equipId);
  try {
    emailjs.init('n5n6_xxmNNHqk0xrE');
    await emailjs.send('service_o320zzu','template_je3rl4j',{
      to_email:'tannergalloway75@gmail.com',
      message:'🚨 CRITICAL OBSERVATION\n\nEquipment: '+(equip?.name||'Unknown')+'\nBy: '+obs.author+'\n\n'+obs.body+'\n\nhttps://mtlmaintenance.github.io/mtl-maintenance'
    });
  } catch(e) { console.log('Email failed:', e); }
}

// ── INVOICES ─────────────────────────────────────────────────
function openAddInvoice() {
  _invoicePhotoData = null;
  _currentInvoiceEquipId = window._currentDetailEquipId;

  // Reset form
  ['inv-supplier','inv-number','inv-date','inv-amount','inv-notes'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });

  // Helper function to safely hide elements
  const hide = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
    else console.warn(`Element with ID "${id}" was not found in the DOM.`);
  };

  hide('invoice-scanning');
  hide('invoice-extracted-badge');
  hide('inv-clear-photo-wrap');

  const previewArea = document.getElementById('invoice-photo-preview-area');
  if (previewArea) {
    previewArea.innerHTML = `
      <div style="font-size:32px;margin-bottom:8px">📄</div>
      <div style="font-size:13px;font-weight:500;color:var(--text)">Drop invoice photo here or click to upload</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">The app will automatically read the invoice details</div>`;
  }

  openModal('invoice-modal');
}



function handleInvoiceDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if(!file || !file.type.startsWith('image/')) return;
  const input = document.getElementById('invoice-photo-input');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  handleInvoicePhoto(input);
}


// ── UNLOCK USER ───────────────────────────────────────────────
async function unlockUser(userId, userName) {
  try {
    await window._mpdb.from('profiles').update({ login_attempts: 0, locked_until: null }).eq('id', userId);
    showToast(userName + ' unlocked ✓');
    renderUsersTable();
  } catch(e) { showToast('Failed to unlock'); }
}

// ── INVOICE PHOTO VIEWER ─────────────────────────────────────
async function viewInvoicePhoto(photoPath) {
  try {
    const { data } = await window._mpdb.storage
      .from('invoices')
      .createSignedUrl(photoPath, 300); // 5 minute signed URL
    if(data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      showToast('Could not load photo');
    }
  } catch(e) {
    showToast('Could not load photo');
  }
}

// ── DELETE INVOICE PHOTO FROM STORAGE ────────────────────────
async function deleteInvoicePhotoFromStorage(photoPath) {
  if(!photoPath) return;
  try {
    await window._mpdb.storage.from('invoices').remove([photoPath]);
  } catch(e) {
    console.log('Photo delete error:', e);
  }
}

// Override deleteInvoice to also remove photo from storage
const _baseDeleteInvoice = deleteInvoice;
async function deleteInvoice(invoiceId, equipId) {
  if(!confirm('Delete this invoice?')) return;
  try {
    // Get photo path first
    const { data: inv } = await window._mpdb.from('invoices').select('photo').eq('id', invoiceId).single();
    if(inv?.photo) await deleteInvoicePhotoFromStorage(inv.photo);
    await window._mpdb.from('invoices').delete().eq('id', invoiceId);
    showToast('Invoice deleted');
    renderInvoicesList(equipId);
  } catch(e) {
    showToast('Failed to delete');
  }
}

// ── GEMINI KEY MANAGEMENT ─────────────────────────────────────
async function saveGeminiKey() {
  const keyInput = document.getElementById('gemini-key-input');
  const key = keyInput?.value.trim();
  
  if(!key || key.startsWith('•')) { 
      showToast('Enter a valid API key'); 
      return; 
  }

  // 1. Save to active memory
  window._geminiKey = key;

  // 2. Save to LocalStorage (Instant)
  localStorage.setItem('mp_gemini_key', key);

  // 3. Save to Supabase (Permanent across all devices)
  try {
    const { error } = await window._mpdb
      .from('profiles')
      .update({ gemini_key: key })
      .eq('id', currentUser.id);

    if (error) throw error;
    
    document.getElementById('gemini-key-status').textContent = '✅ Gemini key synced to cloud';
    keyInput.value = '••••••••••••••••';
    showToast('Gemini API key saved & synced ✓');
  } catch(e) {
    console.error("Cloud sync failed:", e);
    showToast('Saved locally, but cloud sync failed.');
  }
}

// ── AI TOOL SUGGESTIONS ───────────────────────────────────────
let _lastToolSuggestion = '';

async function suggestTools() {
  if(!window._geminiKey) {
    showToast('Set your Gemini API key in Admin → Settings first');
    return;
  }
  const woName = document.getElementById('t-name')?.value.trim();
  const equipId = document.getElementById('t-equip')?.value;
  if(!woName) { showToast('Enter a work order name first'); return; }

  const btn = document.getElementById('suggest-tools-btn');
  if(btn) { btn.textContent = '⏳ Thinking...'; btn.disabled = true; }

  try {
    // Get relevant past work orders for context
    const equip = state.equipment.find(e=>e.id===equipId);
    const pastWOs = state.tasks
      .filter(t=>t.status==='Completed' && t.tools && (
        (equipId && t.equipId===equipId) ||
        t.name.toLowerCase().split(' ').some(w=>w.length>3&&woName.toLowerCase().includes(w))
      ))
      .slice(0,10)
      .map(t=>`Job: "${t.name}" on ${equipName(t.equipId)} — Tools: ${t.tools}`).join('\n');

    const prompt = `You are a heavy equipment maintenance expert. Based on the work order history below, suggest the tools needed for this new job.

Equipment: ${equip?.name || 'Unknown'} (${equip?.type || ''})
New work order: "${woName}"

Past similar work orders:
${pastWOs || 'No relevant history yet - suggest based on job name and equipment type'}

Respond with ONLY a comma-separated list of tools needed. Be specific and concise. Example: "3/4 socket set, torque wrench 150 ft-lbs, hydraulic pressure gauge, drain pan, shop rags"`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + window._geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.3 }
      })
    });

    const data = await response.json();
    const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if(suggestion) {
      _lastToolSuggestion = suggestion;
      document.getElementById('tools-suggestion-text').textContent = suggestion;
      document.getElementById('tools-suggestion-area').style.display = 'block';
    } else {
      showToast('No suggestion available — fill in manually');
    }
  } catch(e) {
    console.error('Tool suggestion error:', e);
    showToast('AI suggestion failed — fill in manually');
  } finally {
    if(btn) { btn.textContent = '✨ AI Suggest'; btn.disabled = false; }
  }
}

function acceptToolSuggestion() {
  const toolsField = document.getElementById('t-tools');
  if(toolsField && _lastToolSuggestion) {
    toolsField.value = _lastToolSuggestion;
  }
  document.getElementById('tools-suggestion-area').style.display = 'none';
}

async function toggleToolStatus(id) {
  const t = state.tools.find(x => x.id === id);
  if (t.status === 'In Shop') {
    t.status = 'Checked Out';
    t.checked_out_by = currentUser.name;
  } else {
    t.status = 'In Shop';
    t.checked_out_by = null;
  }
  t.last_updated = new Date().toISOString();
  await persist('shop_tools', 'upsert', t);
  renderTools();
}  
function switchToolTab(tab) {
    console.log("Switching Tool Tab to:", tab);
    
    const inventory = document.getElementById('tool-inventory-view');
    const wishlist = document.getElementById('tool-wishlist-view');
    const denied = document.getElementById('tool-denied-view');

    if (inventory) inventory.style.display = tab === 'inventory' ? 'block' : 'none';
    if (wishlist) wishlist.style.display = tab === 'wishlist' ? 'block' : 'none';
    if (denied) denied.style.display = tab === 'denied' ? 'block' : 'none';

    document.querySelectorAll('#panel-tools .tab').forEach(b => b.classList.remove('active'));
    
    let btnId = 'tool-inv-tab';
    if (tab === 'wishlist') btnId = 'tool-wish-tab';
    if (tab === 'denied') btnId = 'tool-denied-tab';
    
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');

    // THE FIX: Specifically trigger the correct render function for the tab
    if (tab === 'inventory') renderTools();
    if (tab === 'wishlist') renderToolWishlist();
    if (tab === 'denied') renderToolDeniedHistory(); // <--- This was missing!
}
function renderTools() {
    const tableBody = document.getElementById('tools-table-body');
    if (!tableBody) return;

    // THE FIX: Show 'available' items AND 'ordered' items in this list
    const tools = (window.state.tools || []).filter(t => t.status === 'available' || t.status === 'ordered');
    
    if (tools.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">No tools in inventory.</td></tr>';
        return;
    }

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

    tableBody.innerHTML = tools.map(t => {
        const name = t.tool_name || t.name || 'Unnamed';
        const health = t.health || 100;
        const status = t.status || 'available';
        const location = t.location || '—';
        const isOrdered = status === 'ordered';

        // Add a "Check In" button for managers if the tool is currently on order
        let actionBtn = '';
        if (isOrdered && isAdmin) {
            actionBtn = `<button class="btn btn-primary btn-sm" 
                         style="background:#28a745 !important; border:none; padding:4px 8px; font-size:10px; margin-left:10px;" 
                         onclick="event.stopPropagation(); window.receiveOrderedTool('${t.id}')">📦 Check In</button>`;
        }

        return `
            <tr onclick="editTool('${t.id}')" style="cursor:pointer; ${isOrdered ? 'opacity:0.8; background:rgba(0,123,255,0.02);' : ''}">
                <td><b>${name}</b> ${actionBtn}</td>
                <td>${t.category || 'Other'}</td>
                <td><span style="${isOrdered ? 'color:#007bff; font-weight:600;' : ''}">${isOrdered ? '📦 ON ORDER' : location}</span></td>
                <td>
                    ${isOrdered ? '—' : `
                    <div style="width:60px; height:8px; background:#eee; border-radius:4px; overflow:hidden;">
                        <div style="width:${health}%; height:100%; background:${health > 40 ? '#28a745' : '#dc3545'};"></div>
                    </div>`}
                </td>
                <td><span class="badge ${isOrdered ? 'bi' : (t.is_lost ? 'bd' : 'bs')}">${status.toUpperCase()}</span></td>
                <td>${isOrdered ? `<span style="font-size:11px; color:#007bff">Due: ${t.expected_arrival || '??'}</span>` : (t.procurement || '—')}</td>
            </tr>`;
    }).join('');
}


function renderWishlist() {
    const container = document.getElementById('wishlist-container');
    const pending = state.wishlist.filter(w => w.status === 'pending');
    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';

    container.innerHTML = pending.map(w => `
        <div class="card" style="border-left: 5px solid var(--warning)">
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                    <div style="font-weight:700; font-size:15px">${w.tool_name}</div>
                    <!-- ONLY MANAGERS SEE THE NAME -->
                    <div style="font-size:11px; color:var(--text3); margin-top:2px">
                        ${isManager ? `Requested by <b>${w.requested_by}</b>` : `Status: Pending Review`}
                    </div>
                </div>
                <span class="badge bw">PENDING</span>
            </div>
            <div style="margin-top:10px; font-size:13px; color:var(--text2); background:var(--bg2); padding:8px 10px; border-radius:4px">
                <b>Reason Needed:</b> ${w.request_reason || 'No reason provided.'}
            </div>
            ${isManager ? `
                <div style="margin-top:12px; display:flex; gap:8px">
                    <button class="btn btn-success btn-sm" onclick="handleWishApproval('${w.id}')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="handleWishDenial('${w.id}')">Deny</button>
                </div>
            ` : ''}
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No pending suggestions.</div>';
    updateWishCount();
}
function renderDeniedList() {
    const container = document.getElementById('denied-container');
    const denied = state.wishlist.filter(w => w.status === 'denied');
    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';
    
    container.innerHTML = denied.map(w => `
        <div class="card" style="border-left: 5px solid var(--danger); opacity: 0.9">
            <div style="display:flex; justify-content:space-between">
                <div>
                    <div style="font-weight:700; font-size:15px">${w.tool_name}</div>
                    <div style="font-size:11px; color:var(--text3)">
                        Denied on: ${new Date(w.created_at).toLocaleDateString()} 
                        ${isManager ? ` · Requested by: ${w.requested_by}` : ''}
                    </div>
                </div>
                <span class="badge bd">DENIED</span>
            </div>
            <div style="margin-top:10px; font-size:12px; color:var(--danger-text); background:var(--danger-bg); padding:8px 10px; border-radius:4px">
                <b>Denial Reason:</b> ${w.denial_reason || 'Not specified.'}
            </div>
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No denied tools in history.</div>';
}


function updateWishCount() {
    const count = state.wishlist.filter(w => w.status === 'pending').length;
    const badge = document.getElementById('wish-count');
    if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }
}

async function notifyManagers(text) {
    const { data: m } = await window._mpdb.from('profiles').select('username').in('role', ['admin', 'manager']);
    for (const u of m) { if (u.username !== currentUser.username) await sendDMToUsername(u.username, text); }
}

async function sendDM(fullName, text) {
    const { data: p } = await window._mpdb.from('profiles').select('username').eq('full_name', fullName).single();
    if (p) await sendDMToUsername(p.username, text);
}

async function sendDMToUsername(username, text) {
    const ch = 'dm-' + [currentUser.username, username].sort().join('-');
    await window._mpdb.from('chat_messages').insert({ id: uid(), channel: ch, author: 'System', author_name: 'Tool Monitor', body: text, created_at: new Date().toISOString() });
}

function renderEquipTimeline(equipId) {
  const container = document.getElementById('eq-timeline-content');
  if(!container) return;

  // Gather Work Orders
  const tasks = state.tasks.filter(t => t.equipId === equipId).map(t => ({ 
      date: t.due, 
      title: t.name, 
      body: t.notes, 
      type: 'WO', 
      status: t.status 
  }));
  
  // Gather Observations
  const obs = (state.observations || []).filter(o => o.equip_id === equipId).map(o => ({ 
      date: o.created_at, 
      title: o.severity.toUpperCase() + ' Obs', 
      body: o.body, 
      type: 'OBS', 
      author: o.author,
      photo: o.photo
  }));
  
  // Combine and Sort (Newest at top)
  const timeline = [...tasks, ...obs].sort((a,b) => new Date(b.date) - new Date(a.date));

  if (!timeline.length) {
    container.innerHTML = '<div style="color:var(--text3); font-size:13px; padding:20px 0">No history found for this machine.</div>';
    return;
  }

  container.innerHTML = timeline.map(item => `
    <div style="position:relative; padding-left:24px; margin-bottom:20px; border-left:2px solid var(--border)">
      <!-- The Timeline Dot -->
      <div style="position:absolute; left:-7px; top:0; width:12px; height:12px; border-radius:50%; background:${item.type === 'WO' ? 'var(--accent)' : 'var(--warning)'}; border:2px solid var(--bg)"></div>
      
      <div style="font-size:11px; color:var(--text3); font-weight:600">${fmtDate(item.date)}</div>
      <div style="font-weight:600; font-size:14px; margin:2px 0">${item.title} ${item.status ? `<span class="badge bg" style="font-size:10px">${item.status}</span>` : ''}</div>
      <div style="font-size:13px; color:var(--text2); line-height:1.4">${item.body || ''}</div>
      
      ${item.photo ? `<img src="${item.photo}" style="width:100px; height:100px; object-fit:cover; border-radius:4px; margin-top:8px; border:1px solid var(--border); cursor:pointer" onclick="viewPhoto('${item.photo}')"/>` : ''}
      
      ${item.author ? `<div style="font-size:11px; color:var(--text3); margin-top:4px">Logged by ${item.author}</div>` : ''}
    </div>
  `).join('');
}

// Switches between Details and Observations inside the tool popup
function switchToolModalTab(tab) {
    const details = document.getElementById('tool-tab-details');
    const obs = document.getElementById('tool-tab-obs');
    
    if (tab === 'details') {
        details.style.display = 'block';
        obs.style.display = 'none';
    } else {
        details.style.display = 'none';
        // We use flex for the notes tab so the list stays on top and input stays on bottom
        obs.style.display = 'flex'; 
        if (typeof renderToolObsList === 'function') renderToolObsList();
    }

    // Highlighting the buttons
    document.getElementById('btn-tool-details')?.classList.toggle('active', tab === 'details');
    document.getElementById('btn-tool-obs')?.classList.toggle('active', tab === 'observations');
}


function resetToolForm() {
    console.log("Resetting Tool Form Safely...");
    
    // 1. Reset the Title so it doesn't say "Edit" when adding a new tool
    const titleEl = document.getElementById('tool-modal-title');
    if (titleEl) titleEl.textContent = 'Add New Tool';

    // 2. THE FIX: Hide the delete button when adding new
    const deleteBtn = document.getElementById('tool-delete-btn');
    if (deleteBtn) deleteBtn.style.display = 'none'; 

    // 3. List of IDs based on your HTML
    const fieldIds = [
        'tool-edit-id', // Clears the hidden ID
        'tool-name', 
        'tool-cat',     // Matches HTML
        'tool-loc',     // Matches HTML
        'tool-health'   // Matches HTML
    ];

    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'tool-health') ? '100' : ''; 
    });

    // Reset health text
    const condVal = document.getElementById('cond-val');
    if (condVal) condVal.textContent = '100%';

    // Reset checkbox
    const lostCheck = document.getElementById('tool-lost');
    if (lostCheck) lostCheck.checked = false;
}
  async function editTool(id) {
    console.log("--- Edit Tool Request ---");
    console.log("Looking for ID:", id);

    // 1. Try to find the tool in local memory first
    // We check both 'state.tools' and 'window.state.tools' for safety
    const localList = (window.state && window.state.tools) ? window.state.tools : (typeof state !== 'undefined' ? state.tools : []);
    let tool = localList.find(x => x.id === id);

    // 2. THE FIX: If not found in memory, fetch directly from Supabase
    if (!tool) {
        console.warn("Tool not found in memory. Fetching from database...");
        const { data, error } = await window._mpdb
            .from('tool_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (data) {
            tool = data;
        } else {
            alert("Error: This tool no longer exists in the database.");
            return;
        }
    }

    // 3. Open the Modal and reset UI
    openModal('tool-modal');
    if (typeof switchToolModalTab === 'function') switchToolModalTab('details');

    // 4. Fill the hidden ID field (This is vital for saving)
    const idInput = document.getElementById('tool-edit-id');
    if (idInput) idInput.value = tool.id;

    // 5. Populate Form Fields
    document.getElementById('tool-modal-title').textContent = 'Edit: ' + (tool.tool_name || tool.name);
    document.getElementById('tool-name').value = tool.tool_name || tool.name || '';
    document.getElementById('tool-cat').value = tool.category || 'Other';
    document.getElementById('tool-loc').value = tool.location || '';
    document.getElementById('tool-health').value = tool.health || 100;
    document.getElementById('cond-val').textContent = (tool.health || 100) + '%';
    document.getElementById('tool-lost').checked = !!tool.is_lost;

    // 6. Show the Delete Button
    const delBtn = document.getElementById('tool-delete-btn');
    if (delBtn) delBtn.style.display = 'block';

    console.log("✅ Edit form loaded for:", tool.tool_name || tool.name);
}



async function handleWishApproval(id) {
    const req = state.wishlist.find(x => x.id === id);
    if (!req) return;

    // 1. Mark wish as approved
    req.status = 'approved';
    await window._mpdb.from('tool_requests').update({status: 'approved'}).eq('id', id);

    // 2. Create the tool in Inventory as "On Order"
    const newTool = {
        id: uid(),
        name: req.tool_name,
        category: 'Other',
        location: '📦 ON ORDER', // This marks it as not here yet
        health: 100,
        is_lost: false,
        last_updated: new Date().toISOString()
    };
    
    state.tools.push(newTool);
    await window._mpdb.from('shop_tools').insert(newTool);

    await notifyManagers(`✅ Tool Approved & Ordered: "${req.tool_name}" (Requested by ${req.requested_by})`);
    
    showToast("Approved! Tool added to Inventory as 'On Order'");
     logAuditAction("Wishlist Approval", `Approved and Ordered: ${req.tool_name}`);
  switchToolTab('inventory');
}

async function handleWishDenial(id) {
    const reason = prompt("Why is this tool being denied? (This will be shown to the crew)");
    if (reason === null) return;

    const req = state.wishlist.find(x => x.id === id);
    req.status = 'denied';
    req.denial_reason = reason;

    await window._mpdb.from('tool_requests').update({status: 'denied', denial_reason: reason}).eq('id', id);
    
    await sendDM(req.requested_by, `❌ Your tool request for "${req.tool_name}" was denied. Reason: ${reason}`);
    
    showToast("Request denied and moved to history");
       logAuditAction("Wishlist Denial", `Denied "${req.tool_name}". Reason: ${reason}`);
  renderWishlist();
}

async function promptWishlistCheck() {
    const toolName = prompt("Enter the name of the tool you are suggesting:");
    if (!toolName || toolName.trim() === "") return;
    const category = prompt("What category? (e.g. Power Tool, Diagnostic, Hand Tool)", "Power Tool");
    // THE FIX: We send both 'name' and 'tool_name' to ensure it satisfies Supabase
    const newRequest = {
        id: uid(),
        name: toolName.trim(),        // Column 1
        tool_name: toolName.trim(),   // Column 2 (Matching previous fix)
        category: category || 'Other',
        status: 'requested',          // This marks it as a Wishlist item
        requested_by: currentUser.full_name || currentUser.username,
        created_at: new Date().toISOString()
    };
    try {
        console.log("Submitting suggestion:", newRequest);
        const { error } = await window._mpdb
            .from('tool_requests')
            .insert([newRequest]);
        if (error) {
            console.error("Supabase Suggestion Error:", error.message);
            alert("Could not submit suggestion: " + error.message);
            return;
        }
        showToast("Suggestion submitted ✓");
        // REFRESH DATA: Reload the tools into memory
        if (typeof fetchTools === 'function') {
            await fetchTools(); 
        }
        // REFRESH UI: If you are looking at the Wishlist, redraw it
        if (typeof renderToolWishlist === 'function') {
            renderToolWishlist();
        }
    } catch (e) {
        console.error("Critical error in suggestion:", e);
    }
}
    
function syncAdminRoleSelects() {
    const userId = document.getElementById('role-user-select').value;
    if (!userId) return;

    // Find the user's data in our local state
    // Note: We check profiles in loadState, so we need to ensure they are accessible
    // Let's fetch the specific user from the state we loaded in renderUsersTable
    const { data: profile } = state.users_list_cache ? { data: state.users_list_cache.find(u => u.id === userId) } : { data: null };

    if (profile) {
        // Set the Role dropdown to match the user
        document.getElementById('role-select').value = profile.role || 'tech';
        
        // Set the Group dropdown to match the user
        document.getElementById('group-select').value = profile.group_tag || '';
        
        console.log(`Syncing UI for ${profile.username}: Role=${profile.role}, Group=${profile.group_tag}`);
    }
}
async function renderAdminPanel(){
  try {
    const { data: profiles } = await window._mpdb.from('profiles').select('*').order('created_at',{ascending:false});
    if (!profiles) return;
    
    const pending = profiles.filter(p => p.status === 'pending');
    const active = profiles.filter(p => p.status === 'approved');
    document.getElementById('pending-count').textContent = pending.length || '0';
    document.getElementById('pending-list').innerHTML = pending.map(p => `
      <div class="parts-row">
        <div style="flex:1"><b>${p.full_name}</b> (${p.username})</div>
        <button class="btn btn-success btn-sm" onclick="approveUser('${p.id}')">Approve</button>
      </div>`).join('') || 'No pending requests';

    // Call user table render to fill the rest
    renderUsersTable();
  } catch(e){ console.error(e); }
}


function handleChatInput(el) {
    // 1. Auto-resize textarea
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';

    const val = el.value;
    const cursor = el.selectionStart;
    const lastAt = val.lastIndexOf('@', cursor - 1);

    // 2. Check if user is typing a mention
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
        const query = val.substring(lastAt + 1, cursor).toLowerCase();
        
        // Fetch users from our existing cache or profiles
        const users = (state.users_list_cache || []).filter(u => 
            u.full_name.toLowerCase().includes(query) || 
            u.username.toLowerCase().includes(query)
        );

        if (users.length > 0) {
            showMentionDropdown(users, lastAt);
        } else {
            hideMentionDropdown();
        }
    } else {
        hideMentionDropdown();
    }
}

function showMentionDropdown(users, atPos) {
    const dd = document.getElementById('mention-dropdown');
    if (!dd) return;
    
    dd.innerHTML = users.map(u => `
        <div class="mention-item" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border); font-size:13px" onclick="insertMention('${u.username}', ${atPos})">
            <b>${u.full_name}</b> <span style="font-size:11px; color:var(--text3)">@${u.username}</span>
        </div>
    `).join('');
    dd.style.display = 'block';
}

function hideMentionDropdown() {
    const dd = document.getElementById('mention-dropdown');
    if (dd) dd.style.display = 'none';
}

function insertMention(username, atPos) {
    const input = document.getElementById('chat-input');
    const val = input.value;
    const before = val.substring(0, atPos);
    const after = val.substring(input.selectionStart);
    
    input.value = before + '@' + username + ' ' + after;
    hideMentionDropdown();
    input.focus();
}

function showZerkInfo(event, zerkId) {
    event.stopPropagation(); // Prevents adding a new dot when clicking an existing one
     window.activeZerkId = zerkId; 
    // Find the specific dot data
    const z = allMachineZerks.find(x => x.id === zerkId);
    if(!z) return;

    const box = document.getElementById('zerk-detail-box');
    if(!box) return;
    
    // Fill the text
    document.getElementById('zerk-label').textContent = z.label;
    document.getElementById('zerk-instr').textContent = z.instructions || "No special instructions.";
    
    // Setup the Delete button
    const delBtn = document.getElementById('zerk-delete-btn');
    if(delBtn) {
        // Only show delete button for Admins/Managers
        delBtn.style.display = (currentUser.role === 'admin' || currentUser.role === 'manager') ? 'block' : 'none';
        
        // This connects the button to the function we just added
        delBtn.onclick = () => deleteZerk(z.id);
    }
    
    box.style.display = 'block';
}
async function addZerkViewWithTitle() {
    const equip = state.equipment.find(x => x.id === window._currentDetailEquipId);
    if (!equip) return;

    // 1. Ask for the Name first
    const viewName = prompt("Name this view (e.g. Front Loader, Boom, Right Side):");
    if (!viewName) return; // User cancelled

    // 2. Create hidden file input to pick the image
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageData = event.target.result;

            // 3. Initialize arrays if they don't exist
            if (!equip.zerk_photos) equip.zerk_photos = [];
            if (!equip.zerk_names) equip.zerk_names = [];

            // 4. Save data
            equip.zerk_photos.push(imageData);
            equip.zerk_names.push(viewName);

            // 5. Persist to Supabase/Database
            await persist('equipment', 'upsert', equip);

            // 6. UI Update
            // Set the new view as the active one
            window._currentZerkViewIdx = equip.zerk_photos.length - 1;
            
            // Refresh the switcher and the map
            renderZerkTab(equip.id); 
            showToast("View Added ✓");
        };
        reader.readAsDataURL(file);
    };
    input.click();
}


function renderZerkDots() {
    const equip = state.equipment.find(x => x.id === window._currentDetailEquipId);
    const viewIdx = window._currentZerkViewIdx || 0;
    const overlay = document.getElementById('zerk-dots-overlay');
    const sidebar = document.getElementById('zerk-sidebar-container');

    // Filter points belonging ONLY to this specific photo
    const points = (equip.zerk_points || []).filter(p => p.view_index === viewIdx);

    // Draw the Numbers on the Image
    if (overlay) {
        overlay.innerHTML = points.map((p, idx) => `
            <div class="zerk-dot" style="left:${p.x}%; top:${p.y}%" onclick="event.stopPropagation(); editZerkNote(${idx})">
                ${idx + 1}
            </div>
        `).join('');
    }

    // Draw the Instruction Table on the Right
    if (sidebar) {
        sidebar.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                <h4 style="margin:0; font-size:14px;">Grease Points</h4>
                <button class="btn btn-danger btn-sm" onclick="deleteZerkView()">Delete View</button>
            </div>
            <table class="zerk-sidebar-table">
                <thead><tr><th style="width:40px">#</th><th>Instructions</th></tr></thead>
                <tbody>
                    ${points.map((p, idx) => `
                        <tr onclick="editZerkNote(${idx})">
                            <td style="color:#ffec00; font-weight:bold">#${idx + 1}</td>
                            <td>${p.note || '<span style="opacity:0.4">No instructions</span>'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="2" style="text-align:center; padding:20px; opacity:0.5">Click map to add points</td></tr>'}
                </tbody>
            </table>
        `;
    }
}
function renderZerkTab(equipId) {
    const equip = state.equipment.find(x => x.id === equipId);
    const switcher = document.getElementById('zerk-view-switcher');
    const container = document.getElementById('tab-content-zerk');
    const modal = document.getElementById('equip-detail-modal');
    const histBtn = document.getElementById('btn-history-report');

    if (!equip || !container) return;

    const viewIdx = window._currentZerkViewIdx || 0;
    const currentMode = window.zerkPinMode || 'dot';
    const showAllLines = window.showZerkLines || false;
    const isMobile = window.innerWidth <= 768; // Detection for the floating card

    if (modal) modal.classList.add('modal-zerk-wide');
    if (histBtn) histBtn.style.display = 'none';

    if (!equip.zerk_photos || equip.zerk_photos.length === 0) {
        if (modal) modal.classList.remove('modal-zerk-wide');
        if (histBtn) histBtn.style.display = 'block';
        if (switcher) switcher.innerHTML = `<button class="btn btn-primary" onclick="addZerkViewWithTitle()">+ Add Photo Map</button>`;
        container.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text3); border:2px dashed var(--border); border-radius:12px; margin-top:15px">No photo maps added.</div>`;
        return;
     if (tabWrapper && tabWrapper.style.display === 'none') return;
    }

    const viewButtonsHtml = equip.zerk_photos.map((_, i) => {
        const name = (equip.zerk_names && equip.zerk_names[i]) ? equip.zerk_names[i] : `View ${i + 1}`;
        return `<button class="btn ${viewIdx === i ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window._currentZerkViewIdx=${i}; renderZerkTab('${equipId}')" ondblclick="renameZerkView(${i})">${name}</button>`;
    }).join('');

    switcher.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; border-bottom:1px solid #ddd; padding-bottom:15px; margin-bottom:15px">
        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;">
            ${viewButtonsHtml}
            <button class="btn btn-secondary btn-sm" onclick="addZerkViewWithTitle()">+</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="font-size:11px; color:#666; display:flex; align-items:center; cursor:pointer">
                <input type="checkbox" style="margin-right:5px" ${showAllLines ? 'checked' : ''} onchange="window.showZerkLines=this.checked; renderZerkTab('${equipId}')"> Show Lines
            </label>
            <div style="display:flex; gap:5px">
                <button class="btn ${currentMode === 'dot' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.zerkPinMode='dot'; renderZerkTab('${equipId}')">Point</button>
                <button class="btn ${currentMode === 'line' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.zerkPinMode='line'; renderZerkTab('${equipId}')">Line</button>
            </div>
        </div>
    </div>`;

    const currentPhoto = equip.zerk_photos[viewIdx];
    const points = (equip.zerk_points || []).filter(p => p.view_index === viewIdx);

  

container.innerHTML = `
<div class="zerk-main-layout">
    <div id="zerk-map-container" style="position:relative; background:#000; border-radius:8px; overflow:hidden" onclick="handleZerkMapClick(event, ${viewIdx})">
        <img id="zerk-map-img" src="${currentPhoto}" style="width:100%; display:block; opacity:0.9">
        
        <svg id="zerk-svg-layer" ...> <!-- your existing svg logic --> </svg>

        <!-- THE DOTS -->
        <div id="zerk-dots-overlay" style="position:absolute; inset:0; z-index:100">
            ${points.map((p, idx) => {
                const posX = (p.lx !== null) ? p.lx : p.x;
                const posY = (p.ly !== null) ? p.ly : p.y;
                
              
                const action = isMobile ? `showMobileZerkCard('${p.id}', ${idx+1})` : `editZerkNote('${p.id}')`;
                
                return `
                    <div id="dot-${p.id}" class="zerk-dot" style="left:${posX}%; top:${posY}%" 
                         onclick="event.stopPropagation(); ${action}">
                        ${idx + 1}
                    </div>`;
            }).join('')}
        </div>

        <!-- THE FLOATING CARD (Inject this into the map container) -->
        <div id="mobile-zerk-info-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px">
                <b id="m-card-title" style="color:var(--accent); font-size:14px">Point #1</b>
                <button onclick="event.stopPropagation(); closeMobileZerkCard()" style="background:none; border:none; font-size:24px; color:#999; cursor:pointer; line-height:1">×</button>
            </div>
            <div id="m-card-note" style="font-size:13px; color:#333; margin-bottom:15px; line-height:1.4"></div>
            <div style="display:flex; gap:8px">
                <button class="btn btn-secondary btn-sm" style="flex:1; padding:8px" id="m-card-edit-btn">Edit</button>
                <button class="btn btn-danger btn-sm" id="m-card-del-btn" style="padding:8px 15px">🗑</button>
            </div>
        </div>
    </div>

        <!-- RIGHT: THE SIDEBAR (CSS hides this on mobile automatically) -->
        <div id="zerk-sidebar-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <h4 style="margin:0; font-size:14px; color:#333">Grease Points</h4>
                <button class="btn btn-outline-danger btn-sm" style="font-size:10px" onclick="deleteZerkView()">Delete View</button>
            </div>
            <div style="flex:1; overflow-y:auto">
                <table class="zerk-sidebar-table">
                    <thead><tr><th style="width:40px">#</th><th>Instructions</th><th style="width:30px"></th></tr></thead>
                    <tbody>
                        ${points.map((p, idx) => `
                            <tr onmouseenter="highlightZerkLink('${p.id}', true)" onmouseleave="highlightZerkLink('${p.id}', false)">
                                <td><div class="zerk-num-list">${idx + 1}</div></td>
                                <td style="font-weight:500; color:black !important" onclick="editZerkNote('${p.id}')">${p.note || '<span style="color:#aaa">Add instructions...</span>'}</td>
                                <td style="text-align:right">
                                    <button onclick="window.deleteZerk('${p.id}')" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:16px;">🗑</button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="3" style="text-align:center; padding:30px; color:#999">Click map to add points</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}
function highlightZerk(id, shouldHighlight) {
    const line = document.getElementById(`line-${id}`);
    const dot = document.querySelector(`.zerk-dot[data-id="${id}"]`); // Add data-id to your dots
    
    if (line) {
        if (shouldHighlight) {
            line.classList.add('highlight');
            line.style.opacity = "1";
        } else {
            line.classList.remove('highlight');
            line.style.opacity = window.showZerkLines ? "0.3" : "0";
        }
    }
}
window.highlightZerk = highlightZerk;


function renderDashboardObs(equipId) {
    const container = document.getElementById('eq-obs-list-dash');
    if(!container) return;
    const obs = state.observations.filter(o => o.equip_id === equipId).slice(0, 3);
    container.innerHTML = obs.map(o => `
        <div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
            <div style="color:var(--text3); font-size:10px">${o.author} · ${fmtDate(o.created_at)}</div>
            <div>${o.body.slice(0, 50)}${o.body.length > 50 ? '...' : ''}</div>
        </div>
    `).join('') || '<div style="color:var(--text3); font-size:11px">No notes</div>';
}
    
   
async function addQuickSpec(equipId) {
    // 1. Find the machine in our local list
    const e = state.equipment.find(x => x.id === equipId);
    if(!e) return;

    // 2. Ask for the info
    const key = prompt("Spec Name (e.g. Engine Oil, Front Tire PSI)");
    if (!key) return;
    const val = prompt(`Value for ${key} (e.g. 15 qts, 35 PSI)`);
    if (!val) return;

    // 3. Update the LOCAL data immediately so the redraw sees it
    if (!e.custom_fields) e.custom_fields = {};
    e.custom_fields[key] = val;

    // 4. DRAW IT NOW (Before even talking to the database)
    renderQuickSpecs(equipId);

    // 5. Save to the database in the background
    try {
        await persist('equipment', 'upsert', e);
        showToast("Spec saved ✓");
        
        if(typeof logAuditAction === 'function') {
            logAuditAction("Added Spec", `${e.name}: ${key}=${val}`);
        }
    } catch(err) {
        console.error(err);
        showToast("Sync failed - will retry later");
    }
}

async function deleteQuickSpec(equipId, key) {
    if (!confirm(`Are you sure you want to delete the spec "${key}"?`)) return;

    const e = state.equipment.find(x => x.id === equipId);
    if (!e || !e.custom_fields) return;

    // 1. Remove the key from the local object
    delete e.custom_fields[key];

    // 2. Instant UI Refresh
    renderQuickSpecs(equipId);

    // 3. Save to Database
    try {
        await persist('equipment', 'upsert', e);
        showToast("Spec deleted");
        
        if(typeof logAuditAction === 'function') {
            logAuditAction("Deleted Spec", `${e.name}: removed ${key}`);
        }
    } catch(err) {
        console.error(err);
        showToast("Error saving changes");
    }
}
function setZerkMode(mode) {
    zerkPinMode = mode;
    zerkDrawingStep = 1; // Reset steps
    document.getElementById('mode-dot')?.classList.toggle('active', mode === 'dot');
    document.getElementById('mode-line')?.classList.toggle('active', mode === 'line');
    renderZerkDots(); // Clear any temp dots
}
// 1. Define the actual function so the app stops crashing
function setCalEntryType(type) {
    console.log("Setting Calendar Entry Type:", type);
    
    // 2. Update the UI buttons (One-time vs Recurring)
    const btnOne = document.getElementById('cal-type-one');
    const btnRecur = document.getElementById('cal-type-recur');
    
    if (btnOne) btnOne.classList.toggle('active', type === 'one-time');
    if (btnRecur) btnRecur.classList.toggle('active', type === 'recurring');

    // 3. Handle showing/hiding the recurrence fields in your modal
    const recurFields = document.getElementById('cal-recur-fields');
    if (recurFields) {
        recurFields.style.display = (type === 'recurring') ? 'block' : 'none';
    }
}

// Keep this helper for backwards compatibility if other parts of your code use it
function updateCalEntryTypeButtons(type) {
    setCalEntryType(type);
}
   

   
    
function openDocModal(docId = null) {
  _currentDocEditId = docId;
  _tempFileData = null;
  
  // 1. Populate the "Linked Equipment" dropdown
  const equipSelect = document.getElementById('d-equip');
  equipSelect.innerHTML = '<option value="">— None —</option>' + 
    state.equipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

  // 2. Clear form
  document.getElementById('d-name').value = '';
  document.getElementById('d-expiry').value = '';
  document.getElementById('d-notes').value = '';
  document.getElementById('doc-file-preview').innerText = '';

  if (docId) {
    // EDIT MODE: Fill data
    const doc = state.documents.find(d => d.id === docId);
    document.getElementById('d-name').value = doc.name;
    document.getElementById('d-type').value = doc.type;
    document.getElementById('d-equip').value = doc.equip_id;
    document.getElementById('d-expiry').value = doc.expiry;
    document.getElementById('d-notes').value = doc.notes;
  } else if (window._currentDetailEquipId) {
    // NEW DOC from Equipment Tab: Auto-select current machine
    document.getElementById('d-equip').value = window._currentDetailEquipId;
  }

  openModal('doc-modal');
}

function openAddDocModal() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,image/*,.doc,.docx';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const newDoc = {
                id: 'doc-' + Date.now(),
                equip_id: window._currentDetailEquipId,
                name: file.name,
                type: file.type || 'Unknown',
                file_data: event.target.result,
                date_added: new Date().toISOString()
            };

            state.documents.push(newDoc);
            renderDocsList(window._currentDetailEquipId);
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}


function toggleRecurFields() {
    const type = document.getElementById('ce-recur-type').value;
    document.getElementById('ce-recur-val-wrap').style.display = type === 'calendar' ? 'block' : 'none';
    document.getElementById('ce-recur-hrs-wrap').style.display = type === 'hours' ? 'block' : 'none';
}

function resetCalModal() {
    setCalEntryType('one-time');
    document.getElementById('ce-name').value = '';
    document.getElementById('ce-notes').value = '';
    document.getElementById('ce-date').value = new Date().toISOString().split('T')[0];
    
    // Fill dropdowns
    const equipSelect = document.getElementById('ce-equip');
    const userSelect = document.getElementById('ce-assign');
    if(equipSelect) equipSelect.innerHTML = (state.equipment || []).map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if(userSelect) userSelect.innerHTML = '<option value="">— Unassigned —</option>' + (state.users_list_cache || []).map(u => `<option value="${u.full_name}">${u.full_name}</option>`).join('');
}

async function saveCalendarEntry() {
    const name = document.getElementById('ce-name').value.trim();
    if(!name) return;

    const equipId = document.getElementById('ce-equip').value;
    const date = document.getElementById('ce-date').value;

    try {
        if (currentCalEntryType === 'one-time') {
            const record = {
                id: uid(),
                name: name,
                equip_id: equipId,
                due: date,
                status: 'Open',
                priority: 'Medium',
                meter: '0',
                created_at: new Date().toISOString()
            };

            const { error } = await window._mpdb.from('tasks').insert(record);
            if (error) throw error;

            state.tasks.push({ ...record, equipId: record.equip_id });
        } else {
            // Recurring logic
            const record = {
                id: uid(),
                name: name,
                equip_id: equipId,
                active: true,
                next_due: date,
                interval_unit: document.getElementById('ce-unit').value,
                interval_value: parseInt(document.getElementById('ce-interval').value) || 1,
            };
            await window._mpdb.from('recurrence_rules').insert(record);
            state.recurrenceRules.push(record);
        }

        closeModal('calendar-entry-modal');
        updateMetrics(); 
        renderCalendar();
        renderTasks();
        renderDashboard();
        showToast("Added successfully ✓");

    } catch (err) {
        console.error("Calendar save error:", err);
        showToast("Failed to add entry");
    }
}
 function editTemplate(id) {
    const tpl = state.checklistTemplates.find(t => t.id === id);
    if(!tpl) return;

    // 1. Fill the modal
    document.getElementById('tpl-modal-title').textContent = "Edit Template";
    document.getElementById('tpl-edit-id').value = tpl.id;
    document.getElementById('tpl-name').value = tpl.name;
    document.getElementById('tpl-model').value = tpl.model || '';
    document.getElementById('tpl-type').value = tpl.type || '';
    document.getElementById('tpl-items').value = tpl.items.join('\n');

    openModal('tpl-modal');
}

    async function setManualLink(equipId) {
    const url = prompt("Enter the URL for this machine's parts manual or manufacturer catalog:");
    if (!url) return;

    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;
    
    e.manual_url = url;
    try {
        await persist('equipment', 'upsert', e);
        openEquipDetail(equipId); // Refresh the card to show the new button
        showToast("Catalog link saved ✓");
    } catch(err) {
        showToast("Failed to save link");
    }
}

// Specialists: Cost by Equipment
function renderCostByEquip() {
    const el = document.getElementById('cost-by-equip');
    if(!el) return;
    const ec = state.equipment.map(e => {
        const c = state.tasks.filter(t => t.equipId === e.id).reduce((a, t) => a + (t.cost || 0), 0);
        return { name: e.name.split(' ').slice(0, 2).join(' '), cost: c };
    }).filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 6);
    const mc = Math.max(...ec.map(x => x.cost), 1);
    el.innerHTML = ec.map(x => `
        <div class="stat-row"><div style="width:100px; font-size:12px; color:var(--text2)">${x.name}</div>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(x.cost/mc*100)}%; background:var(--accent)"></div></div>
        <div style="width:60px; text-align:right; font-weight:600">$${x.cost.toLocaleString()}</div></div>`
    ).join('');
}

let markupCanvas, markupCtx, isDrawing = false;
let currentMarkupSource = { key: '', index: -1 };

function initMarkup(imgSrc, key, index) {
    currentMarkupSource = { key, index };
    const modal = document.getElementById('markup-modal');
    markupCanvas = document.getElementById('markup-canvas');
    markupCtx = markupCanvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
        // Set canvas size to match image
        markupCanvas.width = img.width;
        markupCanvas.height = img.height;
        markupCtx.drawImage(img, 0, 0);
        
        // Set drawing style
        markupCtx.strokeStyle = "#ff0000"; // Bright Red
        markupCtx.lineWidth = Math.max(img.width / 100, 5); // Scale line with image size
        markupCtx.lineCap = "round";
        
        openModal('markup-modal');
        setupCanvasListeners();
    };
    img.src = imgSrc;
}

function setupCanvasListeners() {
    const getPos = (e) => {
        const rect = markupCanvas.getBoundingClientRect();
        const scaleX = markupCanvas.width / rect.width;
        const scaleY = markupCanvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const start = (e) => { isDrawing = true; const pos = getPos(e); markupCtx.beginPath(); markupCtx.moveTo(pos.x, pos.y); };
    const move = (e) => { if (!isDrawing) return; e.preventDefault(); const pos = getPos(e); markupCtx.lineTo(pos.x, pos.y); markupCtx.stroke(); };
    const end = () => { isDrawing = false; };

    markupCanvas.onmousedown = start; markupCanvas.onmousemove = move; window.onmouseup = end;
    markupCanvas.ontouchstart = start; markupCanvas.ontouchmove = move; markupCanvas.ontouchend = end;
}

function clearMarkup() {
    const img = new Image();
    img.onload = () => markupCtx.drawImage(img, 0, 0);
    img.src = pendingPhotos[currentMarkupSource.key][currentMarkupSource.index];
}

function saveMarkup() {
    const editedData = markupCanvas.toDataURL('image/jpeg', 0.8);
    pendingPhotos[currentMarkupSource.key][currentMarkupSource.index] = editedData;
    refreshPhotoGrid(currentMarkupSource.key);
    closeMarkupModal();
}

function closeMarkupModal() {
    closeModal('markup-modal');
    isDrawing = false;
}




function switchCalendarView(view) {
    currentCalendarView = view;
    
    // Toggle Visibility
    document.getElementById('cal-grid-container').style.display = view === 'grid' ? 'block' : 'none';
    document.getElementById('cal-list-container').style.display = view === 'list' ? 'block' : 'none';
    
    // Toggle Button Styles
    document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
    
    // Refresh the data
    if(view === 'grid') renderCalendar(); else renderSchedule();
}

// Ensure the old renderSchedule function points to the new IDs
function renderSchedule(){
  const nw = new Date(TODAY); nw.setDate(nw.getDate() + 7);
  const n30 = new Date(TODAY); n30.setDate(n30.getDate() + 30);
  const sorted = [...state.schedules].sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const mk = s => {
    const d = new Date(s.date);
    return `
    <div class="sched-item">
      <!-- Left: Blue Date Badge -->
      <div class="sched-date">
        <div class="sched-day">${d.getDate()}</div>
        <div class="sched-month">${MONTHS[d.getMonth()].slice(0,3)}</div>
      </div>
      
      <!-- Middle: Task Info -->
      <div class="sched-body">
        <div class="sched-title">${s.name}</div>
        <div class="sched-detail">
            ${equipName(s.equipId)} · <span style="font-weight:600; color:#555;">${s.tech||'Unassigned'}</span>
        </div>
      </div>
      
      <!-- Right: Subtle Delete Icon -->
      <button class="btn-delete-sched" title="Delete" onclick="deleteSched('${s.id}')">×</button>
    </div>`;
  };

  // Render lists or show 'empty' message
  const weekHTML = sorted.filter(s => new Date(s.date) >= TODAY && new Date(s.date) <= nw).map(mk).join('');
  const monthHTML = sorted.filter(s => new Date(s.date) >= TODAY && new Date(s.date) <= n30).map(mk).join('');

  document.getElementById('sched-week').innerHTML = weekHTML || '<div style="color:#aaa; padding:10px; font-style:italic;">Nothing this week</div>';
  document.getElementById('sched-next30').innerHTML = monthHTML || '<div style="color:#aaa; padding:10px; font-style:italic;">Nothing in 30 days</div>';
}
function openUserPermissions(userId) {
    console.log("Opening permissions for User ID:", userId);

    // 1. Find the Permissions Panel and Show it
    // Note: We search for the panel and manually force it to show
    const permPanel = document.getElementById('admin-permissions');
    if (permPanel) {
        // First, hide all other panels so they don't overlap
        document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
        
        // Show the permissions panel
        permPanel.style.display = 'block';
        permPanel.classList.add('active');
    } else {
        console.error("Could not find element 'admin-permissions'");
        return;
    }

    // 2. Select the user in the dropdown
    const userDropdown = document.getElementById('role-user-select');
    if (userDropdown) {
        userDropdown.value = userId;
        // Trigger the sync function so the role/group boxes update to match the user
        if (typeof syncAdminRoleSelects === 'function') {
            syncAdminRoleSelects();
        }
    }
}

async function receiveTool() {
    const id = document.getElementById('tool-edit-id').value;
    if(!id) return;

    try {
        showToast("Checking in tool...");
        const { error } = await window._mpdb
            .from('tool_requests')
            .update({ 
                status: 'available', 
                location: 'Main Tool Crib', // Set a default location
                health: 100,
                last_updated: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        // Update local state
        const idx = state.tools.findIndex(t => t.id === id);
        if(idx > -1) {
            state.tools[idx].status = 'available';
            state.tools[idx].health = 100;
        }

        closeModal('tool-modal');
        renderTools();
        showToast("Tool is now in inventory! ✓");
    } catch (e) {
        console.error(e);
        showToast("Update failed");
    }
}

async function fetchAllProfiles() {
    try {
        const { data, error } = await window._mpdb
            .from('profiles')
            .select('id, username, full_name, preferences');
        
        if (error) throw error;
        state.profiles = data || [];
        console.log(`Successfully loaded ${state.profiles.length} team profiles.`);

 
        window._mpdb.channel('global-profile-updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
                const updatedUser = payload.new;
                const idx = state.profiles.findIndex(u => u.id === updatedUser.id);
                if (idx !== -1) {
                    state.profiles[idx] = updatedUser;
                    
                    if (document.getElementById('panel-chat')?.classList.contains('active')) {
                        
                        renderChat(); 
                    }
                }
            }).subscribe();

    } catch (e) {
        console.error("Error loading team profiles:", e);
    }
}

function updateDashboardParts() {
    const bigNumber = document.getElementById('dash-low-parts');
    const listContainer = document.getElementById('dash-low-parts-list');
    
    if (!bigNumber || !listContainer) return;

    // 1. Filter for parts that are below reorder point
    const lowParts = (state.parts || []).filter(p => {
        const qty = parseInt(p.qty) || 0;
        const reorder = parseInt(p.reorder) || 0;
        return qty <= reorder;
    });

    // 2. Update the Big Number
    bigNumber.textContent = lowParts.length;
    bigNumber.style.color = lowParts.length > 0 ? '#d9480f' : 'inherit';

    // 3. Build the List
    if (lowParts.length === 0) {
        listContainer.innerHTML = '<div style="color: #aaa; font-style: italic;">All stock OK</div>';
        return;
    }

    listContainer.innerHTML = lowParts.map(p => {
        const isOut = (parseInt(p.qty) || 0) === 0;
        return `
            <div style="margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                • ${p.name}: 
                <b style="color: ${isOut ? '#dc3545' : '#fd7e14'}">
                    ${isOut ? 'OUT' : p.qty + ' left'}
                </b>
            </div>
        `;
    }).join('');
}
// 1. Initialize memory for consumables
if (typeof state !== 'undefined' && !state.consumables) {
    state.consumables = [];
}

// 2. Tab Switcher
function switchPartsSubTab(tab) {
    const invView = document.getElementById('parts-inventory-view');
    const consView = document.getElementById('parts-consumables-view');
    const partBtn = document.getElementById('add-part-btn');
    const consBtn = document.getElementById('add-consumable-btn');

    if (tab === 'inventory') {
        invView.style.display = 'block';
        consView.style.display = 'none';
        partBtn.style.display = 'block';
        consBtn.style.display = 'none';
        renderParts();
    } else {
        invView.style.display = 'none';
        consView.style.display = 'block';
        partBtn.style.display = 'none';
        consBtn.style.display = 'block';
        fetchConsumables(); // Load data when clicking the tab
    }

    // Update button highlighting
    document.getElementById('btn-parts-inv').classList.toggle('active', tab === 'inventory');
    document.getElementById('btn-parts-cons').classList.toggle('active', tab === 'consumables');
}

// 3. Fetch Data
async function fetchConsumables() {
    try {
        const { data, error } = await window._mpdb.from('consumables').select('*').order('name');
        if (data) {
            state.consumables = data;
            renderConsumables();
        }
    } catch (e) { console.error(e); }
}

// 1. OPEN THE MODAL (For New Items)
window.openAddConsumable = function() {
    console.log("🚀 Opening Consumable Modal for new entry...");
    
    // Set Title and clear Hidden ID
    if (document.getElementById('c-modal-title')) document.getElementById('c-modal-title').textContent = "Add Shop Supply";
    if (document.getElementById('c-edit-id')) document.getElementById('c-edit-id').value = "";
    if (document.getElementById('btn-delete-consumable')) document.getElementById('btn-delete-consumable').style.display = "none";
    
    // Reset all fields to empty/zero
    const fields = ['c-name', 'c-num', 'c-cost', 'c-qty', 'c-reorder'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = (id.includes('qty') || id.includes('reorder')) ? '0' : '';
    });
    
    // Fill suppliers (Specifically for the Consumable dropdown)
    // If your function supports passing an ID, use it here
    if (typeof populateSupplierDropdown === 'function') {
        populateSupplierDropdown(); 
    }
    
    openModal('consumable-modal');
};

// 2. OPEN MODAL FOR EDITING
window.editConsumable = function(id) {
    console.log("🛠️ Opening Edit for Consumable ID:", id);

    // 1. Find the item data FIRST
    const item = state.consumables.find(c => c.id === id);
    if (!item) {
        console.error("Item not found in memory.");
        return;
    }

    // 2. Open the Modal UI
    if (typeof openModal === 'function') openModal('consumable-modal');

    // 3. Force the Delete button to show
    const delBtn = document.getElementById('btn-delete-consumable');
    if (delBtn) {
        delBtn.style.setProperty('display', 'block', 'important');
    }

    // 4. Fill the IDs and Labels
    if (document.getElementById('c-modal-title')) {
        document.getElementById('c-modal-title').textContent = "Edit Item: " + (item.name || "Unnamed");
    }
    if (document.getElementById('c-edit-id')) {
        document.getElementById('c-edit-id').value = item.id;
    }

    // 5. Fill all input fields
    if (document.getElementById('c-name')) document.getElementById('c-name').value = item.name || "";
    if (document.getElementById('c-num')) document.getElementById('c-num').value = item.num || "";
    if (document.getElementById('c-cost')) document.getElementById('c-cost').value = item.cost || 0;
    if (document.getElementById('c-qty')) document.getElementById('c-qty').value = item.qty || 0;
    if (document.getElementById('c-reorder')) document.getElementById('c-reorder').value = item.reorder || 0;
    if (document.getElementById('c-supplier-select')) document.getElementById('c-supplier-select').value = item.supplier_id || "";

    console.log("✅ Consumable form populated successfully.");
};
// 3. SAVE TO SUPABASE
async function saveConsumable() {
    const editId = document.getElementById('c-edit-id').value;
    const name = document.getElementById('c-name').value.trim();
    if(!name) return alert("Please enter a name");

    const record = {
        id: (editId && editId !== "") ? editId : uid(),
        name: name,
        num: document.getElementById('c-num').value,
        supplier_id: document.getElementById('c-supplier-select').value || null,
        qty: parseInt(document.getElementById('c-qty').value) || 0,
        reorder: parseInt(document.getElementById('c-reorder').value) || 0,
        cost: parseFloat(document.getElementById('c-cost').value) || 0,
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await window._mpdb.from('consumables').upsert([record]);
        if (error) throw error;
        
        await fetchConsumables(); 
        closeModal('consumable-modal');
        showToast("Consumable saved ✓");
    } catch(e) {
        alert("Save failed: " + e.message);
    }
}
window.deleteConsumable = async function(id) {
    // 1. Identify which ID to delete
    // If an ID wasn't passed (clicked from modal), grab it from the hidden input
    const targetId = id || document.getElementById('c-edit-id').value;
    
    if (!targetId) {
        console.error("Delete failed: No ID found.");
        return;
    }

    // 2. Find the name for the confirmation box
    const item = state.consumables.find(c => c.id === targetId);
    const itemName = item ? item.name : "this item";

    if (!confirm(`Are you sure you want to permanently delete "${itemName}"?`)) return;

    try {
        // 3. Delete from Supabase
        const { error } = await window._mpdb
            .from('consumables')
            .delete()
            .eq('id', targetId);

        if (error) throw error;

        // 4. Update local memory
        state.consumables = state.consumables.filter(c => c.id !== targetId);

        // 5. Success - Refresh UI
        closeModal('consumable-modal');
        renderConsumables();
        showToast("Item removed ✓");

    } catch (e) {
        console.error("Delete error:", e);
        alert("Delete failed: " + e.message);
    }
};
// 1. Updated Wishlist Renderer
function renderToolWishlist() {
    const tableBody = document.getElementById('wishlist-table-body');
    if (!tableBody) return;

    const wishlist = (window.state.tools || []).filter(t => t.status === 'requested' || t.status === 'ordered');

    tableBody.innerHTML = wishlist.length ? wishlist.map(t => {
        const statusLabel = t.status === 'ordered' 
            ? '<span class="badge bi">📦 ON ORDER</span>' 
            : '<span class="badge" style="background:#eee; color:#666;">Requested</span>';

        return `
            <tr onclick="openWishDetailCard('${t.id}')" style="cursor:pointer;">
                <td><b>${t.tool_name}</b></td>
                <td>${t.category || 'Other'}</td>
                <td>${t.requested_by}</td>
                <td>${statusLabel}</td>
            </tr>`;
    }).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#888;">No pending requests.</td></tr>';
}
async function reviewWishlist(id) {
    const tool = state.tools.find(t => t.id === id);
    if (!tool) return;

    const reason = tool.request_reason || tool.notes || "No reason provided.";
    
    // Simple Manager Review
    const action = confirm(`Tool: ${tool.tool_name}\nRequested by: ${tool.requested_by}\n\nReason: "${reason}"\n\nClick OK to Approve (move to Inventory) or Cancel to leave it on the Wishlist.`);

    if (action) {
        // MOVE TO INVENTORY
        showToast("Moving to Inventory...");
        const { error } = await window._mpdb
            .from('tool_requests')
            .update({ 
                status: 'available', 
                location: 'Main Crib', 
                health: 100 
            })
            .eq('id', id);

        if (!error) {
            await fetchTools();
            renderTools();
            renderToolWishlist();
            showToast("Tool Approved ✓");
        }
    }
}
// 2. Updated Denied History Renderer
function renderToolDeniedHistory() {
    const tableBody = document.getElementById('denied-table-body');
    if (!tableBody) return;

    const denied = (window.state.tools || []).filter(t => t.status === 'denied');

    tableBody.innerHTML = denied.length ? denied.map(t => `
        <tr onclick="openWishDetailCard('${t.id}')" style="cursor:pointer;">
            <td><b>${t.tool_name}</b></td>
            <td>${t.category || 'Other'}</td>
            <td style="color:#dc3545; font-size:12px;">${t.denial_reason || '—'}</td>
            <td><span class="badge bd">DENIED</span></td>
        </tr>`).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#888;">No denied items.</td></tr>';
}
async function checkToolArrivals() {
    const today = new Date().toISOString().split('T')[0];
    
    // Find tools that are 'ordered' and the arrival date has passed or is today
    const arrived = (state.tools || []).filter(t => t.status === 'ordered' && t.expected_arrival <= today);

    for (let tool of arrived) {
        await window._mpdb.from('tool_requests').update({ 
            status: 'available',
            location: 'Main Crib',
            health: 100 
        }).eq('id', tool.id);
    }
    
    if (arrived.length > 0) await fetchTools();
}

window.openReviewModal = async function(id) {
    console.log("🔍 Attempting to Review Tool ID:", id);
    
    // 1. Try to find the tool in local memory first
    const localList = (window.state && window.state.tools) ? window.state.tools : (typeof state !== 'undefined' ? state.tools : []);
    let tool = localList.find(t => t.id === id);

    // 2. THE FIX: If not found in memory, fetch it ly from Supabase
    if (!tool) {
        console.warn("Tool not found in local memory. Fetching from Supabase...");
        try {
            const { data, error } = await window._mpdb
                .from('tool_requests')
                .select('*')
                .eq('id', id)
                .single();
            
            if (data) {
                tool = data;
            } else {
                alert("Error: Could not find this request in the database.");
                return;
            }
        } catch (err) {
            console.error("Fetch failed:", err);
            return;
        }
    }

    // 3. Save the ID globally for the buttons to use
    window.currentReviewId = id;

    // 4. Fill the Modal UI
    const title = document.getElementById('rev-title');
    const reason = document.getElementById('rev-reason');
    
    if (title) title.textContent = "Review: " + (tool.tool_name || tool.name);
    if (reason) {
        reason.innerHTML = `
            <div style="margin-bottom:8px;"><b>Requested by:</b> ${tool.requested_by || 'Unknown'}</div>
            <div><b>Reason:</b> ${tool.request_reason || tool.notes || 'No reason provided.'}</div>
        `;
    }

    // 5. Clear the manager inputs
    if (document.getElementById('rev-date')) document.getElementById('rev-date').value = "";
    if (document.getElementById('rev-denial-reason')) document.getElementById('rev-denial-reason').value = "";

    // 6. Physically show the modal
    if (typeof openModal === 'function') {
        openModal('review-modal');
    } else {
        document.getElementById('review-modal').style.display = 'flex';
    }
    
    console.log("✅ Review modal successfully loaded.");
}

async function saveWishRequest() {
    const editId = document.getElementById('wish-edit-id').value;
    const rawName = document.getElementById('wish-name').value.trim();
    const reason = document.getElementById('wish-reason').value.trim();

    if (!rawName || !reason) return alert("Fill in name and reason.");

    const existing = editId ? state.tools.find(t => t.id === editId) : null;
    const isEdit = !!existing;

    const req = {
        id: (editId && editId !== "") ? editId : uid(),
        name: rawName,
        tool_name: rawName,
        request_reason: reason, 
        notes: reason,
        requested_by: existing ? existing.requested_by : (currentUser.full_name || currentUser.username),
        author_id: existing ? existing.author_id : String(currentUser.id), 
        status: 'requested',
        created_at: existing ? existing.created_at : new Date().toISOString()
    };

    try {
        const { error } = await window._mpdb.from('tool_requests').upsert([req]);
        if (error) throw error;

        // --- ACCOUNTABILITY LOGGING ---
        if (typeof logAuditAction === 'function') {
            const action = isEdit ? "Updated Wishlist Item" : "New Wishlist Request";
            const details = `Tool: "${req.name}", Reason: "${req.request_reason}" (Requested by: ${req.requested_by})`;
            
            await logAuditAction(action, details);
        }
        // ------------------------------

        showToast("Saved successfully ✓");
        closeModal('wishlist-modal');
        
        await fetchTools();
        renderToolWishlist();
        
        document.getElementById('wish-edit-id').value = "";

    } catch (e) { 
        console.error("Wishlist Error:", e);
        alert("Error: " + e.message); 
    }
}
window.deleteWishItem = async function(id) {
    // If no ID passed, try to grab it from the hidden input in the modal
    const targetId = id || document.getElementById('wish-edit-id').value;
    
    if (!targetId) return;

    if (!confirm("Are you sure you want to delete this tool suggestion?")) return;

    try {
        const { error } = await window._mpdb
            .from('tool_requests')
            .delete()
            .eq('id', targetId);

        if (error) throw error;

        showToast("Request removed ✓");
        closeModal('wishlist-modal');
        closeModal('review-modal');

        // Sync local memory and UI
        window.state.tools = window.state.tools.filter(t => t.id !== targetId);
        renderToolWishlist();

    } catch (e) {
        alert("Delete failed: " + e.message);
    }
};
window.openWishDetailCard = function(id) {
    console.log("--- Opening Wishlist Detail Card ---");
    
    try {
        const item = window.state.tools.find(t => t.id === id);
        if (!item) return;

        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
        const isAuthor = String(item.author_id) === String(currentUser.id);

        // Open the Modal
        openModal('wishlist-modal');

        // Fill Fields
        document.getElementById('wish-edit-id').value = item.id;
        document.getElementById('wish-name').value = item.tool_name || item.name || "";
        document.getElementById('wish-reason').value = item.request_reason || item.notes || "";
        
        // Update Labels
        document.getElementById('wish-modal-title').textContent = "✎ Edit Suggestion";
        document.getElementById('wish-submit-btn').textContent = "Update";

        // THE BUTTON VISIBILITY FIX
        const delBtn = document.getElementById('btn-delete-wish');
        if (delBtn) {
            if (isAdmin || isAuthor) {
                // We use 'block' and force it visible
                delBtn.style.setProperty('display', 'block', 'important');
                delBtn.style.visibility = 'visible';
            } else {
                delBtn.style.display = 'none';
            }
        } // End of delBtn check
    } catch (err) {
        console.error("Crash inside openWishDetailCard:", err);
    }
}; 
window.receiveOrderedTool = async function(id) {
    if (!confirm("Confirm this tool has arrived and is now in inventory?")) return;

    await window._mpdb.from('tool_requests').update({ 
        status: 'available', 
        location: 'Main Crib', 
        health: 100 
    }).eq('id', id);

    await fetchTools();
    renderTools();
    renderToolWishlist();
    showToast("Tool checked in ✓");
}
window.deleteDoc = deleteDoc;
window.openEditDocModal = openEditDocModal;
window.saveDoc = saveDoc;
window.openDocDetail = openDocDetail;
// FORCE THE FUNCTION TO BE GLOBAL SO HTML CAN SEE IT
window.deleteDoc = async function(id) {
  // 1. CONFIRMATION ALERT (If this doesn't show up, the button is broken)
  if (!confirm("Are you sure you want to permanently delete this document?")) return;

  console.log("Delete triggered for ID:", id);

  // 2. WIPE FROM LOCAL STATE (MEMORY)
  state.documents = state.documents.filter(d => d.id !== id);

  // 3. WIPE FROM OFFLINE QUEUE (The "Ghost" Fix)
  // We remove any pending SAVES for this document so it doesn't re-upload
  if (window.offlineQueue) {
    offlineQueue = offlineQueue.filter(item => {
        const itemId = (typeof item.record === 'object') ? item.record.id : item.record;
        return !(item.table === 'documents' && itemId === id);
    });
    saveOfflineQueue();
  }

  // 4. UPDATE THE UI IMMEDIATELY
  renderDocuments();
  if (window._currentDetailEquipId) renderDocsList(window._currentDetailEquipId);

  // 5. DELETE FROM SUPABASE
  try {
    // IMPORTANT: We pass an object {id: id} because your 'persist' function 
    // uses 'record.id' to find the row.
    const { error, count } = await window._mpdb
      .from('documents')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error("Supabase Error:", error.message);
      alert("Database error: " + error.message);
    } else if (count === 0) {
      console.warn("Deleted locally, but 0 rows removed from server. Check RLS policies.");
    } else {
      console.log("Successfully deleted from server. Rows affected:", count);
      showToast("Deleted from server ✓");
    }
  } catch (err) {
    console.error("Delete execution failed:", err);
  }
};

function openMobileSearch() {
    // Instead of a tiny bar, we use a prompt or a full-screen search experience
    const query = prompt("Search equipment, tasks, or parts:");
    
    if (query && query.trim() !== "") {
        // Use your existing search logic
        const input = document.getElementById('global-search');
        if (input) {
            input.value = query;
            handleGlobalSearch(); // Trigger the search result dropdown
        } else {
            // Fallback: If you don't have the global search input anymore
            // We can just alert or filter the current view
            alert("Searching for: " + query);
        }
    }
}

// Make it global
window.openMobileSearch = openMobileSearch;

function handleLogoClick() {
    if (window.innerWidth <= 768) {
        // MOBILE: Open Search
        const query = prompt("Search for equipment, tasks, or parts:");
        if (query && query.trim() !== "") {
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.value = query;
                handleGlobalSearch(); 
            }
        }
    } else {
        // PC: Standard behavior (Go to Dashboard)
        showPanel('dashboard');
    }
}
window.handleLogoClick = handleLogoClick;
function adjustMobileLayout() {
    // Only run this logic on mobile screens
    if (window.innerWidth <= 768) {
        const topbar = document.querySelector('.topbar');
        if (topbar) {
            // Measure the actual height of the bar right now
            const height = topbar.offsetHeight;
            // Send that height to the CSS
            document.documentElement.style.setProperty('--topbar-h', height + 'px');
        }
    } else {
        // Reset for PC
        document.documentElement.style.setProperty('--topbar-h', '60px');
    }
}

// Run this whenever the window is resized or a new panel is shown
window.addEventListener('resize', adjustMobileLayout);

// Update your showPanel function to call this
const _origShowPanel = showPanel;
window.showPanel = function(id) {
    _origShowPanel(id);
    // Give the browser a millisecond to render the new panel, then adjust
    setTimeout(adjustMobileLayout, 10); 
};

function switchPartsTab(tabType) {
    const partBtn = document.getElementById('add-part-btn');
    const consumableBtn = document.getElementById('add-consumable-btn');

    if (tabType === 'inventory') {
        // Show Part button, Hide Consumable button
        if (partBtn) partBtn.style.display = 'inline-flex';
        if (consumableBtn) consumableBtn.style.display = 'none';
        
        // Your existing logic to show the inventory table
        renderParts(); 
    } else {
        // Hide Part button, Show Consumable button
        if (partBtn) partBtn.style.display = 'none';
        if (consumableBtn) consumableBtn.style.display = 'inline-flex';
        
        // Your existing logic to show consumables table
        // renderConsumables(); 
    }
}
// Also run it once when the app starts
setTimeout(adjustMobileLayout, 500);


// 1. Open the modal
function openTaskSignoff(taskId) {
    currentTargetTaskId = taskId;
    taskPinEntry = "";
    
    // Clear the display
    const display = document.getElementById('task-pin-display');
    if (display) display.textContent = "";
    
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update Text for Sign-off
    document.getElementById('task-pin-user-name').textContent = currentUser.name;
    
    if (task.status === 'Pending Approval') {
        document.getElementById('task-pin-title').textContent = "Manager Approval";
        document.getElementById('task-pin-instruction').textContent = "Manager PIN required to finalize";
    } else {
        document.getElementById('task-pin-title').textContent = "Technician Sign-off";
        document.getElementById('task-pin-instruction').textContent = "Enter your PIN to verify work";
    }

    // --- THE FIX ---
    // Ensure the main detail modal stays open but sits behind the PIN pad
    const detailModal = document.getElementById('detail-modal');
    if (detailModal) {
        detailModal.style.zIndex = "10000"; // Lower
    }

    const pinModal = document.getElementById('task-pin-modal');
    if (pinModal) {
        pinModal.style.display = 'flex';
        pinModal.style.zIndex = "30000"; // Much Higher
    }
}
// 3. Verify the PIN and update the Task
async function verifyTaskPinAction() {
    const task = state.tasks.find(t => t.id === currentTargetTaskId);
    const now = new Date().toISOString();

    // 1. PIN SECURITY CHECK:
    // This forces the user to use THEIR OWN PIN that they logged in with.
    if (taskPinEntry !== currentUser.pin_code) {
        alert("Incorrect PIN for " + currentUser.name);
        taskPinEntry = "";
        document.getElementById('task-pin-display').textContent = "";
        return;
    }

    // 2. FLOW LOGIC
    if (task.status === 'Pending Approval') {
        // Only allow if the person currently logged in is a Manager
        if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
            alert("Access Denied: Only a Manager can approve this task.");
            closeModal('task-pin-modal');
            return;
        }

        task.status = 'Completed';
        task.manager_user_name = currentUser.name;
        task.manager_signed_at = now;
        await logAuditAction("Work Order Approved", `Task "${task.name}" finalized by Manager.`);
    } 
    else {
        // Tech sign-off
        task.status = 'Pending Approval';
        task.tech_user_name = currentUser.name;
        task.tech_signed_at = now;
        await logAuditAction("Work Order Sign-off", `Tech requested approval for "${task.name}".`);
    }

    // 3. Save to Supabase and Refresh
    await persist('tasks', 'upsert', task);
    closeModal('task-pin-modal');
    renderTasks();
    showToast("Verification Successful ✓");
} 
function switchTaskTab(tabId, btn) {
    // SAVE the choice globally so openTaskDetail knows where to stay
    window._activeTaskTab = tabId;

    // 1. Hide all sections
    document.querySelectorAll('.dt-section').forEach(s => s.style.display = 'none');
    
    // 2. Show the target section
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';

    // 3. Highlight the button
    const tabBar = btn.parentElement;
    tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}
async function toggleTaskCheck(taskId, index) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Toggle the done state
    task.checklist[index].done = !task.checklist[index].done;

    // Save to Database
    await persist('tasks', 'upsert', task);

    // RE-RENDER THE MODAL LIVE (This keeps the user on the current tab)
    openTaskDetail(taskId); 
    
    // Log the action for accountability
    logAuditAction("Checklist Update", `Marked item "${task.checklist[index].text}" as ${task.checklist[index].done ? 'Done' : 'Incomplete'}`);
}
async function addPartToActiveTask(taskId) {
    const partId = prompt("Enter Part ID or Scan QR:"); // You can replace this with a dropdown later
    if (!partId) return;

    const qty = parseInt(prompt("How many used?")) || 1;
    const part = state.parts.find(p => p.id === partId || p.num === partId);

    if (!part) return alert("Part not found in inventory.");

    const usage = {
        id: uid(),
        task_id: taskId,
        part_id: part.id,
        part_name: part.name,
        qty_used: qty,
        used_by: currentUser.name,
        used_at: new Date().toISOString()
    };

    // 1. Save usage
    state.partUsage.push(usage);
    await window._mpdb.from('part_usage').insert(usage);

    // 2. Update stock
    part.qty = Math.max(0, part.qty - qty);
    await persist('parts', 'upsert', part);

    // 3. Refresh the modal view
    openTaskDetail(taskId);
    showToast("Part logged live ✓");
}

async function usePartOnTask(taskId) {
  const partId = document.getElementById('dt-part-select').value;
  const qtyUsed = parseInt(document.getElementById('dt-part-qty').value);
  if(!partId || qtyUsed <= 0) return;

  const part = state.parts.find(p => p.id === partId);
  if(part.qty < qtyUsed) return alert("Not enough stock!");

  const usage = {
    id: uid(),
    task_id: taskId,
    part_id: partId,
    part_name: part.name,
    qty_used: qtyUsed,
    unit_cost: part.cost || 0,
    line_total: (part.cost || 0) * qtyUsed,
    used_by: currentUser.name,
    used_at: new Date().toISOString()
  };

  // 1. Update Database
  await window._mpdb.from('part_usage').insert(usage);
  
  // 2. Subtract from Inventory
  part.qty -= qtyUsed;
  await persist('parts', 'upsert', part);

  // 3. Update Task Total Cost
  const task = state.tasks.find(t => t.id === taskId);
  task.cost = (task.cost || 0) + usage.line_total;
  await persist('tasks', 'upsert', task);

  // 4. Refresh UI
  state.partUsage.push(usage);
  openTaskDetail(taskId); 
  showToast("Part added to Work Order ✓");
}
async function deleteTaskComment(commentId, taskId) {
    if(!confirm("Delete this comment?")) return;
    try {
        await window._mpdb.from('wo_comments').delete().eq('id', commentId);
        // Refresh the modal to show it's gone
        openTaskDetail(taskId);
    } catch(e) { console.error(e); }
}
async function removePartFromTask(usageId, taskId) {
  if(!confirm("Remove part and return to stock?")) return;
  const usage = state.partUsage.find(u => u.id === usageId);
  
  // Return to stock
  const part = state.parts.find(p => p.id === usage.part_id);
  if(part) {
    part.qty += usage.qty_used;
    await persist('parts', 'upsert', part);
  }

  await window._mpdb.from('part_usage').delete().eq('id', usageId);
  state.partUsage = state.partUsage.filter(u => u.id !== usageId);
  openTaskDetail(taskId);
}

async function addTaskCheckItem(taskId) {
  const input = document.getElementById('new-check-item');
  if(!input.value.trim()) return;
  const t = state.tasks.find(x => x.id === taskId);
  t.checklist.push({ text: input.value.trim(), done: false });
  await persist('tasks', 'upsert', t);
  openTaskDetail(taskId);
}
async function deleteChecklistItem(taskId, index) {
    // 1. Confirm with user
    if (!confirm("Remove this item from the checklist?")) return;

    // 2. Find the task in local memory
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.checklist) return;

    // 3. Remove the specific item from the array
    task.checklist.splice(index, 1);

    try {
        // 4. Update the database
        await persist('tasks', 'upsert', task);
        
        // 5. Log the action for accountability
        if (typeof logAuditAction === 'function') {
            logAuditAction("Checklist Item Removed", `Deleted a step from task: ${task.name}`);
        }

        // 6. Refresh the modal live so the item vanishes
        openTaskDetail(taskId);
        showToast("Item removed ✓");

    } catch (e) {
        console.error("Failed to delete checklist item:", e);
        showToast("Error updating checklist");
    }
}

// --- THE TRIGGER ---
window.editObservation = function(obsId, equipId) {
    // 1. Find the data
    const obs = state.observations.find(o => o.id === obsId);
    if (!obs) return alert("Observation not found.");

    // 2. Pre-fill the dedicated card
    document.getElementById('edit-obs-id').value = obsId;
    document.getElementById('edit-obs-equip-id').value = equipId;
    document.getElementById('edit-obs-sev').value = obs.severity;
    document.getElementById('edit-obs-body').value = obs.body;

    // 3. Force the card to show
    document.getElementById('obs-edit-modal-backdrop').style.display = 'flex';
};

window.saveObservationChange = async function() {
    console.log("--- SAVING OBSERVATION ---");

    // 1. Try to find the elements (searching for both new and old IDs just in case)
    const idEl   = document.getElementById('edit-obs-id')   || document.getElementById('edit-id');
    const bodyEl = document.getElementById('edit-obs-body') || document.getElementById('edit-body');
    const sevEl  = document.getElementById('edit-obs-sev')  || document.getElementById('edit-sev');

    // 2. Stop if they are truly missing
    if (!idEl || !bodyEl || !sevEl) {
        console.error("Missing Elements:", { idEl, bodyEl, sevEl });
        alert("CRITICAL ERROR: The app cannot find the edit boxes in your HTML. Check your IDs.");
        return;
    }

    const obsId = idEl.value;
    const newBody = bodyEl.value.trim();
    const newSev = sevEl.value;

    if (!newBody) return alert("Note cannot be empty.");

    try {
        // 3. Update Supabase
        const { error } = await window._mpdb
            .from('observations')
            .update({ body: newBody, severity: newSev })
            .eq('id', obsId);

        if (error) throw error;

        // 4. Update the local memory (state)
        const obsIndex = state.observations.findIndex(o => o.id === obsId);
        if (obsIndex !== -1) {
            state.observations[obsIndex].body = newBody;
            state.observations[obsIndex].severity = newSev;
            
            // 5. Live UI Update
            const equipId = state.observations[obsIndex].equip_id;
            if (equipId) renderObservationsList(equipId);
            renderDashboard(); 
        }

        // 6. Close Modal
        const modal = document.getElementById('obs-edit-modal-backdrop');
        if (modal) modal.style.display = 'none';
        
        showToast("Update saved ✓");

    } catch (e) {
        alert("Save failed: " + e.message);
    }
};

function populateAdminUserSelect() {
    const select = document.getElementById('role-user-select');
    if (!select) return;

    let html = '<option value="">-- Select User --</option>';
    const users = state.users_list_cache || [];
    
    users.forEach(u => {
        html += `<option value="${u.username}">${u.full_name || u.username}</option>`;
    });
    
    select.innerHTML = html;
}
// At the very end of app.js
console.log("🚀 All modules loaded. Triggering Startup...");

// We wait for the HTML to be fully ready before starting
document.addEventListener('DOMContentLoaded', () => {
    if (typeof startApp === 'function') {
        startApp();
    } else {
        console.error("Critical Error: startApp function not found in app.js");
    }
});
