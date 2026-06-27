import { 
    chatSub, chatChannel, currentEditingToolId, selectedLoginUser, 
    enteredPin, lastClickedDate, currentDetailId, selectedAbsenceType, 
    staffAbsences, zerkPinMode, zerkDrawingStep, currentWOTab, 
    woPartsTemp, currentZerkView, allMachineZerks, tempZerkCoords, 
    calDate, MONTHS, currentCalEntryType, _currentDocEditId, 
    _tempFileData, taskPinEntry, currentTargetTaskId,ICONS,  state, pendingPhotos, woPartsAdded,customFieldsTemp
} from './state.js';


// --- INITIALIZATION BRIDGES ---
import {  handleLogoClick } from './mobile.js';
import { handlePhotoUpload, refreshPhotoGrid } from './photos.js';
import { startApp, loadState, teleportModals, enterApp } from './init.js';
import { handleGlobalSearch } from './search.js';
import { showPinLogin, selectUserForLogin, pressPin, verifyUserPin, updatePinDots, backToNames, can, togglePassVis, signOut,doLogin, doRegister } from './auth.js';
import { updateLastSeen, renderDmList, renderOnlineUsers, updateAvatarPreview, fetchAllProfiles, handleChatInput,  showMentionDropdown, hideMentionDropdown, insertMention  } from './profiles.js';
import { runRecurrenceEngine, createBulkWO } from './automation.js';
import { buildEquipDetailHTML, buildTaskDetailHTML, renderObservationsList,renderEquipTimeline, renderMiniTimeline } from './details.js';
import { quickLogHours, saveQuickLogHours } from './meter.js';
import { scanInvoiceWithAI, submitBugReport, saveGeminiKey, suggestTools, checkAndSendOverdueEmails  } from './services.js';
import { uid, fmtDate, isOverdue, badge, showToast, equipName, supplierName } from './utils.js';
import { supabase, persist, setSyncStatus, createSession, validateSession, destroySession,syncOfflineQueue,SUPABASE_URL, SUPABASE_KEY, } from './db.js';
import { initChat, sendChatMessage, buildChatMsgHtml } from './chat.js';
import { openModal, closeModal, showPanel, switchTab, refreshAllDropdowns, showMobileZerkCard, closeMobileZerkCard,switchDetailTab,populateSelects, switchAdminTab, toggleChatSidebar, adjustMobileLayout, initLazyImages,switchToolTab, switchWOTab,  } from './ui.js';
import {  healthColor, calcHealth, getLastService, updateEquipStatus, uploadZerkView, openEquipDetail, addObservation, toggleLockout, addQuickSpec, deleteQuickSpec, globalEditObs, saveObservationChange,saveEquipment  } from './equipment.js';
import { approveUser, denyUser, deleteUser, logAuditAction,  autoCleanupAuditLogs, blockChatUser, unblockChatUser,populateAdminUserSelect,renderUsersTable, renderPermissionsMatrix,clearAuditFilters,syncAdminRoleSelects, changeUserRole, resetUserPassword, unlockUser,saveUserPerms, resetUserPerms,  } from './admin.js';
import { deleteDoc, openDocDetail, saveDoc } from './docs.js';
import { fetchTools, saveTool, deleteTool, addToolNote, deleteToolObservation, handleWishAction, editToolObservation, processReview, handleWishApproval, handleWishDenial, renderTools, renderWishlist, renderDeniedList,resetToolForm, editTool } from './tools.js';
import { openAddPart, resetPartForm, editPart, savePart, deletePart, addPartToTask, removePartUsage, updateDashboardParts,addPartToWO, fetchConsumables, editConsumable, saveConsumable,openSupplierDetail, deleteInvoice, openPartsCatalog } from './inventory.js';
import { renderTasksTable, saveTask, toggleChecklistItem, finalizeTask, openTaskSignoff, verifyTaskPinAction, addTaskCheckItem, addTaskComment, deleteTaskComment, deleteChecklistItem  } from './tasks.js';
import { updateMetrics, renderEquipListDash, renderSchedDash, getAdaptivePrediction, renderRecentTasks } from './dashboard.js';
import { fetchAbsences, renderCalendar, saveAbsence, isUserOutOnDate, setAbsenceType, deleteAbsence, openAbsenceModal,closeAbsenceModal,openAbsenceDetail, togglePrivateReason, triggerAddEntryFromCal, deleteSched, calDayClick, triggerAbsenceFromCal  } from './calendar.js'
import { exportCSV, exportPDF, exportHealthCSV,printQRCode, printMachineHistory } from './reports.js';
import { applyUserPreferences, saveUserProfile, toggleDarkMode } from './settings.js';
import { saveTpl, deleteTpl } from './checklists.js';
import { handleZerkMapClick, deleteZerk, renameZerkView } from './zerk.js';
import { renderEquipmentTable, renderPartsTable, renderQuickSpecs,renderConsumablesTable, refreshObsList, renderRecentObservations,renderChecklistTemplates,     } from './views.js';
import { saveSupplier, deleteSupplier, pullEquipSuppliers } from './suppliers.js';
import { startQRScanner, stopQRScanner } from './scanner.js';
import { formatDuration, getEquipDowntime, logStatusChange } from './downtime.js';
import { renderCostChart, renderHealthScores, renderPlannedVsUnplanned, renderTaskBreakdown, renderDowntimeStats, renderTopPartsUsed } from './analytics.js';

