// tools.js - Tool Crib, Wishlist, and Tool Notes
import { supabase, persist } from './db.js';
import { uid, showToast,compressImage  } from './utils.js';
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
export async function saveTool() {
    console.log("--- SAVING TOOL ---");
    
    // 1. Grab values directly from the modal IDs
    const idField = document.getElementById('tool-edit-id');
    const nameField = document.getElementById('tool-name');
    const catField = document.getElementById('tool-cat');
    const locField = document.getElementById('tool-loc');
    const healthField = document.getElementById('tool-health');
    const lostField = document.getElementById('tool-lost');

    if (!nameField || !nameField.value.trim()) {
        alert("Please enter a tool name");
        return;
    }

    // 2. Build the record. New tools default to 'available' (this is a
    // Main Inventory save, not a wishlist request) - without this, the
    // 'tool_requests' table's own default status ('pending') was being
    // used instead, silently routing brand-new tools into the Wishlist
    // tab where they'd never show up in Main Inventory.
    const isNewTool = !(idField.value && idField.value !== "");
    const toolId = isNewTool ? uid() : idField.value;
    const existing = isNewTool ? null : window.state.tools.find(t => String(t.id) === String(toolId));

    const record = {
        id: toolId,
        name: nameField.value.trim(),
        tool_name: nameField.value.trim(), // Support both column names
        category: catField.value,
        location: locField.value.trim(),
        health: ({good: 100, repair: 40, out: 0, missing: 0})[document.getElementById('tool-condition')?.value] ?? 100,
        is_lost: document.getElementById('tool-condition')?.value === 'missing',
        status: 'available',
        last_updated: new Date().toISOString()
    };

    try {
        // 3. Save to Supabase (Ensure you use 'supabase' or 'window._mpdb')
        const { error } = await window._mpdb.from('tool_requests').upsert(record);
        if (error) throw error;

        // 4. Update Local Memory
        const idx = window.state.tools.findIndex(t => t.id === toolId);
        if (idx !== -1) window.state.tools[idx] = {...window.state.tools[idx], ...record};
        else window.state.tools.push(record);

        // 5. Cleanup
        window.closeModal('tool-modal');
        if (typeof window.renderTools === 'function') window.renderTools();
        window.showToast("Tool saved ✓");

    } catch (e) {
        console.error("Save Tool Error:", e);
        alert("Save failed: " + e.message);
    }
}

