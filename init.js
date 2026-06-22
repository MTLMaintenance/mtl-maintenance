// init.js - Application Bootstrapping
import { supabase, setSyncStatus } from './db.js';
import { updateMetrics } from './dashboard.js';

export async function loadState() {
  const state = window.state; 
  if (!state) return console.error("Global state not found!");
  setSyncStatus('syncing');
  try {
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
      supabase.from('observations').select('*').order('created_at',{ascending:false})
    ]);

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

    updateMetrics();
    setSyncStatus('online');
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
