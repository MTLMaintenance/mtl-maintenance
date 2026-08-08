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
        if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
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

    // Every caller invokes this as window.renderUsersTable() with no argument,
    // so fall back to the global state (same pattern as populateAdminUserSelect).
    const s = state || window.state || {};
    const active = (s.users_list_cache || []).filter(p => p.status === 'approved');
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
        const roleEl = document.getElementById('role-select');
        const groupEl = document.getElementById('group-select');
        if (roleEl) roleEl.value = profile.role || 'tech';
        if (groupEl) groupEl.value = profile.group_tag || '';
    }
}

export async function changeUserRole(renderUsersTableFunc, state) {
  const userId = document.getElementById('role-user-select').value;
  const newRole = document.getElementById('role-select').value;
  const newGroup = document.getElementById('group-select')?.value || '';

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

    // Nothing else populates this cache, but renderUsersTable(), populateAdminUserSelect(),
    // and syncAdminRoleSelects() all read from it — so build it here from the same fetch.
    window.state = window.state || {};
    window.state.users_list_cache = profiles;

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

    // Keep the Symptoms tab badge fresh too, even before that tab is opened
    await ensureCustomSymptomsLoadedAdmin();
    updateSymptomReviewBadge();
  } catch(e){ console.error(e); }
}

// ── SYMPTOM REVIEW QUEUE ─────────────────────────────────────────────
// Custom "Other" symptoms that didn't closely match anything existing
// land here (see resolveCustomSymptom() in tasks.js). An admin either
// approves one as a real category, or merges it into an existing one —
// which also relabels every task that used the old text, so ranking
// logic downstream sees one consistent symptom instead of duplicates.

const PREDEFINED_SYMPTOM_OPTIONS = [
    ['wont_start', "Won't Start"],
    ['overheating', "Overheating"],
    ['leaking', "Leaking"],
    ['electrical', "Electrical Fault"],
    ['unusual_noise', "Unusual Noise/Vibration"],
    ['loss_of_power', "Loss of Power"],
    ['hydraulic_issue', "Hydraulic Issue"]
];

async function ensureCustomSymptomsLoadedAdmin() {
    if (window.state.customSymptoms) return;
    try {
        const { data, error } = await supabase.from('custom_symptoms').select('*');
        if (error) throw error;
        window.state.customSymptoms = data || [];
    } catch (e) {
        console.error('Failed to load custom symptoms:', e);
        window.state.customSymptoms = [];
    }
}

// Keeps the small red badge on the "Symptoms" admin tab in sync, so
// there's a visible signal a review is waiting without opening the tab.
export function updateSymptomReviewBadge() {
    const pending = (window.state.customSymptoms || []).filter(c => c.status === 'pending');
    const tabBadge = document.getElementById('symptom-review-badge');
    if (tabBadge) {
        tabBadge.style.display = pending.length ? 'inline-block' : 'none';
        tabBadge.textContent = pending.length;
    }
    const panelBadge = document.getElementById('pending-symptom-count');
    if (panelBadge) panelBadge.textContent = pending.length;
}

export async function renderSymptomReview() {
    const container = document.getElementById('symptom-review-list');
    if (!container) return;

    await ensureCustomSymptomsLoadedAdmin();
    updateSymptomReviewBadge();

    const pending = (window.state.customSymptoms || [])
        .filter(c => c.status === 'pending')
        .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));

    // Merge target options: every predefined category, plus any custom
    // symptom already approved as its own category.
    const approvedCustoms = (window.state.customSymptoms || []).filter(c => c.status === 'approved');
    const mergeOptions = [
        ...PREDEFINED_SYMPTOM_OPTIONS,
        ...approvedCustoms.map(c => [c.normalized_text, c.raw_text])
    ];

    container.innerHTML = pending.map(c => `
        <div class="parts-row" style="align-items:center;">
            <div style="flex:1">
                <b>"${c.raw_text}"</b>
                <span class="badge bg" style="margin-left:8px;">${c.usage_count || 1}x used</span>
            </div>
            <select id="merge-target-${c.id}" class="form-select" style="max-width:200px; margin-right:8px;">
                <option value="">-- Merge into... --</option>
                ${mergeOptions.map(([val, label]) => `<option value="${val}">${label}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-sm" onclick="window.mergeCustomSymptom('${c.id}')">Merge</button>
            <button class="btn btn-success btn-sm" onclick="window.approveCustomSymptom('${c.id}')">Approve as New</button>
        </div>
    `).join('') || '<div style="padding:15px; text-align:center; color:var(--text3);">No custom symptoms waiting for review.</div>';
}

// Approves a pending custom symptom as its own standalone category —
// it stays as-is and future similar text will fuzzy-match onto it.
export async function approveCustomSymptom(id) {
    const entry = (window.state.customSymptoms || []).find(c => c.id === id);
    if (!entry) return;

    try {
        const { error } = await supabase.from('custom_symptoms').update({ status: 'approved' }).eq('id', id);
        if (error) throw error;

        entry.status = 'approved';
        showToast(`"${entry.raw_text}" approved as a new symptom category ✓`);
        renderSymptomReview();
    } catch (e) {
        console.error('Failed to approve symptom:', e);
        showToast('Failed to approve');
    }
}

// Merges a pending custom symptom into an existing category — relabels
// every task that used the old text so historical data stays consistent.
export async function mergeCustomSymptom(id) {
    const entry = (window.state.customSymptoms || []).find(c => c.id === id);
    if (!entry) return;

    const targetSelect = document.getElementById(`merge-target-${id}`);
    const targetValue = targetSelect ? targetSelect.value : '';
    if (!targetValue) return showToast('Pick a symptom to merge into first');

    if (!confirm(`Merge "${entry.raw_text}" into this symptom? Every past work order tagged "${entry.raw_text}" will be relabeled too.`)) return;

    try {
        // 1. Relabel every task that used the old (pending) normalized text
        const { error: taskErr } = await supabase.from('tasks').update({ symptom: targetValue }).eq('symptom', entry.normalized_text);
        if (taskErr) throw taskErr;

        // 2. Mark this custom entry as merged so it stops being matchable
        const { error: mergeErr } = await supabase.from('custom_symptoms').update({ status: 'merged', merged_into: targetValue }).eq('id', id);
        if (mergeErr) throw mergeErr;

        // 3. Update local memory to match
        entry.status = 'merged';
        entry.merged_into = targetValue;
        (window.state.tasks || []).forEach(t => { if (t.symptom === entry.normalized_text) t.symptom = targetValue; });

        showToast(`Merged "${entry.raw_text}" ✓`);
        renderSymptomReview();
    } catch (e) {
        console.error('Failed to merge symptom:', e);
        showToast('Failed to merge');
    }
}
