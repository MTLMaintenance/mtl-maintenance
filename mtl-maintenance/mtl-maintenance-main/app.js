import { 
    chatSub, chatChannel, currentEditingToolId, selectedLoginUser, 
    enteredPin, lastClickedDate, currentDetailId, selectedAbsenceType, 
    staffAbsences, zerkPinMode, zerkDrawingStep, currentWOTab, 
    woPartsTemp, currentZerkView, allMachineZerks, tempZerkCoords, 
    calDate, MONTHS, currentCalEntryType, _currentDocEditId, 
    _tempFileData, taskPinEntry, currentTargetTaskId,ICONS,  state, pendingPhotos, woPartsAdded,customFieldsTemp
} from './state.js';


// --- INITIALIZATION BRIDGES ---
import { addWikiTip, fetchWiki } from './knowledge.js';
import { openComponentOS } from './components.js';
import { renderPerfectCard, renderWikiSection} from './machine-os-ui.js';
import {  handleLogoClick,openMobileSearch } from './mobile.js';
import { handlePhotoUpload, refreshPhotoGrid } from './photos.js';
import { startApp, loadState, teleportModals, enterApp } from './init.js?v=99';
import { handleGlobalSearch } from './search.js';
import { showPinLogin, selectUserForLogin, pressPin, verifyUserPin, updatePinDots, backToNames, can, togglePassVis, signOut,doLogin, doRegister } from './auth.js';
import { updateLastSeen, renderDmList, renderOnlineUsers, updateAvatarPreview, fetchAllProfiles, handleChatInput,  showMentionDropdown, hideMentionDropdown, insertMention, openProfileModal   } from './profiles.js';
import { runRecurrenceEngine, createBulkWO } from './automation.js';
import { buildEquipDetailHTML, buildTaskDetailHTML, renderObservationsList,renderEquipTimeline, renderMiniTimeline,renderFullHistoryList, openTaskDetail } from './details.js';
import { quickLogHours, saveQuickLogHours } from './meter.js';
import { scanInvoiceWithAI, submitBugReport, saveGeminiKey, suggestTools, checkAndSendOverdueEmails,updateReportType  } from './services.js';
import { uid, fmtDate, isOverdue, badge, showToast, equipName, supplierName, compressImage  } from './utils.js';
import { supabase, persist, setSyncStatus, createSession, validateSession, destroySession,syncOfflineQueue,SUPABASE_URL, SUPABASE_KEY, } from './db.js';
import { initChat, sendChatMessage, buildChatMsgHtml,chatKeyDown, renderChatMessages, sendDM, sendDMToUsername,loadChatMessages,renderChat,appendChatMessage,deleteChatMessage,permanentDeleteMessage } from './chat.js';
import { openModal, closeModal, showPanel, switchTab, refreshAllDropdowns, showMobileZerkCard, closeMobileZerkCard,switchDetailTab,populateSelects, switchAdminTab, toggleChatSidebar, adjustMobileLayout, initLazyImages,switchToolTab, switchWOTab, switchTaskTab, switchToolModalTab, switchChannel  } from './ui.js';
import {  healthColor, calcHealth, getLastService, updateEquipStatus, uploadZerkView, openEquipDetail, addObservation, toggleLockout, addQuickSpec, deleteQuickSpec, globalEditObs, saveObservationChange,saveEquipment, getNextDue, saveEditObservation, deleteEquip as deleteEquipLogic,addSpecToComponent   } from './equipment.js';
import { approveUser, denyUser, deleteUser, logAuditAction,  autoCleanupAuditLogs, blockChatUser, unblockChatUser,populateAdminUserSelect,renderUsersTable, renderPermissionsMatrix,clearAuditFilters,syncAdminRoleSelects, changeUserRole, resetUserPassword, unlockUser,saveUserPerms, resetUserPerms, openUserPermissions, renderAdminPanel  } from './admin.js';
import { deleteDoc, openDocDetail, saveDoc,openEditDocModal,openAddDocModal,openDocModal, handleDocUpload } from './docs.js';
import { fetchTools, saveTool, deleteTool, addToolNote, deleteToolObservation, handleWishAction, editToolObservation, processReview, handleWishApproval, handleWishDenial, renderTools, renderWishlist, renderDeniedList,resetToolForm, editTool, renderToolObsList, saveWishRequest, renderToolDeniedHistory, receiveOrderedTool,deleteWishItem,openWishDetailCard,toggleToolStatus,renderToolWishlist, receiveTool } from './tools.js';
import { openAddPart, resetPartForm, editPart, savePart, deletePart, addPartToTask, removePartUsage, updateDashboardParts,addPartToWO, fetchConsumables, editConsumable, saveConsumable,openSupplierDetail, deleteInvoice, openPartsCatalog,handleInvoiceDrop, viewInvoicePhoto,switchPartsSubTab } from './inventory.js';
import { renderTasksTable, saveTask, toggleChecklistItem, finalizeTask, openTaskSignoff, verifyTaskPinAction, addTaskCheckItem, addTaskComment, deleteTaskComment, deleteChecklistItem,deleteTask,addPartToActiveTask,switchPartsTab,updateTotalCostDisplay,startJobWorkflow  } from './tasks.js';
import { updateMetrics, renderEquipListDash, renderSchedDash, getAdaptivePrediction, renderRecentTasks,renderSchedule,renderDashboardObs } from './dashboard.js';
import { fetchAbsences, renderCalendar, saveAbsence, isUserOutOnDate, setAbsenceType, deleteAbsence, openAbsenceModal,closeAbsenceModal,openAbsenceDetail, togglePrivateReason, triggerAddEntryFromCal, deleteSched, calDayClick, triggerAbsenceFromCal, switchCalendarView, saveCalendarEntry  } from './calendar.js'
import { exportCSV, exportPDF, exportHealthCSV,printQRCode, printMachineHistory } from './reports.js';
import { applyUserPreferences, saveUserProfile, toggleDarkMode } from './settings.js';
import { saveTpl, deleteTpl,editTemplate } from './checklists.js';
import { renderZerkTab, handleZerkMapClick, deleteZerk, renameZerkView, addZerkViewWithTitle, editZerkNote, deleteZerkView,showZerkInfo,renderZerkDots,highlightZerk,setZerkMode  } from './zerk.js';
import { renderEquipmentTable, renderPartsTable, renderQuickSpecs,renderConsumablesTable, refreshObsList, renderRecentObservations,renderChecklistTemplates,renderDocuments,renderMachineTimeline,renderComponentSpecs  } from './views.js';
import { saveSupplier, deleteSupplier, pullEquipSuppliers } from './suppliers.js';
import { startQRScanner, stopQRScanner } from './scanner.js';
import { formatDuration, getEquipDowntime, logStatusChange } from './downtime.js';
import { renderCostChart, renderHealthScores, renderPlannedVsUnplanned, renderTaskBreakdown, renderDowntimeStats, renderTopPartsUsed,renderCostByEquip } from './analytics.js';
import { openEquipDetail as openLegacy } from './equipment.js';
window.openEquipDetail = (id) => {
    window._currentDetailEquipId = id;
    if (typeof window.showPanel === 'function') {
        window.showPanel('machine-profile'); 
    }
    if (typeof renderPerfectCard === 'function') {
        renderPerfectCard(id); 
    }
};
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

