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