window.calDayClick = calDayClick; 
window.resetUserPassword = resetUserPassword;
window.unlockUser = unlockUser;
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

window.getLastService = getLastService
window.calcHealth = calcHealth;
window.renderConsumablesTable = renderConsumablesTable;
window.renderPartsTable = renderPartsTable;
window.woPartsAdded = woPartsAdded;
window.MONTHS = MONTHS;
window.ICONS = ICONS;
window.currentUser = window.currentUser || null;
window.state = state;
window.renderEquipmentTable = renderEquipmentTable;
window.logAuditAction = logAuditAction;
window.customFieldsTemp = customFieldsTemp;
window.pendingPhotos = pendingPhotos; 
window.renderAssignUsers
window.renderCustomFields
window.switchTab = switchTab;
window.switchWOTab = switchWOTab;
window.closeAbsenceModal = closeAbsenceModal;
window.triggerAddEntryFromCal = triggerAddEntryFromCal;
window.triggerAbsenceFromCal = triggerAbsenceFromCal;
window.calDate = calDate;
window.renderCalendar = renderCalendar;
window.saveUserPerms = saveUserPerms;
window.resetUserPerms = resetUserPerms;
window.renderChecklistTemplates = renderChecklistTemplates;
window.deleteTpl = deleteTpl;
window.saveTpl = saveTpl;
window.resetToolForm = resetToolForm;
window.editTool = editTool;
window.renderDeniedList = renderDeniedList;
window.renderWishlist = renderWishlist;
window.renderTools = renderTools;
window.openPartsCatalog = (id) => openPartsCatalog(id, state);
window.enterApp = () => enterApp(window.currentUser, state, can);
window.toggleChatSidebar = toggleChatSidebar;
window.adjustMobileLayout = adjustMobileLayout;
window.handlePhotoUpload = (input, key) => handlePhotoUpload(input, key, pendingPhotos, refreshPhotoGrid);
window.refreshPhotoGrid = (key) => refreshPhotoGrid(key, pendingPhotos);
window.showMentionDropdown = showMentionDropdown;
window.hideMentionDropdown = hideMentionDropdown;
window.insertMention = insertMention;
window.renderDmList = () => renderDmList(currentUser, state);
window.handleChatInput = (el) => handleChatInput(el, state, window.showMentionDropdown, window.hideMentionDropdown);
window.renderUsersTable = () => renderUsersTable(state);
window.openPermissionsCard = (id) => openPermissionsCard(id); // Ensure this is in admin.js
window.togglePermission = (role, key, val) => togglePermission(role, key, val);
window.openAbsenceDetail = (id) => openAbsenceDetail(id, currentUser, state);
window.togglePrivateReason = togglePrivateReason;
window.openSupplierDetail = (id) => openSupplierDetail(id, state);
window.deleteInvoice = deleteInvoice;
window.equipName = (id) => equipName(id, state);
window.supplierName = (id) => supplierName(id, state);
window.switchDetailTab = switchDetailTab;
window.switchAdminTab = switchAdminTab;
window.fetchAllProfiles = () => fetchAllProfiles(state);
window.globalEditObs = (id) => globalEditObs(id, state);
window.saveObservationChange = () => saveObservationChange(state);
window.loadState = () => loadState(state);
window.pressPin = pressPin;
window.verifyUserPin = verifyUserPin;
window.selectUserForLogin = selectUserForLogin;
window.backToNames = backToNames;
window.showPinLogin = showPinLogin;
window.enterApp = () => {
    return enterApp(window.currentUser, state, window.can);
};
window.switchToolTab = switchToolTab;
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
window.can = (permission) => can(permission, currentUser);
window.printQRCode = (id) => printQRCode(id, state);
window.printMachineHistory = (id) => printMachineHistory(id, state);
window.signOut = () => { destroySession(); location.reload(); };
window.togglePassVis = togglePassVis;
window.signOut = signOut;
window.startApp = startApp;
window.clearAuditFilters = clearAuditFilters;
window.renderDowntimeStats = () => renderDowntimeStats(state);
window.renderTopPartsUsed = () => renderTopPartsUsed(state);
window.saveGeminiKey = () => saveGeminiKey(currentUser);
window.suggestTools = () => suggestTools(document.getElementById('t-name').value, document.getElementById('t-equip').value, state, equipName);
window.syncAdminRoleSelects = () => syncAdminRoleSelects(state);
window.changeUserRole = () => changeUserRole(renderUsersTable, state);
window.renderEquipTimeline = (id) => renderEquipTimeline(id, state, fmtDate);
window.renderMiniTimeline = (id) => renderMiniTimeline(id, state, fmtDate, badge);
window.handleWishApproval = (id) => handleWishApproval(id, state).then(() => window.renderWishlist());
window.handleWishDenial = (id) => handleWishDenial(id, state).then(() => window.renderWishlist());
window.refreshObsList = (id) => refreshObsList(id, state, currentUser);
window.renderRecentObservations = () => renderRecentObservations(state, equipName);