window.switchPartsSubTab = switchPartsSubTab;
window.renderComponentSpecs = renderComponentSpecs;
window.loadState = loadState;
window.addSpecToComponent = addSpecToComponent;
window.buildEquipDetailHTML = buildEquipDetailHTML;
window.renderMachineTimeline = renderMachineTimeline;
window.renderWikiSection = renderWikiSection;
window.addWikiTip = addWikiTip;
window.openJobWorkflow = startJobWorkflow;
window.openComponentOS = openComponentOS;
window.renderPerfectCard = renderPerfectCard;
window.saveEditObservation = saveEditObservation;
window.saveCalendarEntry = saveCalendarEntry;
window.renderCostByEquip = renderCostByEquip;
window.viewInvoicePhoto = viewInvoicePhoto;
window.handleInvoiceDrop = handleInvoiceDrop;
window.updateReportType = updateReportType;
window.submitBugReport = submitBugReport;
window.editTemplate = editTemplate;
window.renderAdminPanel = renderAdminPanel;
window.setZerkMode = setZerkMode;
window.highlightZerk = highlightZerk;
window.renderZerkDots = renderZerkDots;
window.showZerkInfo = showZerkInfo;
window.renderDashboardObs = renderDashboardObs;
window.renderSchedule = renderSchedule;
window.openUserPermissions = openUserPermissions;
window.permanentDeleteMessage = permanentDeleteMessage;
window.deleteChatMessage = deleteChatMessage;
window.openMobileSearch = openMobileSearch;
window. updateTotalCostDisplay = updateTotalCostDisplay;
window. receiveTool = receiveTool; 
window.renderToolWishlist = renderToolWishlist;
window.toggleToolStatus = toggleToolStatus; 
window.openWishDetailCard = openWishDetailCard;
window.deleteWishItem = deleteWishItem;
window.receiveOrderedTool = receiveOrderedTool;
window.switchPartsTab = switchPartsTab;
window.addPartToActiveTask = addPartToActiveTask;
window.renderToolDeniedHistory = renderToolDeniedHistory;
window.saveWishRequest = saveWishRequest;
window.renderPermissionsMatrix = renderPermissionsMatrix;
window.renderDocuments = renderDocuments;
window.handleDocUpload = handleDocUpload;
window.openDocModal = openDocModal;
window.openAddDocModal = openAddDocModal; 
window.deletePart = deletePart;
window.renderToolObsList = renderToolObsList;
window.initChat = initChat;
window.appendChatMessage = appendChatMessage;
window.processReview = processReview;
window.editToolObservation = editToolObservation; 
window.handleWishAction = handleWishAction;
window.addToolNote = addToolNote;
window.deleteToolObservation = deleteToolObservation;
window.deleteTool = deleteTool;
window.renderChat = renderChat;
window.loadChatMessages = loadChatMessages;
window.saveTool = saveTool;
window.sendDM = sendDM;
window.sendDMToUsername = sendDMToUsername;
window.openDocDetail = openDocDetail;
window.saveDoc = saveDoc;
window.openEditDocModal = openEditDocModal;
window.pullEquipSuppliers = pullEquipSuppliers;
window.deleteSupplier = deleteSupplier;
window.saveSupplier = saveSupplier;
window.populateAdminUserSelect = populateAdminUserSelect;
window.unblockChatUser = unblockChatUser;
window.blockChatUser = blockChatUser;
window.autoCleanupAuditLogs = autoCleanupAuditLogs;
window.deleteUser = deleteUser;
window.denyUser = denyUser;
window.approveUser = approveUser;
window.renderPermissionsMatrix = renderPermissionsMatrix
window.openProfileModal = openProfileModal; 
window.stopQRScanner = stopQRScanner;
window.startQRScanner = startQRScanner;
window.toggleDarkMode = toggleDarkMode;
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;
window.openAddPart = openAddPart;
window.switchToolModalTab = switchToolModalTab;
window.sendChatMessage = sendChatMessage;
window.chatKeyDown = chatKeyDown;
window.openAbsenceModal= openAbsenceModal;
window.switchCalendarView = switchCalendarView;
window.switchTaskTab = switchTaskTab 
window.deleteTask = deleteTask;
window.renderTasksTable = () => renderTasksTable('tasks-table-body');
window.populateSelects = populateSelects;
window.saveTask = saveTask; 
window.showToast = showToast;
window.compressImage = compressImage;
window.deleteZerkView = deleteZerkView;
window.renderObservationsList = renderObservationsList;
window.renderZerkTab = renderZerkTab;
window.handleZerkMapClick = handleZerkMapClick;
window.deleteZerk = deleteZerk; 
window.renameZerkView = renameZerkView;
window.addZerkViewWithTitle = addZerkViewWithTitle;
window.editZerkNote = editZerkNote;
window.renderFullHistoryList = (id) => renderFullHistoryList(id, state);
window.renderQuickSpecs = (id) => renderQuickSpecs(id);
window.healthColor = healthColor;
window.getNextDue = (id) => getNextDue(id, state.tasks);
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
window.openEquipDetailLegacy = (id) => { openLegacy(id);};
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


