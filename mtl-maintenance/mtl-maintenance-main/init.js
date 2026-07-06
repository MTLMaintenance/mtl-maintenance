// init.js - Application Bootstrapping
import { supabase, setSyncStatus,validateSession  } from './db.js';
import { updateMetrics } from './dashboard.js';
import { fetchAllProfiles } from './profiles.js';
import { showPinLogin } from './auth.js';
import { showPanel, adjustMobileLayout } from './ui.js';
import { applyUserPreferences } from './settings.js';
import { fetchAbsences } from './calendar.js';

console.log("🚀 System Loader: init.js Version 3.0 Booting...");

export async function loadState() {
  const state = window.state;
  setSyncStatus('syncing');
  
  // 1. UNIQUE LOG: If you don't see "LOG VERSION: 10" in your console, the file didn't update
  console.log("📥 LOG VERSION: 10 - FETCHING FROM SUPABASE...");

  try {
    const response = await Promise.all([
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

    // 2. Save data using indices [0, 1, 2...] 
    // This is 100% safe from "Variable not defined" errors.
    state.equipment       = response[0].data  || [];
    state.tasks           = (response[1].data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules       = response[2].data  || [];
    state.parts           = response[3].data  || [];
    state.suppliers       = response[4].data  || [];
    state.documents       = response[5].data  || [];
    state.partUsage       = response[6].data  || [];
    state.recurrenceRules = response[7].data  || [];
    state.tools           = response[8].data  || [];
    state.observations    = response[9].data  || [];
    state.wiki            = response[10].data || [];
    state.chatMessages    = response[11].data || [];
    state.consumables     = response[12].data || [];

    console.log(`✅ SYNC SUCCESS: Found ${state.equipment.length} machines in database.`);

    // 3. Trigger UI redraws
    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    
    setSyncStatus('online');
    return true;
  } catch(e) { 
    console.error("❌ SYNC FAILED:", e); 
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
      
      // VITAL: This 'await' makes the app stay on the loading screen 
      // until the machines actually arrive from Supabase.
      await loadState(); 
      
      window.enterApp(); 
    } else {
      showPinLogin();
    }
  } catch(e) { 
    showPinLogin(); 
  }
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

console.log("Forcing initial table draw...");
if (typeof window.renderEquipmentTable === 'function') {
    window.renderEquipmentTable();
}

export function teleportModals() {
    const modalIds = ['user-perms-modal', 'cal-action-modal', 'absence-detail-modal', 'part-modal', 'tool-modal','review-modal','consumable-modal'];
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) document.body.appendChild(el);
    });
}