window.startApp = startApp; 

window.acceptToolSuggestion = () => {
    const field = document.getElementById('t-tools');
    if(field) field.value = window._lastToolSuggestion;
    document.getElementById('tools-suggestion-area').style.display = 'none';
};

window.removePartUsage = (usageId, taskId) => {
    removePartUsage(usageId, taskId, state).then(success => {
        if (success) window.openTaskDetail(taskId); // Refresh the popup
    });
};

window.openTaskDetail = (id) => openTaskDetail(id, state);
window.deleteTask = (id) => deleteTask(id, state);
window.editPart = (id) => editPart(id, state);
window.openTaskSignoff = (id) => openTaskSignoff(id, currentUser);
window.triggerAddEntryFromCal = () => triggerAddEntryFromCal(window.lastClickedDate);
window.triggerAbsenceFromCal = () => triggerAbsenceFromCal(window.lastClickedDate);
window.deleteSched = deleteSched;


window.calNext = () => {
    window.calDate.setMonth(window.calDate.getMonth() + 1);
    renderCalendar();
};

window.calPrev = () => {
    window.calDate.setMonth(window.calDate.getMonth() - 1);
    renderCalendar();
};

window.calToday = () => {
    window.calDate = new Date();
    renderCalendar();
};


window.verifyTaskPinAction = () => {
    verifyTaskPinAction(currentUser).then(success => {
        if(success) {
            closeModal('task-pin-modal');
            renderTasks();
            showToast("Work Verified ✓");
        }
    });
};
window.addTaskCheckItem = (id) => {
    const input = document.getElementById('new-check-item');
    if(input && input.value.trim()) {
        addTaskCheckItem(id, input.value.trim()).then(() => {
            input.value = '';
            window.openTaskDetail(id); // Refresh popup
        });
    }
};

window.toggleLockout = (id, checked) => {
    toggleLockout(id, checked, currentUser).then(success => {
        if(success) renderDashboard(); // Redraw status on home screen
    });
};
window.addQuickSpec = (id) => {
    addQuickSpec(id).then(() => window.renderQuickSpecs(id, state));
};
window.deleteQuickSpec = (id, key) => {
    deleteQuickSpec(id, key).then(() => window.renderQuickSpecs(id, state));
};

