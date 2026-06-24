// tools.js - Tool Crib, Wishlist, and Tool Notes
import { supabase, persist } from './db.js';
import { uid, showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';

// 1. Fetch all tools from the database
export async function fetchTools() {
    // 1. Grab the global state automatically
    const s = window.state;

    try {
        console.log("Fetching tools from database...");
        const { data, error } = await supabase.from('tool_requests').select('*');
        if (error) throw error;

        // 2. Save the data into the Master Folder
        if (s) {
            s.tools = data || [];
            console.log(`✅ Loaded ${s.tools.length} tools into state.`);
        } else {
            console.warn("⚠️ Global state object not found!");
        }

        return data || [];
    } catch (err) {
        console.error("❌ Fetch tools failed:", err);
        return [];
    }
}

// 2. Save or Update a Tool
export async function saveTool(record) {
    try {
        const { error } = await supabase.from('tool_requests').upsert([record]);
        if (error) throw error;
        showToast("Tool saved ✓");
        return true;
    } catch (e) {
        console.error(e);
        showToast("Save failed");
        return false;
    }
}

// 3. Delete a Tool
export async function deleteTool(id, state) {
    if (!confirm("Are you sure you want to permanently delete this tool?")) return;
    try {
        const { error } = await supabase.from('tool_requests').delete().eq('id', id);
        if (error) throw error;
        state.tools = state.tools.filter(t => t.id !== id);
        showToast("Tool deleted");
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// 4. Handle Tool Observations (Notes) - Merged version of your duplicates
export async function addToolNote(toolId, body, author, state) {
    const newNote = {
        id: uid(),
        equip_id: toolId, // Your DB uses equip_id for tool notes too
        author: author,
        body: body,
        severity: 'info',
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('observations').insert([newNote]);
        if (error) throw error;
        state.observations.push(newNote);
        showToast("Note added ✓");
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// 5. The function that was causing your error! (Merged version)
export async function deleteToolObservation(obsId, state) {
    if (!confirm("Delete this note?")) return;
    try {
        await supabase.from('observations').delete().eq('id', obsId);
        state.observations = state.observations.filter(o => o.id !== obsId);
        showToast("Note removed");
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// 6. Wishlist Logic (Approve/Deny)
export async function handleWishAction(id, status, reason = "") {
    try {
        const updates = { status, denial_reason: reason, last_updated: new Date().toISOString() };
        const { error } = await supabase.from('tool_requests').update(updates).eq('id', id);
        if (error) throw error;
        showToast(`Request ${status} ✓`);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
export async function editToolObservation(obsId, state) {
    const note = state.observations.find(o => o.id === obsId);
    if (!note) {
        console.error("Note not found in memory.");
        return;
    }

    const edited = prompt('Edit note:', note.body || '');
    if (edited === null) return; // User cancelled
    
    const body = edited.trim();
    if (!body || body === note.body) return;

    try {
        // 1. Update Supabase
        const { error } = await supabase.from('observations').update({ body }).eq('id', obsId);
        if (error) throw error;

        // 2. Update Local Memory
        note.body = body;
        
        showToast('Note updated ✓');
        return true;
    } catch (e) {
        console.error('Edit failed:', e);
        showToast('Update failed');
        return false;
    }
}
export async function processReview(newStatus, currentReviewId) {
    if (!currentReviewId) return;

    const arrivalDate = document.getElementById('rev-date')?.value;
    const denialReason = document.getElementById('rev-denial-reason')?.value;

    // Validation
    if (newStatus === 'ordered' && !arrivalDate) {
        alert("Please select an expected arrival date.");
        return false;
    }
    if (newStatus === 'denied' && !denialReason) {
        alert("Please provide a reason for the denial.");
        return false;
    }

    try {
        const updates = { 
            status: newStatus,
            expected_arrival: newStatus === 'ordered' ? arrivalDate : null,
            denial_reason: newStatus === 'denied' ? denialReason : null,
            last_updated: new Date().toISOString()
        };

        // 1. Update Supabase
        const { error } = await supabase
            .from('tool_requests')
            .update(updates)
            .eq('id', currentReviewId);

        if (error) throw error;

        showToast(newStatus === 'ordered' ? "Tool Ordered! 📦" : "Request Denied ❌");
        
        closeModal('review-modal');
        
        // 2. Return true so the main app knows to refresh the tables
        return true;

    } catch (e) {
        console.error("Review process failed:", e);
        alert("Update failed: " + e.message);
        return false;
    }
}

export async function handleWishApproval(id, state) {
    const req = state.wishlist.find(x => x.id === id);
    if (!req) return;

    // 1. Mark as approved
    await window._mpdb.from('tool_requests').update({status: 'approved'}).eq('id', id);

    // 2. Create the tool as "On Order"
    const newTool = {
        id: uid(), name: req.tool_name, category: 'Other',
        location: '📦 ON ORDER', health: 100, is_lost: false,
        last_updated: new Date().toISOString()
    };
    
    state.tools.push(newTool);
    await window._mpdb.from('shop_tools').insert(newTool);
    showToast("Approved! Tool moved to 'On Order'");
}

export async function handleWishDenial(id, state) {
    const reason = prompt("Why is this being denied?");
    if (reason === null) return;

    await window._mpdb.from('tool_requests').update({status: 'denied', denial_reason: reason}).eq('id', id);
    showToast("Request denied");
}

export function renderTools() {
    const tableBody = document.getElementById('tools-table-body');
    if (!tableBody) return;

    // 1. Filter tools
    const tools = (window.state.tools || []).filter(t => t.status === 'available' || t.status === 'ordered');
    
    if (tools.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">No tools in inventory.</td></tr>';
        return;
    }

    const isAdmin = window.currentUser?.role === 'admin' || window.currentUser?.role === 'manager';

    // 2. Build the HTML string
    tableBody.innerHTML = tools.map(t => {
        const name = t.tool_name || t.name || 'Unnamed';
        const health = t.health || 100;
        const status = t.status || 'available';
        const location = t.location || '—';
        const isOrdered = status === 'ordered';

        // --- THE MISSING PART: You must RETURN the HTML ---
        return `
            <tr onclick="window.editTool('${t.id}')" style="cursor:pointer; ${isOrdered ? 'background:rgba(0,123,255,0.05);' : ''}">
                <td><b>${name}</b></td>
                <td>${t.category || 'Other'}</td>
                <td>${isOrdered ? '📦 ON ORDER' : location}</td>
                <td>
                    <div style="width:60px; height:8px; background:#ddd; border-radius:4px; overflow:hidden;">
                        <div style="width:${health}%; height:100%; background:${health > 40 ? '#28a745' : '#dc3545'};"></div>
                    </div>
                </td>
                <td><span class="badge ${isOrdered ? 'bi' : 'bs'}">${status.toUpperCase()}</span></td>
                <td>${t.procurement || '—'}</td>
            </tr>`;
    }).join(''); 
}

export function renderWishlist() {
    const container = document.getElementById('wishlist-container');
    const pending = state.wishlist.filter(w => w.status === 'pending');
    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';

    container.innerHTML = pending.map(w => `
        <div class="card" style="border-left: 5px solid var(--warning)">
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                    <div style="font-weight:700; font-size:15px">${w.tool_name}</div>
                    <!-- ONLY MANAGERS SEE THE NAME -->
                    <div style="font-size:11px; color:var(--text3); margin-top:2px">
                        ${isManager ? `Requested by <b>${w.requested_by}</b>` : `Status: Pending Review`}
                    </div>
                </div>
                <span class="badge bw">PENDING</span>
            </div>
            <div style="margin-top:10px; font-size:13px; color:var(--text2); background:var(--bg2); padding:8px 10px; border-radius:4px">
                <b>Reason Needed:</b> ${w.request_reason || 'No reason provided.'}
            </div>
            ${isManager ? `
                <div style="margin-top:12px; display:flex; gap:8px">
                    <button class="btn btn-success btn-sm" onclick="handleWishApproval('${w.id}')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="handleWishDenial('${w.id}')">Deny</button>
                </div>
            ` : ''}
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No pending suggestions.</div>';
    updateWishCount();
}
export function renderDeniedList() {
    const container = document.getElementById('denied-container');
    const denied = state.wishlist.filter(w => w.status === 'denied');
    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';
    
    container.innerHTML = denied.map(w => `
        <div class="card" style="border-left: 5px solid var(--danger); opacity: 0.9">
            <div style="display:flex; justify-content:space-between">
                <div>
                    <div style="font-weight:700; font-size:15px">${w.tool_name}</div>
                    <div style="font-size:11px; color:var(--text3)">
                        Denied on: ${new Date(w.created_at).toLocaleDateString()} 
                        ${isManager ? ` · Requested by: ${w.requested_by}` : ''}
                    </div>
                </div>
                <span class="badge bd">DENIED</span>
            </div>
            <div style="margin-top:10px; font-size:12px; color:var(--danger-text); background:var(--danger-bg); padding:8px 10px; border-radius:4px">
                <b>Denial Reason:</b> ${w.denial_reason || 'Not specified.'}
            </div>
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No denied tools in history.</div>';
}
