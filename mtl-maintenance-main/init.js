import { supabase, setSyncStatus, validateSession } from './db.js';
import { fetchAllProfiles } from './profiles.js';
import { fetchAbsences } from './calendar.js';
import { showPinLogin } from './auth.js';
import { updateMetrics } from './dashboard.js';

console.log("🚀 System Loader: init.js Version 3.0 Booting...");

export async function loadState() {
  const masterFolder = window.state;
  if (!masterFolder) return console.error("Master Folder Missing");

  setSyncStatus('syncing');

  try {
    console.log("📥 Syncing from Supabase...");

    const dbResponse = await Promise.all([
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

    // We use the results of the 13th table (index 12) 
    // We are NOT using the name "con" anywhere in this code.
    masterFolder.equipment       = dbResponse[0].data  || [];
    masterFolder.tasks           = (dbResponse[1].data || []).map(t => ({ ...t, equipId: t.equip_id }));
    masterFolder.schedules       = dbResponse[2].data  || [];
    masterFolder.parts           = dbResponse[3].data  || [];
    masterFolder.suppliers       = dbResponse[4].data  || [];
    masterFolder.documents       = dbResponse[5].data  || [];
    masterFolder.partUsage       = dbResponse[6].data  || [];
    masterFolder.recurrenceRules = dbResponse[7].data  || [];
    masterFolder.tools           = dbResponse[8].data  || [];
    masterFolder.observations    = dbResponse[9].data  || [];
    masterFolder.wiki            = dbResponse[10].data || [];
    masterFolder.chatMessages    = dbResponse[11].data || [];
    masterFolder.consumables     = dbResponse[12].data || []; 

    console.log(`✅ Sync complete. Total machines: ${masterFolder.equipment.length}`);

    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (typeof window.renderTools === 'function') window.renderTools();
    if (typeof window.renderPartsTable === 'function') window.renderPartsTable();
    if (typeof window.renderConsumablesTable === 'function') window.renderConsumablesTable();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    
    setSyncStatus('online');
    return true;

  } catch(err) { 
    console.error('❌ CRITICAL LOAD FAILURE:', err); 
    setSyncStatus('offline');
    return false;
  }
}

export async function startApp() {
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


export async function enterApp(currentUser, state, canFunc) {
  console.log("Building application interface...");
  
  // 1. Load data before showing anything
  await loadState(); 

  // 2. Hide Login, Show App
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';

  const appContainer = document.getElementById('app');
  if (appContainer) appContainer.style.display = 'flex';

  // 3. Set up permission tool
  const check = typeof canFunc === 'function' ? canFunc : () => true;

  // 4. Build Navigation Bar
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
        if (btn.id === 'analytics' && !check('canViewReports')) return;
        if (btn.id === 'suppliers' && !check('canManageSuppliers')) return;

        const b = document.createElement('button');
        b.className = 'nav-btn';
        b.onclick = () => window.showPanel(btn.id);
        b.innerHTML = btn.id === 'chat' ? 
          `Chat <span id="chat-unread-top" class="badge bd" style="display:none">0</span>` : btn.label;
        nav.appendChild(b);
      });

      if (currentUser && currentUser.role === 'admin') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-btn';
        adminBtn.onclick = () => window.showPanel('admin');
        adminBtn.textContent = 'Admin';
        nav.appendChild(adminBtn);
      }
  }

  // 5. Initial Screen Renders
  if (typeof window.renderEquipmentTable === 'function') {
      window.renderEquipmentTable();
  }

  // 6. Load personalization
  if (typeof window.applyUserPreferences === 'function') {
      window.applyUserPreferences(currentUser);
  }
  
  // 7. Show Preferred Home Page
  const home = currentUser?.preferences?.startPage || 'dashboard';
  if (typeof window.showPanel === 'function') {
      window.showPanel(home); 
  }

  // 8. Background Services
  if (typeof window.initChat === 'function') {
      window.initChat();
  }

  // 9. Force layout snap
  setTimeout(() => {
      if (typeof window.adjustMobileLayout === 'function') window.adjustMobileLayout();
  }, 100);
}