window.addTaskComment = (id) => {
    const input = document.getElementById('dt-comment-input-large');
    if (input) {
        addTaskComment(id, input.value, currentUser).then(success => {
            if (success) {
                input.value = '';
                window.openTaskDetail(id); // Refresh the popup
            }
        });
    }
};
window.deleteTaskComment = (commentId, taskId) => {
    deleteTaskComment(commentId).then(success => {
        if (success) window.openTaskDetail(taskId);
    });
};
window.updateDashboardParts = () => updateDashboardParts(state);

window.editConsumable = (id) => editConsumable(id, state);
window.saveConsumable = () => {
    saveConsumable(state).then(success => {
        if (success) renderConsumablesTable(state, supplierName);
    });
};
window.openAddConsumable = () => {
    document.getElementById('c-edit-id').value = "";
    document.getElementById('c-modal-title').textContent = "Add Supply Item";
    openModal('consumable-modal');
};

document.addEventListener('DOMContentLoaded', () => {
    startApp(); 
});

window.saveEquipment = () => {
    // 1. Run the save logic
    saveEquipment(state, window.currentUser, window.pendingPhotos, window.customFieldsTemp).then(res => {
        if (res && res.success) {
            // 2. Close the modal window
            closeModal('equip-modal');
            
            // 3. THE MAGIC COMMAND: Redraw the table right now
            // This calls the render function we moved to views.js
            if (typeof window.renderEquipmentTable === 'function') {
                window.renderEquipmentTable(); 
            }
            
            // 4. Also update the big dashboard counts
            if (typeof window.updateMetrics === 'function') window.updateMetrics();
            
            showToast("Machine saved and list updated ✓");
        }
    });
};

function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    // Shows one asterisk for every digit typed
    display.textContent = "•".repeat(enteredPin.length);
}


function checkDateSelection(val) {
    if(val) document.getElementById('abs-options').style.display = 'block';
}

const ADMIN_USERNAME = 'tangal99';

function showErr(msg) { const e=document.getElementById('auth-err'); e.textContent=msg; e.style.display='block'; }



const TODAY=new Date(); TODAY.setHours(0,0,0,0);


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


function toggleRecurType(){
  const t=document.getElementById('r-type').value;
  document.getElementById('r-interval-group').style.display=t==='calendar'?'block':'none';
  document.getElementById('r-hours-group').style.display=t==='hours'?'block':'none';
}


function getNextDue(id){ const o=state.tasks.filter(t=>t.equipId===id&&t.status!=='Completed'); if(!o.length)return'—'; const n=o.sort((a,b)=>new Date(a.due)-new Date(b.due))[0]; return `<span style="color:${isOverdue(n.due)?'var(--danger)':'inherit'}">${fmtDate(n.due)}</span>`; }
function addCustomField(){ customFieldsTemp['New Field '+Object.keys(customFieldsTemp).length]='' ; renderCustomFields(); }
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




// ============================================================
// SAVE DATA
// ============================================================

async function deleteRecurRule(id){ if(!confirm('Delete this recurrence rule?'))return; state.recurrenceRules=state.recurrenceRules.filter(r=>r.id!==id); await persist('recurrence_rules','delete',{id}); renderCalendar(); }

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
(function(){try{const s=JSON.parse(localStorage.getItem('mp_tpl')||'null');if(s){const ids=new Set(state.checklistTemplates.map(t=>t.id));s.forEach(t=>{if(!ids.has(t.id))state.checklistTemplates.push(t);});}}catch(e){}})();
(function(){try{state.downtimeLog=JSON.parse(localStorage.getItem('mp_downtime')||'[]');}catch(e){}})();


