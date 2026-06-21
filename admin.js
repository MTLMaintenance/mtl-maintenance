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
export async function showPinLogin() {
    const list = document.getElementById('user-name-list');
    if (!list) return;
    list.innerHTML = '<div style="color:white;">Loading names...</div>';

    try {
        const { data: users, error } = await window._mpdb.from('profiles').select('*');
        if (error) throw error;

        list.innerHTML = '';
        users.forEach(user => {
            const card = document.createElement('div');
            card.className = "login-card"; // Apply your styles here
            card.innerHTML = user.full_name || user.username;
            card.onclick = () => selectUserForLogin(user);
            list.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

export function selectUserForLogin(user) {
    window.selectedLoginUser = user;
    window.enteredPin = "";
    document.getElementById('selected-user-display').textContent = "Hello, " + (user.full_name || user.username);
    document.getElementById('login-stage-names').style.display = 'none';
    document.getElementById('login-stage-pin').style.display = 'block';
    updatePinDots();
}

export function pressPin(num) {
    if (num === 'clear') window.enteredPin = "";
    else if (window.enteredPin.length < 10) window.enteredPin += num;
    updatePinDots();
}

export async function verifyUserPin() {
    const { data, error } = await window._mpdb.from('profiles')
        .select('*')
        .eq('id', window.selectedLoginUser.id)
        .eq('pin_code', window.enteredPin)
        .single();

    if (data) {
        window.currentUser = { ...data, name: data.full_name || data.username };
        localStorage.setItem('mp_session', JSON.stringify(window.currentUser));
        await window.createSession(data.username, data.id);
        await window.enterApp(); 
    } else {
        alert("Incorrect PIN");
        window.enteredPin = "";
        updatePinDots();
    }
}

export function updatePinDots() {
    const container = document.getElementById('pin-display');
    if (!container) return;
    const dotsCount = Math.max(4, window.enteredPin.length);
    let html = "";
    for (let i = 0; i < dotsCount; i++) {
        html += `<div class="pin-dot ${i < window.enteredPin.length ? 'filled' : ''}"></div>`;
    }
    container.innerHTML = html;
}
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
