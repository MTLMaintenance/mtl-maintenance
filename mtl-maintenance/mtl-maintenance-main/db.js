// db.js - The Database Engine
import { showToast } from './utils.js';

// 1. Connection Config (Move these from your big file)
export const SUPABASE_URL = 'https://ldxryhgovspckypqoqvf.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeHJ5aGdvdnNwY2t5cHFvcXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODk2MTksImV4cCI6MjA4OTI2NTYxOX0.rI_PLHYbp_tat5vsXDHXbc0zbokhGrBq_Tg9vFrWuSc';
// 2. Initialize the Client
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window._mpdb = supabase; 
window.supabase = supabase; 
// 3. Sync Status (The green/orange/red dot)
export function setSyncStatus(s) {
  const dot = document.getElementById('sync-dot'); 
  if(!dot) return;
  dot.className = 'sync-dot';
  if(s === 'syncing') dot.classList.add('syncing');
  else if(s === 'offline') dot.classList.add('offline');
}

// 4. The Master Persist Function (Handles saving & offline queue)
export async function persist(table, action, record) {
  const recordId = (typeof record === 'object' && record !== null) ? record.id : record;

  if(!navigator.onLine) {
    // We'll handle the offline queue in a moment, for now:
    showToast('Saved locally (Offline)');
    return;
  }

  try {
    let error;
    if(action==='upsert') ({ error } = await supabase.from(table).upsert(record));
    if(action==='delete') ({ error } = await supabase.from(table).delete().eq('id', recordId));

    // Supabase-js does NOT throw on RLS/permission/schema errors — it just
    // returns { error }. Without this check, a failed write still falls
    // through and reports "Synced" even though nothing was saved.
    if (error) throw error;

    setSyncStatus('online'); 
    showToast('Synced ✓');
  } catch(e) {
    console.error("DB Error:", e);
    showToast(`Save failed: ${e.message || 'Unknown error'}`);
    setSyncStatus('offline');
  }
}

// 5. Session Helpers
export async function createSession(username, userId) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 8*60*60*1000).toISOString();
  try {
    await supabase.from('app_sessions').insert({
      token, username, user_id: userId,
      expires_at: expiresAt, last_active: new Date().toISOString()
    });
    localStorage.setItem('mp_session_token', token);
  } catch(e) { console.error('Session create failed:', e); }
  return token;
}
export async function validateSession() {
  const token = localStorage.getItem('mp_session_token');
  if(!token) return null;
  try {
    const { data: session } = await supabase.from('app_sessions').select('*').eq('token', token).single();
    if(!session || new Date(session.expires_at) < new Date()) return null;
    
    const { data: profile } = await supabase.from('profiles').select('*').eq('username', session.username).single();
    return { ...session, profiles: profile };
  } catch(e) { return null; }
}
export async function syncOfflineQueue() {
  if (!offlineQueue || !offlineQueue.length) {
    const banner = document.getElementById('offline-queue-banner');
    if (banner) banner.style.display = 'none';
    return;
  }
  
  showToast(`Syncing ${offlineQueue.length} changes...`);
  const failed = [];

  for (const item of offlineQueue) {
    try {
      // Safety: Skip if item or record is missing
      if (!item || !item.record) continue;

      // Extract ID correctly
      const recordId = (typeof item.record === 'object') ? item.record.id : item.record;

      if (item.action === 'upsert') {
        await window._mpdb.from(item.table).upsert(item.record);
        console.log(`Sync Upsert for ${item.table}: ${recordId} SUCCESS`);
      } 
      else if (item.action === 'delete') {
        const { error, count } = await window._mpdb
          .from(item.table)
          .delete({ count: 'exact' })
          .eq('id', recordId);
        
        if (error) throw error;
        console.log(`Sync Delete for ${item.table}: ${recordId} - ${count} rows removed`);
      }
    } catch (e) { 
      console.error("Sync failed for item:", item, e);
      failed.push(item); 
    }
  }
  
  offlineQueue = failed;
  saveOfflineQueue();
  
  if (failed.length === 0) {
    setSyncStatus('online');
    showToast('All changes synced ✓');
    const banner = document.getElementById('offline-queue-banner');
    if (banner) banner.style.display = 'none';
  } else {
    showToast(`${failed.length} items failed to sync`);
  }
}

export async function destroySession() {
  const token = localStorage.getItem('mp_session_token');
  if(token) {
    try { await supabase.from('app_sessions').delete().eq('token', token); } catch(e) {}
    localStorage.removeItem('mp_session_token');
    localStorage.removeItem('mp_session');
  }
}