window.switchChannel = (channel, btn) => {
    window.currentChannel = channel;
    loadChatMessages(channel); 
    document.querySelectorAll('.chat-channel-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};


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

window.openTaskDetail = function(id) { openTaskDetail(id, window.state); };
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

const _origSwitchAdminTab = window.switchAdminTab;
window.switchAdminTab = (tab, btn) => {
    _origSwitchAdminTab(tab, btn); // Run the tab switch
    if (tab === 'permissions' || tab === 'users') {
        populateAdminUserSelect();
        renderPermissionsMatrix();
    }
};

window.filterTimeline = (component, btn) => {
    const equipId = window._currentDetailEquipId;
    
    // 1. Redraw the timeline with a filter
    if (typeof window.renderMachineTimeline === 'function') {
        window.renderMachineTimeline(equipId, component);
    }

    // 2. Visual: Highlight the active component card
    const cards = btn.parentElement.querySelectorAll('.comp-card');
    cards.forEach(c => c.style.borderColor = '#eee'); // Reset others
    btn.style.borderColor = 'var(--accent)'; // Highlight active
};


window.filterOS = (component, btn) => {
    const equipId = window._currentDetailEquipId;

    // 1. Trigger the logic to draw the specs (Dark boxes)
    if (typeof window.renderComponentSpecs === 'function') {
        window.renderComponentSpecs(equipId, component);
    }

    // 2. Trigger the logic to filter the timeline
    if (typeof window.renderMachineTimeline === 'function') {
        window.renderMachineTimeline(equipId, component);
    }

    // 3. UI: Highlight the clicked card
    const cards = btn.parentElement.querySelectorAll('.comp-card');
    cards.forEach(c => c.classList.remove('active-os'));
    btn.classList.add('active-os');
};

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

function populateChatTagSelects(){
  const esel=document.getElementById('tag-equip-select');const tsel=document.getElementById('tag-task-select');
  if(esel)esel.innerHTML='<option value="">+ Equipment</option>'+state.equipment.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  if(tsel)tsel.innerHTML='<option value="">+ Work Order</option>'+state.tasks.filter(t=>t.status!=='Completed').map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
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

// ── PARTS CATALOG ─────────────────────────────────────────────
const PARTS_CATALOG_URLS={'cat':'https://parts.cat.com','caterpillar':'https://parts.cat.com','komatsu':'https://parts.komatsu.com','deere':'https://parts.deere.com','john deere':'https://parts.deere.com','kubota':'https://www.kubotausa.com/parts-and-service','volvo':'https://www.volvoce.com/united-states/en-us/services/parts/','bobcat':'https://www.bobcat.com/en/parts-and-service/parts','case':'https://www.caseparts.com','jcb':'https://parts.jcb.com'};
function getPartsCatalogUrl(name,type,mfr){const text=((mfr||'')+' '+name+' '+(type||'')).toLowerCase();for(const[brand,url]of Object.entries(PARTS_CATALOG_URLS)){if(text.includes(brand))return url;}return 'https://www.google.com/search?q='+encodeURIComponent((mfr||name)+' parts catalog');}

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

async function notifyManagers(text) {
    const { data: m } = await window._mpdb.from('profiles').select('username').in('role', ['admin', 'manager']);
    for (const u of m) { if (u.username !== currentUser.username) await sendDMToUsername(u.username, text); }
}

