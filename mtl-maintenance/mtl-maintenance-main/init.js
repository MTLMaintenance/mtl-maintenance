// init.js - Application Bootstrapping
import { supabase, setSyncStatus } from './db.js';
import { updateMetrics } from './dashboard.js';
import { validateSession} from './db.js';
import { fetchAllProfiles } from './profiles.js';
import { showPinLogin } from './auth.js';
import { showPanel, adjustMobileLayout } from './ui.js';
import { applyUserPreferences } from './settings.js';
import { fetchAbsences } from './calendar.js';

export async function loadState() {
  const state = window.state;
  setSyncStatus('syncing');

  try {
    console.log("📥 Refreshing data from Supabase...");

    // 1. Fetch the data - FIXED COMMA AND TABLE ORDER
    const [eq, tk, sc, pt, sup, docs, pu, rr, tr, obs, msgs,wikiData] = await Promise.all([
       window._mpdb.from('shop_wiki').select('*'),
      window._mpdb.from('equipment').select('*'),
      window._mpdb.from('tasks').select('*'),
      window._mpdb.from('schedules').select('*'),
      window._mpdb.from('parts').select('*'),
      window._mpdb.from('suppliers').select('*'),
      window._mpdb.from('documents').select('*'),
      window._mpdb.from('part_usage').select('*'),
      window._mpdb.from('recurrence_rules').select('*'),
      window._mpdb.from('tool_requests').select('*'), // This is where your tools live
      window._mpdb.from('observations').select('*').order('created_at', { ascending: false }),
       window._mpdb.from('chat_messages').select('*').order('created_at', { ascending: true }) 
    ]);

    // 2. Assign to Master State
    state.wiki = wikiData.data || [];
    state.equipment = eq.data || [];
    state.tasks = (tk.data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules = sc.data || [];
    state.parts = pt.data || [];
    state.suppliers = sup.data || [];
    state.documents = docs.data || [];
    state.partUsage = pu.data || [];
    state.recurrenceRules = rr.data || [];
    state.tools = tr.data || []; // 'tr' now maps to tool_requests
    state.observations = obs.data || [];
    window.state.chatMessages = msgs.data || []; 
    console.log(`✅ Sync complete. Found ${state.equipment.length} machines and ${state.tools.length} tools.`);

    // 3. Trigger UI Redraw
    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (typeof window.renderTools === 'function') window.renderTools();
    if (typeof window.updateMetrics === 'function') window.updateMetrics();
    if (typeof window.renderPartsTable === 'function') {window.renderPartsTable(); }
    
    setSyncStatus('online');
    return true;
  } catch(e) { 
    console.error('❌ Data load failed:', e); 
    setSyncStatus('offline');
    return false;
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

export async function startApp() {
  console.log("--- Starting Application Init ---");
  
  // No client creation here anymore! 
  
  try {
    await fetchAllProfiles(); 
    const sessionData = await validateSession();

    if(sessionData) {
      window.currentUser = sessionData.profiles;
      await fetchAbsences(); 
      if (typeof window.enterApp === 'function') window.enterApp(); 
    } else {
      if (typeof window.showPinLogin === 'function') window.showPinLogin();
    }
  } catch(e) { 
    console.error("Startup error:", e);
    if (typeof window.showPinLogin === 'function') window.showPinLogin();
  }
}
