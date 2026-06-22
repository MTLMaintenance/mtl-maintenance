// admin.js - User Management & System Administration
import { supabase } from './db.js';
import { showToast } from './utils.js';

// 1. Approve a User (Merged version of your duplicates)
export async function approveUser(id) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'approved' })
            .eq('id', id);

        if (error) throw error;

        showToast('User approved ✓');
        
        // This triggers a UI refresh if the function exists in your main file
        if (typeof renderAdminPanel === 'function') renderAdminPanel();
        if (typeof renderUsersTable === 'function') renderUsersTable();
        
    } catch (e) {
        console.error("Approval error:", e);
        showToast("Failed to approve user");
    }
}

// 2. Deny/Block a User
export async function denyUser(id) {
    if (!confirm("Are you sure you want to deny this request?")) return;
    try {
        await supabase.from('profiles').update({ status: 'denied' }).eq('id', id);
        showToast('Access denied');
        if (typeof renderAdminPanel === 'function') renderAdminPanel();
    } catch (e) { console.error(e); }
}

// 3. Delete a User Permanently
export async function deleteUser(id) {
    if (!confirm('Permanently delete this user? This cannot be undone.')) return;

    try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        
        showToast('User removed');
        if (typeof renderUsersTable === 'function') renderUsersTable();
    } catch (e) {
        console.error("Delete error:", e);
        showToast("Failed to delete user");
    }
}

// 4. Audit Logging (Used for tracking who did what)
export async function logAuditAction(action, details, currentUser) {
    try {
        await supabase.from('audit_logs').insert({
            user_name: currentUser?.name || 'System',
            action: action,
            details: details,
            created_at: new Date().toISOString()
        });
    } catch(e) { console.warn("Audit log failed"); }
}


e
export async function renderAuditLogs() {
    const container = document.getElementById('audit-log-list');
    if (!container) return;

    try {
        const { data: logs, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;

        container.innerHTML = logs.map(log => `
            <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; gap:12px;">
                <div style="font-size:10px; color:var(--text3); width:70px;">
                    ${new Date(log.created_at).toLocaleDateString()}
                </div>
                <div style="flex:1">
                    <b style="color:var(--accent)">${log.user_name}</b> ${log.action}
                    <div style="font-size:11px; color:var(--text2)">${log.details || ''}</div>
                </div>
            </div>`).join('') || '<div style="padding:20px; text-align:center;">No activity logged</div>';
    } catch (e) { console.error("Audit log error:", e); }
}

export async function autoCleanupAuditLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14); // 14 days ago
    try {
        await supabase.from('audit_logs').delete().lt('created_at', cutoff.toISOString());
    } catch (e) { console.error("Cleanup failed", e); }
}
// ── BLOCK CHAT USER ───────────────────────────────────────────
export async function blockChatUser(username,displayName){
  if(!confirm('Block '+displayName+' from sending chat messages?'))return;
  try{await window._mpdb.from('profiles').update({blocked_from_chat:true}).eq('username',username);showToast(displayName+' blocked from chat');}catch(e){showToast('Failed');}
}
export async function unblockChatUser(username,displayName){
  try{await window._mpdb.from('profiles').update({blocked_from_chat:false}).eq('username',username);showToast(displayName+' unblocked');renderDeletedMessages();}catch(e){showToast('Failed');}
}
