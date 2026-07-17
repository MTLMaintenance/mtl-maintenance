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

    // 2. Build the record
    const toolId = (idField.value && idField.value !== "") ? idField.value : uid();
    const record = {
        id: toolId,
        name: nameField.value.trim(),
        tool_name: nameField.value.trim(), // Support both column names
        category: catField.value,
        location: locField.value.trim(),
        health: parseInt(healthField.value) || 100,
        is_lost: lostField ? lostField.checked : false,
        last_updated: new Date().toISOString()
    };

    try {
        // 3. Save to Supabase (Ensure you use 'supabase' or 'window._mpdb')
        const { error } = await window._mpdb.from('tool_requests').upsert(record);
        if (error) throw error;

        // 4. Update Local Memory
        const idx = window.state.tools.findIndex(t => t.id === toolId);
        if (idx !== -1) window.state.tools[idx] = record;
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

export function renderTools() {
    const tableBody = document.getElementById('tools-table-body');
    if (!tableBody) return;

    // Filter tools from the master state
    const inventory = (window.state.tools || []).filter(t => 
        t.status === 'available' || t.status === 'ordered' || !t.status
    );

    if (inventory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">No tools in inventory.</td></tr>';
        return;
    }

    // Map through the filtered 'inventory' list
    tableBody.innerHTML = inventory.map(t => {
        const name = t.tool_name || t.name || 'Unnamed';
        const health = t.health || 100;
        const status = t.status || 'available';
        const location = t.location || '—';
        const isOrdered = status === 'ordered';

        return `
            <tr onclick="window.editTool('${t.id}')" style="cursor:pointer; ${isOrdered ? 'background:rgba(0,123,255,0.05);' : ''}">
                <td data-label="Tool Name"><b>${name}</b></td>
                <td data-label="Category">${t.category || 'Other'}</td>
                <td data-label="Location">${isOrdered ? '📦 ON ORDER' : location}</td>
                <td data-label="Condition">
                    <div style="width:60px; height:8px; background:#ddd; border-radius:4px; overflow:hidden;">
                        <div style="width:${health}%; height:100%; background:${health > 40 ? '#28a745' : '#dc3545'};"></div>
                    </div>
                </td>
                <td data-label="Status"><span class="badge ${isOrdered ? 'bi' : 'bs'}">${status.toUpperCase()}</span></td>
                <td data-label="Procurement">${t.procurement || '—'}</td>
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

export function resetToolForm() {
    console.log("Resetting Tool Form Safely...");
    
    // 1. Reset the Title so it doesn't say "Edit" when adding a new tool
    const titleEl = document.getElementById('tool-modal-title');
    if (titleEl) titleEl.textContent = 'Add New Tool';

    // 2. THE FIX: Hide the delete button when adding new
    const deleteBtn = document.getElementById('tool-delete-btn');
    if (deleteBtn) deleteBtn.style.display = 'none'; 

    // 3. List of IDs based on your HTML
    const fieldIds = [
        'tool-edit-id', // Clears the hidden ID
        'tool-name', 
        'tool-cat',     // Matches HTML
        'tool-loc',     // Matches HTML
        'tool-health'   // Matches HTML
    ];

    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id === 'tool-health') ? '100' : ''; 
    });

    // Reset health text
    const condVal = document.getElementById('cond-val');
    if (condVal) condVal.textContent = '100%';

    // Reset checkbox
    const lostCheck = document.getElementById('tool-lost');
    if (lostCheck) lostCheck.checked = false;
}
 export async function editTool(id) {
    console.log("Editing Tool ID:", id);

    // 1. Find the specific tool in your Master State
    const tool = window.state.tools.find(x => x.id === id);

    // 2. SAFETY CHECK: If it can't find it, stop before crashing
    if (!tool) {
        console.error("Could not find tool with ID:", id);
        return;
     const idInput = document.getElementById('tool-edit-id');
    if (idInput) idInput.value = tool.id; 
    }

    // 3. Open the Modal UI
    window.openModal('tool-modal');
    if (typeof window.switchToolModalTab === 'function') window.switchToolModalTab('details');

    // 4. Populate the Form Fields (Using the IDs from your HTML)
    const idInput = document.getElementById('tool-edit-id');
    if (idInput) idInput.value = tool.id;

    document.getElementById('tool-modal-title').textContent = 'Edit: ' + (tool.tool_name || tool.name);
    document.getElementById('tool-name').value = tool.tool_name || tool.name || '';
    document.getElementById('tool-cat').value = tool.category || 'Other';
    document.getElementById('tool-loc').value = tool.location || '';
    document.getElementById('tool-health').value = tool.health || 100;
    
    const condVal = document.getElementById('cond-val');
    if (condVal) condVal.textContent = (tool.health || 100) + '%';
    
    document.getElementById('tool-lost').checked = !!tool.is_lost;

    // 5. Show the Delete Button
    const delBtn = document.getElementById('tool-delete-btn');
    if (delBtn) delBtn.style.display = 'block';
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

    if (!rawName || !reason) return alert("Fill in name and reason.");

    const existing = editId ? state.tools.find(t => t.id === editId) : null;
    const isEdit = !!existing;

    const req = {
        id: (editId && editId !== "") ? editId : uid(),
        name: rawName,
        tool_name: rawName,
        request_reason: reason, 
        notes: reason,
        requested_by: existing ? existing.requested_by : (currentUser.full_name || currentUser.username),
        author_id: existing ? existing.author_id : String(currentUser.id), 
        status: 'requested',
        created_at: existing ? existing.created_at : new Date().toISOString()
    };

    try {
        const { error } = await window._mpdb.from('tool_requests').upsert([req]);
        if (error) throw error;

        // --- ACCOUNTABILITY LOGGING ---
        if (typeof logAuditAction === 'function') {
            const action = isEdit ? "Updated Wishlist Item" : "New Wishlist Request";
            const details = `Tool: "${req.name}", Reason: "${req.request_reason}" (Requested by: ${req.requested_by})`;
            
            await logAuditAction(action, details);
        }
        // ------------------------------

        showToast("Saved successfully ✓");
        closeModal('wishlist-modal');
        
        await fetchTools();
        renderToolWishlist();
        
        document.getElementById('wish-edit-id').value = "";

    } catch (e) { 
        console.error("Wishlist Error:", e);
        alert("Error: " + e.message); 
    }
}
window.renderToolDeniedHistory = function() {
    const list = document.getElementById('denied-table-body');
    if (!list) return;

    const items = window.state.wishlist.filter(item => item.status === 'denied');

    if (items.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#999;">No history found.</td></tr>';
        return;
    }

    list.innerHTML = items.map(item => `
        <tr>
            <td><b>${item.tool_name}</b></td>
            <td>${item.category}</td>
            <td style="color:#dc3545; font-size:12px;">${item.denial_reason || 'No reason provided'}</td>
            <td><span class="badge bg">Denied</span></td>
        </tr>
    `).join('');
};

export  async function receiveOrderedTool(id) {
    if (!confirm("Confirm this tool has arrived and is now in inventory?")) return;

    await window._mpdb.from('tool_requests').update({ 
        status: 'available', 
        location: 'Main Crib', 
        health: 100 
    }).eq('id', id);

    await fetchTools();
    renderTools();
    renderToolWishlist();
    showToast("Tool checked in ✓");
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

export async function toggleToolStatus(id) {
  const t = state.tools.find(x => x.id === id);
  if (t.status === 'In Shop') {
    t.status = 'Checked Out';
    t.checked_out_by = currentUser.name;
  } else {
    t.status = 'In Shop';
    t.checked_out_by = null;
  }
  t.last_updated = new Date().toISOString();
  await persist('shop_tools', 'upsert', t);
  renderTools();
}  

window.renderToolWishlist = function() {
    const list = document.getElementById('wishlist-table-body');
    if (!list) return;

    // Use the global window.state
    const items = window.state.wishlist.filter(item => item.status === 'pending');
    
    // Update the notification badge in the UI
    const badge = document.getElementById('wish-count');
    if (badge) {
        badge.innerText = items.length;
        badge.style.display = items.length > 0 ? 'inline-block' : 'none';
    }

    if (items.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#999;">No pending requests.</td></tr>';
        return;
    }

    list.innerHTML = items.map(item => `
        <tr onclick="window.openWishlistReview('${item.id}')">
            <td><b>${item.tool_name}</b></td>
            <td>${item.category}</td>
            <td>${item.user_name || 'Unknown'}</td>
            <td><span class="badge bw">Pending Review</span></td>
        </tr>
    `).join('');
};
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