// 3. Delete a Tool
export async function deleteTool(id = document.getElementById('tool-edit-id')?.value, state = window.state) {
    if (!id) return;
    if (!confirm("Are you sure you want to permanently delete this tool?")) return;
    try {
        const { error } = await supabase.from('tool_requests').delete().eq('id', id);
        if (error) throw error;
        state.tools = state.tools.filter(t => t.id !== id);
        showToast("Tool deleted");
        closeModal('tool-modal'); renderTools();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// 4. Handle Tool Observations (Notes) - Merged version of your duplicates
export async function addToolNote() {
    // 1. Grab the ID from the hidden input in the modal
    const idField = document.getElementById('tool-edit-id');
    const toolId = idField ? idField.value : null;
    
    // 2. Grab the text from the textarea
    const input = document.getElementById('tool-obs-input') || document.getElementById('tool-notes-input');
    const body = input ? input.value.trim() : "";

    // 3. VITAL CHECK: If no ID or no text, STOP here
    if (!toolId) {
        alert("Error: Cannot add a note to a tool that hasn't been saved yet.");
        return;
    }
    if (!body) return;

    // 4. Build the note
    const newNote = {
       id: uid(),
        equip_id: toolId, // Supabase needs this column filled
        author: window.currentUser.name || window.currentUser.username,
        body: body,
        severity: 'info',
        created_at: new Date().toISOString()
    };

    try {
        console.log("Sending tool note:", newNote);
        
        // 5. Save to Supabase
        const { error } = await window._mpdb
            .from('observations')
            .insert([newNote]);

        if (error) throw error;

        // 6. Update Local Memory
        if (!window.state.observations) window.state.observations = [];
        window.state.observations.unshift(newNote);

        // 7. UI Cleanup
        if (input) input.value = "";
        if (typeof window.renderToolObsList === 'function') {
            window.renderToolObsList();
        }
        window.showToast("Note added ✓");

    } catch (e) {
        console.error("Supabase Save Error:", e.message);
        alert("Failed to save note: " + e.message);
    }
}
// 5. The function that was causing your error! (Merged version)
export async function deleteToolObservation(id) {
    // 1. CONFIRMATION
    if (!confirm("Are you sure you want to permanently delete this note?")) return;

    // 2. DATA CHECK: Ensure we can see the master folder
    const state = window.state;
    if (!state || !state.observations) {
        console.error("Master state or observations list missing!");
        return;
    }

    try {
        // 3. DELETE FROM SUPABASE
        const { error } = await window._mpdb
            .from('observations')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 4. UPDATE LOCAL MEMORY
        // This is the line that was crashing before!
        state.observations = state.observations.filter(o => o.id !== id);

        // 5. REFRESH THE UI
        if (typeof window.renderToolObsList === 'function') {
            window.renderToolObsList();
        }
        
        window.showToast("Note deleted ✓");

    } catch (e) {
        console.error("Delete failed:", e);
        alert("Error: Could not remove note from database.");
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

const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function conditionOf(tool) {
    if (tool.is_lost) return { label: 'Missing', key: 'missing' };
    const health = Number(tool.health ?? 100);
    if (health <= 0) return { label: 'Out of Service', key: 'out' };
    if (health < 75) return { label: 'Needs Repair', key: 'repair' };
    return { label: 'Good', key: 'good' };
}
const inventoryTool = t => ['available','In Shop','Checked Out',''].includes(t.status ?? '');
function renderToolSummary() {
    const el = document.getElementById('tool-summary');
    if (!el) return;
    const all = (window.state?.tools || []).filter(inventoryTool);
    const attention = all.filter(t => conditionOf(t).key !== 'good').length;
    const pending = (window.state?.tools || []).filter(t => ['requested','pending'].includes(t.status)).length;
    el.innerHTML = `<span><b>${all.length}</b> tools listed</span><span><b>${attention}</b> need attention</span><span><b>${pending}</b> wishlist requests pending</span>`;
}
export function filterToolInventory() { renderTools(); }
export function prepareNewWish() {
    document.getElementById('wish-edit-id').value = '';
    document.getElementById('wish-name').value = '';
    document.getElementById('wish-reason').value = '';
    document.getElementById('wish-modal-title').textContent = 'Suggest a Tool';
    document.getElementById('wish-submit-btn').textContent = 'Submit';
    const del = document.getElementById('btn-delete-wish'); if (del) del.style.display = 'none';
    openModal('wishlist-modal');
}
export async function remindToolWish(id) {
    const request = (window.state?.tools || []).find(t => String(t.id) === String(id));
    if (!request || !['requested','pending'].includes(request.status)) return;
    if (!confirm(`Mark "${request.tool_name || request.name}" as still needed?`)) return;
    try {
        const timestamp = new Date().toISOString();
        const { error } = await supabase.from('tool_requests').update({last_updated: timestamp}).eq('id',id);
        if (error) throw error;
        request.last_updated = timestamp;
        renderToolWishlist(); showToast('Request marked still needed ✓');
    } catch(e) { console.error(e); alert('Could not update reminder: ' + e.message); }
}
export async function reviewToolWish(id, action) {
    if (!['ordered','denied'].includes(action)) return;
    const req = (window.state?.tools || []).find(t => String(t.id) === String(id));
    if (!req || !['requested','pending'].includes(req.status)) return;
    if (!['admin','manager'].includes(window.currentUser?.role)) { showToast('Manager approval required'); return; }
    const reason = action === 'denied' ? prompt('Reason for denial:') : '';
    if (action === 'denied' && (reason === null || !reason.trim())) return;
    if (action === 'ordered' && !confirm(`Approve and mark "${req.tool_name || req.name}" as on order?`)) return;
    const patch = {status: action, denial_reason: action === 'denied' ? reason.trim() : null, last_updated: new Date().toISOString()};
    try {
        const {error} = await supabase.from('tool_requests').update(patch).eq('id',id);
        if(error) throw error;
        Object.assign(req,patch);
        renderToolWishlist(); renderToolDeniedHistory(); renderToolSummary();
        showToast(action === 'ordered' ? 'Request approved / on order ✓' : 'Request denied ✓');
    } catch(e) { console.error(e); alert('Review failed: ' + e.message); }
}
export function renderTools() {
    const tableBody = document.getElementById('tools-table-body');
    if (!tableBody) return;
    renderToolSummary();
    const query = (document.getElementById('tool-inventory-search')?.value || '').trim().toLowerCase();
    const condition = document.getElementById('tool-condition-filter')?.value || 'all';
    const inventory = (window.state?.tools || []).filter(inventoryTool).filter(t => {
        const matchesQuery = [t.tool_name,t.name,t.category,t.location].some(value => String(value || '').toLowerCase().includes(query));
        return matchesQuery && (condition === 'all' || conditionOf(t).key === condition);
    });
    tableBody.innerHTML = inventory.length ? inventory.map(t => {
        const status = conditionOf(t);
        return `<tr id="tool-row-${htmlEscape(t.id)}" onclick="window.editTool('${htmlEscape(t.id)}')" style="cursor:pointer">
            <td data-label="Tool Name"><b>${htmlEscape(t.tool_name || t.name || 'Unnamed')}</b></td>
            <td data-label="Category">${htmlEscape(t.category || 'Other')}</td>
            <td data-label="Location">${htmlEscape(t.location || '—')}</td>
            <td data-label="Condition"><span class="tool-condition-pill tool-condition-${status.key}">${status.label}</span></td>
            <td data-label="Action">Edit ›</td>
        </tr>`;
    }).join('') : '<tr><td colspan="5" style="text-align:center;padding:24px;color:#777">No matching tools.</td></tr>';
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

export function resetToolForm() {
    document.getElementById('tool-edit-id').value = '';
    document.getElementById('tool-modal-title').textContent = 'Add New Tool';
    document.getElementById('tool-name').value = '';
    document.getElementById('tool-cat').value = 'Hand Tool';
    document.getElementById('tool-loc').value = '';
    document.getElementById('tool-condition').value = 'good';
    const del = document.getElementById('tool-delete-btn'); if(del) del.style.display = 'none';
}
export async function editTool(id) {
    const tool = (window.state?.tools || []).find(x => String(x.id) === String(id));
    if(!tool) return;
    openModal('tool-modal');
    if(typeof window.switchToolModalTab === 'function') window.switchToolModalTab('details');
    document.getElementById('tool-edit-id').value = tool.id;
    document.getElementById('tool-modal-title').textContent = 'Edit: ' + (tool.tool_name || tool.name);
    document.getElementById('tool-name').value = tool.tool_name || tool.name || '';
    document.getElementById('tool-cat').value = tool.category || 'Other';
    document.getElementById('tool-loc').value = tool.location || '';
    document.getElementById('tool-condition').value = conditionOf(tool).key;
    const del = document.getElementById('tool-delete-btn'); if(del) del.style.display = 'block';
}
export async function editToolObservation(obsId) {
    // 1. Find the existing note in your Master State
    const note = window.state.observations.find(o => o.id === obsId);
    if (!note) {
        console.error("Note not found in memory.");
        return;
    }

    // 2. Permission Check: Only the author or a manager can edit
    const isManager = window.currentUser.role === 'admin' || window.currentUser.role === 'manager';
    const isAuthor = note.author === window.currentUser.name || note.author === window.currentUser.username;
    
    if (!isManager && !isAuthor) {
        alert("Access Denied: You can only edit notes that you created.");
        return;
    }

    // 3. Prompt the user for the new text
    const edited = prompt('Edit your note:', note.body || '');
    if (edited === null) return; // User pressed 'Cancel'
    
    const body = edited.trim();
    if (!body || body === note.body) return; // Stop if empty or no change made

    try {
        // 4. Update Supabase
        const { error } = await window._mpdb
            .from('observations')
            .update({ body: body })
            .eq('id', obsId);

        if (error) throw error;

        // 5. Update Local Memory so it updates without a refresh
        note.body = body;

        // 6. Refresh the list inside the Tool Modal
        if (typeof window.renderToolObsList === 'function') {
            window.renderToolObsList();
        }

        window.showToast('Note updated ✓');
    } catch (e) {
        console.error('Edit failed:', e);
        window.showToast('Update failed. Check connection.');
    }
}

export function renderToolObsList() {
    // 1. Grab the ID of the tool currently being edited
    const idField = document.getElementById('tool-edit-id');
    const toolId = idField ? idField.value : null;
    const container = document.getElementById('tool-obs-list');
    
    if(!toolId || !container) return;

    const isManager = window.currentUser.role === 'admin' || window.currentUser.role === 'manager';

    // 2. Filter notes for this tool (Check both tool_id and equip_id columns)
    const obs = (window.state.observations || []).filter(o => o.tool_id === toolId || o.equip_id === toolId);
    
    // 3. Sort newest first
    const sortedObs = [...obs].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    // 4. Build the HTML
    container.innerHTML = sortedObs.length ? sortedObs.map(o => {
        const isAuthor = o.author === (window.currentUser.name || window.currentUser.username);
        const canControl = isManager || isAuthor;

        return `
        <div class="note-card" style="background:rgba(0,0,0,0.03); padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #eee;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <div style="font-weight:bold; font-size:12px; color:#555;">👤 ${o.author}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:10px; color:#999;">${new Date(o.created_at).toLocaleDateString()}</span>
                    ${canControl ? `
                        <button onclick="window.editToolObservation('${o.id}')" style="background:none; border:none; color:blue; cursor:pointer; font-size:11px;">Edit</button>
                        <button onclick="window.deleteToolObservation('${o.id}')" style="background:none; border:none; color:red; cursor:pointer; font-size:11px;">✕</button>
                    ` : ''}
                </div>
            </div>
            <div style="font-size:13px; color:black;">${o.body}</div>
        </div>`;
    }).join('') : `<div style="color:#aaa; font-size:13px; padding:40px 20px; text-align:center; font-style:italic;">No notes recorded for this tool.</div>`;
}

export async function saveWishRequest() {
    const editId = document.getElementById('wish-edit-id').value;
    const rawName = document.getElementById('wish-name').value.trim();
    const reason = document.getElementById('wish-reason').value.trim();
    if(!rawName || !reason) return alert('Enter the tool name and reason.');
    const existing = editId ? (window.state?.tools || []).find(t => String(t.id) === String(editId)) : null;
    if (existing && !['requested','pending'].includes(existing.status)) return alert('Only pending requests may be edited.');
    const user = window.currentUser || {};
    const req = {
        ...(existing || {}),
        id: existing?.id || uid(),
        name: rawName, tool_name: rawName, request_reason: reason, notes: reason,
        requested_by: existing?.requested_by || user.full_name || user.name || user.username || 'Unknown',
        author_id: existing?.author_id || String(user.id || ''),
        status: existing?.status || 'requested',
        created_at: existing?.created_at || new Date().toISOString(),
        last_updated: new Date().toISOString()
    };
    // Only send known writable fields: fetched records may contain generated DB fields.
    const allowed = ['id','name','tool_name','request_reason','notes','requested_by','author_id','status','created_at','last_updated'];
    const payload = Object.fromEntries(allowed.filter(k => k in req).map(k => [k,req[k]]));
    try {
        const { error } = await window._mpdb.from('tool_requests').upsert(payload);
        if(error) throw error;
        showToast('Tool request saved ✓');
        closeModal('wishlist-modal');
        await fetchTools(); renderToolWishlist(); renderToolSummary();
    } catch(e) { console.error('Wishlist error', e); alert('Could not save request: ' + e.message); }
}
export function renderToolDeniedHistory() {
    const body = document.getElementById('denied-table-body');
    if (!body) return;
    const items = (window.state?.tools || []).filter(t => t.status === 'denied' || (t.status === 'available' && !!t.requested_by));
    body.innerHTML = items.length ? items.map(t => `<tr>
        <td data-label="Tool Name"><b>${htmlEscape(t.tool_name || t.name)}</b></td>
        <td data-label="Requested By">${htmlEscape(t.requested_by || '—')}</td>
        <td data-label="Reason / Outcome">${htmlEscape(t.status === 'denied' ? (t.denial_reason || 'Denied') : 'Purchased / received into inventory')}</td>
        <td data-label="Status"><span class="tool-condition-pill ${t.status === 'denied' ? 'tool-condition-out':'tool-condition-good'}">${t.status === 'denied' ? 'Denied' : 'Received'}</span></td>
    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:#888">No completed wishlist requests yet.</td></tr>';
}

export async function receiveOrderedTool(id) {
    const item = (window.state?.tools || []).find(t => String(t.id) === String(id));
    if(!item || item.status !== 'ordered') return;
    if(!['admin','manager'].includes(window.currentUser?.role)) return alert('Manager approval required.');
    if(!confirm('Confirm this ordered tool has arrived and add it to inventory?')) return;
    try {
        const patch={status:'available', location:'Main Tool Crib', health:100, is_lost:false, last_updated:new Date().toISOString()};
        const {error}=await window._mpdb.from('tool_requests').update(patch).eq('id', id);
        if(error) throw error;
        Object.assign(item,patch);
        renderTools(); renderToolWishlist(); showToast('Tool received into inventory ✓');
    } catch(e) {console.error(e); alert('Could not receive tool: '+e.message);}
}

export  async function deleteWishItem(id) {
    // If no ID passed, try to grab it from the hidden input in the modal
    const targetId = id || document.getElementById('wish-edit-id').value;
    
    if (!targetId) return;

    if (!confirm("Are you sure you want to delete this tool suggestion?")) return;

    try {
        const { error } = await window._mpdb
            .from('tool_requests')
            .delete()
            .eq('id', targetId);

        if (error) throw error;

        showToast("Request removed ✓");
        closeModal('wishlist-modal');
        closeModal('review-modal');

        // Sync local memory and UI
        window.state.tools = window.state.tools.filter(t => t.id !== targetId);
        renderToolWishlist();

    } catch (e) {
        alert("Delete failed: " + e.message);
    }
};

export function openWishDetailCard(id) {
    console.log("--- Opening Wishlist Detail Card ---");
    
    try {
        const item = window.state.tools.find(t => t.id === id);
        if (!item) return;

        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
        const isAuthor = String(item.author_id) === String(currentUser.id);

        // Open the Modal
        openModal('wishlist-modal');

        // Fill Fields
        document.getElementById('wish-edit-id').value = item.id;
        document.getElementById('wish-name').value = item.tool_name || item.name || "";
        document.getElementById('wish-reason').value = item.request_reason || item.notes || "";
        
        // Update Labels
        document.getElementById('wish-modal-title').textContent = "✎ Edit Suggestion";
        document.getElementById('wish-submit-btn').textContent = "Update";

        // THE BUTTON VISIBILITY FIX
        const delBtn = document.getElementById('btn-delete-wish');
        if (delBtn) {
            if (isAdmin || isAuthor) {
                // We use 'block' and force it visible
                delBtn.style.setProperty('display', 'block', 'important');
                delBtn.style.visibility = 'visible';
            } else {
                delBtn.style.display = 'none';
            }
        } // End of delBtn check
    } catch (err) {
        console.error("Crash inside openWishDetailCard:", err);
    }
}; 

// Legacy compatibility: checkout tracking is intentionally disabled.
export function toggleToolStatus() { showToast('Use the tool condition field to update shared tools.'); }

export function renderToolWishlist() {
    const body = document.getElementById('wishlist-table-body'); if(!body) return;
    renderToolSummary();
    const user=window.currentUser||{};
    const manager=['admin','manager'].includes(user.role);
    const items=(window.state?.tools||[]).filter(t=>['requested','pending','ordered','approved'].includes(t.status));
    body.innerHTML = items.length ? items.map(t=> {
        const isPending=['requested','pending'].includes(t.status);
        const by=htmlEscape(t.requested_by||'—');
        const reminder=t.last_updated ? new Date(t.last_updated).toLocaleDateString() : '—';
        const actions=isPending ? `<button class="btn btn-sm" onclick="event.stopPropagation();window.remindToolWish('${htmlEscape(t.id)}')">Still Needed</button> ${manager ? `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();window.reviewToolWish('${htmlEscape(t.id)}','ordered')">Approve / Order</button> <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();window.reviewToolWish('${htmlEscape(t.id)}','denied')">Deny</button>` : ''}` : (t.status==='ordered' ? `<button class="btn btn-sm" onclick="event.stopPropagation();window.receiveOrderedTool('${htmlEscape(t.id)}')">Received</button>` : '—');
        return `<tr style="cursor:${isPending?'pointer':'default'}" ${isPending?`onclick="window.openWishDetailCard('${htmlEscape(t.id)}')"`:''}>
         <td data-label="Tool Name"><b>${htmlEscape(t.tool_name||t.name)}</b><div style="font-size:11px;color:#777">${htmlEscape(t.request_reason||t.notes||'')}</div></td>
         <td data-label="Requested By">${by}</td>
         <td data-label="Status"><span class="tool-condition-pill">${isPending?'Pending':t.status==='ordered'?'On Order':'Approved'}</span></td>
         <td data-label="Last Activity">${htmlEscape(reminder)}</td>
         <td data-label="Actions">${actions}</td></tr>`;
    }).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No outstanding requests.</td></tr>';
}
export async function receiveTool() {
    const id = document.getElementById('tool-edit-id').value;
    if(!id) return;

    try {
        showToast("Checking in tool...");
        const { error } = await window._mpdb
            .from('tool_requests')
            .update({ 
                status: 'available', 
                location: 'Main Tool Crib', // Set a default location
                health: 100,
                last_updated: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        // Update local state
        const idx = state.tools.findIndex(t => t.id === id);
        if(idx > -1) {
            state.tools[idx].status = 'available';
            state.tools[idx].health = 100;
        }

        closeModal('tool-modal');
        renderTools();
        showToast("Tool is now in inventory! ✓");
    } catch (e) {
        console.error(e);
        showToast("Update failed");
    }
}