// ── GROUPS ───────────────────────────────────────────────────
function setGroupFilter(group){activeGroupFilter=group;['all','outside','production'].forEach(g=>{const btn=document.getElementById('grp-'+g);if(!btn)return;if(g===group){btn.style.background='#fff';btn.style.color='#1a1a18';btn.style.fontWeight='700';btn.style.borderColor='#fff';}else{btn.style.background='rgba(255,255,255,0.15)';btn.style.color='#fff';btn.style.fontWeight='500';btn.style.borderColor='rgba(255,255,255,0.6)';}});renderDashboard();}
function setEquipGroupFilter(group){equipGroupFilter=group;['all','outside','production'].forEach(g=>{const btn=document.getElementById('eq-grp-'+g);if(!btn)return;btn.classList.toggle('active',g===group);});renderEquipmentTable();}
function filteredEquipment(filter){const f=filter||activeGroupFilter;if(f==='all')return state.equipment;return state.equipment.filter(e=>e.group_tag===f||e.group_tag==='both');}
function applyUserGroupFilter(){if(!currentUser)return;const g=currentUser.group_tag;if(g&&g!=='all'){setGroupFilter(g);setEquipGroupFilter(g);}}


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
function openUserPerms(userId,userName,userRole,customPerms){editingUserId=userId;editingUserRole=userRole;editingPerms={...PERMISSIONS[userRole]||PERMISSIONS.tech,...(customPerms||{})};document.getElementById('user-perms-title').textContent=userName+' — Permissions';document.getElementById('user-perms-role').textContent=userRole;renderUserPermsList();openModal('user-perms-modal');}
function renderUserPermsList(){const rd=PERMISSIONS[editingUserRole]||PERMISSIONS.tech;document.getElementById('user-perms-list').innerHTML=Object.entries(PERM_LABELS).map(([key,label])=>{const def=!!(rd[key]),cur=!!(editingPerms[key]),ov=cur!==def;return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font-size:13px;font-weight:500">${label}</div><div style="font-size:11px;color:var(--text3)">Default: ${def?'✅':'❌'}${ov?' <span style="color:var(--warning)">● Override</span>':''}</div></div><label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0;margin-left:12px"><span style="font-size:12px;color:${cur?'var(--success)':'var(--danger)'};font-weight:600;min-width:60px;text-align:right">${cur?'Allowed':'Denied'}</span><div style="position:relative;width:40px;height:22px;flex-shrink:0"><input type="checkbox" ${cur?'checked':''} onchange="editingPerms['${key}']=this.checked;renderUserPermsList()" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;margin:0;z-index:2"/><div style="width:40px;height:22px;border-radius:11px;background:${cur?'#3B6D11':'#E24B4A'};position:absolute;top:0;left:0"></div><div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${cur?'21px':'3px'};transition:left .2s;pointer-events:none"></div></div></label></div>`;}).join('');}

function togglePermission(role,permission,value){if(role==='admin')return;PERMISSIONS[role][permission]=value;try{const c={};['manager','tech','viewer'].forEach(r=>{c[r]={...PERMISSIONS[r]};});localStorage.setItem('mp_permissions',JSON.stringify(c));}catch(e){}showToast('Updated ✓');}
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
  if(od.length)h+=`<div class="alert alert-d"><span class="dot"></span><b>${od.length} overdue:</b> ${od.map(t=>t.name).join(', ')}</div>`;
  if(lp.length)h+=`<div class="alert alert-w">⚠ <b>${lp.length} part${lp.length>1?'s':''} low/out of stock:</b> ${lp.map(p=>p.name).join(', ')}</div>`;
  if(exp.length)h+=`<div class="alert alert-w">📄 <b>${exp.length} document${exp.length>1?'s':''} expiring soon:</b> ${exp.map(d=>d.name).join(', ')}</div>`;
  if(critObs.length)h+=`<div class="alert alert-d">🚨 <b>${critObs.length} critical observation${critObs.length>1?'s':''}:</b> ${critObs.map(o=>equipName(o.equip_id)+' — '+o.body.slice(0,50)).join(' | ')}</div>`;
  sec.innerHTML=h;
}


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

// ── PARTS CATALOG ─────────────────────────────────────────────
const PARTS_CATALOG_URLS={'cat':'https://parts.cat.com','caterpillar':'https://parts.cat.com','komatsu':'https://parts.komatsu.com','deere':'https://parts.deere.com','john deere':'https://parts.deere.com','kubota':'https://www.kubotausa.com/parts-and-service','volvo':'https://www.volvoce.com/united-states/en-us/services/parts/','bobcat':'https://www.bobcat.com/en/parts-and-service/parts','case':'https://www.caseparts.com','jcb':'https://parts.jcb.com'};
function getPartsCatalogUrl(name,type,mfr){const text=((mfr||'')+' '+name+' '+(type||'')).toLowerCase();for(const[brand,url]of Object.entries(PARTS_CATALOG_URLS)){if(text.includes(brand))return url;}return 'https://www.google.com/search?q='+encodeURIComponent((mfr||name)+' parts catalog');}
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


window.openMobileSearch = openMobileSearch;

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
    }
}
// Also run it once when the app starts
setTimeout(adjustMobileLayout, 500);




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

    
