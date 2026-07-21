// admin.js - User Management & System Administration
import { supabase } from './db.js';
import { showToast } from './utils.js';
import { PERM_LABELS, PERMISSIONS } from './auth.js';

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
        if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
        
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

export function populateAdminUserSelect() {
    const select = document.getElementById('role-user-select');
    if (!select) return;

    const users = window.state.users_list_cache || [];
    
    let html = '<option value="">-- Select User --</option>';
    users.forEach(u => {
        html += `<option value="${u.id}">${u.full_name || u.username}</option>`;
    });
    
    select.innerHTML = html;
}

export function renderUsersTable(state) {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;

    const active = (state.users_list_cache || []).filter(p => p.status === 'approved');
    const rc = { 'admin': 'bd', 'manager': 'bw', 'tech': 'bi', 'viewer': 'bg' };
    
    tableBody.innerHTML = active.map(p => `
        <tr>
            <td><b>${p.full_name || p.username}</b>${p.group_tag ? ` <span class="badge bi" style="font-size:10px;">${p.group_tag}</span>` : ''}</td>
            <td>${p.username || '—'}</td>
            <td><span class="badge ${rc[p.role] || 'bg'}">${p.role || 'tech'}</span></td>
            <td><span class="badge bs">Approved</span></td>
            <td>
              <div class="flex-gap-5">
                <button class="btn-secondary btn-sm" onclick="window.promptResetPin('${p.id}')">🔑 PIN</button>
                <button class="btn-secondary btn-sm" onclick="window.openPermissionsCard('${p.id}')">🛡️ Perms</button>
                <button class="btn-danger btn-sm" onclick="window.deleteUser('${p.id}')">Delete</button>
              </div>
            </td>
        </tr>`).join('');
}

export function renderPermissionsMatrix() {
    const container = document.getElementById('permissions-table-body');
    if (!container) return;

    const roles = ['admin', 'manager', 'tech', 'viewer'];
    const perms = Object.entries(PERM_LABELS);

    container.innerHTML = perms.map(([key, label]) => `
        <tr>
            <td style="padding:10px; font-weight:500; border-bottom:1px solid #eee;">${label}</td>
            ${roles.map(role => `
                <td style="text-align:center; border-bottom:1px solid #eee;">
                    ${role === 'admin' ? '✅' : `
                        <input type="checkbox" 
                               ${PERMISSIONS[role][key] ? 'checked' : ''} 
                               onchange="window.togglePermission('${role}','${key}',this.checked)"
                               style="cursor:pointer;">
                    `}
                </td>
            `).join('')}
        </tr>
    `).join('');
}

export function clearAuditFilters() {
    const uInp = document.getElementById('audit-filter-user');
    const dInp = document.getElementById('audit-filter-date');
    if(uInp) uInp.value = 'all';
    if(dInp) dInp.value = '';
    // Re-render logs with no filters
    if (typeof window.renderAuditLogs === 'function') window.renderAuditLogs();
}

export function syncAdminRoleSelects(state) {
    const userId = document.getElementById('role-user-select')?.value;
    if (!userId) return;

    const profile = state.users_list_cache.find(u => u.username === userId || u.id === userId);
    if (profile) {
        document.getElementById('role-select').value = profile.role || 'tech';
        document.getElementById('group-select').value = profile.group_tag || '';
    }
}

export async function changeUserRole(renderUsersTableFunc, state) {
  const userId = document.getElementById('role-user-select').value;
  const newRole = document.getElementById('role-select').value;
  const newGroup = document.getElementById('group-select').value;

  if (!userId) return showToast("Select a user first");

  try {
    await window._mpdb.from('profiles').update({ role: newRole, group_tag: newGroup || null }).eq('id', userId);
    showToast("User updated ✓");
    renderUsersTableFunc(state);
  } catch(e) { showToast("Failed to update"); }
}

export async function resetUserPassword(userId, userName) {
  const newPass = prompt('Set a new password for ' + userName + ':');
  if(!newPass || newPass.trim().length < 4) return;
  
  const confirm2 = prompt('Confirm new password:');
  if(newPass !== confirm2) return alert("Passwords do not match");

  try {
    const hashed = await window.hashPassword(newPass.trim());
    await window._mpdb.from('profiles').update({ password_hash: hashed }).eq('id', userId);
    showToast(userName + ' password reset ✓');
  } catch(e) { showToast('Failed'); }
}

export async function unlockUser(userId, userName) {
  try {
    await window._mpdb.from('profiles').update({ 
        login_attempts: 0, 
        locked_until: null 
    }).eq('id', userId);
    showToast(userName + ' unlocked ✓');
  } catch(e) { showToast('Failed to unlock'); }
}

export async function saveUserPerms() {
    // These variables need to be global or accessible via state
    const userId = window.editingUserId; 
    const perms = window.editingPerms;

    if (!userId) return;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ permissions: perms })
            .eq('id', userId);

        if (error) throw error;

        window.showToast("Permissions updated ✓");
        window.closeModal('user-perms-modal');
        
        // Refresh the user table to show changes
        if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
    } catch (e) {
        alert("Error saving: " + e.message);
    }
}

export function resetUserPerms() {
    if (!confirm("Reset this user to default role permissions?")) return;
    
    // Clear the custom overrides
    window.editingPerms = {}; 
    
    // Redraw the list in the modal
    if (typeof window.renderUserPermsList === 'function') {
        window.renderUserPermsList();
    }
}

export function openUserPermissions(userId) {
    console.log("Opening permissions for User ID:", userId);

    // 1. Find the Permissions Panel and Show it
    // Note: We search for the panel and manually force it to show
    const permPanel = document.getElementById('admin-permissions');
    if (permPanel) {
        // First, hide all other panels so they don't overlap
        document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
        
        // Show the permissions panel
        permPanel.style.display = 'block';
        permPanel.classList.add('active');
    } else {
        console.error("Could not find element 'admin-permissions'");
        return;
    }

    // 2. Select the user in the dropdown
    const userDropdown = document.getElementById('role-user-select');
    if (userDropdown) {
        userDropdown.value = userId;
        // Trigger the sync function so the role/group boxes update to match the user
        if (typeof syncAdminRoleSelects === 'function') {
            syncAdminRoleSelects();
        }
    }
}

export async function renderAdminPanel(){
  try {
    const { data: profiles } = await window._mpdb.from('profiles').select('*').order('created_at',{ascending:false});
    if (!profiles) return;
    
    const pending = profiles.filter(p => p.status === 'pending');
    const denied = profiles.filter(p => p.status === 'denied');
    document.getElementById('pending-count').textContent = pending.length || '0';
    document.getElementById('pending-list').innerHTML = pending.map(p => `
      <div class="parts-row">
        <div style="flex:1"><b>${p.full_name}</b> (${p.username})</div>
        <button class="btn btn-success btn-sm" onclick="window.approveUser('${p.id}')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="window.denyUser('${p.id}')">Deny</button>
      </div>`).join('') || 'No pending requests';

    const deniedList = document.getElementById('denied-list');
    if (deniedList) {
        deniedList.innerHTML = denied.map(p => `
          <div class="parts-row">
            <div style="flex:1"><b>${p.full_name}</b> (${p.username})</div>
            <button class="btn btn-danger btn-sm" onclick="window.deleteUser('${p.id}')">Delete</button>
          </div>`).join('') || 'No denied requests';
    }

    // Call user table render to fill the rest
    if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
  } catch(e){ console.error(e); }
}
