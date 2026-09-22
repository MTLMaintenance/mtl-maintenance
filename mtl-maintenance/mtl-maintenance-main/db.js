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

// 4. Persistence + offline queue
const OFFLINE_QUEUE_KEY = 'mp_offline_queue';
let offlineQueue = loadOfflineQueue();

function loadOfflineQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Could not read offline queue:', e);
    return [];
  }
}

function saveOfflineQueue() {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue)); } catch (e) {}
  const banner = document.getElementById('offline-queue-banner');
  if (banner) banner.style.display = offlineQueue.length ? 'block' : 'none';
}

function prepareRecordForDb(table, record) {
  if (!record || typeof record !== 'object') return record;
  const clean = { ...record };

  // `equipId` is a legacy UI alias. Supabase tasks use `equip_id`; never
  // send the client-only alias as an extra database column.
  if (table === 'tasks') {
    if (!clean.equip_id && clean.equipId) clean.equip_id = clean.equipId;
    delete clean.equipId;
  }

  return clean;
}

function enqueueOfflineChange(table, action, record) {
  offlineQueue.push({ table, action, record, queued_at: new Date().toISOString() });
  saveOfflineQueue();
}

export async function persist(table, action, record) {
  const dbRecord = action === 'upsert' ? prepareRecordForDb(table, record) : record;
  const recordId = (typeof dbRecord === 'object' && dbRecord !== null) ? dbRecord.id : dbRecord;

  if (!navigator.onLine) {
    enqueueOfflineChange(table, action, dbRecord);
    setSyncStatus('offline');
    showToast('Saved locally — will sync when online');
    return true;
  }

  try {
    let error = null;
    if (action === 'upsert') ({ error } = await supabase.from(table).upsert(dbRecord));
    else if (action === 'delete') ({ error } = await supabase.from(table).delete().eq('id', recordId));
    else throw new Error(`Unknown persist action: ${action}`);

    if (error) throw error;

    setSyncStatus('online');
    showToast('Synced ✓');
    return true;
  } catch (e) {
    console.error('DB Error:', e);
    showToast(`Save failed: ${e.message || 'Unknown error'}`);
    setSyncStatus('offline');
    return false;
  }
}

export async function syncOfflineQueue() {
  if (!offlineQueue.length) {
    saveOfflineQueue();
    return true;
  }
  if (!navigator.onLine) {
    setSyncStatus('offline');
    return false;
  }

  showToast(`Syncing ${offlineQueue.length} changes...`);
  const failed = [];

  for (const item of offlineQueue) {
    try {
      if (!item || !item.record) continue;
      const recordId = (typeof item.record === 'object') ? item.record.id : item.record;
      let error = null;

      if (item.action === 'upsert') {
        ({ error } = await supabase.from(item.table).upsert(item.record));
      } else if (item.action === 'delete') {
        ({ error } = await supabase.from(item.table).delete().eq('id', recordId));
      } else {
        throw new Error(`Unknown queued action: ${item.action}`);
      }

      if (error) throw error;
    } catch (e) {
      console.error('Offline sync failed for item:', item, e);
      failed.push(item);
    }
  }

  offlineQueue = failed;
  saveOfflineQueue();

  if (!failed.length) {
    setSyncStatus('online');
    showToast('All changes synced ✓');
    return true;
  }

  setSyncStatus('offline');
  showToast(`${failed.length} item${failed.length === 1 ? '' : 's'} failed to sync`);
  return false;
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
export async function destroySession() {
  const token = localStorage.getItem('mp_session_token');
  if(token) {
    try { await supabase.from('app_sessions').delete().eq('token', token); } catch(e) {}
    localStorage.removeItem('mp_session_token');
    localStorage.removeItem('mp_session');
  }
}
