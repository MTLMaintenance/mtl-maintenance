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
  // 1. Grab the global folder from the window
  const state = window.state; 
  
  if (!state) {
    console.error("Critical: Global state object not found on window.");
    return false;
  }

  setSyncStatus('syncing');
  try {
    // 2. Fetch all main tables
    const [eq, tk, sc, pt, sup, docs, pu, rr, tl, wl, obs] = await Promise.all([
      supabase.from('equipment').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('schedules').select('*'),
      supabase.from('parts').select('*'),
      supabase.from('suppliers').select('*'),
      supabase.from('documents').select('*'),
      supabase.from('part_usage').select('*'),
      supabase.from('recurrence_rules').select('*'),
      supabase.from('shop_tools').select('*'),
      supabase.from('tool_requests').select('*').order('created_at', {ascending: false}),
      supabase.from('observations').select('*').order('created_at', {ascending:false})
    ]);

    // 3. Map the data into the state
    state.equipment = eq.data || [];
    state.tasks = (tk.data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules = sc.data || [];
    state.parts = pt.data || [];
    state.suppliers = sup.data || [];
    state.documents = docs.data || [];
    state.partUsage = pu.data || [];
    state.recurrenceRules = rr.data || [];
    state.tools = tl.data || [];
    state.wishlist = wl.data || [];
    state.observations = obs.data || [];

console.log("Data loaded, drawing calendar...");
    if (typeof window.renderCalendar === 'function') {
        window.renderCalendar();
    }
    
 if (typeof window.renderCalendar === 'function') {
        window.renderCalendar();
    }
    
     if (typeof window.renderChecklistTemplates === 'function') {
        window.renderChecklistTemplates();
    }
    // 4. Trigger UI Refresh
    if (typeof updateMetrics === 'function') updateMetrics();
    setSyncStatus('online');
    
    console.log("✅ LoadState successful.");
    return true;
  } catch(e) { 
    console.error('Load error:', e); 
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

  // --- THE VITAL MISSING PIECE ---
  // 1. Hide the login screen
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';

  // 2. Show the main application container
  const appContainer = document.getElementById('app');
  if (appContainer) appContainer.style.display = 'flex';
  // -------------------------------

  const check = typeof canFunc === 'function' ? canFunc : () => true;

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
        // USE THE 'check' VARIABLE HERE
        if (btn.id === 'analytics' && !check('canViewReports')) return;
        if (btn.id === 'suppliers' && !check('canManageSuppliers')) return;

        const b = document.createElement('button');
        b.className = 'nav-btn';
        b.onclick = () => showPanel(btn.id);
        b.innerHTML = btn.id === 'chat' ? 
          `Chat <span id="chat-unread-top" class="badge bd" style="display:none">0</span>` : btn.label;
        nav.appendChild(b);
      });

      if (currentUser && currentUser.role === 'admin') {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-btn';
        adminBtn.onclick = () => showPanel('admin');
        adminBtn.textContent = 'Admin';
        nav.appendChild(adminBtn);
      }
  }

  // Load personalization
  if (typeof applyUserPreferences === 'function') {
      applyUserPreferences(currentUser);
  }
  
  // Set preferred home page
  const home = currentUser?.preferences?.startPage || 'dashboard';
  showPanel(home); 

  // Force layout snap
  setTimeout(() => {
      if (typeof adjustMobileLayout === 'function') adjustMobileLayout();
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
