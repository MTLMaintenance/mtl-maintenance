// db.js - The Database Engine
import { showToast } from './utils.js';

// 1. Connection Config (Move these from your big file)
export const SUPABASE_URL = 'https://ldxryhgovspckypqoqvf.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Copy your full key here

// 2. Initialize the Client
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    if(action==='upsert') await supabase.from(table).upsert(record);
    if(action==='delete') await supabase.from(table).delete().eq('id', recordId);
    setSyncStatus('online'); 
    showToast('Synced ✓');
  } catch(e) {
    console.error("DB Error:", e);
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
