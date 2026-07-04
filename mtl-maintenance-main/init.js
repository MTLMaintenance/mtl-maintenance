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
  console.log("📥 Syncing all data from Supabase...");
  
  const state = window.state;
  if (!state) return console.error("Global state folder not found!");

  setSyncStatus('syncing');

  try {
    // 1. Fetch EVERYTHING from the cloud at once
    const [eq, tk, sc, pt, sup, docs, pu, rr, tr, obs, wiki, msgs] = await Promise.all([
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
      window._mpdb.from('chat_messages').select('*').order('created_at', { ascending: true })
    ]);

    // 2. Save all data into the Master State folder
    state.equipment = eq.data || [];
    state.tasks = (tk.data || []).map(t => ({ ...t, equipId: t.equip_id }));
    state.schedules = sc.data || [];
    state.parts = pt.data || [];
    state.suppliers = sup.data || [];
    state.documents = docs.data || [];
    state.partUsage = pu.data || [];
    state.recurrenceRules = rr.data || [];
    state.tools = tr.data || [];
    state.observations = obs.data || [];
    state.wiki = wiki.data || [];
    state.chatMessages = msgs.data || [];

    console.log(`✅ Sync complete. Found ${state.equipment.length} machines and ${state.chatMessages.length} messages.`);

    // 3. Trigger all the UI "Paintbrushes" to draw the data
    if (typeof window.renderEquipmentTable === 'function') window.renderEquipmentTable();
    if (typeof window.renderTools === 'function') window.renderTools();
    if (typeof window.renderPartsTable === 'function') window.renderPartsTable();
    if (typeof window.renderConsumablesTable === 'function') window.renderConsumablesTable();
    if (typeof window.renderChecklistTemplates === 'function') window.renderChecklistTemplates();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.updateMetrics === 'function') window.updateMetrics();
    
    setSyncStatus('online');
    return true;

  } catch(e) { 
    console.error('❌ Data load failed:', e); 
    setSyncStatus('offline');
    return false;
  }
}

// Helper to keep modals on top
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
  window._mpdb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  try {
    await fetchAllProfiles(); 
    const sessionData = await validateSession();    
    if(sessionData) {
      window.currentUser = sessionData.profiles;
      await loadState(); 
      await enterApp(window.currentUser, window.state, window.can); 
      
      console.log("🚀 App ready and data loaded.");
    } else {
      showPinLogin();
    }
  } catch(e) { 
    console.error("Startup error:", e);
    showPinLogin(); 
  }
}

