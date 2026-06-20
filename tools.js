// tools.js - Tool Crib, Wishlist, and Tool Notes
import { supabase, persist } from './db.js';
import { uid, showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';

// 1. Fetch all tools from the database
export async function fetchTools(state) {
    try {
        const { data, error } = await supabase.from('tool_requests').select('*');
        if (error) throw error;
        state.tools = data || [];
        return state.tools;
    } catch (err) {
        console.error("Fetch tools failed:", err);
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
